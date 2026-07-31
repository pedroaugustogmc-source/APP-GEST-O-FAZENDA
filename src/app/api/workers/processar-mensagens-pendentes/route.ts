import { NextResponse } from "next/server";
import { criarClienteServico } from "@/infra/supabase/server";

// docs/04-bot.md §33: "Fila com retry exponencial (3 tentativas), depois fila
// morta + alerta." Chamado por cron (vercel.json) a cada poucos minutos.
//
// Escopo desta fase: este worker cobre a metade "fila morta + alerta" —
// mensagens presas em recebida/transcrita por tempo demais (a Edge Function
// já tentou e caiu em modo degradado, §33) viram status='erro' e geram um
// alerta para o admin. Ele NÃO reprocessa a transcrição/extração automaticamente
// — isso exigiria persistir o áudio original (file_id/bytes), que esta fase
// não faz (decisão registrada em ESTADO.md). Reprocessar de fato hoje é o
// vaqueiro mandar a mensagem de novo.
const MINUTOS_PARA_CONSIDERAR_TRAVADA = 15;

// GET, não POST: Vercel Cron só sabe chamar por GET, e injeta
// "Authorization: Bearer $CRON_SECRET" sozinho quando a env var CRON_SECRET
// está configurada no projeto — convenção da própria Vercel, não inventada aqui.
export async function GET(request: Request) {
  const segredoConfigurado = process.env.CRON_SECRET;
  const segredoRecebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = criarClienteServico();

  const { data: parametroTentativas } = await supabase
    .from("parametros_fazenda")
    .select("valor")
    .eq("chave", "BOT_MAX_TENTATIVAS")
    .maybeSingle();
  const maxTentativas = parametroTentativas ? Number(parametroTentativas.valor) : 3;

  const limiteTempo = new Date(Date.now() - MINUTOS_PARA_CONSIDERAR_TRAVADA * 60_000).toISOString();

  const { data: travadas, error } = await supabase
    .from("mensagens_bot")
    .select("id, tentativas, erro, telefone_origem")
    .in("status", ["recebida", "transcrita"])
    .lt("recebido_em", limiteTempo);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  let marcadas = 0;

  for (const mensagem of travadas ?? []) {
    await supabase
      .from("mensagens_bot")
      .update({
        status: "erro",
        erro: mensagem.erro ?? `Tempo esgotado sem concluir processamento (>${MINUTOS_PARA_CONSIDERAR_TRAVADA} min).`,
      })
      .eq("id", mensagem.id);

    await supabase.from("alertas").insert({
      tipo: "mensagem_bot_travada",
      severidade: "atencao",
      entidade_tipo: "mensagens_bot",
      entidade_id: mensagem.id,
      titulo: "Mensagem do bot não foi processada",
      mensagem: `Mensagem de ${mensagem.telefone_origem} (${mensagem.tentativas} tentativa(s)) ficou presa e virou erro. Peça pro trabalhador mandar de novo.`,
      acao_sugerida: "Confirme com o trabalhador se ele pode reenviar a mensagem.",
    });

    marcadas += 1;
  }

  return NextResponse.json({ verificadas: travadas?.length ?? 0, marcadas_como_erro: marcadas, max_tentativas: maxTentativas });
}
