import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Teste de integração do webhook do bot (docs/03-modulos.md §M1). Precisa de
// uma Edge Function servida localmente (`supabase functions serve
// bot-webhook`) + Supabase local rodando, além de TELEGRAM_WEBHOOK_SECRET
// configurado igual nos dois lados. Sem isso, SKIPPED — mesmo padrão do
// tests/integration/rls.spec.ts, a lacuna fica visível, não escondida.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const FUNCOES_URL = process.env.SUPABASE_FUNCTIONS_URL; // ex: http://127.0.0.1:54321/functions/v1

const rodar = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && WEBHOOK_SECRET && FUNCOES_URL);
const rodarComExtrator = rodar && Boolean(process.env.ANTHROPIC_API_KEY && process.env.GROQ_API_KEY);

function updateTelegramTexto(chatId: string, messageId: number, texto: string) {
  return {
    update_id: messageId,
    message: { message_id: messageId, chat: { id: chatId }, text: texto },
  };
}

async function chamarWebhook(payload: unknown) {
  return fetch(`${FUNCOES_URL}/bot-webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": WEBHOOK_SECRET! },
    body: JSON.stringify(payload),
  });
}

describe.skipIf(!rodar)("bot-webhook — porteiro e validação semântica de ponta a ponta", () => {
  let admin: SupabaseClient;
  const chatIdDesconhecido = "999999999";

  beforeAll(() => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  });

  it("número desconhecido: responde 200, não grava nada, não chama API paga", async () => {
    const antes = await admin.from("mensagens_bot").select("id", { count: "exact", head: true });

    const resposta = await chamarWebhook(updateTelegramTexto(chatIdDesconhecido, 1, "choveu bem ontem"));
    expect(resposta.status).toBe(200);

    const depois = await admin.from("mensagens_bot").select("id", { count: "exact", head: true });
    expect(depois.count).toBe(antes.count);
  });

  it("secret token errado: rejeita com 401", async () => {
    const resposta = await fetch(`${FUNCOES_URL}/bot-webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "errado" },
      body: JSON.stringify(updateTelegramTexto(chatIdDesconhecido, 2, "oi")),
    });
    expect(resposta.status).toBe(401);
  });

  describe.skipIf(!rodarComExtrator)("com trabalhador ativo vinculado", () => {
    const chatIdTeste = `teste-bot-webhook-${Date.now()}`;
    let usuarioId: string;

    beforeAll(async () => {
      const { data } = await admin
        .from("usuarios_acesso")
        .insert({
          telefone: `+5599${Date.now()}`.slice(0, 16),
          plataforma: "telegram",
          chat_id_externo: chatIdTeste,
          nome: "Trabalhador de Teste",
          papel: "trabalhador",
          status: "ativo",
          data_admissao: "2026-01-01",
        })
        .select("id")
        .single();
      usuarioId = data!.id;
    });

    afterAll(async () => {
      if (usuarioId) await admin.from("usuarios_acesso").delete().eq("id", usuarioId);
    });

    it("mensagem de texto reconhecida grava um registro de chuva", async () => {
      const resposta = await chamarWebhook(updateTelegramTexto(chatIdTeste, 10, "choveu bem ontem, uns quarenta milímetro"));
      expect(resposta.status).toBe(200);

      const { data: mensagens } = await admin
        .from("mensagens_bot")
        .select("status")
        .eq("usuario_id", usuarioId)
        .order("recebido_em", { ascending: false })
        .limit(1);

      expect(mensagens?.[0]?.status).toBe("gravada");
    });

    it("vacina de aftosa é bloqueada e não grava nada em vacinas_aplicadas", async () => {
      const antes = await admin.from("vacinas_aplicadas").select("id", { count: "exact", head: true });

      await chamarWebhook(updateTelegramTexto(chatIdTeste, 11, "vou vacinar de aftosa semana que vem"));

      const depois = await admin.from("vacinas_aplicadas").select("id", { count: "exact", head: true });
      expect(depois.count).toBe(antes.count);
    });
  });
});
