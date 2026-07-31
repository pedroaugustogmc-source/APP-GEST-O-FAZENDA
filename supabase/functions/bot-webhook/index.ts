// Webhook do bot — Telegram (docs/05-arquitetura.md §34: "Edge Functions
// para o webhook do bot" — trabalhador não tem sessão Supabase, só
// service_role). A partir da F6, a lógica de domínio (porteiro → transcrição
// → extração → validação → gravação → resposta) mora em pipeline.ts,
// compartilhada com bot-webhook-whatsapp — este arquivo só cuida do que é
// específico do Telegram: verificação do secret do webhook e parsing do
// payload do update.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

import { criarAdapterTelegram } from "../../../src/infra/messaging/telegram.ts";
import { criarTranscritorGroq } from "../../../src/infra/asr/groq.ts";
import { MODELO_PADRAO } from "../../../src/infra/claude/extrair.ts";

import { processarMensagem, type ContextoPipeline } from "./pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const CLAUDE_MODEL_EXTRATOR = Deno.env.get("CLAUDE_MODEL_EXTRATOR") ?? MODELO_PADRAO;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const telegram = criarAdapterTelegram(TELEGRAM_BOT_TOKEN);
const transcritor = criarTranscritorGroq(GROQ_API_KEY);

const ctx: ContextoPipeline = {
  supabase,
  adapter: telegram,
  transcritor,
  anthropicApiKey: ANTHROPIC_API_KEY,
  claudeModel: CLAUDE_MODEL_EXTRATOR,
  plataforma: "telegram",
};

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
    await processarMensagem(ctx, mensagem);
  } catch (erro) {
    console.error("bot-webhook: falha ao processar mensagem", erro);
  }

  return new Response("ok", { status: 200 });
});
