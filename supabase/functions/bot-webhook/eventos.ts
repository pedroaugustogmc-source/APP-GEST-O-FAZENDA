// deno-lint-ignore-file no-explicit-any
// Dispatcher por tipo de evento: roda a validação semântica do §32
// (src/domain/validacao/validacaoSemantica.ts) buscando só o dado necessário
// no banco, e devolve o objeto canônico que supabase/migrations/..._fase2_bot.sql
// (gravar_eventos_mensagem_bot) espera — ou uma recusa com a pergunta certa.
import type { EventoExtraido } from "../../../src/infra/claude/tipos.ts";
import type { Parametros, ISODate } from "../../../src/domain/tipos/index.ts";
import * as V from "../../../src/domain/validacao/validacaoSemantica.ts";
import { gmd } from "../../../src/domain/calculos/gmd.ts";
import { diasDeDescanso } from "../../../src/domain/calculos/diasDeDescanso.ts";
import { elegiveisParaVacina, type AnimalParaVacina, type RegraVacinal } from "../../../src/domain/calculos/elegiveisParaVacina.ts";

export type ResultadoEvento =
  | { acao: "gravar" | "revisao"; canonico: Record<string, unknown> }
  | { acao: "recusar"; pergunta: string; alertarAdmin?: boolean };

export async function validarEvento(
  supabase: any,
  evento: EventoExtraido,
  parametros: Parametros,
  hoje: ISODate
): Promise<ResultadoEvento> {
  const dataFato = (evento.data_do_fato ?? hoje) as ISODate;

  const foraDoPrazo = V.validarDataNaoFutura(dataFato, hoje);
  if (foraDoPrazo.acao === "recusar") return foraDoPrazo;

  const dados = evento.dados as Record<string, unknown>;
  const base: Record<string, unknown> = { tipo: evento.tipo, data: dataFato, ...dados };

  switch (evento.tipo) {
    case "pesagem":
      return validarPesagem(supabase, base, dataFato, parametros);
    case "vacinacao":
      return validarVacinacao(supabase, base, dataFato);
    case "movimentacao_pasto":
      return validarMovimentacaoPasto(supabase, base, dataFato);
    case "mortalidade":
      return validarMortalidade(supabase, base, dataFato);
    case "despesa":
    case "receita":
      return validarFinanceiro(supabase, base, dataFato, evento.tipo, parametros);
    case "nivel_acude":
    case "manutencao":
    case "horas_maquina":
    case "nascimento":
    case "reproducao":
    case "chuva":
    case "producao_leite":
    case "estoque":
    case "demanda":
    case "observacao":
      return { acao: "gravar", canonico: base };
    case "bloqueio":
      // Evento "bloqueio" não é gravado — a resposta já é o próprio aviso.
      return { acao: "recusar", pergunta: String(dados.motivo ?? "Isso não pode ser registrado.") };
    default:
      return { acao: "recusar", pergunta: "Não entendi esse tipo de registro. Pode falar de outro jeito?" };
  }
}

