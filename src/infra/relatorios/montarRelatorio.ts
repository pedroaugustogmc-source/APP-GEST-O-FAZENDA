import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarIndicadoresCria, buscarIndicadoresRecria, subtrairDias } from "@/infra/supabase/indicadoresRebanho";
import { buscarIndicadoresFinanceirosFazenda } from "@/infra/supabase/indicadoresFinanceirosFazenda";
import { buscarPrecosMaisRecentes } from "@/infra/supabase/precoMercado";
import { distanciaBreakeven } from "@/domain/calculos/distanciaBreakeven";
import { partesDeISODate } from "@/domain/tipos/data";
import { formatarCentavos } from "@/lib/dinheiro";
import type { ISODate, Parametros } from "@/domain/tipos";
import type { TipoRelatorioDB } from "@/infra/supabase/tipos";

// docs/03-modulos.md M9 — "texto em linguagem direta, sem jargão; todo
// número acompanhado de contexto e da data do dado." Decisão registrada em
// ESTADO.md, resposta direta ao pedido do dono de não gerar custo novo:
// o relatório é montado por template determinístico em TypeScript, NÃO por
// chamada à Claude API — mesma lógica de simularCenarios (F4) não usar
// Code Execution. `relatorios.conteudo_md` (tabela já existe desde a F1)
// grava o texto final.
export interface RelatorioMontado {
  tipo: TipoRelatorioDB;
  periodoInicio: ISODate;
  periodoFim: ISODate;
  conteudoMd: string;
  indicadores: Record<string, unknown>;
}

interface Snapshot {
  cabecasTotais: number;
  taxaPrenhezPct: number | null;
  taxaDesmamePct: number | null;
  lotesRecriaComGmdAbaixoMeta: number;
  pastosSuperlotados: number;
  acudesBaixos: number;
  vacinasJanela: number;
  vacinasAtrasadas: number;
  manutencoesVencidas: number;
  manutencoesProximas: number;
  custoPorArrobaCentavos: number | null;
  pontoEquilibrioCentavos: number | null;
  distanciaMercadoPct: number | null;
  margemProjetadaCentavos: number | null;
  alertasCriticosAbertos: number;
  tarefasPendentes: number;
  filaRevisaoPendente: number;
}

/**
 * Fase 6c: `ctx` só é passado por quem chama com service_role (o worker
 * `rotina-semanal`) — sem ele, o comportamento é o de antes da F6c (RLS
 * escopa sozinha pra chamada autenticada de `/api/relatorios/gerar`).
 */
export interface ContextoRelatorio {
  propriedadeId: string;
  idsUsuarios: string[];
}

