import { NextResponse } from "next/server";
import { criarClienteServico } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { scoreTarefa } from "@/domain/calculos/scoreTarefa";
import { criarAdapterTelegram } from "@/infra/messaging/telegram";
import { criarAdapterGoogleCalendar, credenciaisGoogleCalendarDoAmbiente } from "@/infra/calendar/google";
import { montarRelatorioSemanal, montarRelatorioTrimestral } from "@/infra/relatorios/montarRelatorio";
import { hojeEmFortaleza, partesDeISODate } from "@/domain/tipos/data";
import type { ISODate, Parametros } from "@/domain/tipos";
import type { TarefaRow } from "@/infra/supabase/tipos";

// docs/03-modulos.md M8 "escala de trabalho por prioridade" + M9
// "consolidação semanal automática". Decisão de arquitetura (ESTADO.md):
// um cron só faz priorização + sincronização com o Calendar + relatório
// semanal (e trimestral, nos meses de virada) — em vez de 2 crons novos,
// mantendo o total em 4 (risco do plano Hobby da Vercel já registrado).
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

const MAPA_SEVERIDADE: Record<string, { impacto: number; urgencia: number; risco: number }> = {
  critico: { impacto: 9, urgencia: 8, risco: 9 },
  atencao: { impacto: 5, urgencia: 5, risco: 5 },
  info: { impacto: 2, urgencia: 2, risco: 2 },
};

export async function GET(request: Request) {
  const segredoConfigurado = process.env.CRON_SECRET;
  const segredoRecebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = criarClienteServico();
  const parametros = await buscarParametros(supabase);
  const hoje = hojeEmFortaleza();

  const priorizacao = await priorizarTarefas(supabase, hoje);
  const calendar = await sincronizarComCalendar(supabase, parametros);
  const relatorio = await gerarEEnviarRelatorios(supabase, parametros, hoje);

  return NextResponse.json({ gerado_em: new Date().toISOString(), priorizacao, calendar, relatorio });
}

interface CandidataTarefa {
  entidadeTipo: string;
  entidadeId: string | null;
  tipo: string;
  descricao: string;
  impacto: number;
  urgencia: number;
  risco: number;
  custoNormalizado: number;
}

function chaveTarefa(entidadeTipo: string, entidadeId: string | null, tipo: string): string {
  return `${entidadeTipo}|${entidadeId ?? "__sem_entidade__"}|${tipo}`;
}

