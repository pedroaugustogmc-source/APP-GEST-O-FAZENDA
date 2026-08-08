-- Fase 1 do plano de expansão da tela Mercado (M6): categoria "boi magro /
-- reposição" — única categoria animal do pedido que ainda não existia
-- (bezerro, garrote e vaca gorda/arroba_vaca já cobriam o resto). Insumo,
-- diesel e frete ficam de fora de propósito: já são escopo de `cotacoes`
-- (M8), que compara fornecedor/prazo/desconto — duplicar em precos_mercado
-- criaria duas fontes de verdade pro mesmo dado.

alter table precos_mercado drop constraint if exists precos_mercado_tipo_check;
alter table precos_mercado add constraint precos_mercado_tipo_check
  check (tipo in ('arroba_boi','arroba_vaca','boi_magro','bezerro','bezerra','garrote','novilha','leite_litro'));
