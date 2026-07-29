# PARTE VI — ARQUITETURA

## 34. Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript **strict**, Tailwind, shadcn/ui.
- **PWA:** manifest + service worker, instalável, **offline-first** com IndexedDB (Dexie) e fila de sincronização.
- **Banco:** Supabase (PostgreSQL), RLS em tudo, Edge Functions para o webhook do bot.
- **Auth:** Supabase Auth para admin/gerente. Trabalhador **não tem login** — só telefone validado.
- **Bot:** Telegram Bot API na Fase 2, **atrás de uma interface `MessagingAdapter`** (`receber`, `responder`, `baixarMidia`) para trocar por WhatsApp Business API na Fase 6 **sem tocar na lógica de domínio**.
- **IA:** Claude API — transcrição, extração estruturada, redação de relatório.
- **Análise:** Code Execution para os 3 cenários e gráficos.
- **Agenda:** Google Calendar API.
- **Testes:** Vitest (domínio), Playwright (E2E crítico).
- **Deploy:** Vercel + Supabase. CI roda lint, typecheck e testes antes do deploy.

## 35. Camadas e estrutura de pastas

```
src/
  domain/          # regras puras, ZERO import de framework, 100% testável
    calculos/      # §9 — uma função por fórmula, com teste
    validacao/     # §32
    estados/       # §11 — máquinas de estado
    alertas/       # §12 — regras de disparo
    tipos/         # tipos de domínio (não os do Supabase)
  infra/
    supabase/      # client, queries, repositórios
    claude/        # prompts versionados, extração, relatório
    messaging/     # MessagingAdapter + telegram/ + whatsapp/
    calendar/
  app/             # rotas Next (UI apenas)
  components/
  workers/         # jobs: alertas diários, relatório semanal, refresh de views
tests/
supabase/migrations/
```

**Regra de dependência:** `app → infra → domain`. **`domain` não importa nada de fora.** Violação = erro de lint (`eslint-plugin-boundaries`).

## 36. Protocolo de sincronização offline

1. Toda escrita no PWA gera uma **operação** local: `{client_uuid, tabela, payload, criado_em, tentativas}` em IndexedDB.
2. Estado da UI é otimista, com marcação visual de "não sincronizado".
3. Ao voltar a conexão, o worker envia em ordem cronológica, **um lote por vez**.
4. Servidor é **idempotente por `client_uuid`**: reenvio retorna o registro existente, nunca duplica.
5. **Resolução de conflito:** o dado de campo é *append-only*, então conflito real é raro. Onde houver (ex.: dois vaqueiros movendo o mesmo lote no mesmo dia), vence o de **`data_do_fato` mais antiga** e o outro vira **alerta de conflito para o admin decidir** — nunca sobrescrita silenciosa.
6. Indicador permanente na UI: "X registros aguardando sincronizar".
7. Teste obrigatório: modo avião → 3 registros → volta online → 3 registros no banco, zero duplicata.

## 37. Observabilidade

- Log estruturado (JSON) com `client_uuid` como correlação ponta a ponta.
- Métricas mínimas no dashboard de admin: mensagens recebidas/processadas/erro por dia · latência média de processamento · taxa de mensagens em revisão · custo de API · tamanho da fila de sincronização.
- Alerta ao admin se a taxa de erro passar de 5% num dia.

---

# PARTE VII — UI/UX

## 38. Diretrizes

- **Mobile-first**, pensado para tela pequena, **sol forte e dedo sujo**: alto contraste, fonte grande, alvos de toque ≥ 48 px, nada de hover como única affordance.
- Estética **de campo, séria, não genérica de SaaS**: paleta terrosa (verde pastagem, terra, areia) + um acento forte reservado **exclusivamente** para alerta crítico.
- **Números são os protagonistas.** Hierarquia tipográfica agressiva: o custo/@ é o maior elemento da tela.
- Qualquer tela em **no máximo 2 toques** a partir do dashboard.
- Estados vazios instrutivos ("nenhum lote cadastrado — comece por aqui").
- Skeleton loaders, feedback imediato, confirmação destrutiva em dois passos.
- Modo escuro opcional. Acessibilidade AA: navegação por teclado, `aria-label`, contraste verificado.
- **Orçamentos de performance:** LCP < 2,5 s em 3G · bundle inicial < 200 KB gzip · dashboard < 800 ms com 5 anos de dados.
- Todo o texto em **pt-BR com vocabulário de campo** (§3). Nada de "entity", "record", "submit".

---

# PARTE VIII — SEGURANÇA, LGPD E CONTINUIDADE

## 39. Requisitos

- RLS negando por padrão (§14) + teste automatizado do invariante de acesso do trabalhador.
- `service_role` **jamais** no cliente. Chaves só em Edge Function/servidor.
- Webhook do bot com verificação de assinatura/secret token e **rate limit por telefone**.
- Validação de entrada com Zod em todas as bordas (webhook, API routes, formulários).
- **LGPD:** telefone e nome de trabalhador são dado pessoal — minimização, finalidade declarada, base legal (execução de contrato / legítimo interesse), prazo de retenção definido, política de privacidade simples no app e possibilidade de anonimização do trabalhador desligado **sem perder o histórico do fato** (substituir nome por "Trabalhador #N" mantendo `usuario_id`).
- **Backup:** diário automático do Supabase + **exportação manual completa em CSV/JSON a qualquer momento**. O dono nunca fica refém do sistema.
- **Plano de saída:** um comando exporta o banco inteiro em formato aberto e documentado.

---
