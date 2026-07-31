import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor } from "@/infra/supabase/server";
import { transicaoValidaMensagem } from "@/domain/estados/mensagem";

// Fila de revisão (docs/03-modulos.md §M1 passo 6 e docs/07-entrega.md §43
// "fila de revisão"). O admin confirma (grava exatamente o que está em
// payload_extraido, editável antes de confirmar) ou descarta. É o único
// outro caminho, além da Edge Function, que chama gravar_eventos_mensagem_bot
// — mesma função SQL, mesma garantia de transação única (plano da F2).

const EsquemaConfirmar = z.object({
  acao: z.literal("confirmar"),
  eventos: z.array(z.record(z.unknown())),
});
const EsquemaDescartar = z.object({ acao: z.literal("descartar") });
const EsquemaCorpo = z.union([EsquemaConfirmar, EsquemaDescartar]);

function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return respostaErro("Sessão inválida.", 401);

  const { data: admin } = await supabase
    .from("usuarios_acesso")
    .select("id")
    .eq("auth_user_id", sessao.user.id)
    .single();
  if (!admin) return respostaErro("Usuário sem cadastro em usuarios_acesso.", 401);

  const corpo = await request.json().catch(() => null);
  const analisado = EsquemaCorpo.safeParse(corpo);
  if (!analisado.success) return respostaErro(analisado.error.issues[0]?.message ?? "Corpo inválido", 400);

  const { data: mensagem, error: erroMensagem } = await supabase
    .from("mensagens_bot")
    .select("id, status")
    .eq("id", params.id)
    .single();
  if (erroMensagem || !mensagem) return respostaErro("Mensagem não encontrada.", 404);

  if (analisado.data.acao === "descartar") {
    if (!transicaoValidaMensagem(mensagem.status, "descartada")) {
      return respostaErro(`Não é possível descartar uma mensagem em status "${mensagem.status}".`, 409);
    }
    const { error } = await supabase
      .from("mensagens_bot")
      .update({ status: "descartada", revisado_por: admin.id, revisado_em: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return respostaErro(error.message, 400);
    return NextResponse.json({ status: "descartada" });
  }

  // src/domain/estados/mensagem.ts: só extraida e revisao podem virar gravada.
  if (!transicaoValidaMensagem(mensagem.status, "gravada")) {
    return respostaErro(`Não é possível confirmar uma mensagem em status "${mensagem.status}".`, 409);
  }

  const eventosParaGravar = analisado.data.eventos.filter(
    (evento) => evento.tipo && evento.tipo !== "bloqueio" && !evento.pergunta_de_esclarecimento
  );

  if (eventosParaGravar.length === 0) {
    return respostaErro("Nenhum evento válido para gravar (todos com pergunta pendente ou vazios).", 400);
  }

  const { data: gerados, error: erroRpc } = await supabase.rpc("gravar_eventos_mensagem_bot", {
    p_mensagem_id: params.id,
    p_eventos: eventosParaGravar,
    p_registrado_por: admin.id,
  });
  if (erroRpc) return respostaErro(erroRpc.message, 400);

  await supabase
    .from("mensagens_bot")
    .update({ revisado_por: admin.id, revisado_em: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ status: "gravada", eventos_gerados: gerados });
}
