---
description: Executar uma fase do projeto de ponta a ponta, no formato obrigatório
argument-hint: [numero-da-fase, ex 1]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(npm run *), Bash(npm test*), Bash(npx supabase *)
---

Executar a **Fase $1** do projeto.

## Antes de escrever qualquer código

1. Leia `ESTADO.md` para saber o que já foi feito e quais suposições valem.
2. Leia `docs/07-entrega.md` (escopo e critério de saída desta fase).
3. Leia os documentos que a fase toca, conforme o mapa em `CLAUDE.md`.
4. Se a fase envolve cálculo, leia o **Anexo A** de `docs/08-anexos.md` — ele é o gabarito e tem precedência sobre a sua implementação.
5. Se a fase envolve função de domínio, leia o **Anexo B** — as assinaturas são fixas.
6. **Entre em plan mode e me mostre o plano antes de codar.**

## Ao entregar, siga exatamente este formato

1. Resumo em 5 linhas do que a fase resolve
2. Árvore de pastas da fase
3. Código completo, arquivo por arquivo, com o caminho no topo — **sem elisão**
4. SQL de migração idempotente, com RLS, índices e comentários
5. Testes correspondentes
6. Variáveis de ambiente e como obter cada uma
7. Passo a passo do zero: pasta vazia → rodando local → deploy
8. Bloco de decisões: 3 a 5 decisões de arquitetura e o porquê
9. O que ficou fora desta fase e em qual fase entra
10. Riscos conhecidos desta fase

## Ao terminar

- Rode `npm run lint`, `npm run typecheck` e `npm test`. Só declare a fase concluída se passarem.
- Atualize `ESTADO.md` (fase, decisões, suposições, pendências, log da sessão).
- Marque a fase como ✅ na tabela do `CLAUDE.md`.
- Rode a auto-verificação e declare `Auto-verificação: N/12 conformes`.
- Decisão do dono (ver `CLAUDE.md` regra 11): emende direto para a fase seguinte, sem esperar um novo comando — mas repita todo este processo (plan mode, formato de entrega, testes, auto-verificação) para ela. Só pare de verdade se faltar uma decisão que só o dono pode tomar.
