# PARTE IX — QUALIDADE

## 40. Testes obrigatórios

- **Unitário:** 100% das fórmulas de §9, incluindo divisão por zero, período sem pesagem, lote vazio, animal sem data de nascimento.
- **Unitário:** todas as transições de §11, inclusive as inválidas.
- **Unitário:** todas as regras de §32 com o caso positivo e o negativo.
- **Integração:** pipeline completo do bot com áudios/transcrições de exemplo (os 12 few-shots de §31 viram casos de teste).
- **Segurança:** JWT de `trabalhador` não lê nada, em nenhuma tabela.
- **E2E:** fluxo offline (§36 item 7) · remoção de trabalhador · bloqueio de aftosa · brucelose fora da janela.

## 41. Critérios de aceite — Given / When / Then

1. **Offline** — *Dado* um vaqueiro sem sinal, *quando* ele manda 3 notas de voz e o sinal volta, *então* os 3 registros aparecem no app, na ordem correta, sem duplicar e sem perder.
2. **Multi-evento** — *Dado* o áudio "passei o lote 2 pro pasto do buriti e o açude tá pela metade", *quando* processado, *então* são criados 1 `movimentacoes_pasto` e 1 leitura de `nivel_acude`.
3. **Desligamento** — *Dado* um trabalhador removido, *quando* ele manda mensagem, *então* é rejeitado antes de qualquer chamada de API paga, **e** tudo que ele registrou continua consultável pelo admin.
4. **Rotação** — *Dado* um lote movido por voz, *quando* a mensagem é gravada, *então* o card do pasto de origem e o de destino atualizam sozinhos e os **dias de descanso** ficam calculados e congelados no histórico.
5. **Lotação** — *Dado* um piquete de Marandu com UA/ha acima da referência + tolerância, *então* alerta `superlotacao` crítico no dashboard **com sugestão de para onde mover**.
6. **Açude** — *Dado* nível abaixo de `NIVEL_ACUDE_CRITICO`, *então* aquele pasto entra no topo da fila de saída da rotação.
7. **Aftosa** — *Dado* qualquer tentativa de registrar vacina de aftosa, *então* o sistema bloqueia e exibe o aviso da AGED/MA.
8. **Brucelose** — *Dado* uma tentativa em macho ou em fêmea de 10 meses, *então* recusa **explicando a janela de 3 a 8 meses**.
9. **Incompatibilidade** — *Dado* clostridiose agendada no mesmo dia da brucelose, *então* o sistema impede e **sugere a data ~30 dias depois**.
10. **Custo** — *Dado* um lote com custos e pesagens lançados, *então* o custo por arroba e o ponto de equilíbrio **batem com o cálculo manual em planilha**, com no máximo 1 centavo de diferença por arredondamento.
11. **Cenários** — *Dado* o comando de simulação, *então* saem 3 cenários (alta/estável/queda × seca) com gráfico de fluxo de caixa de 90 dias.
12. **Cotação** — *Dado* 3 orçamentos com prazos diferentes, *então* o sistema aponta o **vencedor por custo efetivo**, que pode não ser o de menor preço nominal.
13. **Priorização** — *Dado* o início da semana, *então* existe uma agenda com tarefas ordenadas e **cada uma com uma frase de justificativa**.
14. **Relatório** — *Dado* o fim da semana, *então* o relatório é gerado sozinho e **é legível por alguém que não é técnico**.
15. **Honestidade** — *Dado* um indicador sem dado recente, *então* ele aparece como estimativa fraca com a data — **nunca como número firme**.

## 42. Definition of Done (por fase)

Uma fase só está entregue quando: compila com `strict` sem `any` não justificado · lint e typecheck limpos · testes da fase passando · migração roda do zero em banco vazio · RLS testada · README atualizado · variáveis de ambiente documentadas · nenhum `TODO` no código.

---

# PARTE XI — ANTI-PADRÕES E ARMADILHAS DO DOMÍNIO

Erros que **já derrubaram** sistemas parecidos. Evite todos, explicitamente:

1. **Confundir data do fato com data do registro.** Um dado de terça registrado no sábado é de terça. Todo relatório usa `data_do_fato`.
2. **Somar custo de cria com custo de recria.** Esconde exatamente onde a margem some.
3. **Calcular GMD com uma pesagem só.** Sem duas medições, não existe ganho — existe chute.
4. **Usar peso vivo onde o certo é carcaça.** Arroba é carcaça; aplicar `RENDIMENTO_CARCACA` sempre.
5. **Tratar UA como cabeça.** Uma vaca com bezerro não é 1 UA. Calcular por peso vivo.
6. **Deixar o vaqueiro consultar dado.** Quebra o modelo de segurança inteiro.
7. **Apagar registro para "corrigir".** Destrói auditoria. Use estorno.
8. **Assumir que o áudio chega em ordem cronológica.** Não chega. Ordene por `data_do_fato`.
9. **Alerta que grita todo dia.** Deduplicar e auto-resolver, ou o usuário para de ler.
10. **Exibir preço de mercado sem data.** Decisão de venda com preço velho é prejuízo.
11. **Hardcodar capacidade de suporte.** Capim, solo e chuva mudam tudo; é parâmetro.
12. **Ignorar a seca.** Projeção de venda sem sensibilidade à estiagem sempre erra para otimista.
13. **Formulário no celular do vaqueiro.** Ele não vai preencher. Voz ou nada.
14. **Bloquear o app quando não há internet.** É o estado normal, não um erro.
15. **Relatório com jargão.** Se o dono precisa traduzir, o relatório falhou.

---

**Comece pela Fase 0 (§45). Não escreva código antes disso.**

---
