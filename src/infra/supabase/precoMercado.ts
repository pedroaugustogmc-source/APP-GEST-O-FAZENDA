import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaAnimalDB, TipoPrecoMercadoDB } from "./tipos";

// docs/02-dados.md §13.5: precos_mercado.tipo não tem uma entrada por
// categoria_animal — usa arroba_boi/arroba_vaca pra macho/fêmea adultos.
// Aproximação declarada em ESTADO.md, não um mapeamento oficial da spec.
// Extraído de gerar-alertas/route.ts (F3) porque o DRE (F4) e a tela de
// mercado (M6) precisam do mesmo mapeamento — um só lugar de verdade.
export const CATEGORIA_PARA_TIPO_PRECO: Record<CategoriaAnimalDB, TipoPrecoMercadoDB> = {
  bezerro: "bezerro",
  bezerra: "bezerra",
  garrote: "garrote",
  novilha: "novilha",
  vaca: "arroba_vaca",
  touro: "arroba_boi",
  boi: "arroba_boi",
};

export interface PrecoRecente {
  valorCentavos: bigint;
  dataReferencia: string;
  fonte: string;
}

/** Preço mais recente por tipo (precos_mercado não tem "vigente", é sempre a última entrada por data_referencia). */
export async function buscarPrecosMaisRecentes(
  supabase: SupabaseClient
): Promise<Map<TipoPrecoMercadoDB, PrecoRecente>> {
  const { data } = await supabase
    .from("precos_mercado")
    .select("tipo, valor_centavos, data_referencia, fonte")
    .order("data_referencia", { ascending: false });

  const mapa = new Map<TipoPrecoMercadoDB, PrecoRecente>();
  for (const linha of (data ?? []) as Array<{
    tipo: TipoPrecoMercadoDB;
    valor_centavos: number;
    data_referencia: string;
    fonte: string;
  }>) {
    if (!mapa.has(linha.tipo)) {
      mapa.set(linha.tipo, { valorCentavos: BigInt(linha.valor_centavos), dataReferencia: linha.data_referencia, fonte: linha.fonte });
    }
  }
  return mapa;
}
