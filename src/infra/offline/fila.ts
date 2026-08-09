import { bancoOffline, type TabelaSincronizavel } from "./db";
import { sincronizar } from "./sincronizar";

/** Mesmo formato do client_uuid usado pra deduplicar reenvio no servidor
 * (docs/05-arquitetura.md §36 item 4) — função própria pra quem precisa
 * gerar um client_uuid ANTES de enfileirar (ex.: pastos/formulario.tsx,
 * pra reaproveitar o mesmo valor numa 2ª operação sobre a mesma linha). */
export function gerarClientUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Toda escrita das telas de cadastro passa por aqui, nunca por fetch direto
 * (docs/05-arquitetura.md §36 item 1). A UI é otimista: grava local primeiro,
 * tenta sincronizar em seguida, e não bloqueia se falhar — o registro fica
 * na fila até a próxima tentativa.
 */
export async function enfileirarOperacao(
  tabela: TabelaSincronizavel,
  metodo: "POST" | "PATCH",
  payload: Record<string, unknown>,
  // Opcional: quem chama pode fixar o client_uuid pra conseguir mandar uma
  // 2ª operação (ex.: um POST de upsert seguinte) que atualiza a MESMA
  // linha, sem precisar saber o id que o servidor ainda não gerou. Ver
  // pastos/formulario.tsx — cadastro entra na fila na hora, foto (que pode
  // demorar ou falhar na rede) chega depois, sem travar o primeiro.
  clientUuidFixo?: string
): Promise<string> {
  const clientUuid = clientUuidFixo ?? gerarClientUuid();

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

/** Usado por quem precisa confirmar que uma operação já saiu da fila (ex.:
 * só apagar um arquivo antigo do Storage depois que a troca sincronizou de
 * verdade) — mantém o acesso à tabela do Dexie dentro deste módulo, em vez
 * de cada tela importar bancoOffline direto. */
export async function estaPendente(clientUuid: string): Promise<boolean> {
  const quantidade = await bancoOffline.operacoesPendentes.where("clientUuid").equals(clientUuid).count();
  return quantidade > 0;
}
