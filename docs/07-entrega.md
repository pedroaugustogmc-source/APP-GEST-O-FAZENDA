# PARTE X — ENTREGA

> A auto-verificação de 12 pontos citada como §0.1 está reproduzida no fim deste arquivo.

## 43. Fases

| Fase | Escopo | Critério de saída |
|---|---|---|
| **F1 — Fundação** | DDL completo + RLS + seed de `parametros_fazenda` e `vacinas_catalogo` + auth admin + shell do PWA + importador de planilha (§17) | Banco de pé, app instalável, planilha antiga importada |
| **F2 — Captura** | Bot Telegram + transcrição + extração + validação + fila offline + fila de revisão + RBAC completo (§M11) | O dado entra sozinho pela voz |
| **F3 — Visão** | Mapa de pastos (M2) + rebanho cria/recria (M3) + calendário sanitário (M4) + dashboard (M10) | O dado vira imagem |
| **F4 — Dinheiro** | Financeiro completo (M5) + custo/@ + DRE por lote + ponto de equilíbrio + cenários + mercado (M6) | O dado vira decisão |
| **F5 — Rotina** | Máquinas (M7) + checklist e cotações (M8) + priorização semanal + Google Calendar + relatórios semanal/trimestral (M9) | O sistema passa a dirigir a semana |
| **F6 — Escala** | Migração para WhatsApp Business API + exportação/PDF + compliance/GTA + multi-fazenda | Pronto para crescer |

**Entregue uma fase por resposta, completa e funcional, e PARE para eu validar antes de seguir.**

## 44. Formato obrigatório de cada entrega

1. **Resumo em 5 linhas** do que a fase resolve.
2. **Árvore de pastas** completa da fase.
3. **Código completo, arquivo por arquivo**, com o caminho no topo (`// src/domain/calculos/custoArroba.ts`). Sem elisão (§2.1).
4. **SQL de migração** idempotente, com RLS, índices e comentários.
5. **Testes** correspondentes.
6. **Variáveis de ambiente** e como obter cada uma.
7. **Passo a passo do zero**: pasta vazia → rodando local → deploy.
8. **Bloco de decisões:** 3 a 5 decisões de arquitetura que você tomou e por quê.
9. **O que ficou fora desta fase** e em qual fase entra.
10. **Riscos conhecidos** desta fase, se houver.

## 45. FASE 0 — antes de qualquer código

Faça **no máximo 10 perguntas objetivas**, só sobre o que muda decisão de arquitetura e que **só eu posso responder** — por exemplo: número de pastos e de cabeças, se o leite é atividade principal ou secundária, quantos trabalhadores usarão o bot, se existe planilha atual para importar e em qual formato, tipos de capim reais, modelos e anos dos tratores, se há estação de monta definida, se o rebanho tem brinco individual ou é controlado por lote.

**Não pergunte nada que já esteja neste documento.** Para tudo que eu não responder, **assuma o padrão mais sensato para uma fazenda cria-recria do sul do Maranhão, declare a suposição explicitamente e siga.** Não trave esperando resposta.

---

---

## §0.1. Protocolo de auto-verificação (rode ANTES de enviar cada resposta)

Percorra esta lista em silêncio e corrija o que falhar. Ao final da resposta, declare: `Auto-verificação: N/12 conformes` — e, se algum item falhar, diga qual e por quê.

1. **Elisão:** existe `...`, `// resto do código`, `TODO`, `implemente aqui`? → reescreva o arquivo inteiro.
2. **Número mágico:** constante numérica de negócio fora de `parametros_fazenda`? → mover.
3. **Dinheiro:** `number`/`float` representando valor monetário? → centavos em `bigint`.
4. **Camada:** `src/domain/` importando framework, Supabase ou React? → remover.
5. **Gabarito:** os cálculos reproduzem **exatamente** os números do Anexo A? → se não, o errado é o código.
6. **RLS:** toda tabela desta entrega tem policy explícita negando por padrão? → corrigir.
7. **Trabalhador:** existe algum caminho pelo qual um `trabalhador` **lê** dado? → eliminar.
8. **Data:** algum indicador usa `registrado_em` onde deveria usar `data_do_fato`? → corrigir.
9. **Dado inventado:** alguma tela exibe número derivado de dado ausente em vez de `— sem dado —`? → corrigir.
10. **Teste:** toda fórmula e transição de estado desta fase têm teste, com caso de borda? → escrever.
11. **Sanitário:** disclaimer veterinário e bloqueio de aftosa presentes e não removíveis? → restaurar.
12. **Escopo:** entreguei mais de uma fase nesta resposta? → cortar e parar na fase corrente.

**Se você não puder cumprir algum item, diga isso na abertura da resposta em vez de entregar algo que aparenta estar completo.** Entrega honestamente incompleta é aceitável; entrega falsamente completa não é.
