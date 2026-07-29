---
description: Trabalhar no extrator do bot com o protocolo de avaliação obrigatório
argument-hint: [o que mudar no prompt/extrator]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(npm test*)
---

Alteração no extrator: **$ARGUMENTS**

1. Leia `docs/04-bot.md` (prompt de sistema, few-shots, validação semântica).
2. Leia o **Anexo C** (copy deck — o texto que o vaqueiro lê é literal, não parafraseie) e o **Anexo D** (protocolo de avaliação).
3. Toda mudança de prompt **incrementa `PROMPT_VERSION`** e a versão é gravada em `mensagens_bot`.
4. Rode o conjunto de ouro (`tests/golden/`) antes e depois. Mostre as duas medições lado a lado:
   acurácia de tipo · acurácia de campo · **taxa de invenção** · recall multi-evento · precisão de recusa · calibração.
5. **Taxa de invenção acima de zero bloqueia a mudança.** Sem exceção, sem "é só um caso".
6. Nenhuma versão sobe sem empatar ou superar a vigente em **todas** as métricas.
7. Se o conjunto de ouro ainda não existir, crie-o primeiro com os 12 few-shots de `docs/04-bot.md` como base.
