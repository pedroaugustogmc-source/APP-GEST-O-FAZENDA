-- ============================================================================
-- Fase 6 — Escala: 2 campos novos em `financeiro` (preparo de nota fiscal de
-- produtor, Anexo H), view `mv_efetivo_por_categoria` (declaração de
-- rebanho, Anexo H) e a FUNDAÇÃO de schema/RLS para multi-fazenda — só nas
-- tabelas por trás das telas mais críticas (dashboard, financeiro), não um
-- retrofit completo. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nota fiscal de produtor (Anexo H): "valor, quantidade, categoria,
-- comprador, data" — `valor`/`categoria`/`data` já existem; `comprador`
-- reaproveita a coluna `fornecedor` já existente (mesmo campo, papel
-- invertido quando `tipo='receita'` — documentado aqui, não duplicado em
-- coluna nova). Só `quantidade`/`unidade` faltam.
-- ----------------------------------------------------------------------------

alter table financeiro add column if not exists quantidade numeric(12,3);
alter table financeiro add column if not exists unidade text;

comment on column financeiro.fornecedor is
  'Fornecedor quando tipo=custo; comprador quando tipo=receita (Anexo H "nota fiscal de produtor") — mesmo campo, papel conforme o tipo do lançamento.';

-- ----------------------------------------------------------------------------
-- 2. Declaração de rebanho (Anexo H): "efetivo por categoria e sexo em data
-- de referência". Só o efetivo de HOJE (animais ativos agora) — reconstruir
-- o efetivo em uma data passada exigiria replay do log de `auditoria`, fora
-- do escopo deste corte (registrado em ESTADO.md).
-- ----------------------------------------------------------------------------

drop materialized view if exists mv_efetivo_por_categoria;
create materialized view mv_efetivo_por_categoria as
select
  categoria,
  sexo,
  count(*) as cabecas
from animais
where status = 'ativo' and deletado_em is null
group by categoria, sexo;

create unique index if not exists ix_mv_efetivo_categoria_sexo on mv_efetivo_por_categoria(categoria, sexo);

comment on materialized view mv_efetivo_por_categoria is
  'Anexo H (docs/08-anexos.md) — declaração de rebanho: efetivo por categoria e sexo. Só o efetivo de hoje (animais ativos agora), não ponto-em-data-passada.';

-- RLS não se aplica a matviews (mesma nota da F3) — select explícito basta.
grant select on mv_efetivo_por_categoria to authenticated;

-- Entra no refresh periódico existente (worker /api/workers/atualizar-indicadores,
-- F3) em vez de um cron próprio — mesma cadência das outras views de indicador.
-- SECURITY INVOKER, igual ao original (comment da F3): quem chama precisa ter
-- privilégio de refresh (service_role tem).
create or replace function atualizar_views_indicadores() returns void
language plpgsql
as $$
begin
  refresh materialized view mv_lotacao_por_pasto;
  refresh materialized view mv_indicadores_recria;
  refresh materialized view mv_efetivo_por_categoria;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Fundação multi-fazenda — decisão do dono (sessão de 2026-07-31, ver
-- ESTADO.md): só o schema/RLS, aplicado às 5 tabelas por trás do dashboard e
-- do financeiro. As demais ~20 tabelas continuam sem `propriedade_id`
-- (comportamento single-tenant preservado, nada regride). Sem tela de
-- criar/trocar de fazenda — só existe 1 `propriedade` hoje, então a mudança
-- é segura por construção mas ainda não testada contra 2 fazendas reais.
-- ----------------------------------------------------------------------------

alter table usuarios_acesso add column if not exists propriedade_id uuid references propriedade(id);
alter table pastos          add column if not exists propriedade_id uuid references propriedade(id);
alter table lotes           add column if not exists propriedade_id uuid references propriedade(id);
alter table maquinas        add column if not exists propriedade_id uuid references propriedade(id);
alter table financeiro      add column if not exists propriedade_id uuid references propriedade(id);

-- Backfill: hoje só existe 1 propriedade. Se o seed nunca rodou (banco
-- vazio sem nenhuma linha em `propriedade`), não há o que preencher — o
-- `not null` abaixo só entra em vigor quando há pelo menos uma propriedade
-- cadastrada, mesma cautela idempotente das migrações anteriores.
do $$
declare
  v_propriedade_id uuid;
