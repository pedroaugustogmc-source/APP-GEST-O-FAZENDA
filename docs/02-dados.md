# PARTE III — DADOS

## 13. Modelo de dados — DDL canônico

Este é o **esquema de referência**. Você vai entregá-lo completo, idempotente, com `create type if not exists`, comentários (`comment on`), constraints nomeadas, índices e RLS. Pode **acrescentar** campos e tabelas se justificar; **não pode remover nem renomear** o que está aqui.

### 13.1. Tipos

```sql
create type papel_usuario     as enum ('admin','gerente','trabalhador');
create type status_usuario    as enum ('ativo','inativo');
create type plataforma_bot    as enum ('telegram','whatsapp');
create type sexo_animal       as enum ('M','F');
create type categoria_animal  as enum ('bezerro','bezerra','garrote','novilha','vaca','touro','boi');
create type origem_animal     as enum ('nascimento','compra');
create type status_animal     as enum ('ativo','vendido','morto','descartado');
create type tipo_operacao     as enum ('cria','recria','engorda','leite','misto');
create type status_lote       as enum ('rascunho','ativo','vendido','encerrado');
create type status_pasto      as enum ('em_uso','descanso','vedado','reforma');
create type tipo_financeiro   as enum ('custo','receita');
create type centro_custo      as enum ('cria','recria','leite','estrutura','administrativo');
create type tipo_maquina      as enum ('trator','implemento','veiculo','bomba','gerador','outro');
create type status_mensagem   as enum ('recebida','transcrita','extraida','gravada','revisao','erro','descartada');
create type severidade        as enum ('info','atencao','critico');
create type resultado_repro   as enum ('prenha','vazia','perda_gestacional','parida');
create type tipo_repro        as enum ('monta_natural','IA','IATF');
create type dose_vacina       as enum ('unica','primeira','segunda','reforco');
```

### 13.2. Núcleo — acesso e configuração

```sql
-- Propriedade (single-tenant nesta versão; campo pronto para multi-fazenda futura)
create table propriedade (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  municipio       text not null default 'Imperatriz',
  uf              char(2) not null default 'MA',
  area_total_ha   numeric(10,2),
  inscricao_estadual text,
  criado_em       timestamptz not null default now()
);

create table usuarios_acesso (
  id                uuid primary key default gen_random_uuid(),
  auth_user_id      uuid references auth.users(id),       -- só admin/gerente têm login no PWA
  telefone          text not null,                        -- E.164, ex: +5599999999999
  plataforma        plataforma_bot not null default 'telegram',
  chat_id_externo   text,                                 -- id do Telegram/WhatsApp
  nome              text not null,
  papel             papel_usuario not null default 'trabalhador',
  status            status_usuario not null default 'ativo',
  data_admissao     date,
  data_desligamento date,
  ultimo_acesso     timestamptz,
  criado_por        uuid references usuarios_acesso(id),
  criado_em         timestamptz not null default now(),
  constraint uq_usuario_telefone unique (telefone, plataforma),
  constraint ck_desligamento check (
    (status = 'inativo' and data_desligamento is not null) or status = 'ativo'
  )
);
create index ix_usuarios_ativos on usuarios_acesso (telefone) where status = 'ativo';

create table parametros_fazenda (
  chave        text primary key,
  valor        text not null,
  tipo_dado    text not null check (tipo_dado in ('number','text','date','boolean')),
  unidade      text,
  descricao    text not null,
  editavel     boolean not null default true,
  atualizado_por uuid references usuarios_acesso(id),
  atualizado_em  timestamptz not null default now()
);
```

### 13.3. Pastagem

