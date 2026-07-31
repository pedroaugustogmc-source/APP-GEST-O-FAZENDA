// deno-lint-ignore-file no-explicit-any
// docs/03-modulos.md §M1 passo 1 — "Porteiro": valida o remetente ANTES de
// qualquer download de mídia, transcrição ou chamada de API paga. Também
// resolve a ligação chat_id_externo ↔ usuarios_acesso.telefone, porque
// nenhuma plataforma de bot entrega telefone de graça (só via compartilhar
// contato) — ver nota em src/infra/messaging/tipos.ts.

export interface UsuarioAtivo {
  id: string;
  nome: string;
  papel: string;
  telefone: string;
}

export type ResultadoPorteiro =
  | { situacao: "reconhecido"; usuario: UsuarioAtivo }
  | { situacao: "vinculado"; usuario: UsuarioAtivo }
  | { situacao: "nao_reconhecido" }
  | { situacao: "precisa_contato" };

export async function passarPeloPorteiro(
  supabase: any,
  chatIdExterno: string,
  telefoneCompartilhado: string | null
): Promise<ResultadoPorteiro> {
  const { data: porChatId, error: erroChatId } = await supabase
    .from("usuarios_acesso")
    .select("id, nome, papel, telefone")
    .eq("chat_id_externo", chatIdExterno)
    .eq("plataforma", "telegram")
    .eq("status", "ativo")
    .maybeSingle();
  if (erroChatId) throw new Error(`Falha no porteiro (busca por chat_id): ${erroChatId.message}`);

  if (porChatId) {
    return { situacao: "reconhecido", usuario: porChatId as UsuarioAtivo };
  }

  if (!telefoneCompartilhado) {
    return { situacao: "precisa_contato" };
  }

  const { data: porTelefone, error: erroTelefone } = await supabase
    .from("usuarios_acesso")
    .select("id, nome, papel, telefone")
    .eq("telefone", telefoneCompartilhado)
    .eq("plataforma", "telegram")
    .eq("status", "ativo")
    .is("chat_id_externo", null)
    .maybeSingle();
  if (erroTelefone) throw new Error(`Falha no porteiro (busca por telefone): ${erroTelefone.message}`);

  if (!porTelefone) {
    return { situacao: "nao_reconhecido" };
  }

  const { error: erroVinculo } = await supabase
    .from("usuarios_acesso")
    .update({ chat_id_externo: chatIdExterno })
    .eq("id", porTelefone.id);
  if (erroVinculo) throw new Error(`Falha ao vincular chat_id_externo: ${erroVinculo.message}`);

  return { situacao: "vinculado", usuario: porTelefone as UsuarioAtivo };
}

/** docs/05-arquitetura.md §39 — rate limit por telefone, contra abuso/custo. */
export async function excedeuLimiteDeTaxa(supabase: any, usuarioId: string, limitePorMinuto: number): Promise<boolean> {
  const umMinutoAtras = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("mensagens_bot")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .gte("recebido_em", umMinutoAtras);
  if (error) throw new Error(`Falha ao checar rate limit: ${error.message}`);
  return (count ?? 0) >= limitePorMinuto;
}
