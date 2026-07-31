import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor } from "@/infra/supabase/server";
import { criarAdapterGoogleCalendar, credenciaisGoogleCalendarDoAmbiente } from "@/infra/calendar/google";
import { hojeEmFortaleza, partesDeISODate } from "@/domain/tipos/data";
import type { ISODate } from "@/domain/tipos";

const Esquema = z.object({ acao: z.enum(["concluir", "cancelar"]) });

function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

// docs/03-modulos.md M8 — a agenda da semana (/tarefas) precisa de um jeito
// de marcar concluído/cancelado. Duas consequências automáticas: remove o
// evento do Google Calendar (se sincronizado) e, se a tarefa veio de um
// checklist_itens, avança ultima_execucao/proxima_execucao — sem isso o
// worker semanal geraria a mesma tarefa de novo na próxima segunda.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return respostaErro("Sessão inválida.", 401);

  const { data: admin } = await supabase.from("usuarios_acesso").select("id").eq("auth_user_id", sessao.user.id).single();
  if (!admin) return respostaErro("Usuário sem cadastro em usuarios_acesso.", 401);

  const corpo = await request.json().catch(() => null);
  const analisado = Esquema.safeParse(corpo);
  if (!analisado.success) return respostaErro(analisado.error.issues[0]?.message ?? "Corpo inválido", 400);

  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("id, status, entidade_tipo, entidade_id, calendar_event_id")
    .eq("id", params.id)
    .single();
  if (!tarefa) return respostaErro("Tarefa não encontrada.", 404);
  if (tarefa.status !== "pendente" && tarefa.status !== "em_andamento") {
    return respostaErro(`Tarefa já está "${tarefa.status}".`, 409);
  }

  const novoStatus = analisado.data.acao === "concluir" ? "concluida" : "cancelada";
  await supabase.from("tarefas").update({ status: novoStatus, concluida_em: new Date().toISOString() }).eq("id", params.id);

  if (tarefa.calendar_event_id) {
    const credenciais = credenciaisGoogleCalendarDoAmbiente();
    if (credenciais) {
      try {
        await criarAdapterGoogleCalendar(credenciais).removerEvento(tarefa.calendar_event_id);
      } catch {
        // best-effort — o evento fica órfão no Calendar, mas a tarefa já foi marcada; não bloqueia o admin.
      }
    }
    await supabase.from("tarefas").update({ calendar_event_id: null }).eq("id", params.id);
  }

  if (analisado.data.acao === "concluir" && tarefa.entidade_tipo === "checklist_itens" && tarefa.entidade_id) {
    const { data: item } = await supabase.from("checklist_itens").select("recorrencia_dias").eq("id", tarefa.entidade_id).single();
    if (item) {
      const hoje = hojeEmFortaleza();
      await supabase
        .from("checklist_itens")
        .update({ ultima_execucao: hoje, proxima_execucao: somarDias(hoje, item.recorrencia_dias) })
        .eq("id", tarefa.entidade_id);
    }
  }

  return NextResponse.json({ status: novoStatus });
}

function somarDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + dias));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
