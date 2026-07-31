// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
import type { MessagingAdapter, MensagemRecebida, MidiaBaixada } from "./tipos.ts";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Implementação Telegram do MessagingAdapter — só `fetch`, sem SDK, para
 * rodar sem atrito tanto no Next.js (worker de retry) quanto na Edge Function
 * Deno (webhook). `botToken` vem de fora (env do chamador) — este módulo não
 * lê `process.env`/`Deno.env` diretamente, para continuar portátil entre os
 * dois runtimes.
 */
export function criarAdapterTelegram(botToken: string): MessagingAdapter {
  const base = `${TELEGRAM_API}/bot${botToken}`;

  return {
    receber(payloadWebhook: unknown): MensagemRecebida | null {
      return interpretarUpdate(payloadWebhook);
    },

    async responder(chatIdExterno: string, texto: string): Promise<void> {
      await chamarTelegram(`${base}/sendMessage`, {
        chat_id: chatIdExterno,
        text: texto,
        reply_markup: { remove_keyboard: true },
      });
    },

    async pedirContato(chatIdExterno: string, texto: string): Promise<void> {
      await chamarTelegram(`${base}/sendMessage`, {
        chat_id: chatIdExterno,
        text: texto,
        reply_markup: {
          keyboard: [[{ text: "Compartilhar meu telefone", request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
    },

    async baixarMidia(fileId: string): Promise<MidiaBaixada> {
      const infoResposta = await fetch(`${base}/getFile?file_id=${encodeURIComponent(fileId)}`);
      if (!infoResposta.ok) {
        throw new Error(`Telegram getFile falhou: HTTP ${infoResposta.status}`);
      }
      const info = (await infoResposta.json()) as { result?: { file_path?: string } };
      const filePath = info.result?.file_path;
      if (!filePath) throw new Error("Telegram getFile não retornou file_path");

      const arquivoResposta = await fetch(`${TELEGRAM_API}/file/bot${botToken}/${filePath}`);
      if (!arquivoResposta.ok) {
        throw new Error(`Download de mídia do Telegram falhou: HTTP ${arquivoResposta.status}`);
      }
      const bytes = new Uint8Array(await arquivoResposta.arrayBuffer());
      const mimeType = arquivoResposta.headers.get("content-type") ?? "application/octet-stream";

      return { bytes, mimeType };
    },
  };
}

async function chamarTelegram(url: string, corpo: Record<string, unknown>): Promise<void> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resposta.ok) {
    throw new Error(`Chamada ao Telegram falhou: HTTP ${resposta.status}`);
  }
}

function interpretarUpdate(payload: unknown): MensagemRecebida | null {
  if (typeof payload !== "object" || payload === null) return null;
  const update = payload as Record<string, unknown>;
  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return null;

  const chat = message.chat as Record<string, unknown> | undefined;
  const chatIdExterno = chat?.id != null ? String(chat.id) : null;
  if (!chatIdExterno) return null;

  const contact = message.contact as Record<string, unknown> | undefined;
  const telefoneCompartilhado = typeof contact?.phone_number === "string" ? contact.phone_number : null;
  if (telefoneCompartilhado) {
    return {
      chatIdExterno,
      plataforma: "telegram",
      tipo: "texto",
      texto: null,
      fileId: null,
      duracaoSegundos: null,
      telefoneCompartilhado,
    };
  }

  const base = { chatIdExterno, plataforma: "telegram" as const, telefoneCompartilhado: null };

  const voice = message.voice as Record<string, unknown> | undefined;
  const audio = message.audio as Record<string, unknown> | undefined;
  if (voice || audio) {
    const midia = (voice ?? audio) as Record<string, unknown>;
    return {
      ...base,
      tipo: "audio",
      texto: null,
      fileId: typeof midia.file_id === "string" ? midia.file_id : null,
      duracaoSegundos: typeof midia.duration === "number" ? midia.duration : null,
    };
  }

  const photoArray = message.photo as Array<Record<string, unknown>> | undefined;
  const maiorResolucao = photoArray && photoArray.length > 0 ? photoArray[photoArray.length - 1] : undefined;
  if (maiorResolucao) {
    return {
      ...base,
      tipo: "foto",
      texto: typeof message.caption === "string" ? message.caption : null,
      fileId: typeof maiorResolucao.file_id === "string" ? maiorResolucao.file_id : null,
      duracaoSegundos: null,
    };
  }

  const document = message.document as Record<string, unknown> | undefined;
  if (document) {
    return {
      ...base,
      tipo: "documento",
      texto: typeof message.caption === "string" ? message.caption : null,
      fileId: typeof document.file_id === "string" ? document.file_id : null,
      duracaoSegundos: null,
    };
  }

  if (typeof message.text === "string") {
    return {
      ...base,
      tipo: "texto",
      texto: message.text,
      fileId: null,
      duracaoSegundos: null,
    };
  }

  return null;
}