```sql
create table pastos (
  id                       uuid primary key default gen_random_uuid(),
  nome                     text not null unique,
  apelidos                 text[] default '{}',        -- para o parser do bot ("pasto do buriti")
  tamanho_ha               numeric(8,2) not null check (tamanho_ha > 0),
  capim                    text,                        -- marandu | mombaca | massai | nativo | outro
  capacidade_ua_ha_ref     numeric(5,2),               -- null = derivar de parametros pelo capim
  tem_acude                boolean not null default false,
  nivel_acude              smallint check (nivel_acude between 0 and 100),
  nivel_acude_em           timestamptz,
  status                   status_pasto not null default 'descanso',
  lote_atual_id            uuid,                        -- FK adicionada após 'lotes'
  data_entrada_lote_atual  date,
  data_saida_ultimo_lote   date,
  ultima_adubacao          date,
  ultima_rocada            date,
  coordenadas              jsonb,                       -- polígono do croqui no mapa visual
  observacao               text,
  criado_em                timestamptz not null default now()
);

create table lotes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  categoria      categoria_animal not null,
  tipo_operacao  tipo_operacao not null,
  peso_entrada   numeric(7,1) check (peso_entrada > 0),   -- peso médio de entrada (kg)
  data_entrada   date not null,
  data_saida     date,
  area_ha        numeric(8,2),
  pasto_id       uuid references pastos(id),
  cabecas_atuais integer not null default 0 check (cabecas_atuais >= 0),
  status         status_lote not null default 'ativo',
  observacao     text,
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now(),
  deletado_em    timestamptz,
  constraint ck_lote_datas check (data_saida is null or data_saida >= data_entrada)
);

alter table pastos add constraint fk_pasto_lote
  foreign key (lote_atual_id) references lotes(id);

create table animais (
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
  registrado_por   uuid not null references usuarios_acesso(id),
  registrado_em    timestamptz not null default now(),
  deletado_em      timestamptz,
  constraint ck_categoria_sexo check (
    (sexo='F' and categoria in ('bezerra','novilha','vaca')) or
    (sexo='M' and categoria in ('bezerro','garrote','touro','boi'))
  )
);
create index ix_animais_lote on animais(lote_id) where deletado_em is null;
create index ix_animais_matriz on animais(matriz_id);

create table movimentacoes_pasto (
  id                uuid primary key default gen_random_uuid(),
  lote_id           uuid not null references lotes(id),
  pasto_origem_id   uuid references pastos(id),
  pasto_destino_id  uuid not null references pastos(id),
  data              date not null,
  cabecas           integer not null check (cabecas > 0),
  motivo            text,
  dias_descanso_destino integer,   -- calculado na gravação, congelado para histórico
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now()
);
create index ix_mov_pasto_data on movimentacoes_pasto(data desc);
create index ix_mov_pasto_destino on movimentacoes_pasto(pasto_destino_id, data desc);
```

### 13.4. Desempenho e sanidade

```sql
create table pesagens (
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
create index ix_pesagens_lote_data on pesagens(lote_id, data desc);
create index ix_pesagens_animal_data on pesagens(animal_id, data desc);

-- Catálogo de protocolo: as REGRAS sanitárias são DADO, não código.
create table vacinas_catalogo (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null unique,
  obrigatoria         boolean not null default false,
  base_legal          text,                     -- ex: 'PNCEBT'
  sexo_alvo           sexo_animal,              -- null = ambos
  idade_min_meses     numeric(4,1),
  idade_max_meses     numeric(4,1),
  categorias_alvo     categoria_animal[],
  doses               smallint not null default 1,
  intervalo_dose_dias integer,
  reforco_meses       integer,
  previne             text not null,
  epoca_observacao    text,
  incompativel_com    text[] default '{}',      -- nomes de vacinas que não podem no mesmo dia
  intervalo_minimo_dias integer,                -- distância exigida das incompatíveis
  bloqueada           boolean not null default false,
  motivo_bloqueio     text,
  ativo               boolean not null default true
);

create table vacinas_aplicadas (
  id                uuid primary key default gen_random_uuid(),
  vacina_id         uuid references vacinas_catalogo(id),
  vacina            text not null,             -- nome literal, preservado por histórico
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
  aplicado_por      text,                       -- quem aplicou (pode não ser quem registrou)
  mensagem_id       uuid,
  registrado_por    uuid not null references usuarios_acesso(id),
  registrado_em     timestamptz not null default now(),
  deletado_em       timestamptz,
  constraint ck_vacina_alvo check (animal_id is not null or lote_id is not null)
);
create index ix_vacinas_data on vacinas_aplicadas(data desc);

create table reproducao (
  id                  uuid primary key default gen_random_uuid(),
  matriz_id           uuid not null references animais(id),
  touro_id            uuid references animais(id),
  tipo                tipo_repro not null default 'monta_natural',
  data_cobertura      date not null,
  data_diagnostico    date,
  resultado           resultado_repro,
  previsao_parto      date,                     -- cobertura + 283 dias
  data_parto_real     date,
  bezerro_id          uuid references animais(id),
  observacao          text,
  registrado_por      uuid not null references usuarios_acesso(id),
  registrado_em       timestamptz not null default now(),
  deletado_em         timestamptz
);
create index ix_repro_matriz on reproducao(matriz_id, data_cobertura desc);

create table mortalidade (
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
```

