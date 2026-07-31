# Sistema de Gestão de Fazenda — repositório de trabalho para Claude Code

Cria-recria + leite · sul do Maranhão · PWA offline-first + captura de campo por voz.

Este repositório tem a especificação completa em `docs/` e o código das **Fase 1 — Fundação** (banco, RLS, PWA, cadastros básicos, importador) e **Fase 2 — Captura por voz** (bot Telegram, transcrição, extração, validação semântica, fila de revisão). As fases seguintes (mapa de pastos, financeiro, máquinas, WhatsApp) ainda não foram construídas — ver a tabela de fases em `CLAUDE.md`.

---

## Instalação

```bash
# 1. Coloque esta pasta onde você guarda seus projetos e entre nela
cd fazenda

# 2. Inicialize o git (recomendado — permite reverter qualquer fase)
git init && git add -A && git commit -m "spec inicial"

# 3. Abra o Claude Code na pasta
claude
```

Na primeira sessão, confira se a memória carregou:

```
/memory
```

Você deve ver `CLAUDE.md` na lista. Se não aparecer, você não está na pasta certa.

---

## Fase 1 — Fundação: passo a passo do zero

1. **Instale as dependências**

   ```bash
   npm install
   ```

2. **Configure o Supabase**
   - Se ainda não tem um projeto, crie um em [supabase.com/dashboard](https://supabase.com/dashboard).
   - Copie `.env.example` para `.env.local` e preencha:
     - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — painel do projeto → Project Settings → API.
     - `SUPABASE_SERVICE_ROLE_KEY` — mesma tela, campo `service_role` (secreta — nunca comitar, nunca no cliente).
   - Instale a CLI do Supabase (`npm install -g supabase`) e rode `supabase link --project-ref <ref-do-projeto>`, ou use `supabase start` para subir tudo localmente em Docker.

3. **Aplique a migração e o seed**

   ```bash
   npm run db:reset
   ```

   Isso roda `supabase/migrations/20260730120000_schema_inicial.sql` (schema completo + RLS + auditoria) e `supabase/seed.sql` (parâmetros de fábrica + catálogo de vacinas) do zero. Nenhum dado específico desta fazenda é semeado — pastos, rebanho, máquinas e insumos você cadastra pelo app (decisão da Fase 0, ver `ESTADO.md`).

4. **Crie o primeiro admin** — o cadastro público está desligado de propósito (§M11: só admin cria acesso)
   - No Supabase Studio: Authentication → Users → Add user (e-mail + senha).
   - Copie o UUID do usuário criado e rode no SQL Editor:
     ```sql
     insert into usuarios_acesso (auth_user_id, telefone, nome, papel, status, data_admissao)
     values ('<uuid-do-usuario>', '+55SEUTELEFONE', 'Seu nome', 'admin', 'ativo', current_date);
     ```

5. **Rode local**

   ```bash
   npm run dev
   ```

   Abra `http://localhost:3000`, entre com o e-mail/senha do passo 4, e cadastre pastos, lotes, animais, máquinas, insumos e trabalhadores pelas telas do menu.

6. **Confira**

   ```bash
   npm run lint
   npm run typecheck
   npm test           # domínio + RLS (RLS fica SKIPPED sem .env.local com Supabase real)
   npm run test:e2e   # precisa de E2E_ADMIN_EMAIL e E2E_ADMIN_SENHA no ambiente
   npm run gabarito   # vai dizer "não implementado" em tudo — normal na F1
   ```

7. **Deploy**
   - **Vercel:** importe o repositório e configure as mesmas 3 variáveis de ambiente do passo 2 nas settings do projeto.
   - **Supabase:** se usou `supabase start` local, crie o projeto remoto, rode `supabase link` e reaplique a migração (`supabase db push` ou colar o SQL no Studio).

---

## Fase 2 — Bot: passo a passo

> **Nota desta sessão:** o arquivo `.env.example` não pôde ser editado (permissão do ambiente bloqueia leitura/escrita em qualquer `.env*`). As variáveis novas abaixo precisam ser adicionadas manualmente ao seu `.env.local` — a lista completa está aqui e também no bloco de variáveis do `ESTADO.md`.

1. **Contas/credenciais que você precisa ter em mãos**
   - Bot no Telegram criado via [@BotFather](https://t.me/BotFather) → token.
   - Chave da **Claude API** ([platform.claude.com](https://platform.claude.com)) — usada na extração estruturada.
   - Chave da **Groq API** ([console.groq.com](https://console.groq.com)) — usada na transcrição de áudio. A Claude Messages API **não aceita áudio bruto** (só texto/imagem/documento) — por isso a transcrição é um passo separado, com outro provedor. Decisão registrada em `ESTADO.md`; se você preferir outro provedor de ASR, troque só `src/infra/asr/groq.ts` por uma nova implementação da mesma interface `Transcritor`.

2. **Acrescente ao `.env.local`**

   ```bash
   TELEGRAM_BOT_TOKEN=            # do @BotFather
   TELEGRAM_WEBHOOK_SECRET=       # qualquer string aleatória sua, ex: openssl rand -hex 32
   ANTHROPIC_API_KEY=
   GROQ_API_KEY=
   CLAUDE_MODEL_EXTRATOR=         # opcional — default é claude-opus-5
   CRON_SECRET=                   # só para rodar o worker de retry localmente; a Vercel injeta sozinha em produção
   ```

3. **Aplique a migração da Fase 2**

   ```bash
   npm run db:reset
   ```

   Isso já roda `supabase/migrations/20260731120000_fase2_bot.sql` (novos `parametros_fazenda` do bot + a função `gravar_eventos_mensagem_bot`) junto com o resto.

4. **Configure os secrets da Edge Function** (não são as mesmas variáveis do `.env.local` — a função roda em Deno, isolada do Next.js)

   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... ANTHROPIC_API_KEY=... GROQ_API_KEY=...
   ```

   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` a própria Supabase já injeta nas Edge Functions — não precisa configurar.

5. **Suba a função localmente e registre o webhook**

   ```bash
   supabase functions serve bot-webhook
   ```

   Em outro terminal, exponha a porta local (ex.: `ngrok http 54321`) e registre no Telegram:

   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<url-publica>/functions/v1/bot-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

   Em produção, `<url-publica>` é a URL do projeto Supabase (`supabase functions deploy bot-webhook` primeiro).

6. **Teste de ponta a ponta**
   - Cadastre um trabalhador pela tela `/trabalhadores` (telefone + plataforma `telegram`).
   - Mande uma mensagem pro bot no Telegram — na primeira vez ele vai pedir pra você compartilhar o contato (é assim que o telefone cadastrado se liga ao seu `chat_id`, o Telegram não entrega telefone de graça).
   - Depois disso, mande uma nota de voz ou texto (ex.: "choveu bem ontem, uns quarenta milímetro") e confira em `/revisao` ou direto na tabela `mensagens_bot`.
   - Imprima o `/cartao-bolso` (formato A6) pro vaqueiro que vai usar o bot pela primeira vez.

7. **Confira**

   ```bash
   npm run lint
   npm run typecheck
   npm test                # domínio (~180 testes) + os 3 specs de integração abaixo, SKIPPED sem env real
   # tests/integration/extrator.spec.ts   — precisa de ANTHROPIC_API_KEY (os 12 few-shots do §31)
   # tests/integration/bot-webhook.spec.ts — precisa de Supabase local + `supabase functions serve` + os secrets acima
   ```

---

## Estrutura

```
CLAUDE.md              ← memória de projeto, lida em toda sessão. Curta de propósito.
ESTADO.md              ← memória entre sessões: fase, decisões, suposições, pendências
README.md              ← este arquivo
docs/
  00-indice.md         ← mapa do que está em cada documento
  01-dominio.md        ← linguagem de campo, fórmulas, parâmetros, estados, alertas
  02-dados.md          ← DDL canônico (27+ tabelas), RLS, auditoria, migração
  03-modulos.md        ← M1 a M11
  04-bot.md            ← prompt do extrator, few-shots, validação, custo
  05-arquitetura.md    ← stack, camadas, sincronização offline, UX, segurança
  06-qualidade.md      ← testes, 15 critérios de aceite, anti-padrões
  07-entrega.md        ← fases, formato de entrega, Fase 0
  08-anexos.md         ← A gabarito numérico · B contratos · C copy do bot · D avaliação
                          E adoção · F riscos · G arredondamento · H compliance · I custo
.claude/
  settings.json        ← permissões de ferramenta
  commands/            ← comandos do projeto (abaixo)
src/                   ← código (Fase 1 em diante)
  domain/              ← regras puras: tipos, estados, validação, calculos — zero import de framework
  infra/               ← supabase, offline (fila/Dexie), importador de CSV, messaging/asr/claude (bot)
  app/                 ← rotas Next (App Router) — login + telas de cadastro + revisão + API routes
  components/          ← ui/ (shadcn) + componentes que falam com infra
supabase/
  migrations/          ← DDL + RLS + auditoria + função de gravação do bot, idempotente
  functions/
    bot-webhook/        ← Edge Function (Deno) — webhook do Telegram (Fase 2)
    import_map.json      ← mapeia "zod" para npm: (código compartilhado com o Next.js)
  seed.sql             ← parametros_fazenda + vacinas_catalogo (sem dado desta fazenda)
  config.toml          ← config do `supabase start` local
tests/
  e2e/                 ← Playwright (login, cadastro, offline)
  integration/         ← rls.spec.ts (§14) · extrator.spec.ts (§31/§40) · bot-webhook.spec.ts
  golden/              ← os 12 few-shots do §31, viram fixture do extrator
  fixtures/            ← planilha-exemplo.csv do importador
scripts/
  gabarito.ts          ← roda o Anexo A contra src/domain/calculos/
vercel.json            ← cron do worker de retry do bot (§33)
```

**Por que a spec está fatiada:** o Claude Code carrega `CLAUDE.md` em toda sessão. Se a especificação inteira estivesse lá, você queimaria contexto a cada turno. Assim, o `CLAUDE.md` fica com as regras invioláveis e o mapa; os detalhes são lidos só quando a tarefa exige.

---

## Comandos

| Comando | O que faz |
|---|---|
| `/fase 1` | Executa uma fase inteira no formato obrigatório, entra em plan mode antes, roda os testes no fim e **para** |
| `/verificar` | Auditoria de 12 pontos no repositório. Só relata, não corrige |
| `/gabarito` | Confere os cálculos implementados contra o Anexo A, número por número |
| `/dominio custo por arroba` | Implementa uma função de domínio com a assinatura fixa do Anexo B + teste |
| `/bot melhorar reconhecimento de pasto` | Mexe no extrator com o protocolo de avaliação obrigatório |
| `/status` | Situação real do projeto e as 3 próximas coisas a fazer |

Se sua versão do Claude Code preferir skills, converta qualquer comando movendo o arquivo para `.claude/skills/<nome>/SKILL.md` e adicionando `name:` no frontmatter. Quando existirem os dois com o mesmo nome, a skill vence.

---

## Fluxo de trabalho recomendado

**Sessão 1 — contexto**

```
/fase 0
```

O Claude vai te fazer até 10 perguntas objetivas (número de pastos e cabeças, se o leite é principal ou secundário, quantos vaqueiros vão usar o bot, se há planilha para importar, tipos de capim, modelos de trator, se há estação de monta, se o rebanho tem brinco individual). Responda o que souber. **O que você não responder, ele assume um padrão e declara a suposição** em `ESTADO.md` — não trava.

**Sessão 2 — fundação**

```
/clear
/fase 1
```

Ele entra em plan mode. **Leia o plano antes de aprovar.** A Fase 1 é o banco: se o schema sair torto, todo o resto sai torto.

Ao terminar:

```
/gabarito     # ainda vai dizer "não implementado" na maioria — normal nesta fase
/verificar
git add -A && git commit -m "F1: fundação"
```

**Sessões seguintes** — sempre `/clear` antes de começar uma fase nova, sempre commit ao final, sempre `/status` quando voltar depois de uns dias.

**Regra de ouro:** uma fase por sessão. Contexto sujo é a principal causa de o modelo esquecer as regras invioláveis no meio do caminho.

---

## Quando alguma coisa sair errada

| Sintoma | O que fazer |
|---|---|
| Entregou código com `// ...resto do código` | `/verificar` e mande reescrever o arquivo inteiro |
| Inventou um número no dashboard | Aponte a regra 2 do `CLAUDE.md` e mande trocar por `— sem dado —` |
| Cálculo diferente do esperado | `/gabarito` — o Anexo A tem precedência sobre o código |
| Começou a Fase 3 sem você pedir | `/clear`, e recomece com `/fase 2`; ele emendou fase |
| Está lento e esquecendo regras | `/clear` e retome pelo `/status` |
| Você quer testar algo arriscado | `git commit` antes; se der errado, `git reset --hard` |

---

## Antes de rodar a Fase 1

Tenha em mãos:

- Conta no **Supabase** (projeto criado, URL e chaves)
- Conta na **Vercel** (para deploy)
- Chave da **Claude API**
- Bot criado no **Telegram** via @BotFather (token)
- A **planilha atual da fazenda**, se existir — a Fase 1 inclui o importador

---

## O critério real de sucesso

Não é o dashboard ficar bonito. É a **planilha manual ser abandonada em seis meses** (Anexo E).

Se em algum momento você estiver digitando dado que deveria ter vindo do campo por voz, o produto falhou — e isso é um problema de copy e de adoção, não de tecnologia.
