-- ============================================================================
-- Foto de pasto — pedido direto do dono na tela /pastos ("quero poder
-- adicionar a imagem dos pastos da fazenda"). Não é fase da tabela oficial.
--
-- Guarda só o CAMINHO no Storage (`pastos.foto_path`), nunca uma URL
-- assinada: URL assinada expira e a matview só é atualizada pelo worker
-- diário — se guardasse a URL pronta, ela ficaria quebrada entre um refresh
-- e outro. A URL de exibição é gerada a cada carregamento de página
-- (createSignedUrls, em pastos/page.tsx), sempre fresca.
--
-- Bucket privado (não público): fotos de pasto são dado operacional da
-- fazenda, mesmo tratamento de isolamento entre fazendas que o resto do
-- projeto já tem (F6b/F6c) — nada de URL pública adivinhável cruzando
-- propriedade. RLS em storage.objects usa o mesmo current_propriedade_id()/
-- current_papel() já usados em toda tabela (docs/02-dados.md §14):
-- caminho é sempre "{propriedade_id}/{arquivo}", só admin/gerente da própria
-- fazenda lê/grava.
-- ============================================================================

alter table pastos add column if not exists foto_path text;

-- ----------------------------------------------------------------------------
-- 1. Bucket. 5MB, só imagem — mesmo espírito de "sem número mágico" do
-- CLAUDE.md regra 3 seria exagero aqui (limite de upload é constante de
-- engenharia, não parâmetro de negócio da fazenda).
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-pastos', 'fotos-pastos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. RLS em storage.objects — caminho "{propriedade_id}/{arquivo}",
-- (storage.foldername(name))[1] dá o primeiro segmento do caminho.
-- Trabalhador não aparece aqui de propósito: nunca loga no PWA (regra 7).
-- ----------------------------------------------------------------------------

drop policy if exists fotos_pastos_select on storage.objects;
create policy fotos_pastos_select on storage.objects
for select using (
  bucket_id = 'fotos-pastos'
  and current_papel() in ('admin', 'gerente')
  and (storage.foldername(name))[1] = current_propriedade_id()::text
);

drop policy if exists fotos_pastos_insert on storage.objects;
create policy fotos_pastos_insert on storage.objects
for insert with check (
  bucket_id = 'fotos-pastos'
  and current_papel() in ('admin', 'gerente')
  and (storage.foldername(name))[1] = current_propriedade_id()::text
);

drop policy if exists fotos_pastos_update on storage.objects;
create policy fotos_pastos_update on storage.objects
for update using (
  bucket_id = 'fotos-pastos'
  and current_papel() in ('admin', 'gerente')
  and (storage.foldername(name))[1] = current_propriedade_id()::text
);

drop policy if exists fotos_pastos_delete on storage.objects;
create policy fotos_pastos_delete on storage.objects
for delete using (
  bucket_id = 'fotos-pastos'
  and current_papel() in ('admin', 'gerente')
  and (storage.foldername(name))[1] = current_propriedade_id()::text
);

-- ----------------------------------------------------------------------------
-- 3. mv_lotacao_por_pasto/v_lotacao_por_pasto ganham pasto_foto_path. Matview
-- não aceita ADD COLUMN — precisa recriar (mesmo padrão da F6c, migração
-- 20260807120000). Reaplica TODOS os grants/revokes/security_invoker da
-- fase6c_hardening + fase6c_hardening_anon: recriar do zero perde tudo isso
-- (o próprio bootstrap do Supabase reconcede select a anon/authenticated em
-- objeto novo — é exatamente o achado documentado naquelas migrações).
-- ----------------------------------------------------------------------------

drop view if exists v_lotacao_por_pasto;
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
  pt.foto_path as pasto_foto_path,
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

create unique index ix_mv_lotacao_por_pasto_pasto on mv_lotacao_por_pasto (pasto_id);
create index ix_mv_lotacao_por_pasto_propriedade on mv_lotacao_por_pasto (propriedade_id);
comment on materialized view mv_lotacao_por_pasto is
  'docs/02-dados.md §15 — pré-junção para o mapa de pastos (M2). Fórmulas ficam em src/domain/calculos (avaliarLotacao). Sem RLS (matview) — ver v_lotacao_por_pasto para leitura autenticada.';

revoke select on mv_lotacao_por_pasto from authenticated;
revoke select on mv_lotacao_por_pasto from anon;
grant select on mv_lotacao_por_pasto to service_role;

create view v_lotacao_por_pasto as
select * from mv_lotacao_por_pasto where propriedade_id = current_propriedade_id();

alter view v_lotacao_por_pasto set (security_invoker = true);
grant select on v_lotacao_por_pasto to authenticated;
revoke select on v_lotacao_por_pasto from anon;