async function coletarSnapshot(supabase: SupabaseClient, parametros: Parametros, hoje: ISODate, ctx?: ContextoRelatorio): Promise<Snapshot> {
  let queryLotes = supabase.from("lotes").select("cabecas_atuais").eq("status", "ativo");
  let queryAlertas = supabase.from("alertas").select("tipo, severidade").is("resolvido_em", null);
  let queryTarefas = supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("status", "pendente");
  let queryMensagens = supabase.from("mensagens_bot").select("id", { count: "exact", head: true }).in("status", ["revisao", "erro"]);
  if (ctx) {
    queryLotes = queryLotes.eq("propriedade_id", ctx.propriedadeId);
    queryAlertas = queryAlertas.eq("propriedade_id", ctx.propriedadeId);
    queryTarefas = queryTarefas.eq("propriedade_id", ctx.propriedadeId);
    queryMensagens = queryMensagens.in("usuario_id", ctx.idsUsuarios);
  }

  const [
    { data: lotesData },
    cria,
    recria,
    { data: alertasAbertos },
    indicadoresFinanceiros,
    precoMaisRecentePorTipo,
    { count: tarefasPendentes },
    { count: filaRevisaoPendente },
  ] = await Promise.all([
    queryLotes,
    buscarIndicadoresCria(supabase, parametros, hoje, ctx?.idsUsuarios),
    buscarIndicadoresRecria(supabase, parametros, hoje, ctx?.propriedadeId),
    queryAlertas,
    buscarIndicadoresFinanceirosFazenda(supabase, parametros, ctx?.propriedadeId, ctx?.idsUsuarios),
    buscarPrecosMaisRecentes(supabase, ctx?.idsUsuarios),
    queryTarefas,
    queryMensagens,
  ]);

  const cabecasTotais = ((lotesData ?? []) as Array<{ cabecas_atuais: number }>).reduce((t, l) => t + l.cabecas_atuais, 0);

  type LinhaAlerta = { tipo: string; severidade: "info" | "atencao" | "critico" };
  const alertas = (alertasAbertos ?? []) as LinhaAlerta[];
  const contarTipo = (tipo: string) => alertas.filter((a) => a.tipo === tipo).length;

  const precoBoi = precoMaisRecentePorTipo.get("arroba_boi") ?? null;
  const distanciaMercadoPct =
    precoBoi && indicadoresFinanceiros.pontoEquilibrio.valor !== null && indicadoresFinanceiros.pontoEquilibrio.valor > 0n
      ? distanciaBreakeven(precoBoi.valorCentavos, indicadoresFinanceiros.pontoEquilibrio.valor)
      : null;

  return {
    cabecasTotais,
    taxaPrenhezPct: cria.taxaPrenhez.valor,
    taxaDesmamePct: cria.taxaDesmame.valor,
    lotesRecriaComGmdAbaixoMeta: recria.filter((l) => l.gmdAbaixoMeta).length,
    pastosSuperlotados: contarTipo("superlotacao"),
    acudesBaixos: contarTipo("acude_baixo"),
    vacinasJanela: contarTipo("vacina_janela_abrindo"),
    vacinasAtrasadas: contarTipo("vacina_atrasada"),
    manutencoesVencidas: contarTipo("manutencao_vencida"),
    manutencoesProximas: contarTipo("manutencao_proxima"),
    custoPorArrobaCentavos: indicadoresFinanceiros.custoPorArroba.valor !== null ? Number(indicadoresFinanceiros.custoPorArroba.valor) : null,
    pontoEquilibrioCentavos: indicadoresFinanceiros.pontoEquilibrio.valor !== null ? Number(indicadoresFinanceiros.pontoEquilibrio.valor) : null,
    distanciaMercadoPct,
    margemProjetadaCentavos: indicadoresFinanceiros.margemProjetada !== null ? Number(indicadoresFinanceiros.margemProjetada) : null,
    alertasCriticosAbertos: alertas.filter((a) => a.severidade === "critico").length,
    tarefasPendentes: tarefasPendentes ?? 0,
    filaRevisaoPendente: filaRevisaoPendente ?? 0,
  };
}

function linhaOuSemDado(valor: number | null, formatar: (v: number) => string): string {
  return valor !== null ? formatar(valor) : "— sem dado —";
}

// docs/03-modulos.md M9.1: "sob demanda, rebanho, pastos, sanidade,
// financeiro, máquinas, pendências."
export async function montarRelatorioGeral(supabase: SupabaseClient, parametros: Parametros, hoje: ISODate, ctx?: ContextoRelatorio): Promise<RelatorioMontado> {
  const s = await coletarSnapshot(supabase, parametros, hoje, ctx);

  const conteudoMd = `# Relatório geral da fazenda — ${hoje}

## Rebanho
- Cabeças totais: ${s.cabecasTotais}
- Taxa de prenhez: ${linhaOuSemDado(s.taxaPrenhezPct, (v) => `${(v * 100).toFixed(1)}%`)}
- Taxa de desmame: ${linhaOuSemDado(s.taxaDesmamePct, (v) => `${(v * 100).toFixed(1)}%`)}
- Lotes de recria com GMD abaixo da meta: ${s.lotesRecriaComGmdAbaixoMeta}

## Pastos
- Pastos acima da lotação recomendada: ${s.pastosSuperlotados}
- Açudes em nível baixo: ${s.acudesBaixos}

## Sanidade
- Vacinas na janela: ${s.vacinasJanela}
- Vacinas atrasadas: ${s.vacinasAtrasadas}

## Financeiro
- Custo por arroba: ${linhaOuSemDado(s.custoPorArrobaCentavos, (v) => `${formatarCentavos(BigInt(Math.round(v)))}/@`)}
- Ponto de equilíbrio: ${linhaOuSemDado(s.pontoEquilibrioCentavos, (v) => `${formatarCentavos(BigInt(Math.round(v)))}/@`)}
- Distância do preço de mercado: ${linhaOuSemDado(s.distanciaMercadoPct, (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`)}
- Margem projetada: ${linhaOuSemDado(s.margemProjetadaCentavos, (v) => formatarCentavos(BigInt(Math.round(v))))}

