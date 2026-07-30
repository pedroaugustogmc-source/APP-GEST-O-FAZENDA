import { bancoOffline, type TabelaSincronizavel } from "./db";
import { sincronizar } from "./sincronizar";

/**
 * Toda escrita das telas de cadastro passa por aqui, nunca por fetch direto
 * (docs/05-arquitetura.md §36 item 1). A UI é otimista: grava local primeiro,
 * tenta sincronizar em seguida, e não bloqueia se falhar — o registro fica
 * na fila até a próxima tentativa.
 */
export async function enfileirarOperacao(
  tabela: TabelaSincronizavel,
  metodo: "POST" | "PATCH",
  payload: Record<string, unknown>
): Promise<string> {
  const clientUuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await bancoOffline.operacoesPendentes.add({
    clientUuid,
    tabela,
    metodo,
    payload: { ...payload, client_uuid: clientUuid },
    criadoEm: new Date().toISOString(),
    tentativas: 0,
  });

  // Tenta sincronizar imediatamente; se não houver rede, fica na fila mesmo.
  void sincronizar();

  return clientUuid;
}

export async function contarPendentes(): Promise<number> {
  return bancoOffline.operacoesPendentes.count();
}
