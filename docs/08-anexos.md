# ANEXOS — MECANISMOS DE VERIFICAÇÃO

> Os anexos existem para que **eu consiga provar que a implementação está certa sem ler o código**, e para que **você consiga se auto-corrigir** antes de me entregar qualquer coisa.

---

## ANEXO A — GABARITO NUMÉRICO (fixture canônica)

**Este anexo é lei.** Os números abaixo foram calculados à mão e conferidos. Se a sua implementação divergir de qualquer valor aqui, **o errado é o código**. Este cenário deve virar o seed de desenvolvimento (`supabase/seed.sql`) e o teste de integração `tests/gabarito.spec.ts`.

### A.1. Cenário

```
Pasto:  "Baixão"   · 10,00 ha · capim Marandu · açude sim, nível 45%
Lote:   "RECRIA-01" · 40 garrotes · tipo_operacao = recria
        entrada 01/02/2026, peso médio de entrada 220,0 kg
Pesagem 02/05/2026 (90 dias depois), peso médio 265,0 kg

Parâmetros: UA_KG=450 · KG_POR_ARROBA=15 · RENDIMENTO_CARCACA=0,52
            CAP_UA_HA_MARANDU=1,8 · TOLERANCIA_LOTACAO=0,10
            TAXA_OPORTUNIDADE_MES=0,015 · GMD_META_RECRIA=0,500

Custeio do período (90 dias), lançado em `financeiro`, centro_custo = recria:
  Alimentação — sal mineral ....................... R$ 1.296,00
  Sanidade — clostridiose (40 doses) .............. R$   140,00
  Sanidade — vermífugo (40 doses) ................. R$   240,00
  Mão de obra (rateada) ........................... R$ 2.400,00
  Pastagem (rateada) .............................. R$   900,00
  Máquinas e combustível (rateado) ................ R$   500,00
  ────────────────────────────────────────────────────────────
  Custeio total ................................... R$ 5.476,00

Custo de CRIA transferido na entrada: R$ 1.850,00 por animal
Preço de mercado da praça (garrote, Imperatriz-MA): R$ 245,00/@
```

### A.2. Resultados esperados — o código tem que bater com isto

| Indicador | Fórmula (§9) | **Valor esperado** |
|---|---|---|
| GMD do lote | (265,0 − 220,0) / 90 | **0,500 kg/dia** (exatamente na meta) |
| Ganho total do lote | 45,0 × 40 | **1.800 kg** de peso vivo |
| Arrobas **produzidas** no período | (1.800 × 0,52) / 15 | **62,40 @** |
| **Custo por arroba produzida** | 5.476,00 / 62,40 | **R$ 87,76/@** |
| Arrobas de carcaça por animal na venda | (265,0 × 0,52) / 15 | **9,1867 @** |
| Arrobas totais do lote na venda | 9,1867 × 40 | **367,47 @** |
| Custo de entrada do lote | 1.850,00 × 40 | **R$ 74.000,00** |
| Custo acumulado total | 74.000,00 + 5.476,00 | **R$ 79.476,00** |
| **Ponto de equilíbrio** | 79.476,00 / 367,4667 | **R$ 216,28/@** |
| Distância do breakeven | (245,00 − 216,28) / 216,28 | **+13,28%** (semáforo verde) |
| Receita projetada | 367,4667 × 245,00 | **R$ 90.029,33** |
| Margem projetada do lote | 90.029,33 − 79.476,00 | **R$ 10.553,33** |
| Margem por cabeça | 10.553,33 / 40 | **R$ 263,83** |
| Margem por hectare | 10.553,33 / 10,00 | **R$ 1.055,33/ha** |

### A.3. Alerta de superlotação — mesma fixture

| Cálculo | Valor |
|---|---|
| Peso vivo total | 265,0 × 40 = **10.600 kg** |
| UA no pasto | 10.600 / 450 = **23,5556 UA** |
| Lotação | 23,5556 / 10,00 = **2,356 UA/ha** |
| Limite (1,8 × 1,10) | **1,980 UA/ha** |
| Dispara alerta? | 2,356 > 1,980 → **SIM, severidade crítica** |
| Peso vivo suportado a 1,8 UA/ha | 1,8 × 10 × 450 = **8.100 kg** |
| Excesso | 10.600 − 8.100 = **2.500 kg** |
| Sugestão exibida | 2.500 / 265 = 9,43 → **"mover 10 cabeças"** (arredondar **para cima**: subdimensionar a retirada mantém o pasto em risco) |

### A.4. Cotação com custo efetivo — 100 sacos de sal mineral

