import type { SupabaseClient } from "@supabase/supabase-js";
import { arrobasCarcaca } from "@/domain/calculos/arrobasCarcaca";
import { custoPorArroba } from "@/domain/calculos/custoPorArroba";
import { pontoEquilibrio } from "@/domain/calculos/pontoEquilibrio";
import { distanciaBreakeven } from "@/domain/calculos/distanciaBreakeven";
import { receitaProjetadaVenda } from "@/domain/calculos/receitaProjetadaVenda";
import { margemProjetada } from "@/domain/calculos/margemProjetada";
import { CATEGORIA_PARA_TIPO_PRECO, buscarPrecosMaisRecentes } from "@/infra/supabase/precoMercado";
import { partesDeISODate } from "@/domain/tipos/data";
import type { Centavos, Indicador, ISODate, Parametros } from "@/domain/tipos";
import type { CategoriaAnimalDB, CentroCustoDB } from "@/infra/supabase/tipos";

// docs/03-modulos.md M5, "adição sênior — DRE simplificado por lote":
// receita_projetada_venda − custo_acumulado_do_lote = margem_projetada,
// com custo separado por CENTRO_CUSTO cria/recria ("misturar os dois
// esconde onde a margem realmente está sendo perdida"). Ponto de
// equilíbrio e custo/@ usam a mesma base (arrobas totais do lote hoje,
// peso atual × RENDIMENTO_CARCACA — mesma leitura já usada no alerta
// custo_acima_breakeven de F3/gerar-alertas).
export interface LinhaDre {
  loteId: string;
  loteNome: string;
  categoria: CategoriaAnimalDB;
  tipoOperacao: string;
  cabecasAtuais: number;
  custoCriaCentavos: Centavos;
  custoRecriaCentavos: Centavos;
  custoOutroCentavos: Centavos;
  custoAcumuladoCentavos: Centavos;
  arrobasTotais: number | null;
  custoPorArroba: Indicador<Centavos>;
  pontoEquilibrio: Indicador<Centavos>;
  precoMercadoCentavos: Centavos | null;
  precoMercadoDataReferencia: ISODate | null;
  distanciaBreakevenPct: number | null;
  receitaProjetadaCentavos: Centavos | null;
  margemProjetadaCentavos: Centavos | null;
  diasAtivo: number;
}

export async function buscarDrePorLote(supabase: SupabaseClient, parametros: Parametros, hoje: ISODate): Promise<LinhaDre[]> {
  const [{ data: lotesData }, { data: pesosData }, { data: financeiroData }, precoMaisRecentePorTipo] = await Promise.all([
    supabase.from("lotes").select("id, nome, categoria, tipo_operacao, cabecas_atuais, peso_entrada, data_entrada").eq("status", "ativo").order("nome"),
    supabase.from("v_indicadores_recria").select("lote_id, peso_ultima_kg"),
    supabase
      .from("financeiro")
      .select("lote_id, valor_centavos, centro_custo")
      .eq("tipo", "custo")
      .is("deletado_em", null)
      .not("lote_id", "is", null),
    buscarPrecosMaisRecentes(supabase),
  ]);

  type LinhaLote = {
    id: string;
    nome: string;
    categoria: CategoriaAnimalDB;
    tipo_operacao: string;
    cabecas_atuais: number;
    peso_entrada: number | null;
    data_entrada: ISODate;
  };
  const lotes = (lotesData ?? []) as LinhaLote[];

  const pesoAtualPorLote = new Map<string, number>();
  for (const linha of (pesosData ?? []) as Array<{ lote_id: string; peso_ultima_kg: number | null }>) {
    if (linha.peso_ultima_kg !== null) pesoAtualPorLote.set(linha.lote_id, linha.peso_ultima_kg);
  }

  const custosPorLote = new Map<string, { cria: bigint; recria: bigint; outro: bigint }>();
  for (const linha of (financeiroData ?? []) as Array<{ lote_id: string; valor_centavos: number; centro_custo: CentroCustoDB }>) {
    const atual = custosPorLote.get(linha.lote_id) ?? { cria: 0n, recria: 0n, outro: 0n };
    const valor = BigInt(linha.valor_centavos);
    if (linha.centro_custo === "cria") atual.cria += valor;
    else if (linha.centro_custo === "recria") atual.recria += valor;
    else atual.outro += valor;
    custosPorLote.set(linha.lote_id, atual);
  }

  return lotes.map((lote) => {
    const custos = custosPorLote.get(lote.id) ?? { cria: 0n, recria: 0n, outro: 0n };
    const custoAcumuladoCentavos = custos.cria + custos.recria + custos.outro;

    const pesoAtual = pesoAtualPorLote.get(lote.id) ?? lote.peso_entrada;
    const arrobasTotais = pesoAtual !== null ? arrobasCarcaca(pesoAtual, parametros) * lote.cabecas_atuais : null;

    const cpa = arrobasTotais !== null ? custoPorArroba(custoAcumuladoCentavos, arrobasTotais) : semDado("peso do lote não conhecido");
    const pe = arrobasTotais !== null ? pontoEquilibrio(custoAcumuladoCentavos, arrobasTotais) : semDado("peso do lote não conhecido");

    const tipoPreco = CATEGORIA_PARA_TIPO_PRECO[lote.categoria];
    const preco = tipoPreco ? precoMaisRecentePorTipo.get(tipoPreco) : undefined;

    const distanciaBreakevenPct = preco && pe.valor !== null && pe.valor > 0n ? distanciaBreakeven(preco.valorCentavos, pe.valor) : null;
    const receitaProjetadaCentavos = preco && arrobasTotais !== null ? receitaProjetadaVenda(arrobasTotais, preco.valorCentavos) : null;
    const margemProjetadaCentavos = receitaProjetadaCentavos !== null ? margemProjetada(receitaProjetadaCentavos, custoAcumuladoCentavos) : null;

    return {
      loteId: lote.id,
      loteNome: lote.nome,
      categoria: lote.categoria,
      tipoOperacao: lote.tipo_operacao,
      cabecasAtuais: lote.cabecas_atuais,
      custoCriaCentavos: custos.cria,
      custoRecriaCentavos: custos.recria,
      custoOutroCentavos: custos.outro,
      custoAcumuladoCentavos,
      arrobasTotais,
      custoPorArroba: cpa,
      pontoEquilibrio: pe,
      precoMercadoCentavos: preco?.valorCentavos ?? null,
      precoMercadoDataReferencia: preco?.dataReferencia ?? null,
      distanciaBreakevenPct,
      receitaProjetadaCentavos,
      margemProjetadaCentavos,
      diasAtivo: diasEntre(lote.data_entrada, hoje),
    };
  });
}

function semDado(motivo: string): Indicador<Centavos> {
  return { valor: null, n: 0, dataBase: null, qualidade: "sem_dado", motivo };
}

function diasEntre(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.max(1, Math.round((msB - msA) / (1000 * 60 * 60 * 24)));
}
