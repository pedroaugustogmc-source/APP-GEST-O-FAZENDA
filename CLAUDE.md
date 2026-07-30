# CLAUDE.md — Sistema de Gestão de Fazenda

> Memória de projeto. Você lê este arquivo em toda sessão. Ele é curto de propósito.
> **A especificação completa está em `docs/`. Leia o arquivo relevante ANTES de codar — não trabalhe de memória.**

---

## O que é

PWA offline-first + bot de captura por voz para uma fazenda de **cria-recria + leite** no sul do Maranhão.

**Frase-guia:** o vaqueiro só fala · o sistema pensa · o dono decide.

O sistema existe para responder três perguntas, nesta ordem:

1. Quanto custa a arroba, hoje, neste lote?
2. Estou acima ou abaixo do ponto de equilíbrio em relação ao preço da região?
3. O que eu faço esta semana, por ordem de prioridade?

Se uma decisão sua não serve a uma dessas três, é acessório — entra depois.

---

## Mapa da documentação — leia sob demanda

| Vou mexer em... | Leia antes |
|---|---|
| qualquer cálculo, indicador, alerta | `docs/01-dominio.md` |
| schema, migração, RLS, auditoria | `docs/02-dados.md` |
| qualquer tela ou funcionalidade | `docs/03-modulos.md` |
| bot, transcrição, extração, validação | `docs/04-bot.md` |
| stack, camadas, sincronização, UX, segurança | `docs/05-arquitetura.md` |
| testes, critérios de aceite, anti-padrões | `docs/06-qualidade.md` |
| o que entregar em cada fase | `docs/07-entrega.md` |
| **verificar se um número está certo** | `docs/08-anexos.md` (Anexo A) |
| assinatura de função de domínio | `docs/08-anexos.md` (Anexo B) |
| texto que o bot manda pro vaqueiro | `docs/08-anexos.md` (Anexo C) |

**Estado atual do projeto:** `ESTADO.md` — leia no início de toda sessão e atualize no fim.

---

## Regras invioláveis

1. **Nada de código elidido.** Zero `// ...resto`, `TODO`, `implemente aqui`. Arquivo entregue é arquivo inteiro.
2. **Nada de dado inventado.** Sem dado → a tela mostra `— sem dado —`. Nunca um número plausível.
3. **Nada de número mágico.** Todo limiar/fator/taxa vive em `parametros_fazenda`.
4. **Dinheiro é `bigint` em centavos.** Nunca `float`, nunca `number`.
5. **Regra de negócio mora em `src/domain/`.** Puro, sem framework, sem I/O, com teste. `domain` não importa nada de fora.
6. **Sem `DELETE` em tabela de fato.** Só estorno ou soft-delete versionado.
7. **Trabalhador de campo NUNCA lê dado.** Só grava, e só pelo bot. Isso é arquitetura, não regra.
8. **Offline é o estado normal.** Nunca bloquear a UI por falta de internet.
9. **Data do fato ≠ data do registro.** Relatório usa `data_do_fato`, sempre.
10. **Conteúdo veterinário é organizacional, não prescritivo.** Disclaimer obrigatório, aftosa bloqueada (MA é zona livre sem vacinação desde abr/2024).
11. **Uma fase por vez.** Termina, para, espera validação. Não emenda a próxima.
12. **Português de campo em toda a UI e em todo texto do bot.** Nada de "record", "submit", "entity".

---

## Stack

Next.js 14+ (App Router) · TypeScript strict · Tailwind · shadcn/ui · PWA offline-first (IndexedDB + fila) · Supabase (Postgres + RLS + Edge Functions) · Claude API (transcrição/extração/relatório) · Telegram Bot API atrás de `MessagingAdapter` (WhatsApp na F6) · Google Calendar · Vitest + Playwright · Vercel.

```
src/
  domain/     # regras puras, testáveis, ZERO import de framework
    calculos/ validacao/ estados/ alertas/ tipos/
  infra/      # supabase/ claude/ messaging/ calendar/
  app/        # rotas Next — só UI
  components/
  workers/    # jobs: alertas, relatório semanal, refresh de views
tests/  supabase/migrations/  docs/
```

Dependência permitida: `app → infra → domain`. Violação é erro de lint.

---

## Comandos do projeto

```bash
npm run dev            # ambiente local
npm run build          # build de produção
npm run lint           # eslint + boundaries
npm run typecheck      # tsc --noEmit
npm test               # vitest (domínio)
npm run test:e2e       # playwright
npm run db:reset       # supabase db reset (aplica migrações + seed)
npm run db:new -- nome # nova migração
npm run gabarito       # roda a fixture do Anexo A e compara com o esperado
```

---

## Fases (uma por vez, nesta ordem)

| Fase | Escopo | Estado |
|---|---|---|
| F0 | Perguntas de contexto (máx. 10) e suposições declaradas | ✅ |
| F1 | DDL + RLS + seed de parâmetros e vacinas + auth admin + shell PWA + importador de planilha | ✅ |
| F2 | Bot + transcrição + extração + validação + fila offline + fila de revisão + RBAC | ⬜ |
| F3 | Mapa de pastos + rebanho cria/recria + calendário sanitário + dashboard | ⬜ |
| F4 | Financeiro + custo/@ + DRE por lote + ponto de equilíbrio + cenários + mercado | ⬜ |
| F5 | Máquinas + checklist + cotações + priorização semanal + Calendar + relatórios | ⬜ |
| F6 | WhatsApp Business API + exportação/PDF + compliance + multi-fazenda | ⬜ |

Atualize esta tabela e `ESTADO.md` ao concluir cada fase.

---

## Antes de responder qualquer coisa — auto-verificação

Rode a checagem de 12 itens de `docs/07-entrega.md` (§0.1) e declare ao final:
`Auto-verificação: N/12 conformes` — nomeando o que falhou, se falhou.

**Entrega honestamente incompleta é aceitável. Entrega falsamente completa não é.**

---

## O que este projeto NÃO é

Não é ERP contábil · não emite nota fiscal · não integra hardware de balança até a F6 · não é multi-fazenda até a F6 · não dá diagnóstico, prescrição ou dose veterinária em nenhuma fase · não substitui GTA nem documento oficial (só prepara o dado).

**Complexidade não pedida é dívida. Se achar que algo acima deveria entrar, argumente antes — não implemente.**