```
custo_efetivo = total_a_prazo ÷ (1 + 0,015)^(dias/30)
```

| Fornecedor | Condição | Total nominal | **Custo efetivo** |
|---|---|---|---|
| A | lista R$ 135,00/saco, **7% à vista** | 13.500,00 → paga 12.555,00 | **R$ 12.555,00** ← **vencedor** |
| B | R$ 128,00/saco, 30 dias | 12.800,00 | R$ 12.610,84 |
| C | R$ 130,00/saco, 60 dias | 13.000,00 | R$ 12.618,60 |

**Lição que o teste precisa provar:** o **menor preço nominal é B (R$ 12.800,00)**, mas o **vencedor real é A**, com economia de **R$ 55,84** sobre B. Um comparador que só olha preço de tabela erraria a compra. A tela deve exibir as duas colunas lado a lado e destacar essa inversão.

### A.5. Rateio de custo comum por UA-dia — mês de maio/2026

Custo comum de mão de obra: **R$ 6.000,00**. Dois lotes ativos, 30 dias cada:

| Lote | Cabeças × peso | UA | UA-dia | Fração | **Rateio** |
|---|---|---|---|---|---|
| RECRIA-01 | 40 × 265 kg | 23,5556 | 706,67 | 29,609% | **R$ 1.776,54** |
| CRIA-01 | 60 × 420 kg | 56,0000 | 1.680,00 | 70,391% | **R$ 4.223,46** |
| **Total** | | | **2.386,67** | 100% | **R$ 6.000,00** |

**Regra de fechamento obrigatória:** a soma dos rateios tem que fechar **exatamente** com o valor original. Arredonde todas as parcelas menos a maior e **atribua a diferença residual à maior**. Um teste deve provar que `Σ rateios == custo_original` para 1.000 combinações aleatórias.

---

## ANEXO B — CONTRATOS DE FUNÇÃO DO DOMÍNIO

Assinaturas fixas. Você pode acrescentar funções; **não pode mudar estas**. Todas puras, sem I/O, sem `Date.now()` interno (a data entra por parâmetro — é o que torna o teste determinístico).

```ts
// src/domain/tipos/index.ts
export type Centavos = bigint;
export type Kg = number;          // uma casa decimal
export type Arrobas = number;     // quatro casas internas, duas na exibição
export type ISODate = string;     // 'YYYY-MM-DD'

export interface Parametros {
  UA_KG: number; KG_POR_ARROBA: number; RENDIMENTO_CARCACA: number;
  TOLERANCIA_LOTACAO: number; TAXA_OPORTUNIDADE_MES: number;
  DIAS_DADO_VELHO: number; CONFIANCA_MINIMA_BOT: number;
  GMD_META_RECRIA: number; NIVEL_ACUDE_CRITICO: number;
  DIAS_DESCANSO_MINIMO: number; [k: string]: number;
}

/** Resultado que carrega a própria confiabilidade. Nenhum indicador trafega "pelado". */
export interface Indicador<T> {
  valor: T | null;
  n: number;                      // tamanho da amostra
  dataBase: ISODate | null;       // data do dado mais recente que o sustenta
  qualidade: 'firme' | 'estimativa_fraca' | 'sem_dado';
  motivo?: string;                // por que é fraca / por que não há dado
}
```

```ts
// src/domain/calculos/*.ts  — uma função por arquivo, com teste irmão *.spec.ts
export function gmd(pesoAnterior: Kg, pesoAtual: Kg, dias: number): Indicador<number>;
export function arrobasProduzidas(ganhoKg: Kg, p: Parametros): Arrobas;
export function arrobasCarcaca(pesoVivo: Kg, p: Parametros): Arrobas;
export function custoPorArroba(custo: Centavos, arrobas: Arrobas): Indicador<Centavos>;
export function pontoEquilibrio(custoAcumulado: Centavos, arrobasVenda: Arrobas): Indicador<Centavos>;
export function distanciaBreakeven(precoMercado: Centavos, pe: Centavos): number;
export function margemProjetada(receita: Centavos, custo: Centavos): Centavos;
export function unidadesAnimais(pesoVivoTotal: Kg, p: Parametros): number;
export function lotacaoUaHa(pesoVivoTotal: Kg, ha: number, p: Parametros): number;
export function avaliarLotacao(
  pesoVivoTotal: Kg, ha: number, capim: string, pesoMedio: Kg, p: Parametros
): { lotacao: number; limite: number; excede: boolean; cabecasAMover: number };
export function ratearPorUaDia(
  custo: Centavos,
  lotes: Array<{ id: string; pesoVivoTotal: Kg; dias: number }>,
  p: Parametros
): Array<{ id: string; valor: Centavos }>;   // Σ valor === custo, sempre
export function custoEfetivoCotacao(
  totalCentavos: Centavos, prazoDias: number, descontoAvistaPct: number, p: Parametros
): Centavos;
export function diasDeDescanso(saidaAnterior: ISODate | null, entradaNova: ISODate): number | null;
export function scoreTarefa(
  e: { impacto: number; urgencia: number; risco: number; custoNormalizado: number }
): { score: number; justificativa: string };
export function elegiveisParaVacina(
  animais: Array<{ id: string; sexo: 'M'|'F'; categoria: string; nascimento: ISODate | null }>,
  regra: RegraVacinal, hoje: ISODate
): { elegiveis: string[]; bloqueados: Array<{ id: string; motivo: string }> };
```

