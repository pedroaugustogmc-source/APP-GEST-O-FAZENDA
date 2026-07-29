# PARTE IV — MÓDULOS FUNCIONAIS

> Cada módulo abaixo traz: caso de uso, adições sênior, stack, esforço e impacto. **Nenhum item pode ser cortado por "simplificação".** Se algo não couber na fase atual, declare em "o que ficou fora" (§39) — não delete.

## M1 — CAPTURA POR VOZ (o coração do sistema)

**Caso de uso:** qualquer pessoa autorizada da fazenda manda uma **nota de voz sobre qualquer uma das informações do sistema**, e o Claude **transcreve, categoriza e grava no banco**. No fim de cada semana, consolida tudo em relatório.

**Fluxo obrigatório (cada passo é um estado em `mensagens_bot`):**

1. **Porteiro.** Mensagem chega → valida o telefone em `usuarios_acesso` com `status='ativo'`. Se desconhecido ou inativo: resposta neutra ("não reconheci este número"), log, encerra. **Nada é baixado, transcrito ou processado** — isso protege custo de API e vaza zero informação sobre a existência do sistema.
2. **Registro bruto.** Grava em `mensagens_bot` com `client_uuid`. O áudio original é preservado.
3. **Transcrição.** Áudio → texto. Guarda `transcricao` literal, sem edição.
4. **Extração.** Texto → JSON estruturado (§30), com `confianca` por evento.
5. **Validação semântica antes de gravar** (§31): peso de bezerro em 400 kg, lote inexistente, data no futuro, pasto que não existe, animal morto recebendo vacina → **não grava**; devolve uma pergunta curta, em português simples, ao remetente.
6. **Confiança.** Se `confianca < CONFIANCA_MINIMA_BOT` → `status='revisao'`, entra na fila de revisão do admin no PWA. **Nunca inventa dado.**
7. **Gravação.** Escreve nas tabelas de domínio dentro de **uma transação**, dispara recálculos (custo, UA/ha, alertas) e responde **confirmação curta em linguagem de campo**: *"Anotado: lote 3 pesado hoje, média 218 kg, 40 cabeças."*
8. **Consolidação semanal.** Fim de semana → relatório automático (§M9).

**Robustez obrigatória:**

- Entende **sotaque e vocabulário regional** do sul do MA (§3).
- **Vários fatos numa única nota** → vários registros. *"passei o lote 2 pro pasto do buriti e o açude tá pela metade"* = 1 movimentação + 1 leitura de açude.
- Aceita **foto** (nota fiscal, bula de vacina, horímetro) com extração dos dados.
- **O vaqueiro manda a mensagem sem sinal; quando entrar em sinal, o bot envia e repassa pro app.** Fila local no cliente + `client_uuid` idempotente no servidor.
- Registra **quem falou, quando falou e quando o sistema recebeu** — podem ser dias diferentes, e o relatório precisa usar a data do fato, não a do recebimento.
- Retry com backoff em falha de transcrição; após N tentativas, `status='erro'` e alerta para o admin. **Nenhuma mensagem se perde em silêncio.**

**Stack:** Telegram Bot API (Fase 2) com adapter trocável para **WhatsApp Business API** (Fase 6) + Claude API (transcrição e categorização) + Supabase.

**Esforço:** Médio · **Impacto: Altíssimo — é a dor nº 1 do setor; resolver isso primeiro já paga o projeto inteiro.**

---

## M2 — MAPA DE PASTOS E RECURSOS HÍDRICOS

**Caso de uso:** aba visual com a **imagem/croqui da divisão dos pastos da fazenda** e **cada piquete em card** contendo:

`tamanho (ha) · tipo de capim · açude e nível de água · lote atual · nº de cabeças · peso médio do lote · data de entrada · dias no pasto`

- **Toda troca de lote (registrada por voz no bot) atualiza o card automaticamente** e grava o histórico de rotação em `movimentacoes_pasto`.
- Com o tempo, isso revela **quanto tempo de descanso cada pasto teve entre um lote e outro — indicador crítico para recuperação de pastagem.** Exiba a série histórica de descanso por piquete, com média e mínimo.

