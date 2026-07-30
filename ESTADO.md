# ESTADO DO PROJETO

> Leia no início de toda sessão. Atualize no fim. Este arquivo é a memória entre sessões.

## Fase atual

F1 — concluída. Aguardando validação do dono antes de `/fase 2`.

## Decisões tomadas

### Fase 0

1. **Piloto com o máximo de vaqueiros possível, não com 1 usuário.** O dono pediu explicitamente para habilitar todos os trabalhadores de campo desde o início do bot (F2), em vez do piloto de 1 usuário que o Anexo E recomenda por razão de adoção (risco R1 do Anexo F). Registro aqui a divergência de forma transparente: a arquitetura (`usuarios_acesso`) já suporta N trabalhadores sem nenhum esforço extra — não é uma mudança técnica —, mas o risco de adoção descrito no Anexo E (medir com 1 pessoa antes de escalar) deixa de ser mitigado por padrão. Seguimos com a decisão do dono; se a adoção travar, o Anexo E continua sendo o playbook de correção.
2. **Não existe planilha legada.** O importador de planilha (§17) continua sendo entregue na Fase 1 — é requisito de especificação, não posso cortar por "não ter uso imediato" — mas será validado com dados de exemplo/teste, não com uma planilha real desta fazenda. O critério de saída da F1 "planilha antiga importada" (docs/07-entrega.md §43) não se aplica literalmente aqui: o banco desta fazenda começa vazio, além do seed de `parametros_fazenda` e `vacinas_catalogo`.
3. **Contas externas já existem** (Supabase, Vercel, Claude API, Telegram/@BotFather). Não preciso documentar passo a passo de criação de conta na F1 — só a configuração das variáveis de ambiente correspondentes.
4. **Cadastro operacional feito pelo app, não em chat — isso muda o escopo do "shell do PWA" da F1.** O dono não vai me dizer quantos pastos/cabeças/máquinas tem por texto; ele vai cadastrar isso direto no sistema, quando o app existir. Só que o bot da F2 já injeta esse cadastro como contexto (§30: `pastos_cadastrados`, `lotes_ativos`, `maquinas`, `insumos`) para resolver nomes ditos por voz — e a experiência visual rica desses módulos (mapa de pastos com cards, indicadores de cria/recria, ficha de cuidados de máquina) só chega em F3/F5, como já previsto no roadmap. Decisão: o "shell do PWA" da Fase 1 passa a incluir, além do já especificado, **formulários básicos de cadastro (criar/editar/listar, sem a visual completa)** para `pastos`, `lotes`, `animais`, `maquinas` e `estoque_insumos` — é o mínimo para o dono começar a alimentar o sistema e para o bot ter contexto para resolver referências. Isso não antecipa M2/M3/M7 (mapas, indicadores, fichas, alertas) — só a gravação crua dos cadastros que essas telas depois vão exibir bonito.

### Fase 1

5. **Service worker escrito à mão, não um plugin (`next-pwa` etc.).** Compatibilidade com App Router de plugins de PWA é inconsistente entre versões; um SW mínimo (cache do app shell) dá controle previsível e cobre o requisito de instalabilidade + offline desta fase. Estratégias de cache mais ricas por rota entram conforme o app cresce.
6. **RLS aplicada via bloco PL/pgSQL genérico** (loop sobre um array de tabelas), não 27× três policies escritas à mão. Reduz o risco de esquecer uma tabela e deixa auditável que todas seguem exatamente o mesmo padrão (`docs/02-dados.md` §14). `auditoria` é tratada à parte (só `select` para admin; gravação só pela trigger).
7. **`client_uuid` acrescentado a 7 tabelas** que o DDL original não tinha (`pastos`, `lotes`, `animais`, `maquinas`, `estoque_insumos`, `usuarios_acesso`, `propriedade`). O protocolo de sincronização offline (§36) é geral do PWA, não só do bot — sem essa coluna, reenviar uma operação da fila após reconexão duplicaria a linha. Adição justificada pela regra do próprio §13 ("pode acrescentar campos... não pode remover").
8. **`origem_animal` ganhou o valor `'importacao'`** (além de `nascimento`/`compra` do DDL original). O importador de planilha não pode adivinhar se o animal nasceu na fazenda ou foi comprado quando a planilha não diz isso — forçar um dos dois seria inventar dado (regra 2). Quando a planilha tem uma coluna de origem reconhecível, ela é respeitada.
9. **Select nativo do navegador em vez de um componente de dropdown customizado** nos formulários. Mais confiável em tela de toque, sol forte e dedo sujo (§38) do que recriar a interação — e uma dependência a menos.

## Riscos e limitações conhecidas desta entrega (não são lacunas escondidas)