### 13.5. Financeiro, estoque e mercado

```sql
create table financeiro (
  id                uuid primary key default gen_random_uuid(),
  data              date not null,
  tipo              tipo_financeiro not null,
  categoria         text not null,      -- ver §M5: lista fixa de categorias
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
create index ix_fin_data on financeiro(data desc);
create index ix_fin_lote on financeiro(lote_id, data desc) where deletado_em is null;
create index ix_fin_vencimento on financeiro(vencimento) where pago = false;

create table estoque_insumos (
  id                   uuid primary key default gen_random_uuid(),
  insumo               text not null unique,
  categoria            text not null,
  unidade              text not null,          -- kg | saco | litro | dose | unidade
  quantidade           numeric(12,3) not null default 0,
  custo_medio_centavos bigint not null default 0,
  minimo_alerta        numeric(12,3) not null default 0,
  validade             date,
  local_armazenamento  text,
  atualizado_em        timestamptz not null default now()
);

create table movimentacoes_estoque (
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

create table cotacoes (
  id                  uuid primary key default gen_random_uuid(),
  insumo              text not null,
  fornecedor          text not null,
  quantidade          numeric(12,3),
  unidade             text,
  preco_centavos      bigint not null,
  prazo_dias          integer not null default 0,
  desconto_avista_pct numeric(5,2) default 0,
  frete_centavos      bigint default 0,
  custo_efetivo_centavos bigint,     -- calculado (§9)
  data                date not null,
  vencedora           boolean not null default false,
  registrado_por      uuid not null references usuarios_acesso(id),
  registrado_em       timestamptz not null default now()
);

create table precos_mercado (
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
create index ix_preco_tipo_data on precos_mercado(tipo, data_referencia desc);

create table producao_leite (
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
create index ix_leite_data on producao_leite(data desc);
```

### 13.6. Máquinas, operação e clima

```sql
create table maquinas (
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
  ficha_cuidados           jsonb,     -- §M7: recomendações do fabricante, consultáveis na hora
  observacao               text,
  criado_em                timestamptz not null default now()
);

create table plano_manutencao (
  id                 uuid primary key default gen_random_uuid(),
  maquina_id         uuid not null references maquinas(id) on delete cascade,
  item               text not null,           -- 'troca de óleo do motor', 'filtro de ar'...
  intervalo_horas    integer,
  intervalo_dias     integer,
  peca_referencia    text,
  custo_estimado_centavos bigint,
  observacao         text,
  constraint ck_intervalo check (intervalo_horas is not null or intervalo_dias is not null)
);

create table manutencoes (
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

create table horas_maquina (
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

create table tarefas (
  id               uuid primary key default gen_random_uuid(),
  data             date not null,
  prazo            date,
  tipo             text not null,
  descricao        text not null,
  origem           text not null default 'auto' check (origem in ('auto','manual','bot')),
  prioridade       smallint check (prioridade between 1 and 5),
  score_prioridade numeric(6,2),
  justificativa    text,                    -- 1 frase: por que está nesta posição
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
create index ix_tarefas_pendentes on tarefas(prazo) where status = 'pendente';

create table chuvas (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  milimetros     numeric(6,1) not null check (milimetros >= 0),
  local          text,
  mensagem_id    uuid,
  registrado_por uuid not null references usuarios_acesso(id),
  registrado_em  timestamptz not null default now(),
  constraint uq_chuva_dia unique (data, local)
);
```