async function validarPesagem(
  supabase: any,
  base: Record<string, unknown>,
  dataFato: ISODate,
  parametros: Parametros
): Promise<ResultadoEvento> {
  const animalId = base.animal_id as string | undefined;
  const loteId = base.lote_id as string | undefined;
  const peso = Number(base.peso);

  let categoria: string | null = null;
  let dataReferencia: ISODate | null = null;

  if (animalId) {
    const { data: animal, error } = await supabase
      .from("animais")
      .select("status, data_saida, categoria, data_nascimento")
      .eq("id", animalId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!animal) return V.validarEntidadeReferenciada(false, []);

    const podeReceber = V.validarAnimalPodeReceberEvento(animal.status, animal.data_saida, dataFato);
    if (podeReceber.acao === "recusar") return podeReceber;

    categoria = animal.categoria;
    dataReferencia = animal.data_nascimento;
  } else if (loteId) {
    const { data: lote, error } = await supabase
      .from("lotes")
      .select("categoria, data_entrada")
      .eq("id", loteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lote) return V.validarEntidadeReferenciada(false, []);
    categoria = lote.categoria;
    dataReferencia = lote.data_entrada;
  }

  const dataOk = V.validarDataPosteriorAReferencia(dataFato, dataReferencia);
  if (dataOk.acao === "recusar") return dataOk;

  if (categoria) {
    const min = parametros[`PESO_MIN_KG_${categoria.toUpperCase()}`];
    const max = parametros[`PESO_MAX_KG_${categoria.toUpperCase()}`];
    if (typeof min === "number" && typeof max === "number") {
      const pesoOk = V.validarPesoPlausivel(peso, categoria as any, { min, max });
      if (pesoOk.acao === "recusar") return pesoOk;
    }
  }

  // GMD implícito: compara com a pesagem anterior do mesmo alvo, se houver.
  const coluna = animalId ? "animal_id" : "lote_id";
  const valorColuna = animalId ?? loteId;
  if (valorColuna) {
    const { data: anterior } = await supabase
      .from("pesagens")
      .select("data, peso")
      .eq(coluna, valorColuna)
      .lt("data", dataFato)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anterior) {
      const dias = diasEntre(anterior.data, dataFato);
      const resultadoGmd = gmd(Number(anterior.peso), peso, dias);
      const gmdOk = V.validarGmdPlausivel(resultadoGmd, parametros.GMD_IMPLAUSIVEL_MAX_KG_DIA ?? 2.5);
      if (gmdOk.acao === "revisao") return { acao: "revisao", canonico: base };
    }
  }

  return { acao: "gravar", canonico: base };
}

async function validarVacinacao(supabase: any, base: Record<string, unknown>, dataFato: ISODate): Promise<ResultadoEvento> {
  const nomeVacina = String(base.vacina ?? "");
  const { data: catalogo, error } = await supabase
    .from("vacinas_catalogo")
    .select("id, nome, sexo_alvo, idade_min_meses, idade_max_meses, categorias_alvo, incompativel_com, intervalo_minimo_dias, bloqueada, motivo_bloqueio")
    .eq("nome", nomeVacina)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!catalogo) return V.validarEntidadeReferenciada(false, []);

  base.vacina_id = catalogo.id;

  const regra: RegraVacinal = {
    nome: catalogo.nome,
    sexoAlvo: catalogo.sexo_alvo,
    idadeMinMeses: catalogo.idade_min_meses,
    idadeMaxMeses: catalogo.idade_max_meses,
    categoriasAlvo: catalogo.categorias_alvo,
    bloqueada: catalogo.bloqueada,
    motivoBloqueio: catalogo.motivo_bloqueio,
  };

  const animalId = base.animal_id as string | undefined;
  const loteId = base.lote_id as string | undefined;
  let animaisAlvo: AnimalParaVacina[] = [];

  if (animalId) {
    const { data: animal } = await supabase.from("animais").select("id, sexo, categoria, data_nascimento").eq("id", animalId).maybeSingle();
    if (!animal) return V.validarEntidadeReferenciada(false, []);
    animaisAlvo = [{ id: animal.id, sexo: animal.sexo, categoria: animal.categoria, nascimento: animal.data_nascimento }];
  } else if (loteId) {
    const { data: animais } = await supabase
      .from("animais")
      .select("id, sexo, categoria, data_nascimento")
      .eq("lote_id", loteId)
      .eq("status", "ativo")
      .limit(500);
    animaisAlvo = (animais ?? []).map((a: any) => ({ id: a.id, sexo: a.sexo, categoria: a.categoria, nascimento: a.data_nascimento }));
  }

  if (animaisAlvo.length > 0) {
    const resultado = elegiveisParaVacina(animaisAlvo, regra, dataFato);
    if (resultado.bloqueados.length > 0) {
      return { acao: "recusar", pergunta: capitalizar(resultado.bloqueados[0]!.motivo) };
    }
  } else if (regra.bloqueada) {
    return { acao: "recusar", pergunta: regra.motivoBloqueio ?? `${regra.nome} está bloqueada.` };
  }

  if (catalogo.incompativel_com?.length && catalogo.intervalo_minimo_dias) {
    const alvoId = animalId ?? null;
    let query = supabase.from("vacinas_aplicadas").select("vacina, data").order("data", { ascending: false }).limit(20);
    query = alvoId ? query.eq("animal_id", alvoId) : loteId ? query.eq("lote_id", loteId) : query;
    const { data: aplicadas } = await query;

    const intervalo = V.validarIntervaloVacinal(
      regra.nome,
      catalogo.incompativel_com ?? [],
      catalogo.intervalo_minimo_dias,
      (aplicadas ?? []).map((a: any) => ({ vacina: a.vacina, data: a.data })),
      dataFato
    );
    if (intervalo.acao === "recusar") return intervalo;
  }

  return { acao: "gravar", canonico: base };
}

