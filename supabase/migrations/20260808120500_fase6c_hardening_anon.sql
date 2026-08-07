-- ============================================================================
-- Fase 6c (hardening, parte 2) — achado ao verificar o resultado da migração
-- anterior (20260808120000_fase6c_hardening.sql) contra o Supabase real: o
-- `revoke ... from authenticated` nas 3 matviews não bastava. Todo projeto
-- Supabase novo tem `alter default privileges` concedendo acesso amplo a
-- `anon` E `authenticated` em qualquer tabela/matview nova do schema public
-- (bootstrap do próprio Supabase, não escrito por esta migração) — as 3
-- matviews (mv_lotacao_por_pasto, mv_indicadores_recria,
-- mv_efetivo_por_categoria) herdaram isso ao serem criadas, então `anon`
-- (a chave pública, sem login nenhum) tinha SELECT direto nelas o tempo
-- todo. Como matview não tem RLS, esse grant sozinho era a única barreira —
-- e ela não existia pra `anon`. Pior que o achado anterior: não exigia nem
-- estar logado, só a anon key pública. Idempotente.
-- ============================================================================

revoke select on mv_lotacao_por_pasto from anon;
revoke select on mv_indicadores_recria from anon;
revoke select on mv_efetivo_por_categoria from anon;

-- As 3 views finas (v_*) também herdaram o mesmo default privilege de
-- `anon`. Já ficam vazias pra anon na prática (security_invoker = true +
-- current_propriedade_id() sem EXECUTE pra anon desde a migração anterior
-- => erro de permissão, não linha nenhuma) — revogado aqui só por defesa em
-- profundidade, coerente com a mesma postura aplicada às matviews cruas.
revoke select on v_lotacao_por_pasto from anon;
revoke select on v_indicadores_recria from anon;
revoke select on v_efetivo_por_categoria from anon;

-- Mesmo padrão de default privilege pegou as 3 funções internas
-- (current_papel, current_propriedade_id, audit_trigger): `revoke ... from
-- public` da migração anterior só tira o grant implícito de PUBLIC, não o
-- grant explícito que o bootstrap do Supabase concede direto a `anon` em
-- toda função nova. Impacto prático baixo (current_papel/
-- current_propriedade_id retornam null pra anon, sem linha de
-- usuarios_acesso correspondente; audit_trigger é `returns trigger` e o
-- Postgres recusa chamada direta fora de um trigger de verdade) — revogado
-- mesmo assim por defesa em profundidade. `rls_auto_enable()` NÃO é
-- revogada aqui: é função do próprio bootstrap do Supabase (event trigger
-- interno, também não invocável direto), não desta migração — não mexo em
-- objeto que não é meu.
revoke execute on function current_papel() from anon;
revoke execute on function current_propriedade_id() from anon;
revoke execute on function audit_trigger() from anon;
