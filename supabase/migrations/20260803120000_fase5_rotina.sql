-- ============================================================================
-- Fase 5 — Rotina: checklist recorrente, sincronização com Google Calendar,
-- parâmetros novos. Idempotente. `maquinas`, `plano_manutencao`,
-- `manutencoes`, `horas_maquina`, `cotacoes`, `tarefas`, `relatorios` já
-- existem desde a migração da F1 — só `checklist_itens` é tabela nova.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- `checklist_itens`: docs/03-modulos.md M8, "checklist automatizado de
-- manutenção (cerca, curral, bebedouro, maquinário) com recorrência". Não é
-- a mesma coisa que `tarefas` — `tarefas` são as OCORRÊNCIAS concretas
-- (ex.: "revisar cerca do pasto 3, prazo 05/08"); `checklist_itens` é o
-- TEMPLATE recorrente que o worker semanal usa pra gerar uma nova tarefa
-- quando `proxima_execucao <= hoje`.
-- ----------------------------------------------------------------------------

create table if not exists checklist_itens (
  id                uuid primary key default gen_random_uuid(),
  descricao         text not null,
  categoria         text not null,
  recorrencia_dias  integer not null check (recorrencia_dias > 0),
  ultima_execucao   date,
  proxima_execucao  date not null,
  ativo             boolean not null default true,
  client_uuid       text unique, -- idempotência da fila offline do PWA (§36), mesmo padrão da F1
  criado_em         timestamptz not null default now()
);
create index if not exists ix_checklist_itens_proxima on checklist_itens(proxima_execucao) where ativo;

-- RLS: mesmo padrão exato do bloco genérico da F1 (docs/02-dados.md §14),
-- só que aplicado a esta tabela nova em vez de reabrir a migração inicial.
alter table checklist_itens enable row level security;

drop policy if exists admin_select on checklist_itens;
create policy admin_select on checklist_itens for select using (current_papel() = 'admin');
drop policy if exists admin_insert on checklist_itens;
create policy admin_insert on checklist_itens for insert with check (current_papel() = 'admin');
drop policy if exists admin_update on checklist_itens;
create policy admin_update on checklist_itens for update using (current_papel() = 'admin') with check (current_papel() = 'admin');

drop policy if exists gerente_select on checklist_itens;
create policy gerente_select on checklist_itens for select using (current_papel() = 'gerente');
drop policy if exists gerente_insert on checklist_itens;
create policy gerente_insert on checklist_itens for insert with check (current_papel() = 'gerente');

drop trigger if exists audit_trigger on checklist_itens;
create trigger audit_trigger after insert or update on checklist_itens for each row execute function audit_trigger();

grant select, insert, update on checklist_itens to authenticated;
revoke delete on checklist_itens from authenticated;

-- ----------------------------------------------------------------------------
-- `tarefas.calendar_event_id`: idempotência da sincronização com o Google
-- Calendar (criar vs. atualizar vs. remover o mesmo evento em vez de
-- duplicar a cada execução do worker semanal). §13: "pode acrescentar
-- campos, não pode remover".
-- ----------------------------------------------------------------------------

alter table tarefas add column if not exists calendar_event_id text;

-- ----------------------------------------------------------------------------
-- `plano_manutencao` e `manutencoes` só eram gravadas pelo bot (server-side,
-- função gravar_eventos_mensagem_bot) até a F4 — não precisavam de
-- client_uuid porque não passavam pela fila offline do PWA. A F5 acrescenta
-- telas administrativas pra essas 2 tabelas (plano de manutenção, registro
-- administrativo de manutenção) — mesmo raciocínio já aplicado a
-- `financeiro`/`precos_mercado` na F4: "offline é o estado normal" (regra 8)
-- vale pra qualquer tela do admin, não só pro bot. `cotacoes` NÃO entra
-- aqui: o comparador (docs/03-modulos.md M8) é uma ação síncrona que
-- devolve o resultado na hora (mesmo padrão de /api/financeiro/ratear, F4),
-- não um lançamento avulso que se beneficia de fila offline.
-- ----------------------------------------------------------------------------

alter table plano_manutencao add column if not exists client_uuid text unique;
alter table manutencoes add column if not exists client_uuid text unique;

-- ----------------------------------------------------------------------------
-- Parâmetros novos (CLAUDE.md regra 3 — nenhum limiar de negócio hardcoded).
-- `ALERTA_MANUTENCAO_HORAS` já existe desde o seed da F1 (valor 20).
-- ----------------------------------------------------------------------------

insert into parametros_fazenda (chave, valor, tipo_dado, unidade, descricao) values
  ('DIAS_INSUMO_VENCENDO', '30', 'number', 'dias', 'docs/01-dominio.md §12 — alerta insumo_vencendo: validade do insumo dentro deste número de dias'),
  ('LIMITE_TAREFAS_CALENDAR', '10', 'number', 'tarefas', 'docs/03-modulos.md M8 — quantas tarefas pendentes de maior score_prioridade sobem pro Google Calendar a cada rodada semanal, pra não lotar a agenda')
on conflict (chave) do nothing;