### 13.7. Bot, alertas, relatórios e auditoria

```sql
create table mensagens_bot (
  id                uuid primary key default gen_random_uuid(),
  client_uuid       text not null unique,      -- idempotência ponta a ponta
  usuario_id        uuid references usuarios_acesso(id),
  telefone_origem   text not null,
  plataforma        plataforma_bot not null,
  tipo              text not null check (tipo in ('audio','texto','foto','documento')),
  midia_url         text,
  duracao_segundos  integer,
  transcricao       text,
  payload_extraido  jsonb,
  eventos_gerados   jsonb,                     -- ids criados, por tabela
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
create index ix_msg_status on mensagens_bot(status, recebido_em desc);
create index ix_msg_revisao on mensagens_bot(recebido_em desc) where status = 'revisao';

create table alertas (
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
create index ix_alertas_abertos on alertas(severidade, gerado_em desc) where resolvido_em is null;

create table relatorios (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('semanal','trimestral','sob_demanda','geral')),
  periodo_inicio date not null,
  periodo_fim    date not null,
  conteudo_md    text not null,
  indicadores    jsonb,
  gerado_em      timestamptz not null default now()
);

create table auditoria (
  id           bigserial primary key,
  tabela       text not null,
  registro_id  uuid,
  acao         text not null check (acao in ('INSERT','UPDATE','SOFT_DELETE')),
  dados_antes  jsonb,
  dados_depois jsonb,
  usuario_id   uuid,
  origem       text,                 -- 'pwa' | 'bot' | 'job'
  em           timestamptz not null default now()
);
create index ix_auditoria_registro on auditoria(tabela, registro_id, em desc);
```

## 14. Row Level Security

**RLS habilitada em TODAS as tabelas. Política padrão: negar.** Sem exceção, sem tabela "só de leitura pública".

Diretrizes:

- Função `current_papel()` lê o papel do usuário autenticado a partir de `usuarios_acesso`.
- `admin`: `select/insert/update` em tudo; nunca `delete`.
- `gerente`: `select` em tudo **exceto** `financeiro`, `cotacoes`, `precos_mercado` (valores) e `usuarios_acesso`; `insert` operacional.
- `trabalhador`: **nenhuma policy de `select` em nenhuma tabela.** Escrita ocorre exclusivamente via edge function com `service_role`, após validação do telefone. O trabalhador **não tem sessão Supabase**.
- Teste automatizado obrigatório: com um JWT de `trabalhador`, todo `select` em toda tabela retorna vazio ou erro. Se algum retornar linha, o build falha.

## 15. Índices e performance

- Todo `where` de dashboard tem índice correspondente (já indicados no DDL).
- Views materializadas para os cálculos pesados, atualizadas por job: `mv_custo_por_lote`, `mv_gmd_por_lote`, `mv_lotacao_por_pasto`, `mv_indicadores_cria`, `mv_indicadores_recria`. **Refresh incremental**, nunca full a cada requisição.
- Meta: dashboard executivo carrega em **< 800 ms** com 5 anos de histórico e 2.000 cabeças.

## 16. Imutabilidade, soft delete e auditoria

- Nenhuma tabela de fato aceita `DELETE`. Revogue o privilégio no banco.
- Correção = novo registro com `estorna_id` apontando para o original, ou `deletado_em` + `deletado_por` + `motivo`.
- Trigger `audit_trigger` em todas as tabelas de fato grava em `auditoria` (antes/depois em `jsonb`).
- `registrado_por` e `registrado_em` são preenchidos pelo servidor e **rejeitados** se vierem do cliente.

## 17. Migração da planilha atual

Fase 1 entrega um **importador**: o admin sobe o CSV/XLSX atual, o sistema mapeia colunas de forma assistida, valida linha a linha, mostra **pré-visualização com os erros destacados** e só grava após confirmação. Linhas inválidas vão para um relatório de rejeição — nunca são silenciosamente descartadas nem "corrigidas por adivinhação". Todo registro importado recebe `origem = 'importacao'` e mantém a linha original em `jsonb`.

---