**Adição sênior — alerta de capacidade de suporte:** cruze `tamanho do pasto + cabeças + peso médio` para calcular **UA/ha em tempo real** e sinalize quando o piquete estiver **acima da lotação recomendada para o tipo de capim** — **Marandu, Massai e Mombaça têm capacidade de suporte diferente** (§10). Ao disparar, o sistema já sugere **para onde mover** (piquete com maior descanso acumulado e capacidade livre).

**Adição sênior — alerta de açude em período de seca:** se o nível do açude (registrado por voz do vaqueiro) cair abaixo do limite, o sistema **prioriza aquele pasto para rotação de saída antes de virar problema de sede do gado**.

**Adições extras:** cor do card por status e severidade; cruzamento com `chuvas` (mm acumulados nos últimos 30 dias por região) para explicar rebrota; "mapa de calor" de pressão de pastejo ao longo do ano; histórico de adubação e roçada por piquete.

**Stack:** mesma captura via bot (M1) + PWA exibindo o mapa visual + Supabase.

**Esforço:** Médio · **Impacto: Alto — hoje essa informação normalmente só existe na cabeça do vaqueiro mais antigo da fazenda; documentada, vira ativo da fazenda, não da pessoa.**

---

## M3 — GESTÃO DE REBANHO: INDICADOR DE CRIA + INDICADOR DE RECRIA

Dois painéis **separados**, porque misturar esconde onde a margem está sendo perdida.

**CRIA:** taxa de prenhez · taxa de parição · **taxa de desmame** · intervalo entre partos · peso ao desmame (real e ajustado 205 dias) · mortalidade de bezerro até o desmame · **kg de bezerro desmamado por matriz exposta** (o indicador-rei da cria) · ranking de matriz por produtividade acumulada.

**RECRIA:** **GMD por lote e por animal** · ganho por hectare · peso e idade à venda · dias no pasto · conversão do suplemento · **projeção da data de venda por lote** · comparação do GMD contra `GMD_META_RECRIA` e contra o mesmo período do ano anterior.

**Transversais:** evolução do rebanho por categoria · taxa de mortalidade · taxa de descarte · curva de crescimento por lote versus meta · **ranking de genética de touro** (`genetica_touro` × GMD e peso ao desmame da progênie) — informação que normalmente se perde e que muda decisão de compra de reprodutor.

**Marcado futuro e previsão da @:** projeção de arrobas futuras de **bezerro, bezerra, vaca e boi**, com **peso fixo de @ configurável** (`KG_POR_ARROBA`), usando GMD histórico do lote e data-alvo de venda. Exibir, por lote: peso projetado × preço projetado × **receita projetada** × margem projetada.

---

## M4 — CALENDÁRIO SANITÁRIO (VACINAS)

### ⚠️ AVISO OBRIGATÓRIO — exibir em tela, no relatório e no onboarding

**O Maranhão é, desde abril de 2024, zona livre de febre aftosa sem vacinação** — a vacina de aftosa deixou de ser aplicada e seu **armazenamento/uso passou a ser proibido no estado**. Se ainda houver vacina de aftosa em estoque ou no protocolo da fazenda, **isso precisa ser revisado com a AGED/veterinário imediatamente.**

O sistema **bloqueia** qualquer registro de aplicação de aftosa (`vacinas_catalogo.bloqueada = true`) e exibe esse aviso ao tentar.

### Calendário automatizado, com lembrete via bot, calculado por categoria/idade do animal

| Vacina | Obrigatória? | Categoria/idade | O que previne | Época/observação |
|---|---|---|---|---|
| **Brucelose (B19)** | **Sim** — nacional, PNCEBT | **Fêmeas de 3 a 8 meses, dose única** | Brucelose — aborto, infertilidade, **transmissível a humanos** | Só fêmeas nessa janela exata; **vacinar fora da idade ou em macho gera problema em exame sorológico depois** |
| **Clostridioses** | Não obrigatória, **essencial** | Todos a partir de **2 meses**, reforço **30 dias** depois, então **anual** | Botulismo, tétano, enterotoxemia, carbúnculo sintomático — **mortalidade rápida e imprevisível** | Aplicar **~1 mês depois da brucelose (não no mesmo dia — reduz a resposta imune das duas)** |
| **Raiva** | Não obrigatória nacionalmente, **decisiva em área de risco** | Todo o rebanho, **2 doses (30 dias de intervalo) + reforço anual** | Raiva bovina, **transmitida por morcego hematófago** | Avaliar com o veterinário se a região tem histórico de morcego hematófago — **comum no interior do MA** |
| **Reprodutivas — IBR, BVD, Leptospirose, Campilobacteriose** | Não obrigatória, recomendada | **Matrizes e touros** | **Abortos, repetição de cio e infertilidade** | Aplicar **antes da estação de monta (set/out)**; **leptospirose com reforço semestral** |

