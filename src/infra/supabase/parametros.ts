import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parametros } from "@/domain/tipos";

/**
 * Busca todo `parametros_fazenda` de uma vez e devolve como mapa tipado
 * (CLAUDE.md regra 3 — nenhum limiar de negócio fica fixo no código).
 * Consumido pelas telas/workers da Fase 3 em diante que precisam de mais de
 * um ou dois parâmetros (dashboard, alertas, pastos, rebanho, sanidade).
 */
export async function buscarParametros(supabase: SupabaseClient): Promise<Parametros> {
  const { data, error } = await supabase.from("parametros_fazenda").select("chave, valor, tipo_dado");
  if (error) throw new Error(`Falha ao buscar parametros_fazenda: ${error.message}`);

  const parametros: Record<string, number> = {};
  for (const linha of (data ?? []) as Array<{ chave: string; valor: string; tipo_dado: string }>) {
    if (linha.tipo_dado === "number") parametros[linha.chave] = Number(linha.valor);
  }
  return parametros as unknown as Parametros;
}
