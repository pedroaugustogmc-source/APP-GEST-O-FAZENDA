import { NextResponse } from "next/server";
import { criarClienteServico } from "@/infra/supabase/server";

// docs/02-dados.md §15 — refresh das views materializadas de indicador.
// GET + CRON_SECRET: mesma convenção do worker de mensagens pendentes (F2) —
// é o que a Vercel Cron sabe chamar e o que ela injeta sozinha.
export async function GET(request: Request) {
  const segredoConfigurado = process.env.CRON_SECRET;
  const segredoRecebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = criarClienteServico();
  const { error } = await supabase.rpc("atualizar_views_indicadores");

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ atualizado: true, em: new Date().toISOString() });
}
