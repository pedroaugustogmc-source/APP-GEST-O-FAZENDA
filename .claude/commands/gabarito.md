---
description: Validar os cálculos implementados contra o gabarito numérico do Anexo A
allowed-tools: Read, Glob, Grep, Bash(npm run *), Bash(npm test*)
---

Leia o **Anexo A** em `docs/08-anexos.md` e valide a implementação atual contra ele.

Monte uma tabela: `indicador | esperado | obtido | bate?`

Cubra: GMD · ganho do lote · arrobas produzidas · custo por arroba produzida · arrobas de carcaça na venda · custo de entrada · custo acumulado · **ponto de equilíbrio** · distância do breakeven · receita projetada · margem do lote · margem por cabeça · margem por hectare · UA · UA/ha · limite de lotação · disparo do alerta · cabeças a mover · custo efetivo das 3 cotações · vencedor da cotação · rateio por UA-dia dos 2 lotes · fechamento exato da soma do rateio.

Regras:

- Divergência = **o código está errado, não o gabarito**.
- Preste atenção especial a arredondamento intermediário (Anexo G): calcular com precisão plena e arredondar só na exibição. `367,4667 @` × 245 = R$ 90.029,33; arredondar antes dá R$ 90.030,15 — errado.
- Se algum cálculo ainda não existir, diga "não implementado" em vez de simular o resultado.
