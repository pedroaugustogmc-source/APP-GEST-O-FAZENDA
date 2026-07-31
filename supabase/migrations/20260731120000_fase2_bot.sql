-- ============================================================================
-- Fase 2 — Captura por voz: parâmetros novos + função de gravação atômica
-- dos eventos extraídos pelo bot. Idempotente. Não altera schema da F1 (só
-- acrescenta parâmetros e uma função — nenhuma tabela/coluna da F1 muda).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Novos parametros_fazenda (CLAUDE.md regra 3 — nada hardcoded no código).
-- Valores de partida declarados como suposição em ESTADO.md, não como fato
-- validado — mesmo tratamento já dado a CAP_UA_HA_* na F1.
-- ----------------------------------------------------------------------------

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('BOT_MAX_TENTATIVAS', '3', 'number', 'tentativas', 'docs/04-bot.md §33 — tentativas de retry antes de status=erro + alerta'),
  ('GMD_IMPLAUSIVEL_MAX_KG_DIA', '2.5', 'number', 'kg/dia', 'docs/04-bot.md §32 — acima disso (ou no negativo, em módulo), grava marcado como revisão'),
  ('FATOR_VALOR_ATIPICO', '10', 'number', 'x mediana', 'docs/04-bot.md §32 — valor financeiro acima disso vezes a mediana histórica vai para revisão'),
  ('RATE_LIMIT_MENSAGENS_MINUTO', '20', 'number', 'mensagens/min', 'docs/05-arquitetura.md §39 — limite por telefone, contra abuso/custo'),
  ('RETENCAO_AUDIO_DIAS', '90', 'number', 'dias', 'Anexo I — após isso, mantém a transcrição e descarta o áudio'),
  ('TETO_CUSTO_MENSAL_CENTAVOS', '10000', 'number', 'centavos', 'Anexo I — acima disso, alerta o admin (nunca corta o serviço automaticamente)'),
  ('PRECO_ASR_CENTAVOS_MINUTO', '2', 'number', 'centavos/min', 'Anexo I — preço do provedor de transcrição (Groq), para calcular custo_api_centavos'),
  ('PRECO_CLAUDE_INPUT_CENTAVOS_MTOK', '500', 'number', 'centavos/milhão de tokens', 'Anexo I — preço de entrada do modelo de extração configurado'),
  ('PRECO_CLAUDE_OUTPUT_CENTAVOS_MTOK', '2500', 'number', 'centavos/milhão de tokens', 'Anexo I — preço de saída do modelo de extração configurado'),
  ('PESO_MIN_KG_BEZERRO', '15', 'number', 'kg', 'docs/04-bot.md §32 — faixa plausível de peso por categoria, ponto de partida a validar com o zootecnista'),
  ('PESO_MAX_KG_BEZERRO', '220', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_BEZERRA', '15', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_BEZERRA', '200', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_GARROTE', '120', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_GARROTE', '480', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_NOVILHA', '120', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_NOVILHA', '420', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_VACA', '280', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_VACA', '750', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_TOURO', '350', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_TOURO', '1100', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MIN_KG_BOI', '280', 'number', 'kg', 'docs/04-bot.md §32 — idem'),
  ('PESO_MAX_KG_BOI', '900', 'number', 'kg', 'docs/04-bot.md §32 — idem')
on conflict (chave) do nothing;

-- ----------------------------------------------------------------------------
-- 2. gravar_eventos_mensagem_bot — grava, numa única transação (a própria
-- chamada da função), todos os eventos já validados por
-- src/domain/validacao/validacaoSemantica.ts (docs/03-modulos.md §M1 passo 7:
-- "escreve nas tabelas de domínio dentro de uma transação"). Chamada tanto
-- pela Edge Function bot-webhook (service_role) quanto pela tela de revisão
-- do admin — mesmo caminho de gravação nos dois casos.
--
-- SECURITY INVOKER (padrão, não especificado) de propósito: service_role já
-- ignora RLS por privilégio de papel do Postgres; admin já tem admin_insert/
-- admin_update em todas as tabelas tocadas aqui. Não há motivo para elevar
-- privilégio com SECURITY DEFINER — se algum dia um `trabalhador` tentasse
-- chamar isto com sessão própria (não deveria existir, §14), cada INSERT
-- cai na ausência de policy dele e falha, como já é o comportamento correto.
--
-- Formato esperado de cada elemento de p_eventos (um por evento já aprovado):
-- {"tipo": "<um dos 16 tipos de docs/04-bot.md §30>", "data": "YYYY-MM-DD", ...
--  campos específicos do tipo, com "<entidade>_id" já resolvido para uuid}.
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
begin
  if p_registrado_por is null then
    raise exception 'registrado_por é obrigatório para gravar eventos do bot';
  end if;

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
      insert into financeiro (data, tipo, categoria, subcategoria, descricao, valor_centavos, lote_id, centro_custo, fornecedor, mensagem_id, registrado_por)
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
        p_registrado_por
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
      insert into financeiro (data, tipo, categoria, subcategoria, descricao, valor_centavos, lote_id, centro_custo, mensagem_id, registrado_por)
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
        p_registrado_por
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

comment on function gravar_eventos_mensagem_bot(uuid, jsonb, uuid) is
  'docs/03-modulos.md §M1 passo 7 — grava todos os eventos já validados de uma mensagem numa única transação (a própria chamada). Chamada pela Edge Function bot-webhook e pela tela /revisao.';
