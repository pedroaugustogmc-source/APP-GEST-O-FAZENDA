import { NextResponse } from "next/server";
import { criarClienteServico } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { sincronizarAlertas, type OfensorAlerta } from "@/infra/alertas";
import { avaliarLotacao } from "@/domain/calculos/avaliarLotacao";
import { diasDeDescanso } from "@/domain/calculos/diasDeDescanso";
import { gmd } from "@/domain/calculos/gmd";
import { elegiveisParaVacina, type AnimalParaVacina, type RegraVacinal } from "@/domain/calculos/elegiveisParaVacina";
import { arrobasCarcaca } from "@/domain/calculos/arrobasCarcaca";
import { pontoEquilibrio } from "@/domain/calculos/pontoEquilibrio";
import { distanciaBreakeven } from "@/domain/calculos/distanciaBreakeven";
import { CATEGORIA_PARA_TIPO_PRECO, buscarPrecosMaisRecentes } from "@/infra/supabase/precoMercado";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import type { Parametros, ISODate } from "@/domain/tipos";

// docs/01-dominio.md §12 — catálogo de alertas. Cobre 10 dos 16 tipos: os 9
// que já tinham dado sem financeiro (F3) + custo_acima_breakeven, que só
// ficou possível agora que financeiro/custoPorArroba/pontoEquilibrio
// existem (F4). Os que faltam dependem de M7/M8 (F5). Job diário (cron);
// dedup/auto-resolução em src/infra/alertas.ts.
export async function GET(request: Request) {
  const segredoConfigurado = process.env.CRON_SECRET;
  const segredoRecebido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = criarClienteServico();
  const parametros = await buscarParametros(supabase);
  const hoje = hojeEmFortaleza();

  const resultado: Record<string, number> = {};

  resultado.superlotacao_e_descanso = await gerarAlertasDePasto(supabase, parametros);
  resultado.vacinas = await gerarAlertasDeVacina(supabase, hoje);
  resultado.gmd_e_dado_velho = await gerarAlertasDeRecria(supabase, parametros, hoje);
  resultado.mortalidade = await gerarAlertaDeMortalidade(supabase, hoje);
  resultado.sincronizacao = await gerarAlertaDeSincronizacao(supabase, parametros, hoje);
  resultado.custo_acima_breakeven = await gerarAlertaDeCustoAcimaBreakeven(supabase, parametros);

  return NextResponse.json({ gerado_em: new Date().toISOString(), alertas_avaliados: resultado });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

interface LinhaLotacao {
  pasto_id: string;
  pasto_nome: string;
  tamanho_ha: number;
  capim: string | null;
  tem_acude: boolean;
  nivel_acude: number | null;
  pasto_status: string;
  data_entrada_lote_atual: ISODate | null;
  data_saida_ultimo_lote: ISODate | null;
  lote_id: string | null;
  cabecas_atuais: number | null;
  peso_medio_kg: number | null;
}

async function gerarAlertasDePasto(supabase: Supa, parametros: Parametros): Promise<number> {
  const { data } = await supabase.from("mv_lotacao_por_pasto").select("*");
  const linhas = (data ?? []) as LinhaLotacao[];

  const pastosEmDescanso = linhas.filter((l) => l.pasto_status === "descanso");

  const ofensoresSuperlotacao: OfensorAlerta[] = [];
  const ofensoresDescansoInsuficiente: OfensorAlerta[] = [];
  const ofensoresAcudeBaixo: OfensorAlerta[] = [];

  for (const linha of linhas) {
    if (linha.tem_acude && linha.nivel_acude !== null && linha.nivel_acude < (parametros.NIVEL_ACUDE_CRITICO ?? 30)) {
      ofensoresAcudeBaixo.push({
        entidadeId: linha.pasto_id,
        severidade: "critico",
        titulo: "Açude baixo",
        mensagem: `${linha.pasto_nome}: açude em ${linha.nivel_acude}% — priorize esse pasto na saída da próxima rotação.`,
        acaoSugerida: "Priorizar saída deste pasto na próxima rotação.",
      });
    }

    if (linha.lote_id && linha.peso_medio_kg !== null && linha.cabecas_atuais) {
      const pesoVivoTotal = linha.peso_medio_kg * linha.cabecas_atuais;
      const avaliacao = avaliarLotacao(pesoVivoTotal, linha.tamanho_ha, linha.capim ?? "", linha.peso_medio_kg, parametros);
      if (avaliacao.excede) {
        const sugestao = sugerirPastoDestino(pastosEmDescanso, linha.pasto_id);
        ofensoresSuperlotacao.push({
          entidadeId: linha.pasto_id,
          severidade: "critico",
          titulo: "Pasto acima da lotação recomendada",
          mensagem: `${linha.pasto_nome}: ${avaliacao.lotacao.toFixed(3)} UA/ha (limite ${avaliacao.limite.toFixed(3)}). Mover cerca de ${avaliacao.cabecasAMover} cabeças${sugestao ? ` para ${sugestao}` : ""}.`,
          acaoSugerida: sugestao ? `Mover ${avaliacao.cabecasAMover} cabeças para ${sugestao}.` : "Reduzir o lote deste pasto.",
        });
      }
    }

    if (linha.pasto_status === "em_uso" && linha.data_entrada_lote_atual && linha.data_saida_ultimo_lote) {
      const dias = diasDeDescanso(linha.data_saida_ultimo_lote, linha.data_entrada_lote_atual);
      if (dias !== null && dias < (parametros.DIAS_DESCANSO_MINIMO ?? 30)) {
        ofensoresDescansoInsuficiente.push({
          entidadeId: linha.pasto_id,
          severidade: "atencao",
          titulo: "Pasto recebeu lote com pouco descanso",
          mensagem: `${linha.pasto_nome} recebeu o lote atual com só ${dias} dias de descanso (mínimo recomendado: ${parametros.DIAS_DESCANSO_MINIMO ?? 30}).`,
        });
      }
    }
  }

  await sincronizarAlertas(supabase, "superlotacao", "pastos", ofensoresSuperlotacao);
  await sincronizarAlertas(supabase, "descanso_insuficiente", "pastos", ofensoresDescansoInsuficiente);
  await sincronizarAlertas(supabase, "acude_baixo", "pastos", ofensoresAcudeBaixo);
  return ofensoresSuperlotacao.length + ofensoresDescansoInsuficiente.length + ofensoresAcudeBaixo.length;
}

function sugerirPastoDestino(pastosEmDescanso: LinhaLotacao[], excetoPastoId: string): string | null {
  const candidatos = pastosEmDescanso
    .filter((p) => p.pasto_id !== excetoPastoId && p.data_saida_ultimo_lote)
    .sort((a, b) => (a.data_saida_ultimo_lote! < b.data_saida_ultimo_lote! ? -1 : 1));
  return candidatos[0]?.pasto_nome ?? null;
}

async function gerarAlertasDeVacina(supabase: Supa, hoje: ISODate): Promise<number> {
  const [{ data: catalogo }, { data: animais }, { data: aplicadas }] = await Promise.all([
    supabase.from("vacinas_catalogo").select("*").eq("ativo", true).eq("bloqueada", false),
    supabase.from("animais").select("id, sexo, categoria, data_nascimento").eq("status", "ativo").is("deletado_em", null),
    supabase.from("vacinas_aplicadas").select("vacina_id, animal_id").not("animal_id", "is", null),
  ]);

  const animaisAtivos = (animais ?? []) as AnimalParaVacina[];

  const ofensoresJanela: OfensorAlerta[] = [];
  const ofensoresAtrasada: OfensorAlerta[] = [];

  for (const vacina of catalogo ?? []) {
    if (vacina.idade_max_meses === null && vacina.idade_min_meses === null) continue;

    const jaAplicados = new Set(
      (aplicadas ?? []).filter((a: { vacina_id: string }) => a.vacina_id === vacina.id).map((a: { animal_id: string }) => a.animal_id)
    );
    const pendentes = animaisAtivos.filter((a) => !jaAplicados.has(a.id));

    const regra: RegraVacinal = {
      nome: vacina.nome,
      sexoAlvo: vacina.sexo_alvo,
      idadeMinMeses: vacina.idade_min_meses,
      idadeMaxMeses: vacina.idade_max_meses,
      categoriasAlvo: vacina.categorias_alvo,
      bloqueada: vacina.bloqueada,
      motivoBloqueio: vacina.motivo_bloqueio,
    };

    const avaliacao = elegiveisParaVacina(pendentes, regra, hoje);

    if (avaliacao.elegiveis.length > 0) {
      ofensoresJanela.push({
        entidadeId: vacina.id,
        severidade: "atencao",
        titulo: `${vacina.nome}: animais entrando na janela`,
        mensagem: `${avaliacao.elegiveis.length} animal(is) na janela de ${vacina.nome} e ainda sem registro.`,
        dados: { contagem: avaliacao.elegiveis.length },
      });
    }

    const atrasados = avaliacao.bloqueados.filter((b) => b.motivo.includes("idade máxima"));
    if (atrasados.length > 0) {
      ofensoresAtrasada.push({
        entidadeId: vacina.id,
        severidade: "critico",
        titulo: `${vacina.nome}: janela fechou sem registro`,
        mensagem: `${atrasados.length} animal(is) passou(aram) da idade máxima de ${vacina.nome} sem registro de aplicação.`,
        dados: { contagem: atrasados.length },
      });
    }
  }

  await sincronizarAlertas(supabase, "vacina_janela_abrindo", "vacinas_catalogo", ofensoresJanela);
  await sincronizarAlertas(supabase, "vacina_atrasada", "vacinas_catalogo", ofensoresAtrasada);
  return ofensoresJanela.length + ofensoresAtrasada.length;
}

interface LinhaRecria {
  lote_id: string;
  lote_nome: string;
  peso_ultima_kg: number | null;
  peso_ultima_data: ISODate | null;
  peso_penultima_kg: number | null;
  peso_penultima_data: ISODate | null;
}

async function gerarAlertasDeRecria(supabase: Supa, parametros: Parametros, hoje: ISODate): Promise<number> {
  const { data } = await supabase.from("mv_indicadores_recria").select("*");
  const linhas = (data ?? []) as LinhaRecria[];

  const ofensoresGmd: OfensorAlerta[] = [];
  const ofensoresDadoVelho: OfensorAlerta[] = [];
  const diasDadoVelho = parametros.DIAS_DADO_VELHO ?? 45;

  for (const linha of linhas) {
    if (linha.peso_ultima_kg !== null && linha.peso_penultima_kg !== null && linha.peso_ultima_data && linha.peso_penultima_data) {
      const dias = diferencaDias(linha.peso_penultima_data, linha.peso_ultima_data);
      const resultadoGmd = gmd(linha.peso_penultima_kg, linha.peso_ultima_kg, dias);
      if (resultadoGmd.valor !== null && resultadoGmd.valor < (parametros.GMD_META_RECRIA ?? 0.5)) {
        ofensoresGmd.push({
          entidadeId: linha.lote_id,
          severidade: "atencao",
          titulo: "GMD abaixo da meta",
          mensagem: `${linha.lote_nome}: GMD de ${resultadoGmd.valor.toFixed(3)} kg/dia, abaixo da meta de ${parametros.GMD_META_RECRIA ?? 0.5}.`,
        });
      }
    }

    const semPesagemRecente =
      !linha.peso_ultima_data || diferencaDias(linha.peso_ultima_data, hoje) > diasDadoVelho;
    if (semPesagemRecente) {
      ofensoresDadoVelho.push({
        entidadeId: linha.lote_id,
        severidade: "info",
        titulo: "Indicador desatualizado",
        mensagem: `${linha.lote_nome} sem pesagem ${linha.peso_ultima_data ? `há mais de ${diasDadoVelho} dias` : "registrada"} — GMD e projeções não são confiáveis.`,
      });
    }
  }

  await sincronizarAlertas(supabase, "gmd_abaixo_meta", "lotes", ofensoresGmd);
  await sincronizarAlertas(supabase, "dado_velho", "lotes", ofensoresDadoVelho);
  return ofensoresGmd.length + ofensoresDadoVelho.length;
}

async function gerarAlertaDeMortalidade(supabase: Supa, hoje: ISODate): Promise<number> {
  const seiMesesAtras = somarMeses(hoje, -6);
  const { data } = await supabase.from("mortalidade").select("data, cabecas").gte("data", seiMesesAtras).lte("data", hoje);

  const porMes = new Map<string, number>();
  for (const linha of (data ?? []) as Array<{ data: ISODate; cabecas: number }>) {
    const chave = linha.data.slice(0, 7);
    porMes.set(chave, (porMes.get(chave) ?? 0) + linha.cabecas);
  }

  const mesAtual = hoje.slice(0, 7);
  const totalMesAtual = porMes.get(mesAtual) ?? 0;
  const mesesAnteriores = [...porMes.entries()].filter(([mes]) => mes !== mesAtual);

  if (mesesAnteriores.length === 0) return 0; // sem histórico, não inventa comparação

  const mediaAnterior = mesesAnteriores.reduce((total, [, cabecas]) => total + cabecas, 0) / mesesAnteriores.length;

  const ofensores: OfensorAlerta[] =
    mediaAnterior > 0 && totalMesAtual > 2 * mediaAnterior
      ? [
          {
            entidadeId: null,
            severidade: "critico",
            titulo: "Mortalidade acima do normal este mês",
            mensagem: `${totalMesAtual} cabeça(s) este mês, mais que o dobro da média dos meses anteriores (${mediaAnterior.toFixed(1)}).`,
            acaoSugerida: "Acionar veterinário e checar causas registradas.",
          },
        ]
      : [];

  await sincronizarAlertas(supabase, "mortalidade_anormal", "propriedade", ofensores);
  return ofensores.length;
}

async function gerarAlertaDeSincronizacao(supabase: Supa, parametros: Parametros, hoje: ISODate): Promise<number> {
  const { data: trabalhadores } = await supabase
    .from("usuarios_acesso")
    .select("id, nome")
    .eq("papel", "trabalhador")
    .eq("status", "ativo");

  const limite = parametros.DIAS_SEM_MENSAGEM_ALERTA ?? 7;
  const ofensores: OfensorAlerta[] = [];

  for (const trabalhador of (trabalhadores ?? []) as Array<{ id: string; nome: string }>) {
    const { data: ultima } = await supabase
      .from("mensagens_bot")
      .select("recebido_em")
      .eq("usuario_id", trabalhador.id)
      .order("recebido_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const diasSemMensagem = ultima ? diferencaDias((ultima.recebido_em as string).slice(0, 10) as ISODate, hoje) : null;

    if (diasSemMensagem === null || diasSemMensagem >= limite) {
      ofensores.push({
        entidadeId: trabalhador.id,
        severidade: "info",
        titulo: "Trabalhador sem mandar mensagem",
        mensagem: `${trabalhador.nome} está ativo mas ${diasSemMensagem === null ? "nunca mandou mensagem" : `não manda mensagem há ${diasSemMensagem} dias`}. Confira se o celular está sincronizando.`,
      });
    }
  }

  await sincronizarAlertas(supabase, "sincronizacao_parada", "usuarios_acesso", ofensores);
  return ofensores.length;
}

async function gerarAlertaDeCustoAcimaBreakeven(supabase: Supa, parametros: Parametros): Promise<number> {
  const [{ data: lotesRecria }, { data: financeiroData }, precoMaisRecentePorTipo] = await Promise.all([
    supabase.from("mv_indicadores_recria").select("*").eq("tipo_operacao", "recria"),
    supabase.from("financeiro").select("lote_id, valor_centavos").eq("tipo", "custo").is("deletado_em", null).not("lote_id", "is", null),
    buscarPrecosMaisRecentes(supabase),
  ]);

  const custoPorLote = new Map<string, bigint>();
  for (const linha of (financeiroData ?? []) as Array<{ lote_id: string; valor_centavos: number }>) {
    custoPorLote.set(linha.lote_id, (custoPorLote.get(linha.lote_id) ?? 0n) + BigInt(linha.valor_centavos));
  }

  const ofensores: OfensorAlerta[] = [];

  type LinhaRecria = { lote_id: string; lote_nome: string; lote_categoria: string; cabecas_atuais: number; peso_ultima_kg: number | null };
  for (const lote of (lotesRecria ?? []) as LinhaRecria[]) {
    const custoAcumulado = custoPorLote.get(lote.lote_id);
    if (!custoAcumulado || lote.peso_ultima_kg === null || !lote.cabecas_atuais) continue;

    const tipoPreco = CATEGORIA_PARA_TIPO_PRECO[lote.lote_categoria as keyof typeof CATEGORIA_PARA_TIPO_PRECO];
    const precoMercado = tipoPreco ? precoMaisRecentePorTipo.get(tipoPreco)?.valorCentavos : undefined;
    if (!precoMercado) continue; // sem preço de mercado registrado, não dá pra avaliar — não inventa

    const arrobasTotais = arrobasCarcaca(lote.peso_ultima_kg, parametros) * lote.cabecas_atuais;
    const pe = pontoEquilibrio(custoAcumulado, arrobasTotais);
    if (pe.valor === null) continue;

    const distancia = distanciaBreakeven(precoMercado, pe.valor);
    if (distancia < 0) {
      ofensores.push({
        entidadeId: lote.lote_id,
        severidade: "critico",
        titulo: "Lote abaixo do ponto de equilíbrio",
        mensagem: `${lote.lote_nome}: ponto de equilíbrio em R$ ${(Number(pe.valor) / 100).toFixed(2)}/@, preço de mercado em R$ ${(Number(precoMercado) / 100).toFixed(2)}/@ (${(distancia * 100).toFixed(1)}%).`,
        acaoSugerida: "Revisar custo do lote antes de decidir vender.",
      });
    }
  }

  await sincronizarAlertas(supabase, "custo_acima_breakeven", "lotes", ofensores);
  return ofensores.length;
}

function diferencaDias(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / (1000 * 60 * 60 * 24));
}

function somarMeses(data: ISODate, meses: number): ISODate {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano ?? 2026, (mes ?? 1) - 1 + meses, dia ?? 1));
  const anoR = resultado.getUTCFullYear();
  const mesR = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const diaR = String(resultado.getUTCDate()).padStart(2, "0");
  return `${anoR}-${mesR}-${diaR}`;
}
