# Sistema de Gestão de Fazenda — repositório de trabalho para Claude Code

Cria-recria + leite · sul do Maranhão · PWA offline-first + captura de campo por voz.

Este repositório ainda **não tem código** — tem a especificação completa e a configuração para o Claude Code construir o sistema fase por fase.

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

## Estrutura

```
CLAUDE.md              ← memória de projeto, lida em toda sessão. Curta de propósito.
ESTADO.md              ← memória entre sessões: fase, decisões, suposições, pendências
README.md              ← este arquivo
docs/
  00-indice.md         ← mapa do que está em cada documento
  01-dominio.md        ← linguagem de campo, fórmulas, parâmetros, estados, alertas
  02-dados.md          ← DDL canônico (27 tabelas), RLS, auditoria, migração
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
