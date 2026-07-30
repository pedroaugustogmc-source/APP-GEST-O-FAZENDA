import { bancoOffline } from "./db";

const MAX_TENTATIVAS = 5;
let sincronizando = false;

/**
 * Envia a fila em ordem cronológica, um registro por vez
 * (docs/05-arquitetura.md §36 item 3). O endpoint é idempotente por
 * client_uuid — reenviar não duplica (item 4).
 */
export async function sincronizar(): Promise<void> {
  if (sincronizando) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  sincronizando = true;
  try {
    const pendentes = await bancoOffline.operacoesPendentes.orderBy("criadoEm").toArray();

    for (const operacao of pendentes) {
      try {
        const resposta = await fetch(`/api/${operacao.tabela}`, {
          method: operacao.metodo,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(operacao.payload),
        });

        if (!resposta.ok) {
          throw new Error(`HTTP ${resposta.status}`);
        }

        if (operacao.id !== undefined) {
          await bancoOffline.operacoesPendentes.delete(operacao.id);
        }
      } catch (erro) {
        if (operacao.id === undefined) continue;

        const tentativas = operacao.tentativas + 1;
        if (tentativas >= MAX_TENTATIVAS) {
          // Não descarta: fica marcada para o admin ver na indicação de
          // sincronização pendente e decidir (nunca some em silêncio).
          await bancoOffline.operacoesPendentes.update(operacao.id, {
            tentativas,
            ultimoErro: erro instanceof Error ? erro.message : String(erro),
          });
        } else {
          await bancoOffline.operacoesPendentes.update(operacao.id, { tentativas });
        }
        // Para no primeiro erro para preservar a ordem cronológica.
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
}

export function registrarSincronizacaoAutomatica(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => void sincronizar());
  window.setInterval(() => void sincronizar(), 30_000);
  void sincronizar();
}
