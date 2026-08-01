-- ============================================================================
-- Fase 6b — Multi-fazenda além da fundação (ver decisão em ESTADO.md e plano
-- desta sessão): garante 1 usuarios_acesso ativo por login, fecha a brecha
-- de gerente criar propriedade, estende RLS a 15 tabelas que derivam
-- propriedade_id via FK já existente (Grupo A, zero mudança de write-path) +
-- 2 tabelas que ganham a coluna direta (Grupo B1: estoque_insumos,
-- checklist_itens) + auditoria (melhor esforço). `tarefas`/`alertas`/
-- `relatorios` NÃO entram — são escritas pelos workers com service_role, que
-- ainda não sabem iterar por fazenda (fora de escopo declarado).
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Garantia de banco pra "sem troca de fazenda em sessão" (decisão do
-- dono): no máximo 1 usuarios_acesso ATIVO por auth_user_id. Sem isso,
-- current_papel()/current_propriedade_id() (`limit 1`, sem order by) teriam
-- resultado não-determinístico se alguém um dia inserisse 2 linhas ativas
-- pro mesmo login.
-- ----------------------------------------------------------------------------

create unique index if not exists ux_usuarios_acesso_auth_ativo
  on usuarios_acesso (auth_user_id)
  where status = 'ativo' and auth_user_id is not null;

-- ----------------------------------------------------------------------------
-- 2. "Criar fazenda" passa a ser uma capacidade real (rota
-- /api/propriedades/criar, admin-only, verificada na aplicação) — a policy
-- genérica da F1 deixava `propriedade` na lista de tabelas-gerente por
-- padrão, o que permitiria um gerente inserir uma propriedade nova via
-- tabela direta. Nunca foi intencional; fecho agora que a capacidade existe.
--
-- Achado durante a implementação (não estava no plano original): a
-- `admin_select`/`admin_update`/`gerente_select` de `propriedade` da F1
-- nunca foram escopadas por propriedade — só existia 1 fazenda, então não
-- importava. Agora que "criar fazenda" é real, um admin ou gerente da
-- fazenda B conseguiria ler (ou, no caso do admin, renomear via
-- `PATCH /api/propriedade`, rota já existente desde a F1) a propriedade da
-- fazenda A. `admin_insert` fica como está — quem cria fazenda é minha rota
-- nova, com service_role, que ignora RLS de propósito.
-- ----------------------------------------------------------------------------

drop policy if exists gerente_insert on propriedade;
drop policy if exists gerente_select on propriedade;
create policy gerente_select on propriedade for select
  using (current_papel() = 'gerente' and id = current_propriedade_id());

drop policy if exists admin_select on propriedade;
create policy admin_select on propriedade for select
  using (current_papel() = 'admin' and id = current_propriedade_id());
drop policy if exists admin_update on propriedade;
create policy admin_update on propriedade for update
  using (current_papel() = 'admin' and id = current_propriedade_id())
  with check (current_papel() = 'admin' and id = current_propriedade_id());

