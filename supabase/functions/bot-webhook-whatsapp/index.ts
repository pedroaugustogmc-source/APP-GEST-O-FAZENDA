// Webhook do bot — WhatsApp Cloud API (F6, docs/05-arquitetura.md §34: "atrás
// de uma interface MessagingAdapter... para trocar por WhatsApp Business API
// na Fase 6 sem tocar na lógica de domínio"). Mesma lógica de domínio de
// bot-webhook/index.ts (Telegram) — reaproveitada via pipeline.ts — só o
// contrato de webhook muda: a Meta exige (1) um handshake GET de verificação
// na primeira configuração e (2) assinatura HMAC no corpo de cada POST.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

import { criarAdapterWhatsApp, verificarAssinaturaWhatsApp } from "../../../src/infra/messaging/whatsapp.ts";
import { criarTranscritorGroq } from "../../../src/infra/asr/groq.ts";
import { MODELO_PADRAO } from "../../../src/infra/claude/extrair.ts";

import { processarMensagem, type ContextoPipeline } from "../bot-webhook/pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const WHATSAPP_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const CLAUDE_MODEL_EXTRATOR = Deno.env.get("CLAUDE_MODEL_EXTRATOR") ?? MODELO_PADRAO;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const whatsapp = criarAdapterWhatsApp(WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID);
const transcritor = criarTranscritorGroq(GROQ_API_KEY);

const ctx: ContextoPipeline = {
  supabase,
  adapter: whatsapp,
  transcritor,
  anthropicApiKey: ANTHROPIC_API_KEY,
  claudeModel: CLAUDE_MODEL_EXTRATOR,
  plataforma: "whatsapp",
};

Deno.serve(async (req: Request) => {
  // Handshake de verificação do webhook — a Meta chama isto uma vez, na
  // configuração do endpoint no App Dashboard, antes de mandar qualquer
  // mensagem real.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const corpoCru = await req.text();
  const assinaturaValida = await verificarAssinaturaWhatsApp(
    corpoCru,
    req.headers.get("x-hub-signature-256"),
    WHATSAPP_APP_SECRET
  );
  if (!assinaturaValida) return new Response("unauthorized", { status: 401 });

  const payload = JSON.parse(corpoCru || "null");
  const mensagem = whatsapp.receber(payload);
  if (!mensagem) return new Response("ok", { status: 200 });

  try {
    await processarMensagem(ctx, mensagem);
  } catch (erro) {
    console.error("bot-webhook-whatsapp: falha ao processar mensagem", erro);
  }

  return new Response("ok", { status: 200 });
});
