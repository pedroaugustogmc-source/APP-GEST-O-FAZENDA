import type { SupabaseClient } from "@supabase/supabase-js";
import { taxaPrenhez } from "@/domain/calculos/taxaPrenhez";
import { taxaParicao } from "@/domain/calculos/taxaParicao";
import { taxaDesmame } from "@/domain/calculos/taxaDesmame";
import { kgDesmamadoPorMatriz } from "@/domain/calculos/kgDesmamadoPorMatriz";
import { intervaloEntrePartos } from "@/domain/calculos/intervaloEntrePartos";
import { taxaMortalidade } from "@/domain/calculos/taxaMortalidade";
import { pesoAjustado205 } from "@/domain/calculos/pesoAjustado205";
import { gmd } from "@/domain/calculos/gmd";
import { partesDeISODate } from "@/domain/tipos/data";
import type { Indicador, ISODate, Kg, Parametros } from "@/domain/tipos";

// Movido de src/app/(admin)/rebanho/consultas.ts (F3) pra cá na F5: o
// relatório semanal/trimestral (src/infra/relatorios) também precisa
// destas consultas, e `infra` não pode importar de `app`
// (eslint boundaries/element-types — CLAUDE.md "app → infra → domain").
//
// Janela de análise do painel CRIA: últimos 12 meses. docs/03-modulos.md M3
// não fixa uma janela — 12 meses é decisão minha, registrada em ESTADO.md,
// por ser o ciclo natural de uma estação de monta/desmame.
const JANELA_DIAS = 365;

export interface IndicadoresCria {
  matrizesExpostas: number;
  taxaPrenhez: Indicador<number>;
  taxaParicao: Indicador<number>;
  taxaDesmame: Indicador<number>;
  kgDesmamadoPorMatriz: Indicador<number>;
  intervaloEntrePartosDias: Indicador<number>;
  pesoDesmameMedioKg: number | null;
  pesoAjustado205MedioKg: number | null;
  taxaMortalidadeBezerro: Indicador<number>;
}

/**
 * `idsUsuariosDaFazenda` só é necessário quando quem chama roda com
 * service_role (workers) — RLS já escopa por fazenda pra qualquer chamada
 * autenticada (Fase 6b, derivado via registrado_por), então uma tela normal
 * não precisa passar nada.
 */