-- ----------------------------------------------------------------------------
-- 3. RLS — Grupo A: 15 tabelas que já têm uma coluna not null apontando pra
-- usuarios_acesso ou maquinas (as duas já carregam propriedade_id desde a
-- F6) — a policy vira "existe uma linha na tabela-pai com esta propriedade",
-- sem alterar nenhum insert existente.
-- ----------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('animais',               'registrado_por', 'usuarios_acesso'),
      ('movimentacoes_pasto',   'registrado_por', 'usuarios_acesso'),
      ('pesagens',              'registrado_por', 'usuarios_acesso'),
      ('vacinas_aplicadas',     'registrado_por', 'usuarios_acesso'),
      ('reproducao',            'registrado_por', 'usuarios_acesso'),
      ('mortalidade',           'registrado_por', 'usuarios_acesso'),
      ('producao_leite',        'registrado_por', 'usuarios_acesso'),
      ('movimentacoes_estoque', 'registrado_por', 'usuarios_acesso'),
      ('chuvas',                'registrado_por', 'usuarios_acesso'),
      ('cotacoes',              'registrado_por', 'usuarios_acesso'),
      ('precos_mercado',        'registrado_por', 'usuarios_acesso'),
      ('plano_manutencao',      'maquina_id',     'maquinas'),
      ('manutencoes',           'maquina_id',     'maquinas'),
      ('horas_maquina',         'maquina_id',     'maquinas'),
      ('mensagens_bot',         'usuario_id',     'usuarios_acesso')
    ) as t(tabela, coluna, tabela_pai)
  loop
    execute format('drop policy if exists admin_select on %I', rec.tabela);
    execute format(
      'create policy admin_select on %I for select using (current_papel() = ''admin'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id()))',
      rec.tabela, rec.tabela_pai, rec.tabela, rec.coluna
    );

    execute format('drop policy if exists admin_insert on %I', rec.tabela);
    execute format(
      'create policy admin_insert on %I for insert with check (current_papel() = ''admin'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id()))',
      rec.tabela, rec.tabela_pai, rec.tabela, rec.coluna
    );

    execute format('drop policy if exists admin_update on %I', rec.tabela);
    execute format(
      'create policy admin_update on %I for update using (current_papel() = ''admin'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id())) with check (current_papel() = ''admin'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id()))',
      rec.tabela, rec.tabela_pai, rec.tabela, rec.coluna, rec.tabela_pai, rec.tabela, rec.coluna
    );
  end loop;

  -- Só as que já tinham policy de gerente na F1/F5 (cotacoes e
  -- precos_mercado nunca tiveram — continuam admin-only).
  for rec in
    select * from (values
      ('animais',               'registrado_por', 'usuarios_acesso'),
      ('movimentacoes_pasto',   'registrado_por', 'usuarios_acesso'),
      ('pesagens',              'registrado_por', 'usuarios_acesso'),
      ('vacinas_aplicadas',     'registrado_por', 'usuarios_acesso'),
      ('reproducao',            'registrado_por', 'usuarios_acesso'),
      ('mortalidade',           'registrado_por', 'usuarios_acesso'),
      ('producao_leite',        'registrado_por', 'usuarios_acesso'),
      ('movimentacoes_estoque', 'registrado_por', 'usuarios_acesso'),
      ('chuvas',                'registrado_por', 'usuarios_acesso'),
      ('plano_manutencao',      'maquina_id',     'maquinas'),
      ('manutencoes',           'maquina_id',     'maquinas'),
      ('horas_maquina',         'maquina_id',     'maquinas'),
      ('mensagens_bot',         'usuario_id',     'usuarios_acesso')
    ) as t(tabela, coluna, tabela_pai)
  loop
    execute format('drop policy if exists gerente_select on %I', rec.tabela);
    execute format(
      'create policy gerente_select on %I for select using (current_papel() = ''gerente'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id()))',
      rec.tabela, rec.tabela_pai, rec.tabela, rec.coluna
    );

    execute format('drop policy if exists gerente_insert on %I', rec.tabela);
    execute format(
      'create policy gerente_insert on %I for insert with check (current_papel() = ''gerente'' and exists (select 1 from %I p where p.id = %I.%I and p.propriedade_id = current_propriedade_id()))',
      rec.tabela, rec.tabela_pai, rec.tabela, rec.coluna
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. RLS — Grupo B1: estoque_insumos e checklist_itens não têm nenhuma
-- coluna de atribuição de usuário — ganham propriedade_id direto, mesmo
-- padrão de backfill condicional da F6 (só not null se já existir uma
-- propriedade cadastrada no momento da migração).
-- ----------------------------------------------------------------------------

alter table estoque_insumos add column if not exists propriedade_id uuid references propriedade(id);
alter table checklist_itens add column if not exists propriedade_id uuid references propriedade(id);

do $$
declare
  v_propriedade_id uuid;
begin
  select id into v_propriedade_id from propriedade order by criado_em limit 1;
  if v_propriedade_id is not null then
    update estoque_insumos set propriedade_id = v_propriedade_id where propriedade_id is null;
    update checklist_itens set propriedade_id = v_propriedade_id where propriedade_id is null;

    alter table estoque_insumos alter column propriedade_id set not null;
    alter table checklist_itens alter column propriedade_id set not null;
  end if;
end $$;

do $$
declare
  tbl text;
  tabelas_grupo_b1 text[] := array['estoque_insumos', 'checklist_itens'];
begin
  foreach tbl in array tabelas_grupo_b1 loop
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

-- criarRotaEntidade injeta propriedade_id server-side (comPropriedadeId:
-- true) nas rotas de estoque_insumos e checklist_itens — mesmo mecanismo já
-- usado desde a F6 em pastos/lotes/maquinas/financeiro/usuarios_acesso.

-- ----------------------------------------------------------------------------
-- 5. auditoria — melhor esforço, não obrigatório. audit_trigger() (genérica,
-- roda em toda tabela da fundação F1) já sabe ler `to_jsonb(new)`; agora
-- também resolve propriedade_id: direto da própria linha nova quando a
-- tabela já carrega a coluna (fundação F6 + Grupo B1), senão via
-- registrado_por/usuario_id da própria linha contra usuarios_acesso (Grupo
-- A). Fica NULL quando nenhum dos dois existe (plano_manutencao não tem
-- registrado_por nem propriedade_id; vacinas_catalogo/parametros_fazenda são
-- globais por decisão; tarefas/alertas/relatorios não têm atribuição
-- utilizável) — aceitável: é log de atividade administrativa, não dado de
-- produção, e essas linhas continuam visíveis a qualquer admin (nunca
-- escondidas, nunca vazadas pra outra fazenda por engano).
-- ----------------------------------------------------------------------------

alter table auditoria add column if not exists propriedade_id uuid references propriedade(id);

create or replace function audit_trigger() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro uuid;
  v_deletado_antes boolean;
  v_deletado_depois boolean;
  v_acao text;
  v_propriedade_id uuid;
begin
  v_propriedade_id := nullif(to_jsonb(new)->>'propriedade_id', '')::uuid;
  if v_propriedade_id is null then
    select u.propriedade_id into v_propriedade_id
    from usuarios_acesso u
    where u.id = coalesce(
      nullif(to_jsonb(new)->>'registrado_por', '')::uuid,
      nullif(to_jsonb(new)->>'usuario_id', '')::uuid
    );
  end if;

  if tg_op = 'INSERT' then
    v_registro := (to_jsonb(new)->>'id')::uuid;
    insert into auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, origem, propriedade_id)
    values (
      tg_table_name, v_registro, 'INSERT', null, to_jsonb(new), auth.uid(),
      coalesce(current_setting('app.origem', true), 'desconhecida'), v_propriedade_id
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_registro := (to_jsonb(new)->>'id')::uuid;
    v_deletado_antes := coalesce((to_jsonb(old)->>'deletado_em') is not null, false);
    v_deletado_depois := coalesce((to_jsonb(new)->>'deletado_em') is not null, false);
    v_acao := case when (not v_deletado_antes) and v_deletado_depois then 'SOFT_DELETE' else 'UPDATE' end;

    insert into auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, origem, propriedade_id)
    values (
      tg_table_name, v_registro, v_acao, to_jsonb(old), to_jsonb(new), auth.uid(),
      coalesce(current_setting('app.origem', true), 'desconhecida'), v_propriedade_id
    );
    return new;
  end if;
  return null;
end;
$$;

drop policy if exists admin_select on auditoria;
create policy admin_select on auditoria for select using (
  current_papel() = 'admin' and (propriedade_id = current_propriedade_id() or propriedade_id is null)
);
