-- ============================================================================
-- Fase 3 — Visão: views materializadas de apoio a M2 (mapa de pastos) e M3
-- (indicadores de recria). Idempotente. Não altera schema/RLS da F1/F2.
--
-- Decisão de arquitetura: estas views só PRÉ-JUNTAM fatos caros de buscar
-- (pasto + lote atual + pesagem mais recente via LATERAL) — nenhuma fórmula
-- de negócio mora aqui. UA, lotação, limite de capacidade, GMD etc. são
-- calculados em TypeScript por src/domain/calculos/*, já testado contra o
-- Anexo A. Duplicar fórmula em SQL e em TS seria a mesma regra de negócio em
-- dois lugares — exatamente o que CLAUDE.md regra 5 proíbe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- mv_lotacao_por_pasto (M2) — um pasto por linha, com o lote atual e a
-- pesagem mais recente desse lote, se houver.
-- ----------------------------------------------------------------------------

create materialized view if not exists mv_lotacao_por_pasto as
select
  pt.id as pasto_id,
  pt.nome as pasto_nome,
  pt.tamanho_ha,
  pt.capim,
  pt.tem_acude,
  pt.nivel_acude,
  pt.nivel_acude_em,
  pt.status as pasto_status,
  pt.data_entrada_lote_atual,
  pt.data_saida_ultimo_lote,
  lt.id as lote_id,
  lt.nome as lote_nome,
  lt.categoria as lote_categoria,
  lt.cabecas_atuais,
  pr.peso as peso_medio_kg,
  pr.data as peso_medio_data
from pastos pt
left join lotes lt on lt.id = pt.lote_atual_id and lt.deletado_em is null
left join lateral (
  select p.peso, p.data
  from pesagens p
  where p.lote_id = lt.id and p.deletado_em is null
  order by p.data desc, p.registrado_em desc
  limit 1
) pr on true;

create unique index if not exists ix_mv_lotacao_por_pasto_pasto on mv_lotacao_por_pasto (pasto_id);

comment on materialized view mv_lotacao_por_pasto is
  'docs/02-dados.md §15 — pré-junção para o mapa de pastos (M2). Fórmulas ficam em src/domain/calculos (avaliarLotacao).';

-- ----------------------------------------------------------------------------
-- mv_indicadores_recria (M3) — um lote ativo por linha, com as duas
-- pesagens mais recentes (pra GMD) e o pasto atual.
-- ----------------------------------------------------------------------------

create materialized view if not exists mv_indicadores_recria as
select
  lt.id as lote_id,
  lt.nome as lote_nome,
  lt.categoria as lote_categoria,
  lt.tipo_operacao,
  lt.data_entrada,
  lt.cabecas_atuais,
  lt.peso_entrada,
  lt.pasto_id,
  ps.nome as pasto_nome,
  ps.tamanho_ha,
  ps.data_entrada_lote_atual,
  pr2.peso as peso_ultima_kg,
  pr2.data as peso_ultima_data,
  pr1.peso as peso_penultima_kg,
  pr1.data as peso_penultima_data
from lotes lt
left join pastos ps on ps.id = lt.pasto_id
left join lateral (
  select p.peso, p.data
  from pesagens p
  where p.lote_id = lt.id and p.deletado_em is null
  order by p.data desc, p.registrado_em desc
  limit 1
) pr2 on true
left join lateral (
  select p.peso, p.data
  from pesagens p
  where p.lote_id = lt.id and p.deletado_em is null and p.data < pr2.data
  order by p.data desc, p.registrado_em desc
  limit 1
) pr1 on true
where lt.status = 'ativo' and lt.deletado_em is null;

create unique index if not exists ix_mv_indicadores_recria_lote on mv_indicadores_recria (lote_id);

comment on materialized view mv_indicadores_recria is
  'docs/02-dados.md §15 — pré-junção para o painel RECRIA (M3). GMD, peso projetado etc. ficam em src/domain/calculos.';

-- ----------------------------------------------------------------------------
-- Refresh. Decisão: SEM `concurrently`. `REFRESH MATERIALIZED VIEW
-- CONCURRENTLY` não pode rodar dentro de uma function/transação (restrição
-- do próprio Postgres) — só funcionaria via `CALL` de uma PROCEDURE com
-- commit no meio, e o RPC do PostgREST/Supabase não expõe isso. No tamanho
-- de dado desta fazenda (uma propriedade, algumas dezenas de pastos/lotes),
-- o lock breve do refresh sem `concurrently` é imperceptível; os índices
-- únicos acima continuam úteis pra performance de leitura, só deixam de ser
-- estritamente obrigatórios.
-- Chamada pelo worker /api/workers/atualizar-indicadores (cron a cada 15 min).
-- ----------------------------------------------------------------------------

create or replace function atualizar_views_indicadores() returns void
language plpgsql
as $$
begin
  refresh materialized view mv_lotacao_por_pasto;
  refresh materialized view mv_indicadores_recria;
end;
$$;

comment on function atualizar_views_indicadores() is
  'docs/02-dados.md §15 — refresh das views de indicador. SECURITY INVOKER: quem chama precisa ter privilégio de refresh (service_role tem).';

-- Views materializadas não carregam dado financeiro nem pessoal — só select
-- pra quem já é authenticated (admin/gerente; trabalhador nunca tem sessão,
-- §14). RLS não se aplica a matviews no Postgres; select explícito basta.
grant select on mv_lotacao_por_pasto to authenticated;
grant select on mv_indicadores_recria to authenticated;

-- ----------------------------------------------------------------------------
-- Parâmetro novo do worker de alertas (CLAUDE.md regra 3 — nada hardcoded).
-- docs/01-dominio.md §12, alerta "sincronizacao_parada": "trabalhador ativo
-- sem mensagem há 7 dias" — o "7" vira parâmetro editável, como todo limiar.
-- ----------------------------------------------------------------------------

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('DIAS_SEM_MENSAGEM_ALERTA', '7', 'number', 'dias', 'docs/01-dominio.md §12 — trabalhador ativo sem mandar mensagem há tantos dias gera alerta de sincronização parada')
on conflict (chave) do nothing;
