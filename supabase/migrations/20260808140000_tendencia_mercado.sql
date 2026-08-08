-- Tendência de mercado (M6): limiar abaixo do qual a variação de 15 dias
-- conta como "estável" em vez de alta/baixa. Mesmo padrão de
-- MARGEM_DECISAO_MERCADO_PCT (fase4_dinheiro.sql) — fração, não pontos
-- percentuais.

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('LIMIAR_TENDENCIA_ESTAVEL_PCT', '0.03', 'number', 'fração',
   'Tendência de mercado (M6): variação de 15 dias abaixo deste limiar (em módulo) conta como "estável"; acima, "alta" ou "baixa" conforme o sinal.')
on conflict (chave) do nothing;
