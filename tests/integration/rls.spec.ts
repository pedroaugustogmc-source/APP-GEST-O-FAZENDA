import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Teste obrigatório do §14: com um JWT de trabalhador, todo select em toda
// tabela retorna vazio ou erro. Precisa de um Supabase real (local ou
// remoto) — roda `supabase start`, copie .env.example para .env.local com
// as chaves do projeto, e então `npm test`. Sem essas variáveis, o teste
// aparece como SKIPPED (não como passando) para deixar a lacuna visível.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABELAS = [
  "propriedade",
  "usuarios_acesso",
  "parametros_fazenda",
  "pastos",
  "lotes",
  "animais",
  "movimentacoes_pasto",
  "pesagens",
  "vacinas_catalogo",
  "vacinas_aplicadas",
  "reproducao",
  "mortalidade",
  "financeiro",
  "estoque_insumos",
  "movimentacoes_estoque",
  "cotacoes",
  "precos_mercado",
  "producao_leite",
  "maquinas",
  "plano_manutencao",
  "manutencoes",
  "horas_maquina",
  "tarefas",
  "chuvas",
  "mensagens_bot",
  "alertas",
  "relatorios",
  "auditoria",
];

const rodar = Boolean(URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.skipIf(!rodar)("RLS — trabalhador não lê nada em nenhuma tabela (docs/02-dados.md §14)", () => {
  let userId: string;
  let clienteTrabalhador: SupabaseClient;

  beforeAll(async () => {
    const admin = createClient(URL!, SERVICE_ROLE_KEY!);
    const email = `trabalhador-teste-${Date.now()}@exemplo.invalido`;
    const senha = crypto.randomUUID();

    const { data: criado, error: erroCriacao } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (erroCriacao || !criado.user) {
      throw erroCriacao ?? new Error("Falha ao criar usuário de teste");
    }
    userId = criado.user.id;

    const { error: erroInsercao } = await admin.from("usuarios_acesso").insert({
      auth_user_id: userId,
      telefone: `+55999${Date.now()}`,
      nome: "Trabalhador de Teste — RLS",
      papel: "trabalhador",
      status: "ativo",
    });
    if (erroInsercao) throw erroInsercao;

    clienteTrabalhador = createClient(URL!, ANON_KEY!);
    const { error: erroLogin } = await clienteTrabalhador.auth.signInWithPassword({ email, password: senha });
    if (erroLogin) throw erroLogin;
  });

  afterAll(async () => {
    const admin = createClient(URL!, SERVICE_ROLE_KEY!);
    await admin.from("usuarios_acesso").delete().eq("auth_user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });

  it.each(TABELAS)("select em %s retorna vazio ou erro", async (tabela) => {
    const { data, error } = await clienteTrabalhador.from(tabela).select("*").limit(1);
    const negado = error !== null || data === null || data.length === 0;
    expect(negado, `select em "${tabela}" devolveu ${data?.length ?? 0} linha(s) para um trabalhador`).toBe(true);
  });
});