### Regras que o sistema aplica sozinho (a partir de `vacinas_catalogo`, não de `if` no código)

- Gera mensalmente a lista de **quais animais entram na janela** de cada vacina, por idade e sexo, com contagem e custo estimado.
- **Bloqueia brucelose** fora da janela 3–8 meses ou em macho, **explicando o motivo** ao usuário.
- **Impede clostridiose no mesmo dia da brucelose** e **sugere a data correta** (~30 dias depois).
- Agenda automaticamente **2ª dose, reforço 30 dias, reforço semestral e anual** no Google Calendar e no bot.
- Alerta com `ALERTA_VACINA_DIAS` de antecedência; escala para crítico quando a janela fecha sem registro.

**Adição sênior — rastreamento de lote de fabricação:** cada aplicação registrada por voz grava **animal/lote, vacina, data, lote de fabricação, laboratório, validade e quem aplicou**. **Importante em caso de reação adversa ou recall do fabricante — e é o tipo de dado que auditoria de frigorífico/comprador pede.**

### Disclaimer permanente (não removível)

> Este calendário é **ponto de partida organizacional, não prescrição.** O protocolo definitivo precisa ser fechado com seu **médico-veterinário**, considerando o histórico sanitário específico da propriedade.

**Stack:** mesma captura via bot + Google Calendar + Supabase.

**Esforço:** Baixo · **Impacto: Alto — evita tanto a doença quanto o erro caro de vacinar fora do protocolo (ex.: aftosa, que não é mais permitida no MA, ou brucelose fora da janela de idade).**

---

## M5 — FINANCEIRO E CUSTO POR ARROBA (módulo mais importante)

**Caso de uso:** **planilha viva** (Supabase) com **custo por arroba produzida** — ração, sal, vacina, mão de obra, frete — **atualizada semanalmente**.

**Na planilha financeira, organizar por partes que geralmente são gastas** — categorias fixas, subcategoria livre:

`Alimentação` (ração, sal mineral, proteinado, silagem) · `Sanidade` (vacina, vermífugo, carrapaticida, medicamento, veterinário) · `Mão de obra` (salário, encargos, diária, empreita) · `Pastagem` (adubo, semente, herbicida, calcário, roçada) · `Máquinas e combustível` (diesel, óleo, peça, pneu, manutenção) · `Infraestrutura` (cerca, curral, bebedouro, energia, bomba) · `Administrativo` (contador, imposto, taxa, internet) · `Frete e comercialização` · `Aquisição de animais` · `Financeiro` (juros, tarifa)

**Adição sênior — DRE simplificado por lote, com dois centros de custo separados:** em vez de só "custo total da fazenda", monte um **mini-DRE por lote**:

```
receita projetada de venda − custo acumulado do lote = margem projetada
```

E **separe custo de CRIA** (manutenção de matriz + touro, **rateado por bezerro desmamado**) **de custo de RECRIA** (pasto + sal/suplemento, do desmame até a venda). **Numa operação cria-recria, misturar os dois esconde onde a margem realmente está sendo perdida.**

**Adição sênior — ponto de equilíbrio dinâmico:**

```
Ponto de equilíbrio (R$/@) = custo total de produção acumulado ÷ arrobas produzidas no período
```

**Recalcular toda semana** e mostrar a **distância até o preço de mercado atual**. **Essa é a métrica mais importante da fazenda e a maioria dos produtores não a atualiza com frequência.** Exibir no topo do dashboard, com semáforo e com o principal ofensor de custo do período nomeado.

**Cenários (Code Execution):** rodar **3 cenários** — preço do bezerro/garrote em **alta / estável / queda** × **impacto de seca na recria** (que **atrasa o GMD e empurra a data de venda**) — gerando **gráfico de fluxo de caixa de 90 dias**. Cada cenário exibe: data provável de venda, arrobas, receita, margem e caixa mínimo no período.

