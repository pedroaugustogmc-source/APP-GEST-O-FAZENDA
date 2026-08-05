import type { SupabaseClient } from "@supabase/supabase-js";
import { gmd } from "@/domain/calculos/gmd";
import { CATEGORIA_PARA_TIPO_PRECO, buscarPrecosMaisRecentes } from "@/infra/supabase/precoMercado";
import { partesDeISODate } from "@/domain/tipos/data";
import type { ISODate, Parametros } from "@/domain/tipos";
import type { CategoriaAnimalDB } from "@/infra/supabase/tipos";

// Valores em centavos trafegam como string nos props do componente cliente
// (React Server Components não serializa bigint) — o cliente faz
// BigInt(string) antes de chamar simularCenarios. Só lotes de RECRIA entram
// aqui: a simulação é "quanto tempo até o peso-alvo de venda", que não se
// aplica a cria (matriz não "vende" por peso) nem a leite.
export interface LoteParaSimulacao {
  loteId: string;
  loteNome: string;
  categoria: CategoriaAnimalDB;
  pesoAtualKg: number | null;
  gmdBaseSugerido: number | null;
  precoAtualPorArrobaCentavos: string | null;
  precoMercadoDataReferencia: ISODate | null;
  custoDiarioSugeridoCentavos: string;
  pesoAlvoVendaKg: number;
}

export async function buscarLotesParaSimulacao(
  supabase: SupabaseClient,
  parametros: Parametros,
  hoje: ISODate
): Promise<LoteParaSimulacao[]> {
  const [{ data: lotesData }, { data: indicadoresData }, { data: financeiroData }, precoMaisRecentePorTipo] = await Promise.all([
    supabase.from("lotes").select("id, nome, categoria, data_entrada").eq("status", "ativo").eq("tipo_operacao", "recria").order("nome"),
    supabase.from("v_indicadores_recria").select("lote_id, peso_ultima_kg, peso_ultima_data, peso_penultima_kg, peso_penultima_data"),
    supabase.from("financeiro").select("lote_id, valor_centavos").eq("tipo", "custo").is("deletado_em", null).not("lote_id", "is", null),
    buscarPrecosMaisRecentes(supabase),
  ]);

  type LinhaLote = { id: string; nome: string; categoria: CategoriaAnimalDB; data_entrada: ISODate };
  type LinhaIndicador = {
    lote_id: string;
    peso_ultima_kg: number | null;
    peso_ultima_data: ISODate | null;
    peso_penultima_kg: number | null;
    peso_penultima_data: ISODate | null;
  };

  const indicadoresPorLote = new Map(((indicadoresData ?? []) as LinhaIndicador[]).map((i) => [i.lote_id, i]));

  const custoTotalPorLote = new Map<string, bigint>();
  for (const linha of (financeiroData ?? []) as Array<{ lote_id: string; valor_centavos: number }>) {
    custoTotalPorLote.set(linha.lote_id, (custoTotalPorLote.get(linha.lote_id) ?? 0n) + BigInt(linha.valor_centavos));
  }

  const pesoAlvoVendaKg = parametros.PESO_ALVO_VENDA ?? 420;

  return ((lotesData ?? []) as LinhaLote[]).map((lote) => {
    const indicador = indicadoresPorLote.get(lote.id);

    let gmdBaseSugerido: number | null = null;
    if (indicador?.peso_ultima_kg !== null && indicador?.peso_penultima_kg !== null && indicador?.peso_ultima_data && indicador?.peso_penultima_data) {
      const dias = diasEntre(indicador.peso_penultima_data, indicador.peso_ultima_data);
      const resultado = gmd(indicador.peso_penultima_kg, indicador.peso_ultima_kg, dias);
      gmdBaseSugerido = resultado.valor;
    }

    const tipoPreco = CATEGORIA_PARA_TIPO_PRECO[lote.categoria];
    const preco = tipoPreco ? precoMaisRecentePorTipo.get(tipoPreco) : undefined;

    const custoTotal = custoTotalPorLote.get(lote.id) ?? 0n;
    const diasAtivo = diasEntre(lote.data_entrada, hoje);
    const custoDiarioSugerido = diasAtivo > 0 ? custoTotal / BigInt(diasAtivo) : 0n;

    return {
      loteId: lote.id,
      loteNome: lote.nome,
      categoria: lote.categoria,
      pesoAtualKg: indicador?.peso_ultima_kg ?? null,
      gmdBaseSugerido,
      precoAtualPorArrobaCentavos: preco ? preco.valorCentavos.toString() : null,
      precoMercadoDataReferencia: preco?.dataReferencia ?? null,
      custoDiarioSugeridoCentavos: custoDiarioSugerido.toString(),
      pesoAlvoVendaKg,
    };
  });
}

function diasEntre(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.max(1, Math.round((msB - msA) / (1000 * 60 * 60 * 24)));
}
