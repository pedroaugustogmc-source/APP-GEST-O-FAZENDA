# PARTE V — O BOT EM DETALHE

## 30. Prompt de sistema do bot — versão de referência

Você vai entregar este prompt finalizado em `src/infra/claude/prompts/extrator.ts`, versionado (`PROMPT_VERSION`), e **gravar a versão usada em cada linha de `mensagens_bot`** — para que uma mudança futura de prompt não corrompa a interpretação do histórico.

```
Você é o extrator de dados de campo de uma fazenda de cria-recria no sul do Maranhão.
Recebe a transcrição de uma nota de voz de um vaqueiro e devolve APENAS JSON válido,
sem markdown, sem comentário, sem texto fora do JSON.

CONTEXTO INJETADO (dinâmico, montado pelo servidor):
- data_recebimento: {ISO, America/Fortaleza}
- usuario: {nome, papel}
- pastos_cadastrados: [{id, nome, apelidos}]
- lotes_ativos: [{id, nome, categoria, pasto_atual, cabecas}]
- maquinas: [{id, nome, modelo}]
- vacinas_permitidas: [{nome, bloqueada, motivo_bloqueio}]
- insumos: [{id, nome, unidade}]

REGRAS:
1. NUNCA invente valor. Campo não dito = null e entra em campos_faltantes.
2. Uma mensagem pode conter VÁRIOS eventos. Devolva todos.
3. Resolva datas relativas contra data_recebimento ("ontem", "sábado passado",
   "semana retrasada"). Se não houver data, use data_recebimento e confianca <= 0.8.
4. Resolva nome de pasto/lote/máquina por similaridade contra o contexto injetado.
   Se houver mais de um candidato plausível, NÃO escolha: devolva
   pergunta_de_esclarecimento com as opções.
5. Converta linguagem aproximada em número com confiança menor:
   "uns 40 bicho" -> cabecas: 40, confianca: 0.7.
   "meio açude", "pela metade" -> nivel_acude: 50, confianca: 0.7.
   "tá quase secando" -> nivel_acude: 15, confianca: 0.5.
6. Unidades: peso em kg; se o vaqueiro falar em arroba, converta usando KG_POR_ARROBA
   do contexto e registre a conversão em observacao.
7. Dinheiro: devolva SEMPRE em centavos, inteiro.
8. Se a vacina citada estiver com bloqueada=true, gere evento tipo "bloqueio"
   com o motivo — NÃO gere vacinacao.
9. Sem julgamento clínico, sem recomendação veterinária, sem diagnóstico.
10. confianca é sua estimativa honesta de 0 a 1 sobre o evento INTEIRO.
    Prefira errar para baixo.

SAÍDA (schema exato):
{
  "eventos": [
    {
      "tipo": "pesagem|vacinacao|movimentacao_pasto|nivel_acude|manutencao|horas_maquina|
               despesa|receita|mortalidade|nascimento|reproducao|chuva|producao_leite|
               estoque|demanda|observacao|bloqueio",
      "confianca": 0.0,
      "data_do_fato": "YYYY-MM-DD|null",
      "dados": { },
      "campos_faltantes": ["..."],
      "pergunta_de_esclarecimento": "string|null"
    }
  ],
  "resumo_para_confirmacao": "uma frase curta, linguagem de campo, do que foi entendido"
}
```

## 31. Few-shots obrigatórios (use estes na implementação e acrescente mais)

| Entrada (fala real) | Saída esperada |
|---|---|
| "passei o lote dois pro pasto do buriti hoje de manhã, foram trinta e oito cabeça" | 1 evento `movimentacao_pasto` (lote 2 → pasto "Buriti", cabecas 38, data hoje, confiança alta) |
| "o açude do baixão tá pela metade e o gado tá bebendo muito" | 1 evento `nivel_acude` (50, confiança 0,7) + 1 `observacao` |
| "pesei a boiada do três, deu duzentos e dezoito de média, quarenta bicho" | 1 `pesagem` tipo `lote`, peso 218, n_animais 40 |
| "morreu um bezerro no pasto novo, acho que foi cobra" | 1 `mortalidade` (causa_suspeita "picada de cobra", confiança 0,6, `campos_faltantes: [brinco]`) |
| "rodei o trator vermelho seis hora hoje roçando" | 1 `horas_maquina` (6h, atividade "roçada") — se houver 2 tratores vermelhos, `pergunta_de_esclarecimento` |
| "comprei dez saco de sal a cento e vinte o saco" | 1 `despesa` (Alimentação/sal, 10 sacos, 12000 centavos/un, total 120000) + 1 `estoque` entrada |
| "vacinei as bezerra de brucelose, foram quinze, lote da vacina B dois três quatro" | 1 `vacinacao` com `lote_fabricacao: "B234"`, n_animais 15 |
| "vou vacinar de aftosa semana que vem" | 1 `bloqueio` com o aviso do MA — **nenhum registro sanitário criado** |
| "choveu bem ontem, uns quarenta milímetro" | 1 `chuva` (40 mm, data = ontem) |
| "precisa arrumar a cerca do pasto de cima, tem três palanque caído" | 1 `demanda` → vira `tarefa` com score calculado |
| "tirei cento e dez litro de leite hoje cedo" | 1 `producao_leite` (110 L, turno manhã) |
| áudio inaudível / ruído | 0 eventos, `status = 'revisao'`, resposta pedindo para repetir |

## 32. Validação semântica (barreira antes de gravar)

Antes de qualquer `insert`, rodar `src/domain/validacao/`:

| Checagem | Ação em caso de falha |
|---|---|
| Peso fora da faixa plausível **para a categoria** (ex.: bezerro > 300 kg) | não grava · pergunta ao remetente |
| Data do fato no futuro | não grava · pergunta |
| Data do fato anterior à entrada do lote/nascimento do animal | não grava · pergunta |
| Lote/pasto/máquina/insumo inexistente | não grava · devolve as opções mais próximas |
| Animal `morto`/`vendido` recebendo evento posterior à saída | não grava · alerta ao admin |
| Movimentação para pasto em `reforma` | não grava · sugere alternativa |
| GMD implícito absurdo (> 2,5 kg/dia ou negativo forte) | grava marcado como `revisao` |
| `cabecas` maior que o efetivo do lote | não grava · pergunta |
| Vacina bloqueada | não grava · aviso legal |
| Vacina fora da janela etária | não grava · explica a janela correta |
| Vacina incompatível no mesmo dia | não grava · sugere a data certa |
| Valor financeiro com ordem de grandeza atípica (> 10× a mediana da categoria) | grava marcado como `revisao` |

**Toda pergunta de esclarecimento é uma frase, no máximo, em português simples.** Nunca um formulário. Nunca duas perguntas juntas.

## 33. Custo e resiliência da API

- `mensagens_bot.custo_api_centavos` acumula o custo por mensagem; dashboard mostra custo/mês.
- Só transcrever depois de validar o remetente (§M1 passo 1).
- Cache do contexto injetado (pastos, lotes, máquinas) com invalidação por mudança — não remontar do banco a cada mensagem.
- Áudio acima de N minutos: avisar e processar em partes.
- Fila com retry exponencial (3 tentativas), depois fila morta + alerta.
- **Modo degradado:** se a API de IA estiver fora, o bot ainda grava a mensagem bruta e responde "recebi, vou processar assim que der". **Nada se perde.**

---
