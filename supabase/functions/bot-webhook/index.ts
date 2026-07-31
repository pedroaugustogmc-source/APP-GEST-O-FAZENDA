// deno-lint-ignore-file no-explicit-any
// Webhook do bot (docs/05-arquitetura.md §34: "Edge Functions para o webhook
// do bot" — trabalhador não tem sessão Supabase, só service_role). Fluxo
// completo de docs/03-modulos.md §M1: porteiro → transcrição → extração →
// validação semântica → gravação → resposta, com modo degradado (§33) se
// algum passo caro falhar.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

import { criarAdapterTelegram } from "../../../src/infra/messaging/telegram.ts";
import type { MensagemRecebida } from "../../../src/infra/messaging/tipos.ts";
import { criarTranscritorGroq } from "../../../src/infra/asr/groq.ts";
import { extrairEventos, MODELO_PADRAO, type EntradaExtrator } from "../../../src/infra/claude/extrair.ts";
import { calcularCustoMensagemCentavos } from "../../../src/infra/custoBot.ts";
import { hojeEmFortaleza } from "../../../src/domain/tipos/data.ts";

import { buscarContextoExtrator, buscarParametros } from "./contexto.ts";
import { passarPeloPorteiro, excedeuLimiteDeTaxa } from "./porteiro.ts";
import { validarEvento } from "./eventos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const CLAUDE_MODEL_EXTRATOR = Deno.env.get("CLAUDE_MODEL_EXTRATOR") ?? MODELO_PADRAO;

const RESPOSTA_NAO_RECONHECIDO = "Não reconheci esse número."; // Anexo C, texto exato.
const RESPOSTA_MODO_DEGRADADO = "Recebi. Vou anotar assim que der."; // Anexo C, texto exato.
const RESPOSTA_PEDIR_CONTATO = "Pra eu te reconhecer, aperta o botão abaixo e compartilha seu telefone.";
const RESPOSTA_VINCULADO = "Prontinho, te reconheci. Pode mandar por voz o que quiser registrar.";
const RESPOSTA_AUDIO_RUIM = "Não consegui entender direito. Pode mandar de novo?"; // Anexo C, texto exato.
const RESPOSTA_DOCUMENTO_NAO_SUPORTADO = "Por enquanto só leio foto, não esse tipo de arquivo. Pode tirar uma foto?";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const telegram = criarAdapterTelegram(TELEGRAM_BOT_TOKEN);
const transcritor = criarTranscritorGroq(GROQ_API_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const tokenRecebido = req.headers.get("x-telegram-bot-api-secret-token");
  if (!TELEGRAM_WEBHOOK_SECRET || tokenRecebido !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const mensagem = telegram.receber(payload);
  if (!mensagem) return new Response("ok", { status: 200 });

  try {
    await processarMensagem(mensagem);
  } catch (erro) {
    console.error("bot-webhook: falha ao processar mensagem", erro);
  }

  return new Response("ok", { status: 200 });
});

