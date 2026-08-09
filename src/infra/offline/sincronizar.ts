import { bancoOffline } from "./db";

const MAX_TENTATIVAS = 5;
let promessaEmAndamento: Promise<void> | null = null;

/**
 * Envia a fila em ordem cronológica, um registro por vez
 * (docs/05-arquitetura.md §36 item 3). O endpoint é idempotente por
 * client_uuid — reenviar não duplica (item 4).
 *
 * Chamada concorrente devolve a MESMA promise em andamento, não uma nova
 * já resolvida — achado em revisão de código: a versão anterior usava um
 * booleano (`if (sincronizando) return`) que já ficava `true` de forma
 * síncrona, antes do primeiro `await` do corpo da função. Isso fazia
 * `await sincronizar()` chamado logo depois de `enfileirarOperacao`
 * (que já dispara `void sincronizar()` por conta própria) retornar na
 * hora, sem esperar a sincronização de verdade terminar — o bug que
 * `formulario.tsx`/`foto-pasto.tsx` tentavam corrigir continuava
 * acontecendo, só que escondido atrás de um `await` que não esperava nada.
 */
export function sincronizar(): Promise<void> {
  if (promessaEmAndamento) return promessaEmAndamento;
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();

  promessaEmAndamento = executarSincronizacao().finally(() => {
    promessaEmAndamento = null;
  });
  return promessaEmAndamento;
}

async function executarSincronizacao(): Promise<void> {
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
}

export function registrarSincronizacaoAutomatica(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => void sincronizar());
  window.setInterval(() => void sincronizar(), 30_000);
  void sincronizar();
}