begin
  select id into v_propriedade_id from propriedade order by criado_em limit 1;
  if v_propriedade_id is not null then
    update usuarios_acesso set propriedade_id = v_propriedade_id where propriedade_id is null;
    update pastos          set propriedade_id = v_propriedade_id where propriedade_id is null;
    update lotes            set propriedade_id = v_propriedade_id where propriedade_id is null;
    update maquinas         set propriedade_id = v_propriedade_id where propriedade_id is null;
    update financeiro       set propriedade_id = v_propriedade_id where propriedade_id is null;

    alter table usuarios_acesso alter column propriedade_id set not null;
    alter table pastos          alter column propriedade_id set not null;
    alter table lotes           alter column propriedade_id set not null;
    alter table maquinas        alter column propriedade_id set not null;
    alter table financeiro      alter column propriedade_id set not null;
  end if;
end $$;

-- current_propriedade_id(): mesmo padrão security definer de current_papel()
-- (docs/02-dados.md §14) — evita recursão de RLS ao ler usuarios_acesso de
-- dentro da própria policy de usuarios_acesso.
create or replace function current_propriedade_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select propriedade_id
  from usuarios_acesso
  where auth_user_id = auth.uid()
    and status = 'ativo'
  limit 1
$$;

grant execute on function current_propriedade_id() to authenticated;

-- Policies das 5 tabelas ganham "and propriedade_id = current_propriedade_id()"
-- — substituem as policies genéricas criadas pelo loop da F1 (docs/02-dados.md
-- §14), só nestas 5 tabelas. `usuarios_acesso` e `financeiro` não têm policy
-- de gerente (não estavam em `tabelas_gerente` na F1); `pastos`/`lotes`/
-- `maquinas` têm as duas.

drop policy if exists admin_select on usuarios_acesso;
create policy admin_select on usuarios_acesso for select
  using (current_papel() = 'admin' and propriedade_id = current_propriedade_id());
drop policy if exists admin_insert on usuarios_acesso;
create policy admin_insert on usuarios_acesso for insert
  with check (current_papel() = 'admin' and propriedade_id = current_propriedade_id());
drop policy if exists admin_update on usuarios_acesso;
create policy admin_update on usuarios_acesso for update
  using (current_papel() = 'admin' and propriedade_id = current_propriedade_id())
  with check (current_papel() = 'admin' and propriedade_id = current_propriedade_id());

drop policy if exists admin_select on financeiro;
create policy admin_select on financeiro for select
  using (current_papel() = 'admin' and propriedade_id = current_propriedade_id());
drop policy if exists admin_insert on financeiro;
create policy admin_insert on financeiro for insert
  with check (current_papel() = 'admin' and propriedade_id = current_propriedade_id());
drop policy if exists admin_update on financeiro;
create policy admin_update on financeiro for update
  using (current_papel() = 'admin' and propriedade_id = current_propriedade_id())
  with check (current_papel() = 'admin' and propriedade_id = current_propriedade_id());

do $$
declare
  tbl text;
  tabelas_propriedade text[] := array['pastos', 'lotes', 'maquinas'];
begin
  foreach tbl in array tabelas_propriedade loop
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
-- 4. gravar_eventos_mensagem_bot (F2) grava em `financeiro` (eventos
-- 'despesa'/'receita') sem propriedade_id — como a coluna virou not null
-- (para instalações que já têm propriedade cadastrada), essas duas gravações
-- quebrariam sem este ajuste. Corpo idêntico ao original
-- (supabase/migrations/20260731120000_fase2_bot.sql), só com
-- v_propriedade_id (lido de usuarios_acesso.propriedade_id do próprio
-- p_registrado_por) somado às duas inserções em `financeiro`.
-- ----------------------------------------------------------------------------

create or replace function gravar_eventos_mensagem_bot(
  p_mensagem_id uuid,
  p_eventos jsonb,
  p_registrado_por uuid
) returns jsonb
language plpgsql
as $$
declare
  v_evento jsonb;
  v_tipo text;
  v_novo_id uuid;
  v_gerados jsonb := '{}'::jsonb;
  v_propriedade_id uuid;
