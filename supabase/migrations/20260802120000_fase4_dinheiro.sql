-- ============================================================================
-- Fase 4 — Dinheiro: parâmetros novos para os cenários de preço/seca.
-- Idempotente. `financeiro`, `cotacoes`, `precos_mercado` já existem desde a
-- migração da F1 — nenhuma mudança de schema nesta fase.
-- ============================================================================

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('VARIACAO_PRECO_CENARIO_PCT', '0.10', 'number', 'fração', 'docs/03-modulos.md M5 — variação de preço para os cenários "alta"/"queda" (± sobre o preço atual); "estável" não varia'),
  ('FATOR_GMD_SECA', '0.6', 'number', 'fração', 'docs/06-qualidade.md anti-padrão nº 12 — fração do GMD normal mantida durante dias de estiagem na simulação de cenários; ponto de partida, ajustar com dado real da fazenda'),
  ('DIAS_PRECO_MERCADO_DESATUALIZADO', '7', 'number', 'dias', 'docs/03-modulos.md M6 — "preço com mais de 7 dias aparece marcado como desatualizado"'),
  ('MARGEM_DECISAO_MERCADO_PCT', '0.10', 'number', 'fração', 'docs/03-modulos.md M6 — faixa (±) de distância do ponto de equilíbrio da fazenda dentro da qual a decisão semanal sugerida é SEGURAR, em vez de COMPRAR/VENDER'),
  ('PESO_REFERENCIA_BOI_GORDO_KG', '500', 'number', 'kg', 'docs/03-modulos.md M6 — peso vivo de referência do "boi gordo" usado para converter arroba_boi em preço por cabeça na relação de troca com o bezerro')
on conflict (chave) do nothing;

-- ----------------------------------------------------------------------------
-- `financeiro` ganha lançamento direto pelo admin nesta fase (além do bot,
-- que já grava despesa/receita desde a F2) — precisa de client_uuid pra
-- idempotência da fila offline (§36 item 4), mesmo padrão já usado em 7
-- outras tabelas na F1. Regra do §13: "pode acrescentar campos, não pode remover".
-- ----------------------------------------------------------------------------

alter table financeiro add column if not exists client_uuid text unique;

-- Mesma razão para `precos_mercado`: a tela de mercado (M6) grava preço
-- direto pelo admin, pela fila offline padrão (docs/05-arquitetura.md §36) —
-- "offline é o estado normal" (CLAUDE.md regra 8) vale pra toda tela de
-- cadastro do admin, não só o bot de campo.
alter table precos_mercado add column if not exists client_uuid text unique;