## Máquinas
- Manutenções vencidas: ${s.manutencoesVencidas}
- Manutenções próximas do vencimento: ${s.manutencoesProximas}

## Pendências
- Alertas críticos abertos: ${s.alertasCriticosAbertos}
- Tarefas pendentes: ${s.tarefasPendentes}
- Fila de revisão do bot: ${s.filaRevisaoPendente}
`;

  return { tipo: "geral", periodoInicio: hoje, periodoFim: hoje, conteudoMd, indicadores: s as unknown as Record<string, unknown> };
}

// docs/03-modulos.md M9.2: "consolidação semanal automática (fim de cada
// semana): o que foi registrado, o que mudou, o que ficou pendente,
// alertas abertos, custo/@ atualizado, ponto de equilíbrio vs mercado, e a
// agenda da semana seguinte."
export async function montarRelatorioSemanal(
  supabase: SupabaseClient,
  parametros: Parametros,
  hoje: ISODate,
  agendaSemanaSeguinte: Array<{ descricao: string; justificativa: string | null }>,
  ctx?: ContextoRelatorio
): Promise<RelatorioMontado> {
  const inicio = subtrairDias(hoje, 7);
  const s = await coletarSnapshot(supabase, parametros, hoje, ctx);

  let queryGravadas = supabase
    .from("mensagens_bot")
    .select("id", { count: "exact", head: true })
    .eq("status", "gravada")
    .gte("recebido_em", `${inicio}T00:00:00`);
  if (ctx) queryGravadas = queryGravadas.in("usuario_id", ctx.idsUsuarios);
  const { count: gravadasNaSemana } = await queryGravadas;

  const linhasAgenda = agendaSemanaSeguinte
    .map((t, i) => `${i + 1}. ${t.descricao}${t.justificativa ? ` — ${t.justificativa}` : ""}`)
    .join("\n");

  const conteudoMd = `# Consolidação semanal — ${inicio} a ${hoje}

## O que foi registrado
- ${gravadasNaSemana ?? 0} mensagem(ns) do bot gravada(s) nesta semana.

## Alertas abertos
- Críticos: ${s.alertasCriticosAbertos}
- Pastos acima da lotação: ${s.pastosSuperlotados} · Açudes baixos: ${s.acudesBaixos}
- Vacinas na janela: ${s.vacinasJanela} · Vacinas atrasadas: ${s.vacinasAtrasadas}
- Manutenções vencidas: ${s.manutencoesVencidas} · próximas: ${s.manutencoesProximas}