export async function buscarIndicadoresCria(
  supabase: SupabaseClient,
  parametros: Parametros,
  hoje: ISODate,
  idsUsuariosDaFazenda?: string[]
): Promise<IndicadoresCria> {
  const inicioPeriodo = subtrairDias(hoje, JANELA_DIAS);
  const idadeDesmameDias = parametros.IDADE_DESMAME_DIAS ?? 240;

  let queryReproducao = supabase
    .from("reproducao")
    .select("matriz_id, resultado, data_parto_real")
    .is("deletado_em", null)
    .gte("data_cobertura", inicioPeriodo);
  let queryAnimais = supabase
    .from("animais")
    .select("id, matriz_id, data_nascimento, peso_nascimento, status, categoria")
    .is("deletado_em", null)
    .eq("origem", "nascimento")
    .not("matriz_id", "is", null)
    .gte("data_nascimento", inicioPeriodo);
  let queryMortalidade = supabase
    .from("mortalidade")
    .select("cabecas, categoria, data")
    .gte("data", inicioPeriodo)
    .in("categoria", ["bezerro", "bezerra"]);
  if (idsUsuariosDaFazenda) {
    queryReproducao = queryReproducao.in("registrado_por", idsUsuariosDaFazenda);
    queryAnimais = queryAnimais.in("registrado_por", idsUsuariosDaFazenda);
    queryMortalidade = queryMortalidade.in("registrado_por", idsUsuariosDaFazenda);
  }

  const [{ data: reproducaoData }, { data: animaisData }, { data: mortalidadeData }] = await Promise.all([
    queryReproducao,
    queryAnimais,
    queryMortalidade,
  ]);

  type LinhaReproducao = { matriz_id: string; resultado: string | null; data_parto_real: ISODate | null };
  type LinhaAnimal = {
    id: string;
    matriz_id: string;
    data_nascimento: ISODate | null;
    peso_nascimento: number | null;
    status: string;
    categoria: string;
  };

  const reproducao = (reproducaoData ?? []) as LinhaReproducao[];
  const animais = (animaisData ?? []) as LinhaAnimal[];
  const mortes = (mortalidadeData ?? []) as Array<{ cabecas: number }>;

  const matrizesExpostas = new Set(reproducao.map((r) => r.matriz_id));
  const matrizesPrenhas = new Set(
    reproducao.filter((r) => r.resultado === "prenha" || r.resultado === "parida").map((r) => r.matriz_id)
  );
  const partos = reproducao.filter((r) => r.data_parto_real !== null).length;

  const partosPorMatriz = new Map<string, ISODate[]>();
  for (const r of reproducao) {
    if (!r.data_parto_real) continue;
    const lista = partosPorMatriz.get(r.matriz_id) ?? [];
    lista.push(r.data_parto_real);
    partosPorMatriz.set(r.matriz_id, lista);
  }
  const intervalosValidos = [...partosPorMatriz.values()]
    .map((datas) => intervaloEntrePartos(datas))
    .filter((i): i is Indicador<number> & { valor: number } => i.valor !== null);
  const intervaloMedio =
    intervalosValidos.length > 0
      ? intervalosValidos.reduce((total, i) => total + i.valor, 0) / intervalosValidos.length
      : null;

  // "Desmamado": nascido há tempo suficiente pra já ter atingido a idade de
  // desmame e continua vivo — não existe evento de desmame explícito no
  // schema (docs/02-dados.md), essa é a aproximação declarada em ESTADO.md.
  const bezerrosElegiveis = animais.filter(
    (a) => a.data_nascimento && diasEntre(a.data_nascimento, hoje) >= idadeDesmameDias
  );
  const bezerrosVivos = bezerrosElegiveis.filter((a) => a.status !== "morto");

  const pesagensIds = bezerrosVivos.map((a) => a.id);
  let pesosDesmame: Array<{ animalId: string; peso: Kg; idadeDias: number; pesoNascimento: Kg | null }> = [];

  if (pesagensIds.length > 0) {
    const { data: pesagensData } = await supabase
      .from("pesagens")
      .select("animal_id, peso, data")
      .in("animal_id", pesagensIds)
      .eq("tipo", "individual")
      .is("deletado_em", null);

    const pesagensPorAnimal = new Map<string, Array<{ peso: number; data: ISODate }>>();
    for (const p of (pesagensData ?? []) as Array<{ animal_id: string; peso: number; data: ISODate }>) {
      const lista = pesagensPorAnimal.get(p.animal_id) ?? [];
      lista.push({ peso: p.peso, data: p.data });
      pesagensPorAnimal.set(p.animal_id, lista);
    }

    pesosDesmame = bezerrosVivos
      .map((animal) => {
        const pesagensDoAnimal = pesagensPorAnimal.get(animal.id) ?? [];
        if (!animal.data_nascimento || pesagensDoAnimal.length === 0) return null;
        const maisProxima = pesagemMaisProximaDaIdadeAlvo(pesagensDoAnimal, animal.data_nascimento, idadeDesmameDias);
        return { animalId: animal.id, peso: maisProxima.peso, idadeDias: maisProxima.idadeDias, pesoNascimento: animal.peso_nascimento };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }

  const pesoDesmameMedioKg =
    pesosDesmame.length > 0 ? pesosDesmame.reduce((t, p) => t + p.peso, 0) / pesosDesmame.length : null;

  const ajustados = pesosDesmame
    .filter((p) => p.pesoNascimento !== null)
    .map((p) => pesoAjustado205(p.pesoNascimento!, p.peso, p.idadeDias).valor)
    .filter((v): v is number => v !== null);
  const pesoAjustado205MedioKg = ajustados.length > 0 ? ajustados.reduce((t, v) => t + v, 0) / ajustados.length : null;

  return {
    matrizesExpostas: matrizesExpostas.size,
    taxaPrenhez: taxaPrenhez(matrizesPrenhas.size, matrizesExpostas.size),
    taxaParicao: taxaParicao(partos, matrizesExpostas.size),
    taxaDesmame: taxaDesmame(bezerrosVivos.length, matrizesExpostas.size),
    kgDesmamadoPorMatriz: kgDesmamadoPorMatriz(pesosDesmame.map((p) => p.peso), matrizesExpostas.size),
    intervaloEntrePartosDias:
      intervaloMedio !== null
        ? { valor: intervaloMedio, n: intervalosValidos.length, dataBase: hoje, qualidade: "firme" }
        : { valor: null, n: 0, dataBase: null, qualidade: "sem_dado", motivo: "nenhuma matriz com 2+ partos no período" },
    pesoDesmameMedioKg,
    pesoAjustado205MedioKg,
    taxaMortalidadeBezerro: taxaMortalidade(
      mortes.reduce((t, m) => t + m.cabecas, 0),
      bezerrosElegiveis.length
    ),
  };
}

function pesagemMaisProximaDaIdadeAlvo(
  pesagens: Array<{ peso: number; data: ISODate }>,
  dataNascimento: ISODate,
  idadeAlvoDias: number
): { peso: number; idadeDias: number } {
  let melhor = { peso: pesagens[0]!.peso, idadeDias: diasEntre(dataNascimento, pesagens[0]!.data) };
  let menorDiferenca = Math.abs(melhor.idadeDias - idadeAlvoDias);

  for (const p of pesagens) {
    const idade = diasEntre(dataNascimento, p.data);
    const diferenca = Math.abs(idade - idadeAlvoDias);
    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      melhor = { peso: p.peso, idadeDias: idade };
    }
  }
  return melhor;
}

function diasEntre(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

export interface IndicadorRecriaLote {
  loteId: string;
  loteNome: string;
  categoria: string;
  diasNoPasto: number | null;
  gmd: Indicador<number>;
  ganhoPorHectare: number | null;
  pesoAtualKg: Kg | null;
  dataVendaProjetada: ISODate | null;
  gmdAbaixoMeta: boolean;
}

/**
 * `mv_indicadores_recria` é view MATERIALIZADA — Postgres não suporta RLS
 * nela (Fase 6c). Uma tela autenticada lê `v_indicadores_recria` (filtra
 * sozinha por `current_propriedade_id()`); um worker com service_role passa
 * `propriedadeId` explicitamente e lê a matview crua com filtro manual.
 */
export async function buscarIndicadoresRecria(
  supabase: SupabaseClient,
  parametros: Parametros,
  hoje: ISODate,
  propriedadeId?: string
): Promise<IndicadorRecriaLote[]> {
  let query = supabase
    .from(propriedadeId ? "mv_indicadores_recria" : "v_indicadores_recria")
    .select("*")
    .eq("tipo_operacao", "recria");
  if (propriedadeId) query = query.eq("propriedade_id", propriedadeId);
  const { data } = await query;

  type LinhaRecria = {
    lote_id: string;
    lote_nome: string;
    lote_categoria: string;
    tamanho_ha: number | null;
    data_entrada_lote_atual: ISODate | null;
    peso_ultima_kg: number | null;
    peso_ultima_data: ISODate | null;
    peso_penultima_kg: number | null;
    peso_penultima_data: ISODate | null;
  };

  const pesoAlvoVenda = parametros.PESO_ALVO_VENDA ?? 420;
  const gmdMeta = parametros.GMD_META_RECRIA ?? 0.5;

  return ((data ?? []) as LinhaRecria[]).map((linha) => {
    const diasNoPasto = linha.data_entrada_lote_atual ? diasEntre(linha.data_entrada_lote_atual, hoje) : null;

    let resultadoGmd: Indicador<number> = {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "menos de 2 pesagens registradas para este lote",
    };
    let dataVendaProjetada: ISODate | null = null;
    let ganhoPorHectare: number | null = null;

    if (
      linha.peso_ultima_kg !== null &&
      linha.peso_penultima_kg !== null &&
      linha.peso_ultima_data &&
      linha.peso_penultima_data
    ) {
      const dias = diasEntre(linha.peso_penultima_data, linha.peso_ultima_data);
      resultadoGmd = gmd(linha.peso_penultima_kg, linha.peso_ultima_kg, dias);

      if (linha.tamanho_ha) {
        ganhoPorHectare = (linha.peso_ultima_kg - linha.peso_penultima_kg) / linha.tamanho_ha;
      }

      // Mesma fórmula de src/domain/calculos/pesoProjetado.ts, resolvida pro
      // dia em vez do peso (pesoProjetado responde "quanto vai pesar em N
      // dias"; aqui a pergunta é "em quantos dias chega no peso-alvo").
      if (resultadoGmd.valor !== null && resultadoGmd.valor > 0 && linha.peso_ultima_kg < pesoAlvoVenda) {
        const diasParaAlvo = (pesoAlvoVenda - linha.peso_ultima_kg) / resultadoGmd.valor;
        dataVendaProjetada = somarDias(hoje, Math.ceil(diasParaAlvo));
      }
    }

    return {
      loteId: linha.lote_id,
      loteNome: linha.lote_nome,
      categoria: linha.lote_categoria,
      diasNoPasto,
      gmd: resultadoGmd,
      ganhoPorHectare,
      pesoAtualKg: linha.peso_ultima_kg,
      dataVendaProjetada,
      gmdAbaixoMeta: resultadoGmd.valor !== null && resultadoGmd.valor < gmdMeta,
    };
  });
}

function somarDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + dias));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function subtrairDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia - dias));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