**Invariantes testáveis das assinaturas:** toda função que pode não ter dado retorna `Indicador<T>`, nunca `number | null` solto. Toda função que distribui dinheiro devolve parcelas que somam o total. Nenhuma lê relógio, banco ou ambiente.

---

## ANEXO C — COPY DECK DO BOT (texto exato)

A adoção do sistema depende mais destas frases do que da arquitetura. Português de campo: curto, concreto, sem "sistema", sem "registro", sem "erro".

| Situação | Texto exato |
|---|---|
| Confirmação de pesagem | `Anotado: lote 3 pesado hoje, média 218 kg, 40 cabeças.` |
| Confirmação de movimentação | `Anotado: lote 2 passou pro pasto Buriti hoje, 38 cabeças.` |
| Confirmação com dois fatos | `Anotei duas coisas: lote 2 foi pro Buriti (38 cabeças) e o açude tá em 50%.` |
| Confirmação de vacina | `Anotado: 15 bezerras vacinadas de brucelose hoje, lote B234.` |
| Confirmação de despesa | `Anotado: 10 sacos de sal, R$ 1.200,00 no total.` |
| Falta um dado | `Quantas cabeças foram?` |
| Nome ambíguo | `É o pasto Buriti ou o Buritizinho?` |
| Áudio ruim | `Não consegui entender direito. Pode mandar de novo?` |
| Valor implausível | `220 kg num bezerro tá fora do normal. Confere pra mim?` |
| Animal já saído | `Esse animal já foi dado como vendido. Quer que eu registre assim mesmo pro patrão conferir?` |
| Vacina bloqueada (aftosa) | `Vacina de aftosa não pode mais ser usada no Maranhão desde abril de 2024. Fala com o patrão e com o veterinário antes de qualquer coisa.` |
| Brucelose fora da janela | `Brucelose é só em fêmea de 3 a 8 meses. Essa aí tá fora da idade — não registrei.` |
| Incompatibilidade | `Clostridiose no mesmo dia da brucelose não pode. O certo é lá pro dia 15/06.` |
| Número não reconhecido | `Não reconheci esse número.` |
| Sem internet no envio (cliente) | `Guardado aqui. Vai sozinho quando pegar sinal.` |
| Sistema fora do ar | `Recebi. Vou anotar assim que der.` |
| Fim de semana (só admin) | `Resumo da semana tá pronto no app.` |

**Regras do copy:** uma pergunta por vez · nunca duas frases quando uma resolve · nunca expor nome de tabela, código de erro ou termo técnico · nunca culpar o usuário · sempre repetir o dado entendido de volta, para ele conferir de ouvido.

---

## ANEXO D — PROTOCOLO DE AVALIAÇÃO DO EXTRATOR

O prompt do bot vai mudar ao longo do tempo. Sem isto, cada melhoria arrisca quebrar silenciosamente o que já funcionava.

**D.1. Conjunto de ouro.** `tests/golden/` com no mínimo **60 transcrições reais ou realistas** rotuladas à mão com o JSON esperado. Composição obrigatória: 30 casos simples · 10 multi-evento · 5 ambíguos (devem pedir esclarecimento) · 5 implausíveis (devem recusar) · 5 fora de escopo (devem virar `observacao`) · 5 de áudio ruim/incompleto.

**D.2. Métricas por versão de prompt:**

| Métrica | Definição | Meta |
|---|---|---|
| Acurácia de tipo | eventos com `tipo` correto | ≥ 0,95 |
| Acurácia de campo | campos preenchidos corretamente | ≥ 0,92 |
| **Taxa de invenção** | campos preenchidos que **não** estavam na fala | **0,00 — falha dura** |
| Recall multi-evento | eventos capturados / esperados | ≥ 0,90 |
| Precisão de recusa | recusas corretas / recusas totais | ≥ 0,95 |
| Calibração | erro médio entre `confianca` e acerto real | ≤ 0,10 |