**Adições extras:** rateio automático de custo comum por `UA × dias` (§9) · fluxo de caixa realizado vs projetado · contas a pagar/receber com alerta de vencimento · custo por litro de leite · margem por hectare · comparação do custo/@ deste lote contra a média histórica da fazenda · curva ABC de despesa (onde estão os 20% que consomem 80%).

**Stack:** Supabase + Claude com Code Execution.

**Esforço:** Médio · **Impacto: Alto — saber seu ponto de equilíbrio por lote, atualizado semanalmente, muda a decisão de "vender agora vs segurar" mais do que só olhar preço de mercado isolado.**

---

## M6 — INTELIGÊNCIA DE MERCADO

- **Preço médio da @ baseado no atual da região** (praça Imperatriz/sul do MA), por categoria: boi gordo, vaca gorda, bezerro, bezerra, garrote, novilha.
- **Preço médio do leite baseado no atual da região** (R$/litro).
- Série histórica com gráfico; variação semanal e mensal; **cruzamento automático com o ponto de equilíbrio da fazenda**.
- **Decisão semanal sugerida: COMPRAR / VENDER / SEGURAR**, com justificativa curta e os números que a sustentam.
- **Relação de troca** (quantos bezerros equivalem a um boi gordo) — indicador clássico de decisão em cria-recria.
- Entrada de preço por registro manual do admin, por nota de voz ou por fonte externa configurável. **Sempre com `fonte` e `data_referencia` gravados: o sistema nunca exibe preço sem dizer de onde veio e de quando é.** Preço com mais de 7 dias aparece marcado como desatualizado.

---

## M7 — SALA DE MÁQUINAS E GESTÃO DE FROTA

**Caso de uso:** **registro de cada trator/implemento — modelo, ano, horas/km rodadas** — com **plano de manutenção preventiva específico por modelo** (óleo, filtro, correia, calibração), calculado a partir das **horas de uso reportadas por voz** (*"rodei o trator X por 6 horas hoje"*), **não só por tempo corrido no calendário**.

**Adição sênior — ficha de cuidados por máquina:** manter, **por modelo/ano, uma ficha de cuidados recomendados pelo fabricante** (intervalo de troca de óleo, torque de parafuso, cuidado com superaquecimento em época seca), organizada e **consultável na hora, sem precisar procurar o manual físico perdido no galpão** (`maquinas.ficha_cuidados`).

**Adição sênior — alerta preditivo de manutenção:** se o trator **ultrapassar o intervalo recomendado sem o registro de troca correspondente**, sinalizar no **dashboard executivo antes de virar quebra cara no meio do plantio de capim ou da colheita**.

**Adições extras:** custo acumulado por máquina e **custo por hora trabalhada** · histórico de peça trocada · consumo de diesel por hora · alerta de máquina parada há muito tempo · projeção de custo de manutenção do próximo trimestre.

**Stack:** mesma captura via bot + Supabase (tabelas de máquinas e manutenções) + Google Calendar.

**Esforço:** Baixo · **Impacto: Médio-alto — quebra de trator na hora errada custa caro em atraso, não só em conserto.**

---

## M8 — OPERAÇÃO, LOGÍSTICA E PRIORIZAÇÃO

**Caso de uso:** **checklist automatizado de manutenção (cerca, curral, bebedouro, maquinário) com recorrência**, e **comparador de cotação de insumo**.

**Adição sênior — negociação assistida:** o admin **cola 3 orçamentos de fornecedor** (ração, sal, vacina) e o sistema **não só compara preço, mas calcula o custo efetivo considerando prazo de pagamento e custo de oportunidade do capital** — comparando a taxa que se pagaria **à vista com desconto vs parcelado** (§9). Exibe o **vencedor real**, não o mais barato aparente, e a economia em reais.

**Adição sênior — escala de trabalho por prioridade:** **toda semana, cruze calendário sanitário + manutenção pendente + indicadores fora da meta e sugira a ordem de prioridade das tarefas de campo da semana** — **em vez de o dono decidir isso de cabeça toda segunda de manhã.**

**Priorização da demanda do vaqueiro:** **o vaqueiro manda a demanda pro bot, e o sistema define qual é mais importante, necessária e prioritária, considerando o custo e o impacto** — com o score de §9 e **uma frase explicando por que aquilo ficou em primeiro**.