// docs/01-dominio.md §9: score = impacto*0,40 + urgencia*0,30 +
// risco*0,20 − custo_normalizado*0,10 (scoreTarefa, Anexo B). Alertas não
// carregam estimativa de custo estruturada hoje — custoNormalizado fica 0
// (honesto: nenhum alerta atual popula isso, não é fabricado).
async function priorizarTarefas(supabase: Supa, hoje: ISODate): Promise<{ criadas: number; atualizadas: number; concluidas_automaticamente: number }> {
  const [{ data: alertasAbertos }, { data: checklistDevidos }, { data: tarefasPendentes }] = await Promise.all([
    supabase.from("alertas").select("tipo, severidade, entidade_tipo, entidade_id, titulo, mensagem").is("resolvido_em", null).in("severidade", ["critico", "atencao"]),
    supabase.from("checklist_itens").select("id, descricao, categoria, proxima_execucao").eq("ativo", true).lte("proxima_execucao", hoje),
    supabase.from("tarefas").select("id, entidade_tipo, entidade_id, tipo").eq("status", "pendente"),
  ]);

  const candidatas: CandidataTarefa[] = [];

  type LinhaAlerta = { tipo: string; severidade: "info" | "atencao" | "critico"; entidade_tipo: string | null; entidade_id: string | null; titulo: string; mensagem: string };
  for (const alerta of (alertasAbertos ?? []) as LinhaAlerta[]) {
    const pesos = MAPA_SEVERIDADE[alerta.severidade] ?? MAPA_SEVERIDADE.atencao!;
    candidatas.push({
      entidadeTipo: alerta.entidade_tipo ?? "propriedade",
      entidadeId: alerta.entidade_id,
      tipo: alerta.tipo,
      descricao: `${alerta.titulo} — ${alerta.mensagem}`,
      ...pesos,
      custoNormalizado: 0,
    });
  }

  type LinhaChecklist = { id: string; descricao: string; categoria: string; proxima_execucao: ISODate };
  for (const item of (checklistDevidos ?? []) as LinhaChecklist[]) {
    const diasAtraso = diferencaDias(item.proxima_execucao, hoje);
    candidatas.push({
      entidadeTipo: "checklist_itens",
      entidadeId: item.id,
      tipo: "checklist",
      descricao: `[${item.categoria}] ${item.descricao}`,
      impacto: 5,
      urgencia: Math.min(10, Math.max(5, 5 + diasAtraso / 2)),
      risco: 4,
      custoNormalizado: 0,
    });
  }

  type LinhaTarefaPendente = { id: string; entidade_tipo: string | null; entidade_id: string | null; tipo: string };
  const tarefasExistentesPorChave = new Map<string, string>(
    ((tarefasPendentes ?? []) as LinhaTarefaPendente[]).map((t) => [chaveTarefa(t.entidade_tipo ?? "propriedade", t.entidade_id, t.tipo), t.id])
  );

  let criadas = 0;
  let atualizadas = 0;

  for (const candidata of candidatas) {
    const chave = chaveTarefa(candidata.entidadeTipo, candidata.entidadeId, candidata.tipo);
    const { score, justificativa } = scoreTarefa({
      impacto: candidata.impacto,
      urgencia: candidata.urgencia,
      risco: candidata.risco,
      custoNormalizado: candidata.custoNormalizado,
    });

    const idExistente = tarefasExistentesPorChave.get(chave);
    if (idExistente) {
      await supabase
        .from("tarefas")
        .update({ descricao: candidata.descricao, score_prioridade: score, justificativa, impacto_estimado: Math.round(candidata.impacto) })
        .eq("id", idExistente);
      atualizadas += 1;
      tarefasExistentesPorChave.delete(chave);
    } else {
      await supabase.from("tarefas").insert({
        data: hoje,
        tipo: candidata.tipo,
        descricao: candidata.descricao,
        origem: "auto",
        score_prioridade: score,
        justificativa,
        impacto_estimado: Math.round(candidata.impacto),
        entidade_tipo: candidata.entidadeTipo,
        entidade_id: candidata.entidadeId,
        status: "pendente",
      });
      criadas += 1;
    }
  }

  // O que sobrou em tarefasExistentesPorChave é `auto` sem candidata correspondente
  // mais — a condição que a gerou não existe mais (alerta resolvido, checklist já
  // cumprido). Mesmo raciocínio de sincronizarAlertas: fecha sozinho.
  let concluidasAutomaticamente = 0;
  for (const [, id] of tarefasExistentesPorChave) {
    await supabase.from("tarefas").update({ status: "concluida", concluida_em: new Date().toISOString() }).eq("id", id);
    concluidasAutomaticamente += 1;
  }

  return { criadas, atualizadas, concluidas_automaticamente: concluidasAutomaticamente };
}

