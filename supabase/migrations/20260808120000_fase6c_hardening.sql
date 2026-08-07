-- ============================================================================
-- Fase 6c (hardening) — achados do advisor de segurança do Supabase real
-- (docs/07-entrega.md nunca tinha rodado contra um projeto de verdade antes
-- desta sessão — `mcp__Supabase__get_advisors` só existe fora do sandbox
-- local). 4 achados, do mais grave ao mais cosmético. Idempotente.
--
-- 1) GRAVE — regressão real: as 3 matviews (mv_lotacao_por_pasto,
--    mv_indicadores_recria, mv_efetivo_por_categoria) continuavam com
--    `grant select ... to authenticated` herdado da F3/F6, mesmo depois da
--    F6c criar as views finas (v_*) pra filtrar por fazenda. Isso ANULAVA a
--    correção inteira da F6c: qualquer admin autenticado ainda conseguia
--    consultar a matview crua direto via `/rest/v1/mv_lotacao_por_pasto` e
--    ver o dado de todas as fazendas — exatamente o vazamento que a F6c
--    disse ter corrigido. Corrigido revogando de `authenticated` e
--    concedendo só a `service_role` (usado pelos workers, que filtram
--    explicitamente por propriedade dentro do laço).
-- 2) As 3 views finas (v_*) eram implicitamente SECURITY DEFINER (rodam com
--    o privilégio de quem criou a view, não de quem consulta) — Postgres
--    15+/Supabase recomenda `security_invoker = true` nesse caso. Sem
--    impacto prático aqui (a view só lê a matview, que não tem RLS mesmo),
--    mas é o padrão correto e o advisor marca como ERROR.
-- 3) 2 funções (gravar_eventos_mensagem_bot, atualizar_views_indicadores)
--    não tinham `set search_path` — mesmo padrão de segurança que
--    current_papel()/current_propriedade_id()/audit_trigger() já usam desde
--    a F1, só que essas 2 ficaram de fora quando foram escritas.
-- 4) current_papel()/current_propriedade_id()/audit_trigger() são
--    executáveis por PUBLIC (grant implícito do Postgres em toda função
--    nova) — nenhuma delas faz sentido chamada direto por `anon`/RPC solto;
--    audit_trigger só roda dentro de trigger, e as outras duas já têm grant
--    explícito pra `authenticated`. Revogar de PUBLIC é defesa em
--    profundidade, sem mudar nenhum comportamento observável.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fechar a regressão do grant nas matviews cruas.
-- ----------------------------------------------------------------------------

revoke select on mv_lotacao_por_pasto from authenticated;
revoke select on mv_indicadores_recria from authenticated;
revoke select on mv_efetivo_por_categoria from authenticated;

grant select on mv_lotacao_por_pasto to service_role;
grant select on mv_indicadores_recria to service_role;
grant select on mv_efetivo_por_categoria to service_role;

-- ----------------------------------------------------------------------------
-- 2. security_invoker nas 3 views finas.
-- ----------------------------------------------------------------------------

alter view v_lotacao_por_pasto set (security_invoker = true);
alter view v_indicadores_recria set (security_invoker = true);
alter view v_efetivo_por_categoria set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 3. search_path fixo nas 2 funções que ficaram de fora do padrão.
-- ----------------------------------------------------------------------------

alter function gravar_eventos_mensagem_bot(uuid, jsonb, uuid) set search_path = public;
alter function atualizar_views_indicadores() set search_path = public;

-- ----------------------------------------------------------------------------
-- 4. Revogar EXECUTE de PUBLIC nas funções internas — authenticated mantém
-- o grant explícito já concedido nas migrações da F1/F6.
-- ----------------------------------------------------------------------------

revoke execute on function current_papel() from public;
revoke execute on function current_propriedade_id() from public;
revoke execute on function audit_trigger() from public;

grant execute on function current_papel() to authenticated;
grant execute on function current_propriedade_id() to authenticated;
