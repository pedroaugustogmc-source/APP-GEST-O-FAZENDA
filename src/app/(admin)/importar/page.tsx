import { criarClienteServidor } from "@/infra/supabase/server";
import type { ParametroRow } from "@/infra/supabase/tipos";
import { ImportadorCliente } from "./cliente";

export const dynamic = "force-dynamic";

// CLAUDE.md regra 3: o limite de peso ao nascer não fica fixo no código —
// vem de parametros_fazenda.PESO_NASCIMENTO_MAX_KG (supabase/seed.sql).
const DEFAULT_PESO_NASCIMENTO_MAX_KG = 100;

export default async function PaginaImportar() {
  const supabase = criarClienteServidor();
  const { data } = await supabase
    .from("parametros_fazenda")
    .select("*")
    .eq("chave", "PESO_NASCIMENTO_MAX_KG")
    .maybeSingle();

  const parametro = data as ParametroRow | null;
  const pesoNascimentoMaxKg = parametro ? Number(parametro.valor) : DEFAULT_PESO_NASCIMENTO_MAX_KG;

  return <ImportadorCliente pesoNascimentoMaxKg={pesoNascimentoMaxKg} />;
}