async function sincronizarComCalendar(supabase: Supa, parametros: Parametros): Promise<{ sincronizadas: number; removidas: number; configurado: boolean }> {
  const credenciais = credenciaisGoogleCalendarDoAmbiente();
  if (!credenciais) return { sincronizadas: 0, removidas: 0, configurado: false };

  const adapter = criarAdapterGoogleCalendar(credenciais);
  const limite = parametros.LIMITE_TAREFAS_CALENDAR ?? 10;

  const { data } = await supabase
    .from("tarefas")
    .select("id, data, prazo, descricao, status, calendar_event_id, score_prioridade")
    .in("status", ["pendente", "concluida", "cancelada"])
    .order("score_prioridade", { ascending: false, nullsFirst: false });

  const tarefas = (data ?? []) as Array<Pick<TarefaRow, "id" | "data" | "prazo" | "descricao" | "status" | "calendar_event_id" | "score_prioridade">>;
  const pendentes = tarefas.filter((t) => t.status === "pendente");
  const naoPendentesComEvento = tarefas.filter((t) => t.status !== "pendente" && t.calendar_event_id);

  let sincronizadas = 0;
  let removidas = 0;

  for (let i = 0; i < pendentes.length; i += 1) {
    const tarefa = pendentes[i]!;
    if (i < limite) {
      const id = await adapter.criarOuAtualizarEvento({ titulo: tarefa.descricao, data: tarefa.prazo ?? tarefa.data }, tarefa.calendar_event_id);
      if (id !== tarefa.calendar_event_id) await supabase.from("tarefas").update({ calendar_event_id: id }).eq("id", tarefa.id);
      sincronizadas += 1;
    } else if (tarefa.calendar_event_id) {
      await adapter.removerEvento(tarefa.calendar_event_id);
      await supabase.from("tarefas").update({ calendar_event_id: null }).eq("id", tarefa.id);
      removidas += 1;
    }
  }

  for (const tarefa of naoPendentesComEvento) {
    await adapter.removerEvento(tarefa.calendar_event_id!);
    await supabase.from("tarefas").update({ calendar_event_id: null }).eq("id", tarefa.id);
    removidas += 1;
  }

  return { sincronizadas, removidas, configurado: true };
}

async function gerarEEnviarRelatorios(
  supabase: Supa,
  parametros: Parametros,
  hoje: ISODate
): Promise<{ semanal: boolean; trimestral: boolean; enviado_ao_admin: boolean }> {
  const { data: agendaData } = await supabase
    .from("tarefas")
    .select("descricao, justificativa")
    .eq("status", "pendente")
    .order("score_prioridade", { ascending: false, nullsFirst: false })
    .limit(5);
  const agenda = (agendaData ?? []) as Array<{ descricao: string; justificativa: string | null }>;

  const semanal = await montarRelatorioSemanal(supabase, parametros, hoje, agenda);
  await supabase.from("relatorios").insert({
    tipo: semanal.tipo,
    periodo_inicio: semanal.periodoInicio,
    periodo_fim: semanal.periodoFim,
    conteudo_md: semanal.conteudoMd,
    indicadores: semanal.indicadores,
  });

  let trimestral = false;
  if (ehInicioDeTrimestre(hoje)) {
    const relatorioTrimestral = await montarRelatorioTrimestral(supabase, parametros, hoje);
    await supabase.from("relatorios").insert({
      tipo: relatorioTrimestral.tipo,
      periodo_inicio: relatorioTrimestral.periodoInicio,
      periodo_fim: relatorioTrimestral.periodoFim,
      conteudo_md: relatorioTrimestral.conteudoMd,
      indicadores: relatorioTrimestral.indicadores,
    });
    trimestral = true;
  }

  const enviadoAoAdmin = await enviarResumoAoAdmin(supabase, semanal.conteudoMd);

  return { semanal: true, trimestral, enviado_ao_admin: enviadoAoAdmin };
}

// Best-effort: só envia se o admin já vinculou o Telegram (compartilhou
// contato, F2) e se TELEGRAM_BOT_TOKEN está configurado — sem isso, o
// relatório continua disponível na tela /relatorios, silenciosamente.
async function enviarResumoAoAdmin(supabase: Supa, conteudoMd: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const { data: admin } = await supabase.from("usuarios_acesso").select("chat_id_externo").eq("papel", "admin").eq("status", "ativo").not("chat_id_externo", "is", null).limit(1).maybeSingle();
  if (!admin?.chat_id_externo) return false;

  const telegram = criarAdapterTelegram(botToken);
  await telegram.responder(admin.chat_id_externo, markdownParaTextoSimples(conteudoMd));
  return true;
}

function markdownParaTextoSimples(md: string): string {
  return md.replace(/^#+\s*/gm, "").trim();
}

function diferencaDias(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

function ehInicioDeTrimestre(hoje: ISODate): boolean {
  const partes = partesDeISODate(hoje);
  const mesInicioTrimestre = [1, 4, 7, 10].includes(partes.mes);
  return mesInicioTrimestre && partes.dia <= 7;
}