async function processarMensagem(mensagem: MensagemRecebida): Promise<void> {
  const porteiro = await passarPeloPorteiro(supabase, mensagem.chatIdExterno, mensagem.telefoneCompartilhado);

  if (porteiro.situacao === "nao_reconhecido") {
    await telegram.responder(mensagem.chatIdExterno, RESPOSTA_NAO_RECONHECIDO);
    return;
  }
  if (porteiro.situacao === "precisa_contato") {
    await telegram.pedirContato(mensagem.chatIdExterno, RESPOSTA_PEDIR_CONTATO);
    return;
  }
  if (porteiro.situacao === "vinculado") {
    await telegram.responder(mensagem.chatIdExterno, RESPOSTA_VINCULADO);
    return;
  }

  const usuario = porteiro.usuario;
  const parametros = await buscarParametros(supabase);

  const limiteExcedido = await excedeuLimiteDeTaxa(supabase, usuario.id, parametros.RATE_LIMIT_MENSAGENS_MINUTO ?? 20);
  if (limiteExcedido) {
    await telegram.responder(mensagem.chatIdExterno, "Muita coisa de uma vez — espera um minuto e manda de novo.");
    return;
  }

  if (mensagem.tipo === "documento") {
    await telegram.responder(mensagem.chatIdExterno, RESPOSTA_DOCUMENTO_NAO_SUPORTADO);
    return;
  }

  const hoje = hojeEmFortaleza();
  const clientUuid = `telegram:${mensagem.chatIdExterno}:${mensagem.fileId ?? mensagem.texto ?? hoje}:${Date.now()}`;

  const { data: linhaMensagem, error: erroInsercao } = await supabase
    .from("mensagens_bot")
    .insert({
      client_uuid: clientUuid,
      usuario_id: usuario.id,
      telefone_origem: usuario.telefone,
      plataforma: mensagem.plataforma,
      tipo: mensagem.tipo,
      duracao_segundos: mensagem.duracaoSegundos,
      status: "recebida",
    })
    .select("id")
    .single();
  if (erroInsercao) throw new Error(`Falha ao gravar mensagem recebida: ${erroInsercao.message}`);

  const mensagemId = linhaMensagem.id as string;

  let entrada: EntradaExtrator;
  let duracaoSegundosReal: number | null = mensagem.duracaoSegundos;

  try {
    if (mensagem.tipo === "texto") {
      entrada = { tipo: "texto", texto: mensagem.texto ?? "" };
      await supabase.from("mensagens_bot").update({ status: "transcrita", transcricao: mensagem.texto }).eq("id", mensagemId);
    } else if (mensagem.tipo === "audio") {
      const midia = await telegram.baixarMidia(mensagem.fileId!);
      const transcricao = await transcritor.transcrever({ bytes: midia.bytes, mimeType: midia.mimeType });
      if (!transcricao.texto) {
        await supabase.from("mensagens_bot").update({ status: "erro", erro: "transcrição vazia" }).eq("id", mensagemId);
        await telegram.responder(mensagem.chatIdExterno, RESPOSTA_AUDIO_RUIM);
        return;
      }
      duracaoSegundosReal = transcricao.duracaoSegundos ?? mensagem.duracaoSegundos;
      entrada = { tipo: "texto", texto: transcricao.texto };
      await supabase
        .from("mensagens_bot")
        .update({ status: "transcrita", transcricao: transcricao.texto, duracao_segundos: duracaoSegundosReal })
        .eq("id", mensagemId);
    } else {
      const midia = await telegram.baixarMidia(mensagem.fileId!);
      entrada = {
        tipo: "imagem",
        base64: base64DeBytes(midia.bytes),
        mimeType: midia.mimeType,
        legenda: mensagem.texto,
      };
      // Foto não tem "transcrição" no sentido literal — "transcrita" aqui
      // marca que a entrada já está pronta para a extração (Claude lê a
      // imagem direto, sem passo de ASR).
      await supabase.from("mensagens_bot").update({ status: "transcrita" }).eq("id", mensagemId);
    }
  } catch (erro) {
    await marcarModoDegradado(mensagemId, erro);
    await telegram.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
    return;
  }

  const contexto = await buscarContextoExtrator(supabase, { nome: usuario.nome, papel: usuario.papel });

  let resultadoExtracao;
  try {
    resultadoExtracao = await extrairEventos(
      ANTHROPIC_API_KEY,
      entrada,
      contexto,
      hoje,
      parametros.KG_POR_ARROBA ?? 15,
      CLAUDE_MODEL_EXTRATOR
    );
  } catch (erro) {
    await marcarModoDegradado(mensagemId, erro);
    await telegram.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
    return;
  }

  const custoCentavos = calcularCustoMensagemCentavos(duracaoSegundosReal, resultadoExtracao.tokensEntrada, resultadoExtracao.tokensSaida, {
    precoAsrCentavosMinuto: parametros.PRECO_ASR_CENTAVOS_MINUTO ?? 0,
    precoClaudeInputCentavosMTok: parametros.PRECO_CLAUDE_INPUT_CENTAVOS_MTOK ?? 0,
    precoClaudeOutputCentavosMTok: parametros.PRECO_CLAUDE_OUTPUT_CENTAVOS_MTOK ?? 0,
  });

  const eventos = resultadoExtracao.eventos;
  const confiancaMedia = eventos.length > 0 ? eventos.reduce((soma, e) => soma + e.confianca, 0) / eventos.length : 0;

  await supabase
    .from("mensagens_bot")
    .update({
      status: "extraida",
      payload_extraido: resultadoExtracao as any,
      confianca_media: confiancaMedia,
      custo_api_centavos: custoCentavos.toString(),
    })
    .eq("id", mensagemId);

  // docs/03-modulos.md §M1 passo 6: confiança baixa → revisão do admin, nunca inventa dado.
  const confiancaMinima = parametros.CONFIANCA_MINIMA_BOT ?? 0.75;
  if (confiancaMedia < confiancaMinima) {
    await supabase.from("mensagens_bot").update({ status: "revisao" }).eq("id", mensagemId);
    await telegram.responder(mensagem.chatIdExterno, "Anotei o que entendi, mas não tenho certeza — o patrão vai conferir.");
    return;
  }

  const paraGravar: Record<string, unknown>[] = [];
  const perguntas: string[] = [];

  for (const evento of eventos) {
    if (evento.pergunta_de_esclarecimento) {
      perguntas.push(evento.pergunta_de_esclarecimento);
      continue;
    }
    const resultado = await validarEvento(supabase, evento, parametros, hoje);
    if (resultado.acao === "recusar") {
      perguntas.push(resultado.pergunta);
      if (resultado.alertarAdmin) {
        await supabase.from("alertas").insert({
          tipo: "mensagem_bot_recusada",
          severidade: "atencao",
          entidade_tipo: "mensagens_bot",
          entidade_id: mensagemId,
          titulo: "Bot recusou um registro",
          mensagem: resultado.pergunta,
        });
      }
    } else {
      paraGravar.push(resultado.canonico);
    }
  }

  if (paraGravar.length > 0) {
    const { error: erroRpc } = await supabase.rpc("gravar_eventos_mensagem_bot", {
      p_mensagem_id: mensagemId,
      p_eventos: paraGravar,
      p_registrado_por: usuario.id,
    });
    if (erroRpc) {
      await supabase.from("mensagens_bot").update({ status: "erro", erro: erroRpc.message }).eq("id", mensagemId);
      await telegram.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
      return;
    }
  } else {
    await supabase.from("mensagens_bot").update({ status: "revisao" }).eq("id", mensagemId);
  }

  const partes: string[] = [];
  if (paraGravar.length > 0) partes.push(`Anotado: ${resultadoExtracao.resumoParaConfirmacao}`);
  if (perguntas.length > 0) partes.push(perguntas[0]!); // Anexo C: nunca duas perguntas juntas.

  // Nenhum evento extraído (áudio ruim/inaudível) — few-shot de docs/04-bot.md
  // §31: "0 eventos, status='revisao', resposta pedindo para repetir".
  const texto = partes.length > 0 ? partes.join(" ") : RESPOSTA_AUDIO_RUIM;

  await telegram.responder(mensagem.chatIdExterno, texto);
}

async function marcarModoDegradado(mensagemId: string, erro: unknown): Promise<void> {
  const mensagemErro = erro instanceof Error ? erro.message : String(erro);
  const { data: atual } = await supabase.from("mensagens_bot").select("tentativas").eq("id", mensagemId).maybeSingle();
  await supabase
    .from("mensagens_bot")
    .update({ erro: mensagemErro, tentativas: (atual?.tentativas ?? 0) + 1 })
    .eq("id", mensagemId);
}

function base64DeBytes(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}
