# ESTADO DO PROJETO

> Leia no início de toda sessão. Atualize no fim. Este arquivo é a memória entre sessões.

## Fase atual

F0 — concluída, aguardando o dono disparar `/fase 1`

## Decisões tomadas

1. **Piloto com o máximo de vaqueiros possível, não com 1 usuário.** O dono pediu explicitamente para habilitar todos os trabalhadores de campo desde o início do bot (F2), em vez do piloto de 1 usuário que o Anexo E recomenda por razão de adoção (risco R1 do Anexo F). Registro aqui a divergência de forma transparente: a arquitetura (`usuarios_acesso`) já suporta N trabalhadores sem nenhum esforço extra — não é uma mudança técnica —, mas o risco de adoção descrito no Anexo E (medir com 1 pessoa antes de escalar) deixa de ser mitigado por padrão. Seguimos com a decisão do dono; se a adoção travar, o Anexo E continua sendo o playbook de correção.
2. **Não existe planilha legada.** O importador de planilha (§17) continua sendo entregue na Fase 1 — é requisito de especificação, não posso cortar por "não ter uso imediato" — mas será validado com dados de exemplo/teste, não com uma planilha real desta fazenda. O critério de saída da F1 "planilha antiga importada" (docs/07-entrega.md §43) não se aplica literalmente aqui: o banco desta fazenda começa vazio, além do seed de `parametros_fazenda`, `vacinas_catalogo` e da fixture do Anexo A.
3. **Contas externas já existem** (Supabase, Vercel, Claude API, Telegram/@BotFather). Não preciso documentar passo a passo de criação de conta na F1 — só a configuração das variáveis de ambiente correspondentes.
4. **Cadastro operacional feito pelo app, não em chat — isso muda o escopo do "shell do PWA" da F1.** O dono não vai me dizer quantos pastos/cabeças/máquinas tem por texto; ele vai cadastrar isso direto no sistema, quando o app existir. Só que o bot da F2 já injeta esse cadastro como contexto (§30: `pastos_cadastrados`, `lotes_ativos`, `maquinas`, `insumos`) para resolver nomes ditos por voz — e a experiência visual rica desses módulos (mapa de pastos com cards, indicadores de cria/recria, ficha de cuidados de máquina) só chega em F3/F5, como já previsto no roadmap. Decisão: o "shell do PWA" da Fase 1 passa a incluir, além do já especificado, **formulários básicos de cadastro (criar/editar/listar, sem a visual completa)** para `pastos`, `lotes`, `animais`, `maquinas` e `estoque_insumos` — é o mínimo para o dono começar a alimentar o sistema e para o bot ter contexto para resolver referências. Isso não antecipa M2/M3/M7 (mapas, indicadores, fichas, alertas) — só a gravação crua dos cadastros que essas telas depois vão exibir bonito.

## Suposições assumidas na Fase 0

- **Número de pastos, área total, composição do rebanho, tipos de capim reais, modelos/anos de máquinas, estação de monta, política de brinco individual:** não fornecidos. Não viram números inventados em lugar nenhum — ficam `— sem dado —` até o dono cadastrar pelo app. Os parâmetros com valor de fábrica (`ESTACAO_MONTA_INICIO=11-01`, `ESTACAO_MONTA_FIM=01-31`, capacidades de suporte por capim em `docs/01-dominio.md` §10, etc.) permanecem o default até serem editados na tela de parâmetros.
- **Leite como atividade secundária:** mantido conforme já definido em `docs/01-dominio.md` §4 (o dono não indicou mudança). Volume e se há vacas de ordenha dedicadas serão cadastrados pelo app, não presumidos.
- **Brinco individual:** o schema já suporta os dois cenários (`animais.brinco` é opcional e único) — nenhuma suposição de arquitetura necessária; a fazenda decide caso a caso ao cadastrar.

## Pendências e bloqueios

_(nenhum — Fase 0 concluída)_

## Log de sessões

| Data | Fase | O que foi feito | O que ficou aberto |
|---|---|---|---|
| 2026-07-29 | F0 | Bootstrap: materializados os 19 arquivos da especificação (CLAUDE.md, ESTADO.md, README.md, docs/00-08, .claude/settings.json e 6 comandos), commitados e enviados para `claude/lucid-archimedes-3gy9mc` (PR #1). Lidos CLAUDE.md, docs/01-dominio.md e docs/07-entrega.md do disco. Enviadas e respondidas as 10 perguntas objetivas da Fase 0. Decisões e suposições registradas acima. | Início da Fase 1, sob comando do dono (`/fase 1`). |