**Agenda semanal automática:** **com base nos dados já registrados no sistema, gerar uma agenda semanal com a lista de tarefas pendentes, suas prioridades e importância** — entregue no PWA e resumida no bot para o admin.

**Stack:** Google Calendar + Supabase + Claude.

**Esforço:** Baixo · **Impacto: Médio-alto — evita prejuízo por manutenção esquecida e tira de você a carga mental de priorizar tarefa manualmente toda semana.**

---

## M9 — RELATÓRIOS

1. **Relatório geral da fazenda** (sob demanda): rebanho, pastos, sanidade, financeiro, máquinas, pendências.
2. **Consolidação semanal automática** (fim de cada semana): o que foi registrado, o que mudou, o que ficou pendente, alertas abertos, **custo/@ atualizado**, **ponto de equilíbrio vs mercado**, e a **agenda da semana seguinte**.
3. **Briefing trimestral, com relatório da fazenda:** trimestre vs trimestre anterior e vs mesmo trimestre do ano passado; evolução de rebanho; margem dos lotes fechados; eficiência de pastagem; **o que deu certo, o que deu errado e 3 recomendações concretas para o próximo trimestre**.
4. Exportação em **PDF e CSV**. Texto em **linguagem direta, sem jargão**; **todo número acompanhado de contexto e da data do dado**.

---

## M10 — DASHBOARD EXECUTIVO ÚNICO

Uma tela, no celular, que responde em 10 segundos: **como está a fazenda hoje?**

**Topo (números grandes):** Custo por @ · Ponto de equilíbrio vs preço de mercado (com semáforo) · Margem projetada do rebanho · Cabeças totais · Caixa do mês.

**Abaixo:** alertas críticos abertos · pastos acima da lotação · açudes em nível baixo · vacinas na janela e vacinas atrasadas · máquinas com manutenção estourada · **as 5 tarefas prioritárias da semana com a justificativa** · últimas mensagens do bot processadas · fila de revisão pendente · indicador de sincronização.

Regra de ouro: **nenhum número aparece sem data e sem origem.** Se está velho, aparece cinza com "atualizado há X dias".

---

## M11 — CONTROLE DE ACESSO E SEGURANÇA DE DADOS

**Caso de uso:** **painel simples** (uma tela no PWA ou um comando de admin no bot) onde o administrador **adiciona ou remove o número de WhatsApp/Telegram de um trabalhador**. Assim que um número é removido:

- **Ele para de conseguir registrar qualquer informação nova** — o bot simplesmente não reconhece mais o número (é a checagem na tabela `usuarios_acesso` que já está no prompt de sistema do bot).
- **Ele perde qualquer capacidade de consultar dado, passado ou futuro** — porque, no desenho correto do sistema, **trabalhador de campo nunca teve canal de consulta, só de registro**. Quem lê relatório e histórico é só o dono. **Isso resolve boa parte do requisito por arquitetura, não por uma regra que pode falhar.**

**Adição sênior — separação de papéis (RBAC):**

- **Trabalhador de campo:** só grava dado (pesagem, vacina, pasto, manutenção) — **nunca lê**.
- **Administrador:** lê tudo, adiciona/remove trabalhador, exporta relatório.
- **Gerente de confiança (futuro):** papel intermediário — lê relatório consolidado, **não lê financeiro bruto**.

**Adição sênior — o dado não se apaga, mas o acesso sim:** quando um trabalhador é removido, **o que ele registrou continua no banco** (é patrimônio da fazenda e serve de auditoria — *"quem vacinou o lote 4 em março"* continua rastreável). **O que muda é que ele não tem mais nenhuma forma de acessar isso — nem o que já registrou, nem qualquer coisa nova.**

**Stack:** tabela `usuarios_acesso` no Supabase (telefone, nome, papel, status ativo/inativo, data de desligamento) + **validação em toda mensagem recebida pelo bot antes de processar qualquer coisa**.

**Esforço:** Baixo — **é uma tabela e uma checagem, não um sistema de login complexo.**

**Impacto: Alto — dado de fazenda (preço pago, localização de gado, rotina) é ativo sensível; um ex-funcionário com acesso ativo é risco real, não teórico.**

---
