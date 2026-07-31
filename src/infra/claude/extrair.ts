import { RespostaExtratorSchema, type ResultadoExtracao, type ContextoExtrator } from "./tipos.ts";
import { montarPromptSistema } from "./prompts/extrator.ts";
// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
import type { ISODate } from "../../domain/tipos/index.ts";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS_SAIDA = 4096;

/**
 * Modelo padrão desta fase: claude-opus-5. Não é hardcode de negócio (Regra 3
 * do CLAUDE.md fala de limiar/fator/taxa da fazenda) — é a versão de um
 * fornecedor externo; ainda assim fica configurável via env
 * (CLAUDE_MODEL_EXTRATOR), resolvida pelo chamador, não por este módulo.
 */
export const MODELO_PADRAO = "claude-opus-5";

/**
 * Entrada do extrator: texto (transcrição de áudio, ou a própria mensagem de
 * texto) OU imagem (nota fiscal, bula de vacina, horímetro — docs/03-modulos.md
 * §M1 "aceita foto... com extração dos dados"). A Messages API não aceita
 * áudio bruto (confirmado em platform.claude.com/docs antes de desenhar esta
 * fase) — por isso áudio sempre chega aqui já transcrito por src/infra/asr/;
 * imagem, ao contrário, a própria API entende nativamente.
 */
export type EntradaExtrator =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; base64: string; mimeType: string; legenda: string | null };

/**
 * Chama a Claude Messages API por `fetch` puro (sem SDK — roda igual em
 * Node/Next e na Edge Function Deno).
 */
export async function extrairEventos(
  apiKey: string,
  entrada: EntradaExtrator,
  contexto: ContextoExtrator,
  dataRecebimento: ISODate,
  kgPorArroba: number,
  modelo: string = MODELO_PADRAO
): Promise<ResultadoExtracao> {
  const promptSistema = montarPromptSistema(contexto, dataRecebimento, kgPorArroba);

  const resposta = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: MAX_TOKENS_SAIDA,
      system: promptSistema,
      messages: [{ role: "user", content: montarConteudoUsuario(entrada) }],
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Extração Claude falhou: HTTP ${resposta.status} ${corpo}`);
  }

  const dados = (await resposta.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const blocoTexto = dados.content?.find((bloco) => bloco.type === "text")?.text ?? "";
  const json = extrairJson(blocoTexto);

  const analisado = RespostaExtratorSchema.safeParse(json);
  if (!analisado.success) {
    throw new Error(`Saída do extrator não bateu com o schema esperado: ${analisado.error.message}`);
  }

  return {
    eventos: analisado.data.eventos,
    resumoParaConfirmacao: analisado.data.resumo_para_confirmacao,
    tokensEntrada: dados.usage?.input_tokens ?? 0,
    tokensSaida: dados.usage?.output_tokens ?? 0,
  };
}

function montarConteudoUsuario(entrada: EntradaExtrator) {
  if (entrada.tipo === "texto") return entrada.texto;

  const blocos: Array<Record<string, unknown>> = [
    {
      type: "image",
      source: { type: "base64", media_type: entrada.mimeType, data: entrada.base64 },
    },
  ];
  blocos.push({
    type: "text",
    text: entrada.legenda ? `Legenda enviada junto com a foto: ${entrada.legenda}` : "Extraia os dados desta foto.",
  });
  return blocos;
}

/**
 * O prompt manda devolver "APENAS JSON... sem markdown" — mesmo assim, este
 * parser tolera uma cerca de código ```json ... ``` por segurança, em vez de
 * quebrar direto se o modelo desviar da instrução uma vez.
 */
function extrairJson(texto: string): unknown {
  const semCercas = texto
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(semCercas);
  } catch {
    throw new Error("Saída do extrator não é JSON válido.");
  }
}
