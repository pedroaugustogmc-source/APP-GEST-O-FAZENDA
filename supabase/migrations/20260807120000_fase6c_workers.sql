-- ============================================================================
-- Fase 6c — Multi-fazenda nos workers e nas views materializadas. Pedido do
-- dono depois da F6b ("reestruturar os workers pra iterar por propriedade").
--
-- Achado durante a implementação, mais sério que o item original da lista de
-- pendências: as 3 views materializadas (mv_lotacao_por_pasto,
-- mv_indicadores_recria, mv_efetivo_por_categoria) NÃO têm — e não podem
-- ter — RLS (Postgres não suporta RLS em matview). Isso significa que, com
-- 2+ fazendas, QUALQUER admin autenticado que consultasse essas views direto
-- veria o dado de TODAS as fazendas misturado — não é só os workers que
-- precisavam de conserto, é uma leitura cross-tenant real nas telas
-- /pastos, /rebanho, /compliance, /financeiro/dre, /financeiro/cenarios e no
-- dashboard. Corrigido com 2 mecanismos:
--   1. As 3 matviews ganham `propriedade_id` (via join com pastos/lotes, que
--      já têm a coluna desde a F6; mv_efetivo_por_categoria via
--      animais.registrado_por -> usuarios_acesso, mesma derivação do Grupo A).
--   2. 3 views (não materializadas) finas por cima de cada matview, filtrando
--      `where propriedade_id = current_propriedade_id()` — como
--      current_propriedade_id() é security definer e lê auth.uid(), isso dá
--      o equivalente de RLS pras telas autenticadas sem duplicar dado. Os
--      workers (service_role, sem auth.uid()) continuam lendo a matview crua
--      com filtro explícito por propriedade, dentro do laço por fazenda.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. alertas/tarefas/relatorios ganham propriedade_id — eram as 3 tabelas
-- que ficaram de fora da F6b porque só os workers as escrevem, e os workers
-- ainda não sabiam qual fazenda usar. Agora sabem (ver o restante desta
-- migração + as rotas atualizadas).
-- ----------------------------------------------------------------------------

alter table alertas    add column if not exists propriedade_id uuid references propriedade(id);
alter table tarefas    add column if not exists propriedade_id uuid references propriedade(id);
alter table relatorios add column if not exists propriedade_id uuid references propriedade(id);

do $$
declare
  v_propriedade_id uuid;
begin
  select id into v_propriedade_id from propriedade order by criado_em limit 1;
  if v_propriedade_id is not null then
    update alertas    set propriedade_id = v_propriedade_id where propriedade_id is null;
    update tarefas    set propriedade_id = v_propriedade_id where propriedade_id is null;
    update relatorios set propriedade_id = v_propriedade_id where propriedade_id is null;
  end if;
end $$;

-- `uq_alerta_aberto` original não considerava fazenda — 2 fazendas com o
-- mesmo tipo de alerta pra entidades homônimas (ex.: mesma vacina do
-- catálogo global) colidiriam. Substituída por uma que inclui propriedade_id.
alter table alertas drop constraint if exists uq_alerta_aberto;
alter table alertas add constraint uq_alerta_aberto
  unique (propriedade_id, tipo, entidade_tipo, entidade_id, resolvido_em);

do $$
declare
  tbl text;
  tabelas_grupo_b2 text[] := array['alertas', 'tarefas', 'relatorios'];
begin
  foreach tbl in array tabelas_grupo_b2 loop
    execute format('drop policy if exists admin_select on %I', tbl);
    execute format(
      'create policy admin_select on %I for select using (current_papel() = ''admin'' and propriedade_id = current_propriedade_id())', tbl
    );
    execute format('drop policy if exists admin_insert on %I', tbl);
    execute format(
      'create policy admin_insert on %I for insert with check (current_papel() = ''admin'' and propriedade_id = current_propriedade_id())', tbl
    );
    execute format('drop policy if exists admin_update on %I', tbl);
    execute format(
      'create policy admin_update on %I for update using (current_papel() = ''admin'' and propriedade_id = current_propriedade_id()) with check (current_papel() = ''admin'' and propriedade_id = current_propriedade_id())',
      tbl
    );
    execute format('drop policy if exists gerente_select on %I', tbl);
    execute format(
      'create policy gerente_select on %I for select using (current_papel() = ''gerente'' and propriedade_id = current_propriedade_id())', tbl
    );
    execute format('drop policy if exists gerente_insert on %I', tbl);
    execute format(
      'create policy gerente_insert on %I for insert with check (current_papel() = ''gerente'' and propriedade_id = current_propriedade_id())', tbl
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. As 3 views materializadas ganham propriedade_id. Matview não aceita
-- ADD COLUMN — precisa recriar (drop + create); os índices e grants se vão
-- junto e precisam ser refeitos.
-- ----------------------------------------------------------------------------

drop materialized view if exists mv_lotacao_por_pasto;
create materialized view mv_lotacao_por_pasto as
select
  pt.id as pasto_id,
  pt.propriedade_id,
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
create index if not exists ix_mv_lotacao_por_pasto_propriedade on mv_lotacao_por_pasto (propriedade_id);
comment on materialized view mv_lotacao_por_pasto is
  'docs/02-dados.md §15 — pré-junção para o mapa de pastos (M2). Fórmulas ficam em src/domain/calculos (avaliarLotacao). Sem RLS (matview) — ver v_lotacao_por_pasto para leitura autenticada.';
grant select on mv_lotacao_por_pasto to authenticated;

drop materialized view if exists mv_indicadores_recria;
create materialized view mv_indicadores_recria as
select
  lt.id as lote_id,
  lt.propriedade_id,
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
create index if not exists ix_mv_indicadores_recria_propriedade on mv_indicadores_recria (propriedade_id);
comment on materialized view mv_indicadores_recria is
  'docs/02-dados.md §15 — pré-junção para o painel RECRIA (M3), DRE e alertas de custo. Sem RLS (matview) — ver v_indicadores_recria para leitura autenticada.';
grant select on mv_indicadores_recria to authenticated;

drop materialized view if exists mv_efetivo_por_categoria;
create materialized view mv_efetivo_por_categoria as
select
  u.propriedade_id,
  a.categoria,
  a.sexo,
  count(*) as cabecas
from animais a
join usuarios_acesso u on u.id = a.registrado_por
where a.status = 'ativo' and a.deletado_em is null
group by u.propriedade_id, a.categoria, a.sexo;

create unique index if not exists ix_mv_efetivo_categoria_sexo on mv_efetivo_por_categoria (propriedade_id, categoria, sexo);
comment on materialized view mv_efetivo_por_categoria is
  'Anexo H — declaração de rebanho. Sem RLS (matview) — ver v_efetivo_por_categoria para leitura autenticada.';
grant select on mv_efetivo_por_categoria to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Views finas com o filtro de fazenda embutido — o que uma tela
-- autenticada deve consultar em vez da matview crua. Nome começando com
-- "v_" (não "mv_") de propósito, pra não ter dúvida de qual delas tem o
-- filtro.
-- ----------------------------------------------------------------------------

create or replace view v_lotacao_por_pasto as
select * from mv_lotacao_por_pasto where propriedade_id = current_propriedade_id();
grant select on v_lotacao_por_pasto to authenticated;

create or replace view v_indicadores_recria as
select * from mv_indicadores_recria where propriedade_id = current_propriedade_id();
grant select on v_indicadores_recria to authenticated;

create or replace view v_efetivo_por_categoria as
select * from mv_efetivo_por_categoria where propriedade_id = current_propriedade_id();
grant select on v_efetivo_por_categoria to authenticated;
