import type { SupabaseClient } from "@supabase/supabase-js";

// Fase 6c — os workers rodam com service_role (criarClienteServico), que
// ignora RLS por completo: nenhuma policy de propriedade_id os protege
// sozinha. Este módulo monta, por fazenda, o contexto que cada worker
// precisa pra filtrar manualmente as tabelas que só têm propriedade_id
// derivado (via registrado_por/usuario_id -> usuarios_acesso, ou via
// maquina_id -> maquinas) — as que já têm a coluna direta (pastos, lotes,
// maquinas, financeiro, estoque_insumos, checklist_itens, usuarios_acesso,
// alertas, tarefas, relatorios) se filtram com um `.eq("propriedade_id", ...)`
// simples, sem precisar deste contexto.
export interface Propriedade {
  id: string;
  nome: string;
}

export interface ContextoFazenda {
  propriedadeId: string;
  propriedadeNome: string;
  /** ids de usuarios_acesso desta fazenda — filtra registrado_por/usuario_id. */
  idsUsuarios: string[];
  /** ids de maquinas desta fazenda — filtra maquina_id (manutencoes/horas_maquina/plano_manutencao). */
  idsMaquinas: string[];
}

export async function listarPropriedades(supabase: SupabaseClient): Promise<Propriedade[]> {
  const { data } = await supabase.from("propriedade").select("id, nome").order("criado_em");
  return (data ?? []) as Propriedade[];
}

export async function construirContextoFazenda(supabase: SupabaseClient, propriedade: Propriedade): Promise<ContextoFazenda> {
  const [{ data: usuarios }, { data: maquinas }] = await Promise.all([
    supabase.from("usuarios_acesso").select("id").eq("propriedade_id", propriedade.id),
    supabase.from("maquinas").select("id").eq("propriedade_id", propriedade.id),
  ]);

  return {
    propriedadeId: propriedade.id,
    propriedadeNome: propriedade.nome,
    idsUsuarios: ((usuarios ?? []) as Array<{ id: string }>).map((u) => u.id),
    idsMaquinas: ((maquinas ?? []) as Array<{ id: string }>).map((m) => m.id),
  };
}
