// deno-lint-ignore-file no-explicit-any
import type { ContextoExtrator } from "../../../src/infra/claude/tipos.ts";
import type { Parametros } from "../../../src/domain/tipos/index.ts";

/** Busca todos os parametros_fazenda de uma vez e devolve como mapa tipado (números já convertidos). */
export async function buscarParametros(supabase: any): Promise<Parametros> {
  const { data, error } = await supabase.from("parametros_fazenda").select("chave, valor, tipo_dado");
  if (error) throw new Error(`Falha ao buscar parametros_fazenda: ${error.message}`);

  const parametros: Record<string, number> = {};
  for (const linha of data ?? []) {
    if (linha.tipo_dado === "number") parametros[linha.chave] = Number(linha.valor);
  }
  return parametros as unknown as Parametros;
}

/**
 * Monta o CONTEXTO INJETADO do prompt do extrator (docs/04-bot.md §30):
 * pastos, lotes ativos, máquinas, vacinas permitidas e insumos cadastrados —
 * é o que permite o extrator resolver nomes ditos por voz contra ids reais.
 */
export async function buscarContextoExtrator(supabase: any, usuario: { nome: string; papel: string }): Promise<ContextoExtrator> {
  const [pastos, lotes, maquinas, vacinas, insumos] = await Promise.all([
    supabase.from("pastos").select("id, nome, apelidos"),
    supabase
      .from("lotes")
      .select("id, nome, categoria, pasto_id, cabecas_atuais, pastos(nome)")
      .eq("status", "ativo"),
    supabase.from("maquinas").select("id, nome, modelo").neq("status", "vendida"),
    supabase.from("vacinas_catalogo").select("nome, bloqueada, motivo_bloqueio").eq("ativo", true),
    supabase.from("estoque_insumos").select("id, insumo, unidade"),
  ]);

  for (const [nome, resultado] of Object.entries({ pastos, lotes, maquinas, vacinas, insumos })) {
    if ((resultado as any).error) {
      throw new Error(`Falha ao buscar ${nome} para o contexto do extrator: ${(resultado as any).error.message}`);
    }
  }

  return {
    usuario,
    pastosCadastrados: (pastos.data ?? []).map((p: any) => ({ id: p.id, nome: p.nome, apelidos: p.apelidos ?? [] })),
    lotesAtivos: (lotes.data ?? []).map((l: any) => ({
      id: l.id,
      nome: l.nome,
      categoria: l.categoria,
      pastoAtual: l.pastos?.nome ?? null,
      cabecas: l.cabecas_atuais,
    })),
    maquinas: (maquinas.data ?? []).map((m: any) => ({ id: m.id, nome: m.nome, modelo: m.modelo })),
    vacinasPermitidas: (vacinas.data ?? []).map((v: any) => ({
      nome: v.nome,
      bloqueada: v.bloqueada,
      motivoBloqueio: v.motivo_bloqueio,
    })),
    insumos: (insumos.data ?? []).map((i: any) => ({ id: i.id, nome: i.insumo, unidade: i.unidade })),
  };
}
