// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
// docs/05-arquitetura.md §34: "Bot: Telegram Bot API na Fase 2, atrás de uma
// interface MessagingAdapter, para trocar por WhatsApp Business API na Fase 6
// sem tocar na lógica de domínio." Implementação via WhatsApp Cloud API
// (Graph API do Meta), só `fetch`, sem SDK — mesma filosofia de telegram.ts.
//
// Diferença que simplifica o porteiro (supabase/functions/bot-webhook/porteiro.ts):
// no Telegram, o telefone só chega depois que o usuário aperta "compartilhar
// contato" (pedirContato). No WhatsApp, TODA mensagem já vem com `from` — o
// telefone E.164 de quem mandou — então `receber()` preenche
// `telefoneCompartilhado` sempre, em toda mensagem, e o porteiro liga o
// `chat_id_externo` sozinho já na primeira mensagem, sem passo extra.
import type { MessagingAdapter, MensagemRecebida, MidiaBaixada } from "./tipos.ts";

const GRAPH_API = "https://graph.facebook.com/v20.0";

export function criarAdapterWhatsApp(accessToken: string, phoneNumberId: string): MessagingAdapter {
  const base = `${GRAPH_API}/${phoneNumberId}`;

  return {
    receber(payloadWebhook: unknown): MensagemRecebida | null {
      return interpretarWebhook(payloadWebhook);
    },

    async responder(chatIdExterno: string, texto: string): Promise<void> {
      await chamarWhatsApp(`${base}/messages`, accessToken, {
        messaging_product: "whatsapp",
        to: chatIdExterno,
        type: "text",
        text: { body: texto },
      });
    },

    // O WhatsApp não tem um botão nativo de "compartilhar contato" que
    // preencha telefoneCompartilhado como o Telegram — mas também não
    // precisa: receber() já preenche telefoneCompartilhado em toda
    // mensagem (from = telefone de quem mandou), então o porteiro nunca
    // fica no estado "precisa_contato" para esta plataforma. Este método
    // só existe para satisfazer a interface; envia o mesmo texto de aviso.
    async pedirContato(chatIdExterno: string, texto: string): Promise<void> {
      await chamarWhatsApp(`${base}/messages`, accessToken, {
        messaging_product: "whatsapp",
        to: chatIdExterno,
        type: "text",
        text: { body: texto },
      });
    },

    async baixarMidia(fileId: string): Promise<MidiaBaixada> {
      const infoResposta = await fetch(`${GRAPH_API}/${fileId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!infoResposta.ok) {
        throw new Error(`WhatsApp: consulta de mídia falhou: HTTP ${infoResposta.status}`);
      }
      const info = (await infoResposta.json()) as { url?: string; mime_type?: string };
      if (!info.url) throw new Error("WhatsApp: consulta de mídia não retornou url");

      const arquivoResposta = await fetch(info.url, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!arquivoResposta.ok) {
        throw new Error(`WhatsApp: download de mídia falhou: HTTP ${arquivoResposta.status}`);
      }
      const bytes = new Uint8Array(await arquivoResposta.arrayBuffer());
      const mimeType = info.mime_type ?? arquivoResposta.headers.get("content-type") ?? "application/octet-stream";

      return { bytes, mimeType };
    },
  };
}

async function chamarWhatsApp(url: string, accessToken: string, corpo: Record<string, unknown>): Promise<void> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    throw new Error(`Chamada ao WhatsApp Cloud API falhou: HTTP ${resposta.status}`);
  }
}

// Formato do webhook de mensagem do WhatsApp Cloud API (Meta):
// { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages",
//   value: { messages: [{ from, id, type, text?, audio?, image?, document? }] } }] }] }
function interpretarWebhook(payload: unknown): MensagemRecebida | null {
  if (typeof payload !== "object" || payload === null) return null;
  const corpo = payload as Record<string, unknown>;
  const entry = (corpo.entry as Array<Record<string, unknown>> | undefined)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>> | undefined)?.[0];
  const value = change?.value as Record<string, unknown> | undefined;
  const mensagem = (value?.messages as Array<Record<string, unknown>> | undefined)?.[0];
  if (!mensagem) return null;

  const from = typeof mensagem.from === "string" ? mensagem.from : null;
  if (!from) return null;

  // Todo remetente do WhatsApp já chega com telefone conhecido — diferente
  // do Telegram, o porteiro nunca precisa pedir contato nesta plataforma.
  const base = { chatIdExterno: from, plataforma: "whatsapp" as const, telefoneCompartilhado: from };

  const tipo = mensagem.type as string | undefined;

  if (tipo === "audio" || tipo === "voice") {
    const audio = mensagem.audio as Record<string, unknown> | undefined;
    return {
      ...base,
      tipo: "audio",
      texto: null,
      fileId: typeof audio?.id === "string" ? audio.id : null,
      duracaoSegundos: null,
    };
  }

  if (tipo === "image") {
    const image = mensagem.image as Record<string, unknown> | undefined;
    return {
      ...base,
      tipo: "foto",
      texto: typeof image?.caption === "string" ? image.caption : null,
      fileId: typeof image?.id === "string" ? image.id : null,
      duracaoSegundos: null,
    };
  }

  if (tipo === "document") {
    const document = mensagem.document as Record<string, unknown> | undefined;
    return {
      ...base,
      tipo: "documento",
      texto: typeof document?.caption === "string" ? document.caption : null,
      fileId: typeof document?.id === "string" ? document.id : null,
      duracaoSegundos: null,
    };
  }

  if (tipo === "text") {
    const text = mensagem.text as Record<string, unknown> | undefined;
    return {
      ...base,
      tipo: "texto",
      texto: typeof text?.body === "string" ? text.body : null,
      fileId: null,
      duracaoSegundos: null,
    };
  }

  return null;
}

/**
 * Verificação de assinatura do webhook (Meta exige, header
 * `X-Hub-Signature-256: sha256=<hmac>` calculado sobre o corpo cru da
 * requisição com WHATSAPP_APP_SECRET). Precisa do corpo cru (não do JSON já
 * reanalisado) porque HMAC é sensível a qualquer diferença de serialização.
 */
export async function verificarAssinaturaWhatsApp(
  corpoCru: string,
  assinaturaHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!assinaturaHeader || !assinaturaHeader.startsWith("sha256=")) return false;
  const assinaturaRecebida = assinaturaHeader.slice("sha256=".length);

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinaturaBytes = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpoCru));
  const assinaturaCalculada = Array.from(new Uint8Array(assinaturaBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return assinaturaCalculada === assinaturaRecebida;
}