**D.3. Regra de promoção.** Nenhuma versão de prompt vai para produção sem rodar o conjunto de ouro inteiro e **empatar ou superar** a versão vigente em todas as métricas. Taxa de invenção acima de zero **bloqueia o deploy**, sem discussão.

**D.4. Ciclo de realimentação.** Toda mensagem que o admin corrigir na fila de revisão é candidata a entrar no conjunto de ouro. Uma tela permite promovê-la com um clique. **O sistema aprende com o erro que o dono já pagou para descobrir.**

---

## ANEXO E — PLANO DE ADOÇÃO HUMANA

O maior risco deste projeto **não é técnico**. É o vaqueiro não usar. Trate isto como requisito de produto, não como treinamento.

**Semana 0 — antes de qualquer coisa.** Escolher **um** vaqueiro (o mais receptivo, não necessariamente o mais antigo) como primeiro usuário. Sistema em produção com **um único usuário** por uma semana inteira.

**Cartão de bolso** (entregável da Fase 2, PDF A6 para imprimir e plastificar): **10 frases prontas** — exatamente as do §31 — com o título *"É só falar assim"*. Sem menu, sem comando, sem barra, sem palavra em inglês. Nada de "/start".

**Regra de ouro do primeiro mês:** o vaqueiro **nunca** recebe correção pública nem cobrança pelo bot. Erro dele é problema do parser, não dele. Toda mensagem mal interpretada vira caso de teste (Anexo D), não bronca.

**Marcos de adoção — medir, não supor:**

| Marco | Meta | Se não bater |
|---|---|---|
| Semana 1 | 1 usuário, ≥ 5 mensagens/dia | o problema é o copy (Anexo C), não a tecnologia |
| Semana 4 | ≥ 80% das mensagens processadas sem revisão | melhorar few-shots antes de escalar |
| Semana 8 | 2º e 3º usuários ativos | o primeiro vira quem ensina, não o dono |
| Mês 6 | planilha manual **abandonada** | esse é o verdadeiro critério de sucesso do projeto |

**Sinal de alarme:** se o dono estiver digitando dado que deveria vir do campo, o produto falhou — não importa quão bonito esteja o dashboard.

---

## ANEXO F — REGISTRO DE RISCOS

| # | Risco | Prob. | Impacto | Mitigação embutida no produto |
|---|---|---|---|---|
| R1 | Vaqueiro não adota; dado continua na cabeça dele | **Alta** | Crítico | Voz sem formulário · copy de campo (C) · cartão de bolso · piloto de 1 usuário (E) |
| R2 | Extração erra e grava dado errado sem ninguém ver | Média | Crítico | Validação semântica (§32) · limiar de confiança · fila de revisão · taxa de invenção zero (D) |
| R3 | Mensagem se perde por falta de sinal | **Alta** | Alto | Fila local · idempotência por `client_uuid` · modo degradado (§33) |
| R4 | Custo por arroba calculado errado → decisão de venda errada | Baixa | **Crítico** | Gabarito do Anexo A como teste obrigatório · fórmulas isoladas e testadas |
| R5 | Ex-funcionário mantém acesso | Baixa | Alto | Trabalhador sem canal de leitura, por arquitetura (§M11) · teste automatizado do invariante |
| R6 | Protocolo sanitário muda (regra estadual) | Média | Alto | Protocolo é **dado** em `vacinas_catalogo`, editável sem deploy (§M4) |
| R7 | Custo de API cresce sem controle | Média | Médio | Porteiro antes da transcrição · cache de contexto · custo por mensagem medido (Anexo I) |
| R8 | Projeção otimista demais por ignorar a seca | Média | Alto | 3 cenários obrigatórios com fator de estiagem (§M5) · anti-padrão nº 12 |
| R9 | Dono fica refém do sistema/fornecedor | Baixa | Alto | Exportação completa em formato aberto · plano de saída (§39) |
| R10 | Escopo incha e a Fase 1 nunca termina | **Alta** | Alto | Guarda de escopo (§0.2) · uma fase por resposta · Definition of Done (§42) |

Cada fase entregue deve reavaliar esta tabela e reportar mudanças de probabilidade.

---

## ANEXO G — FORMATAÇÃO, UNIDADES E ARREDONDAMENTO