begin
  if p_registrado_por is null then
    raise exception 'registrado_por é obrigatório para gravar eventos do bot';
  end if;

  select propriedade_id into v_propriedade_id from usuarios_acesso where id = p_registrado_por;

  for v_evento in select * from jsonb_array_elements(p_eventos)
  loop
    v_tipo := v_evento->>'tipo';

    if v_tipo = 'pesagem' then
      insert into pesagens (animal_id, lote_id, data, peso, tipo, n_animais, mensagem_id, registrado_por)
      values (
        nullif(v_evento->>'animal_id', '')::uuid,
        nullif(v_evento->>'lote_id', '')::uuid,
        (v_evento->>'data')::date,
        (v_evento->>'peso')::numeric,
        coalesce(v_evento->>'tipo_pesagem', 'lote'),
        nullif(v_evento->>'n_animais', '')::integer,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{pesagens}', coalesce(v_gerados->'pesagens', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'vacinacao' then
      insert into vacinas_aplicadas (vacina_id, vacina, animal_id, lote_id, data, dose, lote_fabricacao, laboratorio, n_animais, mensagem_id, registrado_por)
      values (
        nullif(v_evento->>'vacina_id', '')::uuid,
        v_evento->>'vacina',
        nullif(v_evento->>'animal_id', '')::uuid,
        nullif(v_evento->>'lote_id', '')::uuid,
        (v_evento->>'data')::date,
        coalesce(nullif(v_evento->>'dose', '')::dose_vacina, 'unica'),
        v_evento->>'lote_fabricacao',
        v_evento->>'laboratorio',
        nullif(v_evento->>'n_animais', '')::integer,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{vacinas_aplicadas}', coalesce(v_gerados->'vacinas_aplicadas', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'movimentacao_pasto' then
      insert into movimentacoes_pasto (lote_id, pasto_origem_id, pasto_destino_id, data, cabecas, motivo, dias_descanso_destino, mensagem_id, registrado_por)
      values (
        (v_evento->>'lote_id')::uuid,
        nullif(v_evento->>'pasto_origem_id', '')::uuid,
        (v_evento->>'pasto_destino_id')::uuid,
        (v_evento->>'data')::date,
        (v_evento->>'cabecas')::integer,
        v_evento->>'motivo',
        nullif(v_evento->>'dias_descanso_destino', '')::integer,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{movimentacoes_pasto}', coalesce(v_gerados->'movimentacoes_pasto', '[]'::jsonb) || to_jsonb(v_novo_id));

      if nullif(v_evento->>'pasto_origem_id', '') is not null then
        update pastos
        set status = 'descanso', data_saida_ultimo_lote = (v_evento->>'data')::date, lote_atual_id = null
        where id = (v_evento->>'pasto_origem_id')::uuid
          and lote_atual_id = (v_evento->>'lote_id')::uuid;
      end if;

      update pastos
      set status = 'em_uso', lote_atual_id = (v_evento->>'lote_id')::uuid, data_entrada_lote_atual = (v_evento->>'data')::date
      where id = (v_evento->>'pasto_destino_id')::uuid;

      update lotes set pasto_id = (v_evento->>'pasto_destino_id')::uuid where id = (v_evento->>'lote_id')::uuid;

    elsif v_tipo = 'nivel_acude' then
      update pastos
      set nivel_acude = (v_evento->>'nivel_acude')::smallint, nivel_acude_em = now()
      where id = (v_evento->>'pasto_id')::uuid;

    elsif v_tipo = 'manutencao' then
      insert into manutencoes (maquina_id, data, tipo, preventiva, horas_no_momento, custo_centavos, mensagem_id, registrado_por)
      values (
        (v_evento->>'maquina_id')::uuid,
        (v_evento->>'data')::date,
        coalesce(v_evento->>'tipo_manutencao', 'manutenção'),
        coalesce(nullif(v_evento->>'preventiva', '')::boolean, true),
        nullif(v_evento->>'horas_no_momento', '')::numeric,
        nullif(v_evento->>'custo_centavos', '')::bigint,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{manutencoes}', coalesce(v_gerados->'manutencoes', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'horas_maquina' then
      insert into horas_maquina (maquina_id, data, horas, atividade, mensagem_id, registrado_por)
      values (
        (v_evento->>'maquina_id')::uuid,
        (v_evento->>'data')::date,
        (v_evento->>'horas')::numeric,
        v_evento->>'atividade',
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{horas_maquina}', coalesce(v_gerados->'horas_maquina', '[]'::jsonb) || to_jsonb(v_novo_id));

      update maquinas set horas_uso_total = horas_uso_total + (v_evento->>'horas')::numeric
      where id = (v_evento->>'maquina_id')::uuid;

    elsif v_tipo = 'despesa' then
      insert into financeiro (data, tipo, categoria, subcategoria, descricao, valor_centavos, lote_id, centro_custo, fornecedor, mensagem_id, registrado_por, propriedade_id)
      values (
        (v_evento->>'data')::date,
        'custo',
        v_evento->>'categoria',
        v_evento->>'subcategoria',
        v_evento->>'descricao',
        (v_evento->>'valor_centavos')::bigint,
        nullif(v_evento->>'lote_id', '')::uuid,
        coalesce(nullif(v_evento->>'centro_custo', '')::centro_custo, 'estrutura'),
        v_evento->>'fornecedor',
        p_mensagem_id,
        p_registrado_por,
        v_propriedade_id
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{financeiro}', coalesce(v_gerados->'financeiro', '[]'::jsonb) || to_jsonb(v_novo_id));

      if nullif(v_evento->>'insumo_id', '') is not null then
        insert into movimentacoes_estoque (insumo_id, tipo, quantidade, custo_centavos, lote_id, data, mensagem_id, registrado_por)
        values (
          (v_evento->>'insumo_id')::uuid,
          'entrada',
          coalesce(nullif(v_evento->>'quantidade', '')::numeric, 0),
          (v_evento->>'valor_centavos')::bigint,
          nullif(v_evento->>'lote_id', '')::uuid,
          (v_evento->>'data')::date,
          p_mensagem_id,
          p_registrado_por
        );
      end if;

    elsif v_tipo = 'receita' then
      insert into financeiro (data, tipo, categoria, subcategoria, descricao, valor_centavos, lote_id, centro_custo, mensagem_id, registrado_por, propriedade_id)
      values (
        (v_evento->>'data')::date,
        'receita',
        v_evento->>'categoria',
        v_evento->>'subcategoria',
        v_evento->>'descricao',
        (v_evento->>'valor_centavos')::bigint,
        nullif(v_evento->>'lote_id', '')::uuid,
        coalesce(nullif(v_evento->>'centro_custo', '')::centro_custo, 'estrutura'),
        p_mensagem_id,
        p_registrado_por,
        v_propriedade_id
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{financeiro}', coalesce(v_gerados->'financeiro', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'mortalidade' then
      insert into mortalidade (animal_id, lote_id, data, cabecas, categoria, causa_suspeita, mensagem_id, registrado_por)
      values (
        nullif(v_evento->>'animal_id', '')::uuid,
        nullif(v_evento->>'lote_id', '')::uuid,
        (v_evento->>'data')::date,
        coalesce(nullif(v_evento->>'cabecas', '')::integer, 1),
        nullif(v_evento->>'categoria', '')::categoria_animal,
        v_evento->>'causa_suspeita',
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{mortalidade}', coalesce(v_gerados->'mortalidade', '[]'::jsonb) || to_jsonb(v_novo_id));

      if nullif(v_evento->>'animal_id', '') is not null then
        update animais set status = 'morto', data_saida = (v_evento->>'data')::date
        where id = (v_evento->>'animal_id')::uuid and status = 'ativo';
      end if;

      if nullif(v_evento->>'lote_id', '') is not null then
        update lotes set cabecas_atuais = greatest(cabecas_atuais - coalesce(nullif(v_evento->>'cabecas', '')::integer, 1), 0)
        where id = (v_evento->>'lote_id')::uuid;
      end if;

    elsif v_tipo = 'nascimento' then
      insert into animais (brinco, lote_id, sexo, categoria, data_nascimento, matriz_id, origem, peso_nascimento, registrado_por)
      values (
        nullif(v_evento->>'brinco', ''),
        nullif(v_evento->>'lote_id', '')::uuid,
        (v_evento->>'sexo')::sexo_animal,
        (v_evento->>'categoria')::categoria_animal,
        (v_evento->>'data')::date,
        nullif(v_evento->>'matriz_id', '')::uuid,
        'nascimento',
        nullif(v_evento->>'peso_nascimento', '')::numeric,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{animais}', coalesce(v_gerados->'animais', '[]'::jsonb) || to_jsonb(v_novo_id));

      if nullif(v_evento->>'lote_id', '') is not null then
        update lotes set cabecas_atuais = cabecas_atuais + 1 where id = (v_evento->>'lote_id')::uuid;
      end if;

    elsif v_tipo = 'reproducao' then
      insert into reproducao (matriz_id, touro_id, tipo, data_cobertura, resultado, observacao, registrado_por)
      values (
        (v_evento->>'matriz_id')::uuid,
        nullif(v_evento->>'touro_id', '')::uuid,
        coalesce(nullif(v_evento->>'tipo_reproducao', '')::tipo_repro, 'monta_natural'),
        (v_evento->>'data')::date,
        nullif(v_evento->>'resultado', '')::resultado_repro,
        v_evento->>'observacao',
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{reproducao}', coalesce(v_gerados->'reproducao', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'chuva' then
      insert into chuvas (data, milimetros, local, mensagem_id, registrado_por)
      values (
        (v_evento->>'data')::date,
        (v_evento->>'milimetros')::numeric,
        v_evento->>'local',
        p_mensagem_id,
        p_registrado_por
      )
      on conflict (data, local) do update
        set milimetros = excluded.milimetros, mensagem_id = excluded.mensagem_id, registrado_por = excluded.registrado_por
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{chuvas}', coalesce(v_gerados->'chuvas', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'producao_leite' then
      insert into producao_leite (data, turno, litros, vaca_id, lote_id, mensagem_id, registrado_por)
      values (
        (v_evento->>'data')::date,
        nullif(v_evento->>'turno', ''),
        (v_evento->>'litros')::numeric,
        nullif(v_evento->>'vaca_id', '')::uuid,
        nullif(v_evento->>'lote_id', '')::uuid,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{producao_leite}', coalesce(v_gerados->'producao_leite', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'estoque' then
      insert into movimentacoes_estoque (insumo_id, tipo, quantidade, custo_centavos, lote_id, data, mensagem_id, registrado_por)
      values (
        (v_evento->>'insumo_id')::uuid,
        coalesce(v_evento->>'tipo_movimentacao', 'ajuste'),
        (v_evento->>'quantidade')::numeric,
        nullif(v_evento->>'custo_centavos', '')::bigint,
        nullif(v_evento->>'lote_id', '')::uuid,
        (v_evento->>'data')::date,
        p_mensagem_id,
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{movimentacoes_estoque}', coalesce(v_gerados->'movimentacoes_estoque', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'demanda' then
      insert into tarefas (data, tipo, descricao, origem, status, registrado_por)
      values (
        (v_evento->>'data')::date,
        coalesce(v_evento->>'tipo_tarefa', 'demanda de campo'),
        v_evento->>'descricao',
        'bot',
        'pendente',
        p_registrado_por
      )
      returning id into v_novo_id;
      v_gerados := jsonb_set(v_gerados, '{tarefas}', coalesce(v_gerados->'tarefas', '[]'::jsonb) || to_jsonb(v_novo_id));

    elsif v_tipo = 'observacao' then
      -- docs/02-dados.md não tem tabela de observações soltas; o texto já
      -- fica preservado em mensagens_bot.transcricao/.payload_extraido —
      -- nenhuma escrita adicional aqui (decisão registrada em ESTADO.md).
      null;

    elsif v_tipo = 'bloqueio' then
      -- Nunca deveria chegar aqui — eventos "bloqueio" são interceptados
      -- pela validação semântica antes de chamar esta função.
      raise exception 'evento tipo bloqueio não deve ser gravado';

    else
      raise exception 'tipo de evento desconhecido: %', v_tipo;
    end if;
  end loop;

  update mensagens_bot
  set status = 'gravada', eventos_gerados = v_gerados, processado_em = now()
  where id = p_mensagem_id;

  return v_gerados;
end;
$$;
