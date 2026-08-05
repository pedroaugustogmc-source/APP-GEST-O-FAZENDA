import type { SupabaseClient } from "@supabase/supabase-js";
import { arrobasCarcaca } from "@/domain/calculos/arrobasCarcaca";
import { custoPorArroba } from "@/domain/calculos/custoPorArroba";
import { pontoEquilibrio } from "@/domain/calculos/pontoEquilibrio";
import { receitaProjetadaVenda } from "@/domain/calculos/receitaProjetadaVenda";
import { margemProjetada } from "@/domain/calculos/margemProjetada";
import { CATEGORIA_PARA_TIPO_PRECO, buscarPrecosMaisRecentes } from "./precoMercado";
import type { Centavos, Indicador, Parametros } from "@/domain/tipos";
import type { CategoriaAnimalDB } from "./tipos";

// docs/03-modulos.md M5/M6/M10 — o mesmo agregado "fazenda inteira" alimenta
// três telas (dashboard, mercado, e o total que o DRE por lote já mostra
// separado por lote): custo acumulado e arrobas totais de todos os lotes
// ativos com peso conhecido. Um só lugar de verdade evita as telas
// mostrando pontos de equilíbrio diferentes pro mesmo dia.
export interface IndicadoresFinanceirosFazenda {
  custoTotalCentavos: Centavos;
  arrobasTotal: number;
  custoPorArroba: Indicador<Centavos>;
  pontoEquilibrio: Indicador<Centavos>;
  /** Soma da receita projetada só dos lotes com preço de mercado conhecido pra sua categoria — null se nenhum lote contribuiu. */
  receitaProjetadaCentavos: Centavos | null;
  margemProjetada: Centavos | null;
}

/**
 * Fase 6c: `propriedadeId`/`idsUsuariosDaFazenda` só são necessários quando
 * quem chama roda com service_role (workers) — `lotes`/`financeiro` já são
 * escopados por RLS pra chamada autenticada normal, e
 * `mv_indicadores_recria` tem a view `v_indicadores_recria` equivalente pra
 * esse caso (matview não tem RLS). Sem os parâmetros, o comportamento é
 * idêntico ao de antes da F6c.
 */
export async function buscarIndicadoresFinanceirosFazenda(
  supabase: SupabaseClient,
  parametros: Parametros,
  propriedadeId?: string,
  idsUsuariosDaFazenda?: string[]
): Promise<IndicadoresFinanceirosFazenda> {
  let queryLotes = supabase.from("lotes").select("id, categoria, cabecas_atuais, peso_entrada").eq("status", "ativo");
  let queryIndicadores = supabase
    .from(propriedadeId ? "mv_indicadores_recria" : "v_indicadores_recria")
    .select("lote_id, peso_ultima_kg");
  let queryFinanceiro = supabase
    .from("financeiro")
    .select("lote_id, valor_centavos")
    .eq("tipo", "custo")
    .is("deletado_em", null)
    .not("lote_id", "is", null);
  if (propriedadeId) {
    queryLotes = queryLotes.eq("propriedade_id", propriedadeId);
    queryIndicadores = queryIndicadores.eq("propriedade_id", propriedadeId);
    queryFinanceiro = queryFinanceiro.eq("propriedade_id", propriedadeId);
  }

  const [{ data: lotesData }, { data: indicadoresData }, { data: financeiroData }, precoMaisRecentePorTipo] = await Promise.all([
    queryLotes,
    queryIndicadores,
    queryFinanceiro,
    buscarPrecosMaisRecentes(supabase, idsUsuariosDaFazenda),
  ]);

  type LinhaLote = { id: string; categoria: CategoriaAnimalDB; cabecas_atuais: number; peso_entrada: number | null };
  const lotes = (lotesData ?? []) as LinhaLote[];

  const pesoAtualPorLote = new Map<string, number>();
  for (const linha of (indicadoresData ?? []) as Array<{ lote_id: string; peso_ultima_kg: number | null }>) {
    if (linha.peso_ultima_kg !== null) pesoAtualPorLote.set(linha.lote_id, linha.peso_ultima_kg);
  }

  const custoPorLote = new Map<string, Centavos>();
  for (const linha of (financeiroData ?? []) as Array<{ lote_id: string; valor_centavos: number }>) {
    custoPorLote.set(linha.lote_id, (custoPorLote.get(linha.lote_id) ?? 0n) + BigInt(linha.valor_centavos));
  }

  let custoTotal: Centavos = 0n;
  let arrobasTotal = 0;
  let receitaTotal: Centavos = 0n;
  let algumaReceita = false;

  for (const lote of lotes) {
    const pesoAtual = pesoAtualPorLote.get(lote.id) ?? lote.peso_entrada;
    if (pesoAtual === null) continue;

    const custoLote = custoPorLote.get(lote.id) ?? 0n;
    const arrobasLote = arrobasCarcaca(pesoAtual, parametros) * lote.cabecas_atuais;
    custoTotal += custoLote;
    arrobasTotal += arrobasLote;

    const tipoPreco = CATEGORIA_PARA_TIPO_PRECO[lote.categoria];
    const preco = tipoPreco ? precoMaisRecentePorTipo.get(tipoPreco) : undefined;
    if (preco) {
      receitaTotal += receitaProjetadaVenda(arrobasLote, preco.valorCentavos);
      algumaReceita = true;
    }
  }

  return {
    custoTotalCentavos: custoTotal,
    arrobasTotal,
    custoPorArroba: custoPorArroba(custoTotal, arrobasTotal),
    pontoEquilibrio: pontoEquilibrio(custoTotal, arrobasTotal),
    receitaProjetadaCentavos: algumaReceita ? receitaTotal : null,
    margemProjetada: algumaReceita ? margemProjetada(receitaTotal, custoTotal) : null,
  };
}
