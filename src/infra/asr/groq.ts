// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
import type { AudioParaTranscrever, ResultadoTranscricao, Transcritor } from "./tipos.ts";

const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO_PADRAO = "whisper-large-v3-turbo";

/**
 * Provedor de ASR escolhido nesta fase: Groq (whisper-large-v3-turbo) — muito
 * rápido, custo próximo de zero, boa qualidade em pt-BR. Suposição declarada
 * em ESTADO.md (o dono não respondeu qual provedor preferia); trocar de
 * provedor depois é escrever um novo arquivo que implemente `Transcritor`,
 * não mexer no pipeline.
 */
export function criarTranscritorGroq(apiKey: string, modelo: string = MODELO_PADRAO): Transcritor {
  return {
    async transcrever(audio: AudioParaTranscrever): Promise<ResultadoTranscricao> {
      const formData = new FormData();
      // Cast pontual: o lib.dom.d.ts do TS exige ArrayBufferView<ArrayBuffer>
      // em BlobPart, mais estrito que o runtime real (Uint8Array é aceito
      // por qualquer Blob de verdade, em Node e em Deno).
      formData.append("file", new Blob([audio.bytes as BlobPart], { type: audio.mimeType }), "audio");
      formData.append("model", modelo);
      formData.append("language", "pt");
      formData.append("response_format", "verbose_json");

      const resposta = await fetch(GROQ_TRANSCRIPTIONS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!resposta.ok) {
        const corpo = await resposta.text().catch(() => "");
        throw new Error(`Transcrição Groq falhou: HTTP ${resposta.status} ${corpo}`);
      }

      const dados = (await resposta.json()) as { text?: string; duration?: number };
      return {
        texto: (dados.text ?? "").trim(),
        duracaoSegundos: typeof dados.duration === "number" ? dados.duration : null,
      };
    },
  };
}
