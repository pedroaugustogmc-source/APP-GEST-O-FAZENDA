---
description: Implementar ou corrigir uma função de domínio com teste
argument-hint: [nome da função ou do cálculo]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(npm test*)
---

Implementar/corrigir a função de domínio: **$ARGUMENTS**

1. Leia a fórmula canônica em `docs/01-dominio.md` (§9).
2. Leia a assinatura obrigatória no **Anexo B** de `docs/08-anexos.md`. A assinatura é fixa — não invente outra.
3. Implemente em `src/domain/calculos/<nome>.ts`: função **pura**, sem I/O, sem ler relógio (a data entra por parâmetro), sem import de framework.
4. Se o resultado pode não existir, retorne `Indicador<T>` com `valor`, `n`, `dataBase`, `qualidade` e `motivo` — nunca `number | null` solto.
5. Escreva `src/domain/calculos/<nome>.spec.ts` cobrindo: caso feliz · divisão por zero · amostra vazia · dado ausente · valores de borda · e, quando aplicável, **o caso exato do Anexo A**.
6. Rode `npm test` e mostre a saída.