async function validarMovimentacaoPasto(supabase: any, base: Record<string, unknown>, dataFato: ISODate): Promise<ResultadoEvento> {
  const loteId = base.lote_id as string | undefined;
  const pastoDestinoId = base.pasto_destino_id as string | undefined;
  const cabecas = Number(base.cabecas);

  if (!loteId || !pastoDestinoId) return V.validarEntidadeReferenciada(false, []);

  const [{ data: lote }, { data: destino }] = await Promise.all([
    supabase.from("lotes").select("cabecas_atuais").eq("id", loteId).maybeSingle(),
    supabase.from("pastos").select("status, data_saida_ultimo_lote").eq("id", pastoDestinoId).maybeSingle(),
  ]);
  if (!lote || !destino) return V.validarEntidadeReferenciada(false, []);

  const cabecasOk = V.validarCabecasNaoExcedeLote(cabecas, lote.cabecas_atuais);
  if (cabecasOk.acao === "recusar") return cabecasOk;

  const pastoOk = V.validarPastoAceitaEntrada(destino.status, null);
  if (pastoOk.acao === "recusar") return pastoOk;

  const dias = diasDeDescanso(destino.data_saida_ultimo_lote, dataFato);
  if (dias !== null) base.dias_descanso_destino = dias;

  return { acao: "gravar", canonico: base };
}

async function validarMortalidade(supabase: any, base: Record<string, unknown>, dataFato: ISODate): Promise<ResultadoEvento> {
  const animalId = base.animal_id as string | undefined;
  const loteId = base.lote_id as string | undefined;
  const cabecas = Number(base.cabecas ?? 1);

  if (animalId) {
    const { data: animal } = await supabase.from("animais").select("status, data_saida").eq("id", animalId).maybeSingle();
    if (!animal) return V.validarEntidadeReferenciada(false, []);
    const podeReceber = V.validarAnimalPodeReceberEvento(animal.status, animal.data_saida, dataFato);
    if (podeReceber.acao === "recusar") return podeReceber;
  }

  if (loteId) {
    const { data: lote } = await supabase.from("lotes").select("cabecas_atuais").eq("id", loteId).maybeSingle();
    if (!lote) return V.validarEntidadeReferenciada(false, []);
    const cabecasOk = V.validarCabecasNaoExcedeLote(cabecas, lote.cabecas_atuais);
    if (cabecasOk.acao === "recusar") return cabecasOk;
  }

  return { acao: "gravar", canonico: base };
}

async function validarFinanceiro(
  supabase: any,
  base: Record<string, unknown>,
  dataFato: ISODate,
  tipo: "despesa" | "receita",
  parametros: Parametros
): Promise<ResultadoEvento> {
  const categoria = String(base.categoria ?? "");
  const valor = BigInt(Math.round(Number(base.valor_centavos ?? 0)));

  // CLAUDE.md regra 9: data do fato, não data do registro — mesmo para a
  // mediana histórica usada só para detectar valor atípico.
  const { data: historico } = await supabase
    .from("financeiro")
    .select("valor_centavos")
    .eq("categoria", categoria)
    .eq("tipo", tipo === "despesa" ? "custo" : "receita")
    .order("data", { ascending: false })
    .limit(20);

  const mediana = calcularMediana((historico ?? []).map((h: any) => BigInt(h.valor_centavos)));
  const resultado = V.validarValorFinanceiroPlausivel(valor, mediana, parametros.FATOR_VALOR_ATIPICO ?? 10);

  if (resultado.acao === "revisao") return { acao: "revisao", canonico: base };
  return { acao: "gravar", canonico: base };
}

function calcularMediana(valores: bigint[]): bigint | null {
  if (valores.length === 0) return null;
  const ordenado = [...valores].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const meio = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 0) return (ordenado[meio - 1]! + ordenado[meio]!) / 2n;
  return ordenado[meio]!;
}

function diasEntre(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / (1000 * 60 * 60 * 24));
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
