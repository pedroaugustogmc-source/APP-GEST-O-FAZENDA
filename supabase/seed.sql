-- ============================================================================
-- Seed de produção — só dado universal (parâmetros de fábrica e catálogo de
-- vacinas). NADA específico desta fazenda (nome da propriedade, pastos,
-- rebanho, máquinas): isso o dono cadastra pelo app (decisão da Fase 0,
-- ver ESTADO.md). Idempotente via ON CONFLICT DO NOTHING.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- parametros_fazenda (docs/01-dominio.md §10) — defaults de fábrica, editáveis
-- pelo admin na tela de Parâmetros.
-- ----------------------------------------------------------------------------

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('UA_KG', '450', 'number', 'kg', 'Peso de referência de 1 Unidade Animal'),
  ('KG_POR_ARROBA', '15', 'number', 'kg', 'Massa da arroba'),
  ('RENDIMENTO_CARCACA', '0.52', 'number', 'fração', 'Rendimento de carcaça padrão da fazenda'),
  ('TOLERANCIA_LOTACAO', '0.10', 'number', 'fração', 'Folga antes de disparar alerta de superlotação'),
  ('CAP_UA_HA_MARANDU', '1.8', 'number', 'UA/ha', 'Capacidade de suporte de referência — capim Marandu'),
  ('CAP_UA_HA_MOMBACA', '2.8', 'number', 'UA/ha', 'Capacidade de suporte de referência — capim Mombaça'),
  ('CAP_UA_HA_MASSAI', '2.0', 'number', 'UA/ha', 'Capacidade de suporte de referência — capim Massai'),
  ('CAP_UA_HA_DEFAULT', '1.5', 'number', 'UA/ha', 'Usado quando o capim do pasto não está cadastrado'),
  ('NIVEL_ACUDE_CRITICO', '30', 'number', '%', 'Abaixo disso, o pasto entra na fila de saída'),
  ('DIAS_DESCANSO_MINIMO', '30', 'number', 'dias', 'Descanso mínimo desejado por piquete'),
  ('TAXA_OPORTUNIDADE_MES', '0.015', 'number', 'fração', 'Custo de capital mensal usado nas cotações'),
  ('DIAS_DADO_VELHO', '45', 'number', 'dias', 'Após isso, o indicador vira estimativa fraca'),
  ('CONFIANCA_MINIMA_BOT', '0.75', 'number', '0–1', 'Abaixo disso, a mensagem do bot vai para revisão humana'),
  ('GMD_META_RECRIA', '0.500', 'number', 'kg/dia', 'Meta de ganho médio diário na recria'),
  ('PESO_ALVO_VENDA', '420', 'number', 'kg', 'Peso-alvo de saída do garrote'),
  ('IDADE_DESMAME_DIAS', '240', 'number', 'dias', 'Idade padrão de desmame'),
  ('ESTACAO_MONTA_INICIO', '11-01', 'text', 'MM-DD', 'Início da estação de monta'),
  ('ESTACAO_MONTA_FIM', '01-31', 'text', 'MM-DD', 'Fim da estação de monta'),
  ('ALERTA_VACINA_DIAS', '15', 'number', 'dias', 'Antecedência do alerta sanitário'),
  ('ALERTA_MANUTENCAO_HORAS', '20', 'number', 'horas', 'Antecedência do alerta de manutenção'),
  ('PESO_NASCIMENTO_MAX_KG', '100', 'number', 'kg', 'Acima disso, peso ao nascer é implausível no importador de planilha (§17) — acréscimo da F1')
on conflict (chave) do nothing;

-- ----------------------------------------------------------------------------
-- vacinas_catalogo (docs/03-modulos.md §M4) — protocolo é dado, não código.
-- ----------------------------------------------------------------------------

insert into vacinas_catalogo
  (nome, obrigatoria, base_legal, sexo_alvo, idade_min_meses, idade_max_meses,
   categorias_alvo, doses, intervalo_dose_dias, reforco_meses, previne,
   epoca_observacao, incompativel_com, intervalo_minimo_dias, bloqueada, motivo_bloqueio, ativo)
values
  ('Brucelose (B19)', true, 'PNCEBT', 'F', 3, 8,
   array['bezerra','novilha']::categoria_animal[], 1, null, null,
   'Brucelose — aborto, infertilidade, transmissível a humanos',
   'Só fêmeas de 3 a 8 meses; fora da janela ou em macho gera problema em exame sorológico depois',
   array['Clostridioses'], 30, false, null, true),

  ('Clostridioses', false, null, null, 2, null,
   null, 2, 30, 12,
   'Botulismo, tétano, enterotoxemia, carbúnculo sintomático — mortalidade rápida e imprevisível',
   'Aplicar ~1 mês depois da brucelose — nunca no mesmo dia, reduz a resposta imune das duas',
   array['Brucelose (B19)'], 30, false, null, true),

  ('Raiva', false, null, null, null, null,
   null, 2, 30, 12,
   'Raiva bovina, transmitida por morcego hematófago',
   'Avaliar com o veterinário se a região tem histórico de morcego hematófago — comum no interior do MA',
   '{}', null, false, null, true),

  ('IBR', false, null, null, null, null,
   array['vaca','touro']::categoria_animal[], 1, null, 12,
   'IBR — abortos, repetição de cio e infertilidade',
   'Aplicar antes da estação de monta (set/out)',
   '{}', null, false, null, true),

  ('BVD', false, null, null, null, null,
   array['vaca','touro']::categoria_animal[], 1, null, 12,
   'BVD — abortos, repetição de cio e infertilidade',
   'Aplicar antes da estação de monta (set/out)',
   '{}', null, false, null, true),

  ('Leptospirose', false, null, null, null, null,
   array['vaca','touro']::categoria_animal[], 1, null, 6,
   'Leptospirose — abortos, repetição de cio e infertilidade',
   'Aplicar antes da estação de monta (set/out); reforço semestral',
   '{}', null, false, null, true),

  ('Campilobacteriose', false, null, null, null, null,
   array['vaca','touro']::categoria_animal[], 1, null, 12,
   'Campilobacteriose — abortos, repetição de cio e infertilidade',
   'Aplicar antes da estação de monta (set/out)',
   '{}', null, false, null, true),

  ('Febre Aftosa', false, null, null, null, null,
   null, 0, null, null,
   'Febre aftosa',
   'BLOQUEADA — Maranhão é zona livre de aftosa sem vacinação desde abril de 2024',
   '{}', null, true,
   'O Maranhão é zona livre de febre aftosa sem vacinação desde abril de 2024 — aplicação e armazenamento da vacina passaram a ser proibidos no estado. Se ainda houver vacina de aftosa em estoque, fale com a AGED e com o veterinário imediatamente.',
   true)
on conflict (nome) do nothing;
