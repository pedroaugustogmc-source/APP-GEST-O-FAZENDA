import type { SupabaseClient } from "@supabase/supabase-js";
import { partesDeISODate } from "@/domain/tipos/data";
import { buscarIndicadoresFinanceirosFazenda } from "@/infra/supabase/indicadoresFinanceirosFazenda";
import type { Centavos, ISODate, Indicador, Parametros } from "@/domain/tipos";
import type { TipoPrecoMercadoDB } from "@/infra/supabase/tipos";

export const ORDEM_TIPOS_PRECO: TipoPrecoMercadoDB[] = [
  "arroba_boi",
  "arroba_vaca",
  "bezerro",
  "bezerra",
  "garrote",
  "novilha",
  "leite_litro",
];

// docs/03-modulos.md M6: "cruzamento automático com o ponto de equilíbrio
// da fazenda" — reaproveita o mesmo agregado usado pelo dashboard (M10),
// pra nunca mostrar dois números diferentes de ponto de equilíbrio da
// fazenda no mesmo dia (src/infra/supabase/indicadoresFinanceirosFazenda.ts).
export async function calcularPontoEquilibrioFazenda(supabase: SupabaseClient, parametros: Parametros): Promise<Indicador<Centavos>> {
  const indicadores = await buscarIndicadoresFinanceirosFazenda(supabase, parametros);
  return indicadores.pontoEquilibrio;
}

export interface SeriePreco {
  tipo: TipoPrecoMercadoDB;
  unidade: string;
  valorCentavos: Centavos;
  dataReferencia: ISODate;
  fonte: string;
  desatualizado: boolean;
  variacaoSemanalPct: number | null;
  variacaoMensalPct: number | null;
  historico: Array<{ dataReferencia: ISODate; valorCentavos: Centavos }>;
}

// docs/03-modulos.md M6: "Série histórica com gráfico; variação semanal e
// mensal... Preço com mais de 7 dias aparece marcado como desatualizado."
// Uma linha por tipo (o preço mais recente), com a variação contra a
// entrada mais próxima de 7/30 dias atrás — "— sem dado —" honesto quando
// não há histórico velho o bastante pra comparar (§9).
export async function buscarSeriesPrecos(supabase: SupabaseClient, parametros: Parametros, hoje: ISODate): Promise<SeriePreco[]> {
  const { data } = await supabase
    .from("precos_mercado")
    .select("tipo, valor_centavos, unidade, data_referencia, fonte")
    .order("data_referencia", { ascending: false })
    .limit(500);

  type LinhaPreco = { tipo: TipoPrecoMercadoDB; valor_centavos: number; unidade: string; data_referencia: ISODate; fonte: string };
  const linhas = (data ?? []) as LinhaPreco[];

  const porTipo = new Map<TipoPrecoMercadoDB, LinhaPreco[]>();
  for (const linha of linhas) {
    const lista = porTipo.get(linha.tipo) ?? [];
    lista.push(linha);
    porTipo.set(linha.tipo, lista);
  }

  const diasDesatualizado = parametros.DIAS_PRECO_MERCADO_DESATUALIZADO ?? 7;
  const dataSemanaAtras = subtrairDias(hoje, 7);
  const dataMesAtras = subtrairDias(hoje, 30);

  const resultado: SeriePreco[] = [];
  for (const [tipo, entradas] of porTipo) {
    // já vem ordenado desc por data_referencia (a query buscou assim).
    const maisRecente = entradas[0]!;
    const entradaSemana = encontrarMaisProximaAntesDe(entradas, dataSemanaAtras);
    const entradaMes = encontrarMaisProximaAntesDe(entradas, dataMesAtras);

    resultado.push({
      tipo,
      unidade: maisRecente.unidade,
      valorCentavos: BigInt(maisRecente.valor_centavos),
      dataReferencia: maisRecente.data_referencia,
      fonte: maisRecente.fonte,
      desatualizado: diasEntre(maisRecente.data_referencia, hoje) > diasDesatualizado,
      variacaoSemanalPct: entradaSemana ? variacaoPct(entradaSemana.valor_centavos, maisRecente.valor_centavos) : null,
      variacaoMensalPct: entradaMes ? variacaoPct(entradaMes.valor_centavos, maisRecente.valor_centavos) : null,
      historico: entradas
        .slice()
        .reverse()
        .map((e) => ({ dataReferencia: e.data_referencia, valorCentavos: BigInt(e.valor_centavos) })),
    });
  }

  return resultado.sort((a, b) => ORDEM_TIPOS_PRECO.indexOf(a.tipo) - ORDEM_TIPOS_PRECO.indexOf(b.tipo));
}

function variacaoPct(valorAntigo: number, valorNovo: number): number {
  return (valorNovo - valorAntigo) / valorAntigo;
}

/** Entre as entradas (desc por data), a mais recente que ainda é <= alvo. */
function encontrarMaisProximaAntesDe<T extends { data_referencia: ISODate }>(entradas: T[], alvo: ISODate): T | null {
  return entradas.find((e) => e.data_referencia <= alvo) ?? null;
}

function diasEntre(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

function subtrairDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia - dias));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