- **Leitura ainda depende de sinal no carregamento da página** (Server Components buscam direto no Supabase). Só a **escrita** é 100% offline-first nesta fase (fila IndexedDB + sincronização). Se isso se mostrar um problema real de uso no campo, uma fase futura pode adicionar cache de leitura (SW runtime cache ou espelho no Dexie).
- **Testes de integração de RLS (`tests/integration/rls.spec.ts`) e E2E (Playwright) exigem um Supabase real** com variáveis de ambiente configuradas — não rodam de ponta a ponta neste ambiente de desenvolvimento por não haver projeto conectado aqui. A suíte compila, os specs são descobertos corretamente (`npx playwright test --list` confirma os 4 testes; `npm test` mostra os 28 casos de RLS como **SKIPPED**, não como passando) — a lacuna fica visível, não escondida. Precisa rodar com `.env.local` + `E2E_ADMIN_EMAIL`/`E2E_ADMIN_SENHA` antes de confiar cegamente na Fase 1 em produção.
- **Papel `gerente` tem RLS pronta mas nenhum usuário `gerente` real foi testado** — o papel é "futuro" pela própria especificação.
- **`npm audit` reportou vulnerabilidades nas dependências** (majoritariamente ferramental de build/lint, não código de produção). Não tratado nesta fase; revisar antes de produção.

## Suposições assumidas na Fase 0

- **Número de pastos, área total, composição do rebanho, tipos de capim reais, modelos/anos de máquinas, estação de monta, política de brinco individual:** não fornecidos. Não viram números inventados em lugar nenhum — ficam `— sem dado —` até o dono cadastrar pelo app. Os parâmetros com valor de fábrica (`ESTACAO_MONTA_INICIO=11-01`, `ESTACAO_MONTA_FIM=01-31`, capacidades de suporte por capim em `docs/01-dominio.md` §10, etc.) permanecem o default até serem editados na tela de parâmetros.
- **Leite como atividade secundária:** mantido conforme já definido em `docs/01-dominio.md` §4 (o dono não indicou mudança). Volume e se há vacas de ordenha dedicadas serão cadastrados pelo app, não presumidos.
- **Brinco individual:** o schema já suporta os dois cenários (`animais.brinco` é opcional e único) — nenhuma suposição de arquitetura necessária; a fazenda decide caso a caso ao cadastrar.

## Pendências e bloqueios

- Rodar `npm run db:reset` num Supabase real e criar o primeiro admin (passo a passo no `README.md`) — sem isso o app não tem em quem logar.
- Rodar `npm test` e `npm run test:e2e` com `.env.local`/`E2E_ADMIN_*` preenchidos para validar de verdade o teste de RLS e os 4 E2E (hoje só verificados por construção/descoberta, não executados de ponta a ponta neste ambiente).
- Validar com agrônomo/zootecnista os valores de capacidade de suporte (`CAP_UA_HA_*`) antes de confiar neles para decisão de lotação — aviso já fica na tela de Parâmetros.
- Início da Fase 2, sob comando do dono (`/fase 2`).

## Log de sessões

| Data | Fase | O que foi feito | O que ficou aberto |
|---|---|---|---|
| 2026-07-29 | F0 | Bootstrap: materializados os 19 arquivos da especificação (CLAUDE.md, ESTADO.md, README.md, docs/00-08, .claude/settings.json e 6 comandos), commitados e enviados para `claude/lucid-archimedes-3gy9mc` (PR #1). Lidos CLAUDE.md, docs/01-dominio.md e docs/07-entrega.md do disco. Enviadas e respondidas as 10 perguntas objetivas da Fase 0. Decisões e suposições registradas acima. | Início da Fase 1, sob comando do dono (`/fase 1`). |
| 2026-07-30 | F1 | Fundação completa: DDL idempotente (28 tabelas, RLS, trigger de auditoria) + seed de parâmetros/vacinas · Next.js 14 App Router + TS strict + Tailwind + shadcn/ui à mão · PWA (manifest + SW) + fila offline (Dexie) com sincronização por `client_uuid` · auth admin (Supabase Auth + middleware) · cadastros de pastos/lotes/animais/máquinas/insumos/trabalhadores/parâmetros · importador de planilha (CSV, mapeamento assistido, prévia, relatório de rejeição) · 7 rotas de API + rota de importação em lote · `src/domain/estados/*` (lote/animal/pasto/usuário) com 74 testes passando · teste de RLS obrigatório (skippa sem Supabase real, não finge passar) · `scripts/gabarito.ts` honesto ("não implementado" — normal fora de F3/F4) · `npm run lint`, `typecheck`, `test` e `build` limpos. | Rodar contra Supabase real (RLS + E2E de ponta a ponta) e criar o primeiro admin antes de considerar a F1 validada em produção. |
