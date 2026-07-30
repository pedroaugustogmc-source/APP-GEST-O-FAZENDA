-- ============================================================================
-- Fase 1 — Fundação: schema canônico completo (docs/02-dados.md §13),
-- RLS (§14), auditoria (§16). Idempotente: pode rodar em banco vazio ou já
-- migrado sem erro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TIPOS (§13.1)
-- ----------------------------------------------------------------------------

do $$ begin
  create type papel_usuario as enum ('admin','gerente','trabalhador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_usuario as enum ('ativo','inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plataforma_bot as enum ('telegram','whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sexo_animal as enum ('M','F');
exception when duplicate_object then null; end $$;

do $$ begin
  create type categoria_animal as enum ('bezerro','bezerra','garrote','novilha','vaca','touro','boi');
exception when duplicate_object then null; end $$;

-- 'importacao' acrescentado ao original ('nascimento','compra') para o
-- importador de planilha (§17): quando a planilha antiga não diz se o
-- animal nasceu na fazenda ou foi comprado, marcar como 'compra' ou
-- 'nascimento' seria inventar dado (CLAUDE.md regra 2) — 'importacao'
-- é a origem honesta quando isso não é sabido.
do $$ begin
  create type origem_animal as enum ('nascimento','compra','importacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_animal as enum ('ativo','vendido','morto','descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_operacao as enum ('cria','recria','engorda','leite','misto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_lote as enum ('rascunho','ativo','vendido','encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_pasto as enum ('em_uso','descanso','vedado','reforma');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_financeiro as enum ('custo','receita');
exception when duplicate_object then null; end $$;

do $$ begin
  create type centro_custo as enum ('cria','recria','leite','estrutura','administrativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_maquina as enum ('trator','implemento','veiculo','bomba','gerador','outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_mensagem as enum ('recebida','transcrita','extraida','gravada','revisao','erro','descartada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type severidade as enum ('info','atencao','critico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resultado_repro as enum ('prenha','vazia','perda_gestacional','parida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_repro as enum ('monta_natural','IA','IATF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dose_vacina as enum ('unica','primeira','segunda','reforco');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. NÚCLEO — ACESSO E CONFIGURAÇÃO (§13.2)
-- ----------------------------------------------------------------------------

create table if not exists propriedade (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  municipio       text not null default 'Imperatriz',
  uf              char(2) not null default 'MA',
  area_total_ha   numeric(10,2),
  inscricao_estadual text,
  criado_em       timestamptz not null default now()
);
comment on table propriedade is 'Single-tenant nesta versão; pronto para multi-fazenda na F6.';

create table if not exists usuarios_acesso (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid references auth.users(id),
  telefone          text not null,
  plataforma        plataforma_bot not null default 'telegram',
  chat_id_externo   text,
  nome              text not null,
  papel             papel_usuario not null default 'trabalhador',
  status            status_usuario not null default 'ativo',
  data_admissao     date,
  data_desligamento date,
  ultimo_acesso     timestamptz,
  criado_por        uuid references usuarios_acesso(id),
  client_uuid       text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  criado_em         timestamptz not null default now(),
  constraint uq_usuario_telefone unique (telefone, plataforma),
  constraint ck_desligamento check (
    (status = 'inativo' and data_desligamento is not null) or status = 'ativo'
  )
);
comment on table usuarios_acesso is 'Só admin/gerente têm auth_user_id (login no PWA). Trabalhador é validado só por telefone, no bot.';
create index if not exists ix_usuarios_ativos on usuarios_acesso (telefone) where status = 'ativo';

create table if not exists parametros_fazenda (
  chave        text primary key,
  valor        text not null,
  tipo_dado    text not null check (tipo_dado in ('number','text','date','boolean')),
  unidade      text,
  descricao    text not null,
  editavel     boolean not null default true,
  atualizado_por uuid references usuarios_acesso(id),
  atualizado_em  timestamptz not null default now()
);
comment on table parametros_fazenda is 'Todo limiar/fator/taxa de negócio vive aqui. Nunca hardcoded (CLAUDE.md regra 3).';

-- ----------------------------------------------------------------------------
-- 3. PASTAGEM (§13.3)
-- ----------------------------------------------------------------------------

create table if not exists pastos (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null unique,
  apelidos                 text[] default '{}',
  tamanho_ha               numeric(8,2) not null check (tamanho_ha > 0),
  capim                    text,
  capacidade_ua_ha_ref     numeric(5,2),
  tem_acude                boolean not null default false,
  nivel_acude              smallint check (nivel_acude between 0 and 100),
  nivel_acude_em           timestamptz,
  status                   status_pasto not null default 'descanso',
  lote_atual_id            uuid,
  data_entrada_lote_atual  date,
  data_saida_ultimo_lote   date,
  ultima_adubacao          date,
  ultima_rocada            date,
  coordenadas              jsonb,
  observacao               text,
  client_uuid              text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  criado_em                timestamptz not null default now()
);

create table if not exists lotes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  categoria      categoria_animal not null,
  tipo_operacao  tipo_operacao not null,
  peso_entrada   numeric(7,1) check (peso_entrada > 0),
  data_entrada   date not null,
  data_saida     date,
  area_ha        numeric(8,2),
  pasto_id       uuid references pastos(id),
  cabecas_atuais integer not null default 0 check (cabecas_atuais >= 0),
  status         status_lote not null default 'ativo',
  observacao     text,
  client_uuid    text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now(),
  deletado_em    timestamptz,
  constraint ck_lote_datas check (data_saida is null or data_saida >= data_entrada)
);

do $$ begin
  alter table pastos add constraint fk_pasto_lote
    foreign key (lote_atual_id) references lotes(id);
exception when duplicate_object then null; end $$;

create table if not exists animais (
  id               uuid primary key default gen_random_uuid(),
  brinco           text unique,
  lote_id          uuid references lotes(id),
  sexo             sexo_animal not null,
  categoria        categoria_animal not null,
  data_nascimento  date,
  matriz_id        uuid references animais(id),
  genetica_touro   text,
  touro_id         uuid references animais(id),
  origem           origem_animal not null default 'nascimento',
  peso_nascimento  numeric(6,1),
  status           status_animal not null default 'ativo',
  data_saida       date,
  client_uuid      text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  linha_importada  jsonb, -- linha original do CSV quando origem='importacao' (§17); acréscimo à F1
  registrado_por   uuid not null references usuarios_acesso(id),
  registrado_em    timestamptz not null default now(),
  deletado_em      timestamptz,
  constraint ck_categoria_sexo check (
    (sexo='F' and categoria in ('bezerra','novilha','vaca')) or
    (sexo='M' and categoria in ('bezerro','garrote','touro','boi'))
  )
);
create index if not exists ix_animais_lote on animais(lote_id) where deletado_em is null;
create index if not exists ix_animais_matriz on animais(matriz_id);

create table if not exists movimentacoes_pasto (
  id                uuid primary key default gen_random_uuid(),
  lote_id           uuid not null references lotes(id),
  pasto_origem_id   uuid references pastos(id),
  pasto_destino_id  uuid not null references pastos(id),
  data              date not null,
  cabecas           integer not null check (cabecas > 0),
  motivo            text,
  dias_descanso_destino integer,
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now()
);
create index if not exists ix_mov_pasto_data on movimentacoes_pasto(data desc);
create index if not exists ix_mov_pasto_destino on movimentacoes_pasto(pasto_destino_id, data desc);

-- ----------------------------------------------------------------------------
-- 4. DESEMPENHO E SANIDADE (§13.4)
-- ----------------------------------------------------------------------------

create table if not exists pesagens (
  id                 uuid primary key default gen_random_uuid(),
  animal_id          uuid references animais(id),
  lote_id            uuid references lotes(id),
  data               date not null,
  peso               numeric(7,1) not null check (peso between 10 and 1500),
  tipo               text not null check (tipo in ('individual','lote','amostragem')),
  n_animais          integer check (n_animais > 0),
  gmd_calculado      numeric(5,3),
  mensagem_id        uuid,
  registrado_por     uuid not null references usuarios_acesso(id),
  registrado_em      timestamptz not null default now(),
  deletado_em        timestamptz,
  constraint ck_pesagem_alvo check (animal_id is not null or lote_id is not null)
);
create index if not exists ix_pesagens_lote_data on pesagens(lote_id, data desc);
create index if not exists ix_pesagens_animal_data on pesagens(animal_id, data desc);

create table if not exists vacinas_catalogo (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null unique,
  obrigatoria         boolean not null default false,
  base_legal          text,
  sexo_alvo           sexo_animal,
  idade_min_meses     numeric(4,1),
  idade_max_meses     numeric(4,1),
  categorias_alvo     categoria_animal[],
  doses               smallint not null default 1,
  intervalo_dose_dias integer,
  reforco_meses       integer,
  previne             text not null,
  epoca_observacao    text,
  incompativel_com    text[] default '{}',
  intervalo_minimo_dias integer,
  bloqueada           boolean not null default false,
  motivo_bloqueio     text,
  ativo               boolean not null default true
);
comment on table vacinas_catalogo is 'Protocolo sanitário é DADO, não código (docs/03-modulos.md §M4). Aftosa é seedada com bloqueada=true.';

create table if not exists vacinas_aplicadas (
  id                uuid primary key default gen_random_uuid(),
  vacina_id         uuid references vacinas_catalogo(id),
  vacina            text not null,
  animal_id         uuid references animais(id),
  lote_id           uuid references lotes(id),
  data              date not null,
  dose              dose_vacina not null default 'unica',
  lote_fabricacao   text,
  laboratorio       text,
  validade          date,
  via_aplicacao     text,
  n_animais         integer check (n_animais > 0),
  custo_centavos    bigint check (custo_centavos >= 0),
  aplicado_por      text,
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now(),
  deletado_em       timestamptz,
  constraint ck_vacina_alvo check (animal_id is not null or lote_id is not null)
);
create index if not exists ix_vacinas_data on vacinas_aplicadas(data desc);

create table if not exists reproducao (
  id                  uuid primary key default gen_random_uuid(),
  matriz_id           uuid not null references animais(id),
  touro_id            uuid references animais(id),
  tipo                tipo_repro not null default 'monta_natural',
  data_cobertura      date not null,
  data_diagnostico    date,
  resultado           resultado_repro,
  previsao_parto      date,
  data_parto_real     date,
  bezerro_id          uuid references animais(id),
  observacao          text,
  registrado_por      uuid not null references usuarios_acesso(id),
  registrado_em       timestamptz not null default now(),
  deletado_em         timestamptz
);
create index if not exists ix_repro_matriz on reproducao(matriz_id, data_cobertura desc);

create table if not exists mortalidade (
  id               uuid primary key default gen_random_uuid(),
  animal_id        uuid references animais(id),
  lote_id          uuid references lotes(id),
  data             date not null,
  cabecas          integer not null default 1 check (cabecas > 0),
  categoria        categoria_animal,
  causa_suspeita   text,
  houve_necropsia  boolean default false,
  observacao       text,
  mensagem_id      uuid,
  registrado_por   uuid not null references usuarios_acesso(id),
  registrado_em    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. FINANCEIRO, ESTOQUE E MERCADO (§13.5)
-- ----------------------------------------------------------------------------

create table if not exists financeiro (
  id                uuid primary key default gen_random_uuid(),
  data              date not null,
  tipo              tipo_financeiro not null,
  categoria         text not null,
  subcategoria      text,
  descricao         text,
  valor_centavos    bigint not null check (valor_centavos > 0),
  lote_id           uuid references lotes(id),
  centro_custo      centro_custo not null,
  maquina_id        uuid,
  fornecedor        text,
  forma_pagamento   text,
  prazo_dias        integer default 0,
  vencimento        date,
  pago              boolean not null default true,
  nota_fiscal       text,
  rateio_automatico boolean not null default false,
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now(),
  deletado_em       timestamptz,
  estorna_id        uuid references financeiro(id)
);
create index if not exists ix_fin_data on financeiro(data desc);
create index if not exists ix_fin_lote on financeiro(lote_id, data desc) where deletado_em is null;
create index if not exists ix_fin_vencimento on financeiro(vencimento) where pago = false;

create table if not exists estoque_insumos (
  id                   uuid primary key default gen_random_uuid(),
  insumo               text not null unique,
  categoria            text not null,
  unidade              text not null,
  quantidade           numeric(12,3) not null default 0,
  custo_medio_centavos bigint not null default 0,
  minimo_alerta        numeric(12,3) not null default 0,
  validade             date,
  local_armazenamento  text,
  client_uuid          text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  atualizado_em        timestamptz not null default now()
);

create table if not exists movimentacoes_estoque (
  id             uuid primary key default gen_random_uuid(),
  insumo_id      uuid not null references estoque_insumos(id),
  tipo           text not null check (tipo in ('entrada','saida','ajuste','perda')),
  quantidade     numeric(12,3) not null,
  custo_centavos bigint,
  lote_id        uuid references lotes(id),
  data           date not null,
  mensagem_id    uuid,
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now()
);

create table if not exists cotacoes (
  id                  uuid primary key default gen_random_uuid(),
  insumo              text not null,
  fornecedor          text not null,
  quantidade          numeric(12,3),
  unidade             text,
  preco_centavos      bigint not null,
  prazo_dias          integer not null default 0,
  desconto_avista_pct numeric(5,2) default 0,
  frete_centavos      bigint default 0,
  custo_efetivo_centavos bigint,
  data                date not null,
  vencedora           boolean not null default false,
  registrado_por      uuid not null references usuarios_acesso(id),
  registrado_em       timestamptz not null default now()
);

create table if not exists precos_mercado (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in
                   ('arroba_boi','arroba_vaca','bezerro','bezerra','garrote','novilha','leite_litro')),
  valor_centavos bigint not null check (valor_centavos > 0),
  unidade        text not null default '@',
  praca          text not null default 'Imperatriz-MA',
  fonte          text not null,
  data_referencia date not null,
  registrado_por uuid references usuarios_acesso(id),
  registrado_em  timestamptz not null default now(),
  constraint uq_preco unique (tipo, praca, data_referencia, fonte)
);
create index if not exists ix_preco_tipo_data on precos_mercado(tipo, data_referencia desc);

create table if not exists producao_leite (
  id                  uuid primary key default gen_random_uuid(),
  data                date not null,
  turno               text check (turno in ('manha','tarde')),
  litros              numeric(9,2) not null check (litros >= 0),
  vaca_id             uuid references animais(id),
  lote_id             uuid references lotes(id),
  preco_litro_centavos bigint,
  mensagem_id         uuid,
  registrado_por      uuid not null references usuarios_acesso(id),
  registrado_em       timestamptz not null default now()
);
create index if not exists ix_leite_data on producao_leite(data desc);

-- ----------------------------------------------------------------------------
-- 6. MÁQUINAS, OPERAÇÃO E CLIMA (§13.6)
-- ----------------------------------------------------------------------------

create table if not exists maquinas (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null,
  tipo                     tipo_maquina not null,
  fabricante               text,
  modelo                   text not null,
  ano                      smallint check (ano between 1950 and 2100),
  numero_serie             text,
  horas_uso_total          numeric(10,1) not null default 0,
  horimetro_ultima_leitura numeric(10,1),
  horimetro_lido_em        date,
  status                   text not null default 'ativa'
                             check (status in ('ativa','parada','manutencao','vendida')),
  ficha_cuidados           jsonb,
  observacao               text,
  client_uuid              text unique, -- idempotência da fila offline do PWA (§36); acréscimo à F1
  criado_em                timestamptz not null default now()
);

create table if not exists plano_manutencao (
  id                 uuid primary key default gen_random_uuid(),
  maquina_id         uuid not null references maquinas(id) on delete cascade,
  item               text not null,
  intervalo_horas    integer,
  intervalo_dias     integer,
  peca_referencia    text,
  custo_estimado_centavos bigint,
  observacao         text,
  constraint ck_intervalo check (intervalo_horas is not null or intervalo_dias is not null)
);

create table if not exists manutencoes (
  id                uuid primary key default gen_random_uuid(),
  maquina_id        uuid not null references maquinas(id),
  plano_id          uuid references plano_manutencao(id),
  data              date not null,
  tipo              text not null,
  preventiva        boolean not null default true,
  horas_no_momento  numeric(10,1),
  peca_trocada      text,
  custo_centavos    bigint check (custo_centavos >= 0),
  executado_por     text,
  proxima_em_horas  numeric(10,1),
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now()
);

create table if not exists horas_maquina (
  id             uuid primary key default gen_random_uuid(),
  maquina_id     uuid not null references maquinas(id),
  data           date not null,
  horas          numeric(6,2) not null check (horas > 0),
  atividade      text,
  operador       text,
  mensagem_id    uuid,
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now()
);

create table if not exists tarefas (
  id               uuid primary key default gen_random_uuid(),
  data             date not null,
  prazo            date,
  tipo             text not null,
  descricao        text not null,
  origem           text not null default 'auto' check (origem in ('auto','manual','bot')),
  prioridade       smallint check (prioridade between 1 and 5),
  score_prioridade numeric(6,2),
  justificativa    text,
  impacto_estimado smallint,
  custo_estimado_centavos bigint,
  responsavel_id   uuid references usuarios_acesso(id),
  entidade_tipo    text,
  entidade_id      uuid,
  status           text not null default 'pendente'
                     check (status in ('pendente','em_andamento','concluida','cancelada')),
  concluida_em     timestamptz,
  registrado_por   uuid references usuarios_acesso(id),
  registrado_em    timestamptz not null default now()
);
create index if not exists ix_tarefas_pendentes on tarefas(prazo) where status = 'pendente';

create table if not exists chuvas (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  milimetros     numeric(6,1) not null check (milimetros >= 0),
  local          text,
  mensagem_id    uuid,
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now(),
  constraint uq_chuva_dia unique (data, local)
);

-- ----------------------------------------------------------------------------
-- 7. BOT, ALERTAS, RELATÓRIOS E AUDITORIA (§13.7)
-- ----------------------------------------------------------------------------

create table if not exists mensagens_bot (
  id                uuid primary key default gen_random_uuid(),
  client_uuid       text not null unique,
  usuario_id        uuid references usuarios_acesso(id),
  telefone_origem   text not null,
  plataforma        plataforma_bot not null,
  tipo              text not null check (tipo in ('audio','texto','foto','documento')),
  midia_url         text,
  duracao_segundos  integer,
  transcricao       text,
  payload_extraido  jsonb,
  eventos_gerados   jsonb,
  confianca_media   numeric(4,3),
  status            status_mensagem not null default 'recebida',
  erro              text,
  tentativas        smallint not null default 0,
  custo_api_centavos bigint default 0,
  recebido_em       timestamptz not null default now(),
  processado_em     timestamptz,
  revisado_por      uuid references usuarios_acesso(id),
  revisado_em       timestamptz
);
create index if not exists ix_msg_status on mensagens_bot(status, recebido_em desc);
create index if not exists ix_msg_revisao on mensagens_bot(recebido_em desc) where status = 'revisao';

create table if not exists alertas (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,
  severidade     severidade not null,
  entidade_tipo  text,
  entidade_id    uuid,
  titulo         text not null,
  mensagem       text not null,
  acao_sugerida  text,
  dados          jsonb,
  gerado_em      timestamptz not null default now(),
  lido_em        timestamptz,
  resolvido_em   timestamptz,
  resolvido_auto boolean default false,
  constraint uq_alerta_aberto unique (tipo, entidade_tipo, entidade_id, resolvido_em)
);
create index if not exists ix_alertas_abertos on alertas(severidade, gerado_em desc) where resolvido_em is null;

create table if not exists relatorios (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('semanal','trimestral','sob_demanda','geral')),
  periodo_inicio date not null,
  periodo_fim    date not null,
  conteudo_md    text not null,
  indicadores    jsonb,
  gerado_em      timestamptz not null default now()
);

create table if not exists auditoria (
  id           bigserial primary key,
  tabela       text not null,
  registro_id  uuid,
  acao         text not null check (acao in ('INSERT','UPDATE','SOFT_DELETE')),
  dados_antes  jsonb,
  dados_depois jsonb,
  usuario_id   uuid,
  origem       text,
  em           timestamptz not null default now()
);
create index if not exists ix_auditoria_registro on auditoria(tabela, registro_id, em desc);

-- ============================================================================
-- 8. RLS (§14) — política padrão: negar. Habilitada em TODAS as tabelas.
-- ============================================================================

-- current_papel(): security definer para não cair em recursão de RLS ao ler
-- o próprio papel do usuário em usuarios_acesso.
create or replace function current_papel()
returns papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from usuarios_acesso
  where auth_user_id = auth.uid()
    and status = 'ativo'
  limit 1
$$;

grant execute on function current_papel() to authenticated;

do $$
declare
  tbl text;
  -- todas as tabelas de fato/config exceto auditoria (tratada à parte abaixo)
  tabelas_admin_full text[] := array[
    'propriedade','usuarios_acesso','parametros_fazenda','pastos','lotes','animais',
    'movimentacoes_pasto','pesagens','vacinas_catalogo','vacinas_aplicadas','reproducao',
    'mortalidade','financeiro','estoque_insumos','movimentacoes_estoque','cotacoes',
    'precos_mercado','producao_leite','maquinas','plano_manutencao','manutencoes',
    'horas_maquina','tarefas','chuvas','mensagens_bot','alertas','relatorios'
  ];
begin
  foreach tbl in array tabelas_admin_full loop
    execute format('alter table %I enable row level security', tbl);

    execute format('drop policy if exists admin_select on %I', tbl);
    execute format(
      'create policy admin_select on %I for select using (current_papel() = ''admin'')', tbl
    );

    execute format('drop policy if exists admin_insert on %I', tbl);
    execute format(
      'create policy admin_insert on %I for insert with check (current_papel() = ''admin'')', tbl
    );

    execute format('drop policy if exists admin_update on %I', tbl);
    execute format(
      'create policy admin_update on %I for update using (current_papel() = ''admin'') with check (current_papel() = ''admin'')',
      tbl
    );

    execute format('drop trigger if exists audit_trigger on %I', tbl);
    execute format(
      'create trigger audit_trigger after insert or update on %I for each row execute function audit_trigger()',
      tbl
    );
  end loop;
end $$;

-- gerente: select + insert operacional, exceto financeiro/cotacoes/precos_mercado/usuarios_acesso (§14)
do $$
declare
  tbl text;
  tabelas_gerente text[] := array[
    'propriedade','parametros_fazenda','pastos','lotes','animais','movimentacoes_pasto',
    'pesagens','vacinas_catalogo','vacinas_aplicadas','reproducao','mortalidade',
    'estoque_insumos','movimentacoes_estoque','producao_leite','maquinas',
    'plano_manutencao','manutencoes','horas_maquina','tarefas','chuvas',
    'mensagens_bot','alertas','relatorios'
  ];
begin
  foreach tbl in array tabelas_gerente loop
    execute format('drop policy if exists gerente_select on %I', tbl);
    execute format(
      'create policy gerente_select on %I for select using (current_papel() = ''gerente'')', tbl
    );

    execute format('drop policy if exists gerente_insert on %I', tbl);
    execute format(
      'create policy gerente_insert on %I for insert with check (current_papel() = ''gerente'')', tbl
    );
  end loop;
end $$;

-- auditoria: só leitura por admin. Escrita só pela trigger (security definer,
-- roda como dono da tabela e por isso não precisa de policy de insert aqui).
alter table auditoria enable row level security;
drop policy if exists admin_select on auditoria;
create policy admin_select on auditoria for select using (current_papel() = 'admin');

-- audit_trigger(): genérica, funciona em qualquer tabela com coluna id uuid.
-- security definer para gravar em auditoria independente da RLS do papel que
-- disparou o INSERT/UPDATE original (ex.: gerente inserindo uma pesagem).
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
begin
  if tg_op = 'INSERT' then
    v_registro := (to_jsonb(new)->>'id')::uuid;
    insert into auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, origem)
    values (
      tg_table_name, v_registro, 'INSERT', null, to_jsonb(new), auth.uid(),
      coalesce(current_setting('app.origem', true), 'desconhecida')
    );
    return new;
  elsif tg_op = 'UPDATE' then
    v_registro := (to_jsonb(new)->>'id')::uuid;
    v_deletado_antes := coalesce((to_jsonb(old)->>'deletado_em') is not null, false);
    v_deletado_depois := coalesce((to_jsonb(new)->>'deletado_em') is not null, false);
    v_acao := case when (not v_deletado_antes) and v_deletado_depois then 'SOFT_DELETE' else 'UPDATE' end;

    insert into auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, origem)
    values (
      tg_table_name, v_registro, v_acao, to_jsonb(old), to_jsonb(new), auth.uid(),
      coalesce(current_setting('app.origem', true), 'desconhecida')
    );
    return new;
  end if;
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Privilégios explícitos e proibição de DELETE (§16)
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke delete on all tables in schema public from authenticated;
-- 'anon' não recebe nenhum privilégio de tabela: só admin/gerente autenticam no PWA.
