---
description: Rodar a auto-verificação de 12 pontos no que já existe no repositório
allowed-tools: Read, Glob, Grep, Bash(npm run *), Bash(npm test*)
---

Auditar o repositório inteiro (ou apenas `$ARGUMENTS`, se eu tiver especificado um caminho) contra a auto-verificação de 12 pontos.

Para cada item, responda **CONFORME** ou **FALHA** com o arquivo e a linha:

1. Código elidido (`...`, `TODO`, `implemente aqui`)
2. Número mágico de negócio fora de `parametros_fazenda`
3. `float`/`number` representando dinheiro
4. `src/domain/` importando framework, Supabase ou React
5. Cálculo divergindo do gabarito do Anexo A
6. Tabela sem RLS explícita negando por padrão
7. Qualquer caminho de leitura acessível a `trabalhador`
8. `registrado_em` usado onde deveria ser `data_do_fato`
9. Tela exibindo número derivado de dado ausente em vez de `— sem dado —`
10. Fórmula ou transição de estado sem teste, incluindo caso de borda
11. Disclaimer veterinário ou bloqueio de aftosa ausente/removível
12. Escopo além da fase corrente declarada em `ESTADO.md`

Ao final: `Auto-verificação: N/12 conformes` e uma lista priorizada do que corrigir primeiro.

**Não corrija nada nesta execução** — só relate.