**Regra mestra:** **calcule com precisão plena; arredonde só na exibição.** Arredondar no meio do caminho é como o Anexo A prova que o erro entra: usar `367,47 @` em vez de `367,4667 @` na receita muda o resultado de **R$ 90.029,33** para **R$ 90.030,15** — R$ 0,82 de diferença que vira centenas de reais numa fazenda inteira.

| Grandeza | Armazenamento | Exibição | Arredondamento |
|---|---|---|---|
| Dinheiro | `bigint` centavos | `R$ 1.234,56` | meio-para-cima, só na tela |
| Peso | `numeric(7,1)` kg | `265,0 kg` | 1 casa |
| Arroba | calculado | `9,19 @` | 4 casas internas, 2 na tela |
| GMD | `numeric(5,3)` | `0,500 kg/dia` | 3 casas |
| Área | `numeric(8,2)` ha | `10,00 ha` | 2 casas |
| UA/ha | calculado | `2,356 UA/ha` | 3 casas |
| Percentual | fração 0–1 | `+13,3%` | 1 casa |
| Data | `date` (UTC) | `dd/mm/aaaa` | — |
| Hora | `timestamptz` | `dd/mm/aaaa HH:mm` | `America/Fortaleza` |
| Nº de cabeças | `integer` | inteiro | **para cima** quando for sugestão de retirada |

Locale `pt-BR` em tudo: vírgula decimal, ponto de milhar, `Intl.NumberFormat('pt-BR')`. **Nunca** exibir número cru sem unidade. **Nunca** exibir `NaN`, `null`, `Infinity` ou `0` no lugar de ausência — o texto é `— sem dado —`.

---

## ANEXO H — PREPARAÇÃO DE COMPLIANCE (Fase 6)

Não emitimos documento oficial (§0.2). **Preparamos o dado** para que a emissão seja trivial e correta. Nas fases 1–5, apenas garantir que os campos existam e sejam preenchíveis.

| Necessidade | Campos que o sistema já precisa carregar | Onde |
|---|---|---|
| Trânsito de animais (GTA) | quantidade e categoria movimentada, origem, destino, data, finalidade, situação vacinal do lote | `movimentacoes_pasto`, `vacinas_aplicadas`, `lotes` |
| Comprovação de vacinação | animal/lote, vacina, data, dose, **lote de fabricação**, laboratório, validade, quem aplicou | `vacinas_aplicadas` (§M4) |
| Declaração de rebanho | efetivo por categoria e sexo em data de referência | `animais`, view `mv_efetivo_por_categoria` |
| Rastreabilidade individual (se exigida pelo comprador) | brinco, nascimento, mãe, movimentações, sanidade | `animais`, `reproducao` |
| Auditoria de frigorífico/comprador | histórico sanitário íntegro e rastreável por lote | `auditoria` + `vacinas_aplicadas` |
| Nota fiscal de produtor | valor, quantidade, categoria, comprador, data | `financeiro` tipo `receita` |

**Aviso obrigatório na tela deste módulo:** exigências, prazos e formatos de documentação agropecuária **mudam por estado e por período**. O sistema organiza o dado; a validação do que é exigido hoje é feita com a **AGED-MA** e com o contador/veterinário da propriedade. **Nunca afirme ao usuário que um documento está "em conformidade".**

---

## ANEXO I — MODELO DE CUSTO OPERACIONAL

O dono precisa saber quanto o sistema custa por mês para decidir se vale. Exiba isso, não esconda.

**Drivers a instrumentar desde a Fase 2** (medir de verdade, não estimar):

```
custo_mensal ≈ (mensagens_dia × dias × custo_por_mensagem)
             + hospedagem_fixa
             + banco_e_storage(áudios retidos)

custo_por_mensagem = transcrição(duração) + extração(tokens_contexto + tokens_saída)
```

**Controles obrigatórios de custo, todos já especificados:**

- Porteiro antes da transcrição (§M1) — mensagem de número inativo custa **zero**.
- Cache do contexto injetado (§33) — o maior bloco de tokens não é remontado a cada mensagem.
- Áudio longo processado em partes, com aviso.
- Retenção de áudio configurável (`RETENCAO_AUDIO_DIAS`); após o prazo, mantém transcrição e descarta o áudio.
- Painel de custo no admin: custo do mês, custo por mensagem, projeção do mês e **custo por cabeça gerenciada** — a métrica que responde "isso vale a pena?".

**Regra:** se o custo mensal do sistema passar de um teto configurável (`TETO_CUSTO_MENSAL_CENTAVOS`), o admin recebe alerta — **nunca** corte automático de serviço. Cortar a captura de dado por causa de custo é pior do que o custo.

---
