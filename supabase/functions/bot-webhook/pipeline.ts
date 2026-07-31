// deno-lint-ignore-file no-explicit-any
// Pipeline compartilhado do webhook do bot (docs/03-modulos.md §M1: porteiro
// → transcrição → extração → validação semântica → gravação → resposta, com
// modo degradado se algum passo caro falhar). Extraído de index.ts na F6
// para ser reaproveitado por bot-webhook (Telegram) E bot-webhook-whatsapp
// (WhatsApp) — mesma lógica de domínio, só o adapter de mensageria muda
// (docs/05-arquitetura.md §34).
import type { MessagingAdapter, MensagemRecebida, Plataforma } from "../../../src/infra/messaging/tipos.ts";
import type { Transcritor } from "../../../src/infra/asr/tipos.ts";
import { extrairEventos, type EntradaExtrator } from "../../../src/infra/claude/extrair.ts";
import { calcularCustoMensagemCentavos } from "../../../src/infra/custoBot.ts";
import { hojeEmFortaleza } from "../../../src/domain/tipos/data.ts";

import { buscarContextoExtrator, buscarParametros } from "./contexto.ts";
import { passarPeloPorteiro, excedeuLimiteDeTaxa } from "./porteiro.ts";
import { validarEvento } from "./eventos.ts";

const RESPOSTA_NAO_RECONHECIDO = "Não reconheci esse número."; // Anexo C, texto exato.
const RESPOSTA_MODO_DEGRADADO = "Recebi. Vou anotar assim que der."; // Anexo C, texto exato.
const RESPOSTA_PEDIR_CONTATO = "Pra eu te reconhecer, aperta o botão abaixo e compartilha seu telefone.";
const RESPOSTA_VINCULADO = "Prontinho, te reconheci. Pode mandar por voz o que quiser registrar.";
const RESPOSTA_AUDIO_RUIM = "Não consegui entender direito. Pode mandar de novo?"; // Anexo C, texto exato.
const RESPOSTA_DOCUMENTO_NAO_SUPORTADO = "Por enquanto só leio foto, não esse tipo de arquivo. Pode tirar uma foto?";

export interface ContextoPipeline {
  supabase: any;
  adapter: MessagingAdapter;
  transcritor: Transcritor;
  anthropicApiKey: string;
  claudeModel: string;
  plataforma: Plataforma;
}

export async function processarMensagem(ctx: ContextoPipeline, mensagem: MensagemRecebida): Promise<void> {
  const { supabase, adapter } = ctx;

  const porteiro = await passarPeloPorteiro(supabase, mensagem.chatIdExterno, mensagem.telefoneCompartilhado, ctx.plataforma);

  if (porteiro.situacao === "nao_reconhecido") {
    await adapter.responder(mensagem.chatIdExterno, RESPOSTA_NAO_RECONHECIDO);
    return;
  }
  if (porteiro.situacao === "precisa_contato") {
    await adapter.pedirContato(mensagem.chatIdExterno, RESPOSTA_PEDIR_CONTATO);
    return;
  }
  if (porteiro.situacao === "vinculado") {
    await adapter.responder(mensagem.chatIdExterno, RESPOSTA_VINCULADO);
    return;
  }

  const usuario = porteiro.usuario;
  const parametros = await buscarParametros(supabase);

  const limiteExcedido = await excedeuLimiteDeTaxa(supabase, usuario.id, parametros.RATE_LIMIT_MENSAGENS_MINUTO ?? 20);
  if (limiteExcedido) {
    await adapter.responder(mensagem.chatIdExterno, "Muita coisa de uma vez — espera um minuto e manda de novo.");
    return;
  }

  if (mensagem.tipo === "documento") {
    await adapter.responder(mensagem.chatIdExterno, RESPOSTA_DOCUMENTO_NAO_SUPORTADO);
    return;
  }

  const hoje = hojeEmFortaleza();
  const clientUuid = `${ctx.plataforma}:${mensagem.chatIdExterno}:${mensagem.fileId ?? mensagem.texto ?? hoje}:${Date.now()}`;

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
      const midia = await adapter.baixarMidia(mensagem.fileId!);
      const transcricao = await ctx.transcritor.transcrever({ bytes: midia.bytes, mimeType: midia.mimeType });
      if (!transcricao.texto) {
        await supabase.from("mensagens_bot").update({ status: "erro", erro: "transcrição vazia" }).eq("id", mensagemId);
        await adapter.responder(mensagem.chatIdExterno, RESPOSTA_AUDIO_RUIM);
        return;
      }
      duracaoSegundosReal = transcricao.duracaoSegundos ?? mensagem.duracaoSegundos;
      entrada = { tipo: "texto", texto: transcricao.texto };
      await supabase
        .from("mensagens_bot")
        .update({ status: "transcrita", transcricao: transcricao.texto, duracao_segundos: duracaoSegundosReal })
        .eq("id", mensagemId);
    } else {
      const midia = await adapter.baixarMidia(mensagem.fileId!);
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
    await marcarModoDegradado(supabase, mensagemId, erro);
    await adapter.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
    return;
  }

  const contexto = await buscarContextoExtrator(supabase, { nome: usuario.nome, papel: usuario.papel });

  let resultadoExtracao;
  try {
    resultadoExtracao = await extrairEventos(
      ctx.anthropicApiKey,
      entrada,
      contexto,
      hoje,
      parametros.KG_POR_ARROBA ?? 15,
      ctx.claudeModel
    );
  } catch (erro) {
    await marcarModoDegradado(supabase, mensagemId, erro);
    await adapter.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
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
    await adapter.responder(mensagem.chatIdExterno, "Anotei o que entendi, mas não tenho certeza — o patrão vai conferir.");
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
      await adapter.responder(mensagem.chatIdExterno, RESPOSTA_MODO_DEGRADADO);
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

  await adapter.responder(mensagem.chatIdExterno, texto);
}

async function marcarModoDegradado(supabase: any, mensagemId: string, erro: unknown): Promise<void> {
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