## Financeiro
- Custo por arroba: ${linhaOuSemDado(s.custoPorArrobaCentavos, (v) => `${formatarCentavos(BigInt(Math.round(v)))}/@`)}
- Ponto de equilíbrio vs mercado: ${linhaOuSemDado(s.distanciaMercadoPct, (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`)}

## Pendente
- Tarefas pendentes: ${s.tarefasPendentes} · Fila de revisão: ${s.filaRevisaoPendente}

## Agenda da semana seguinte
${linhasAgenda || "— sem dado — nenhuma tarefa priorizada ainda."}
`;

  return { tipo: "semanal", periodoInicio: inicio, periodoFim: hoje, conteudoMd, indicadores: s as unknown as Record<string, unknown> };
}

// docs/03-modulos.md M9.3: "briefing trimestral: trimestre vs trimestre
// anterior e vs mesmo trimestre do ano passado; evolução de rebanho;
// margem dos lotes fechados; eficiência de pastagem; o que deu certo, o
// que deu errado e 3 recomendações concretas."
export async function montarRelatorioTrimestral(
  supabase: SupabaseClient,
  parametros: Parametros,
  hoje: ISODate,
  ctx?: ContextoRelatorio
): Promise<RelatorioMontado> {
  const inicioTrimestre = inicioDoTrimestre(hoje);
  const s = await coletarSnapshot(supabase, parametros, hoje, ctx);

  let queryTrimestreAnterior = supabase
    .from("relatorios")
    .select("indicadores, periodo_fim")
    .eq("tipo", "trimestral")
    .lt("periodo_fim", inicioTrimestre);
  if (ctx) queryTrimestreAnterior = queryTrimestreAnterior.eq("propriedade_id", ctx.propriedadeId);
  const { data: trimestreAnterior } = await queryTrimestreAnterior.order("periodo_fim", { ascending: false }).limit(1).maybeSingle();

  const anterior = (trimestreAnterior?.indicadores ?? null) as Snapshot | null;
  const recomendacoes = anterior ? recomendacoesDoTrimestre(s, anterior) : [];

  const comparacao = anterior
    ? `- Custo por arroba: ${linhaOuSemDado(s.custoPorArrobaCentavos, (v) => formatarCentavos(BigInt(Math.round(v))))} (trimestre anterior: ${linhaOuSemDado(anterior.custoPorArrobaCentavos, (v) => formatarCentavos(BigInt(Math.round(v))))})
- Taxa de desmame: ${linhaOuSemDado(s.taxaDesmamePct, (v) => `${(v * 100).toFixed(1)}%`)} (trimestre anterior: ${linhaOuSemDado(anterior.taxaDesmamePct, (v) => `${(v * 100).toFixed(1)}%`)})
- Cabeças totais: ${s.cabecasTotais} (trimestre anterior: ${anterior.cabecasTotais})`
    : "— sem dado — este é o primeiro briefing trimestral desta fazenda, não há trimestre anterior pra comparar.";

  const conteudoMd = `# Briefing trimestral — ${inicioTrimestre} a ${hoje}

## Evolução do rebanho
- Cabeças totais: ${s.cabecasTotais}
- Taxa de prenhez: ${linhaOuSemDado(s.taxaPrenhezPct, (v) => `${(v * 100).toFixed(1)}%`)}
- Taxa de desmame: ${linhaOuSemDado(s.taxaDesmamePct, (v) => `${(v * 100).toFixed(1)}%`)}

## Comparação com o trimestre anterior
${comparacao}

## Margem projetada da fazenda
- ${linhaOuSemDado(s.margemProjetadaCentavos, (v) => formatarCentavos(BigInt(Math.round(v))))}

## Recomendações
${recomendacoes.length > 0 ? recomendacoes.map((r, i) => `${i + 1}. ${r}`).join("\n") : "— sem dado — sem trimestre anterior pra comparar, ainda não dá pra recomendar mudança de rumo com segurança."}
`;

  return { tipo: "trimestral", periodoInicio: inicioTrimestre, periodoFim: hoje, conteudoMd, indicadores: s as unknown as Record<string, unknown> };
}

// Recomendações determinísticas (não geradas por LLM — decisão registrada
// em ESTADO.md, mesma razão de simularCenarios não usar Code Execution):
// cada regra compara o indicador atual com o do trimestre anterior e só
// dispara quando o movimento é desfavorável.
function recomendacoesDoTrimestre(atual: Snapshot, anterior: Snapshot): string[] {
  const recomendacoes: string[] = [];

  if (
    atual.custoPorArrobaCentavos !== null &&
    anterior.custoPorArrobaCentavos !== null &&
    atual.custoPorArrobaCentavos > anterior.custoPorArrobaCentavos
  ) {
    recomendacoes.push("Custo por arroba subiu em relação ao trimestre anterior — revisar a categoria de despesa que mais cresceu no DRE por lote.");
  }

  if (atual.taxaDesmamePct !== null && anterior.taxaDesmamePct !== null && atual.taxaDesmamePct < anterior.taxaDesmamePct) {
    recomendacoes.push("Taxa de desmame caiu — checar nutrição das matrizes e histórico de mortalidade de bezerro no período.");
  }

  if (atual.lotesRecriaComGmdAbaixoMeta > anterior.lotesRecriaComGmdAbaixoMeta) {
    recomendacoes.push("Mais lotes de recria abaixo da meta de GMD que no trimestre anterior — revisar suplementação e rotação de pasto.");
  }

  if (atual.pastosSuperlotados > anterior.pastosSuperlotados) {
    recomendacoes.push("Mais pastos acima da lotação recomendada — revisar o plano de rotação antes da próxima estiagem.");
  }

  return recomendacoes.slice(0, 3);
}

function inicioDoTrimestre(hoje: ISODate): ISODate {
  const partes = partesDeISODate(hoje);
  const mesInicioTrimestre = Math.floor((partes.mes - 1) / 3) * 3 + 1;
  return `${partes.ano}-${String(mesInicioTrimestre).padStart(2, "0")}-01`;
}
