import { bancoOffline } from "./db";
import { criarClienteNavegador } from "../supabase/client";

const MAX_TENTATIVAS = 5;
// Limite de engenharia, não parâmetro de negócio (mesmo raciocínio da
// regra 3 do CLAUDE.md aplicado a limites técnicos, como o de tamanho de
// arquivo em fotoPasto.ts). Sem isso, um `fetch` numa conexão rural que
// trava sem cair (sem RST/FIN, comum em sinal fraco) ficaria pendurado
// indefinidamente — e agora que `sincronizar()` de fato espera terminar
// (achado em revisão de código), isso travaria a tela de quem chamou
// `await sincronizar()` pra sempre, exatamente o que a regra 8 do
// CLAUDE.md proíbe. Com o timeout, o pior caso vira "espera 15s e a
// operação volta pra fila", não "trava pra sempre".
const TIMEOUT_FETCH_MS = 15_000;
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
  // Um cliente só pro lote inteiro — criar um novo por item de limpeza
  // multiplicaria instâncias de GoTrueClient concorrentes à toa (mesmo
  // localStorage de sessão), achado em revisão de código.
  const supabaseNavegador = criarClienteNavegador();

  for (const operacao of pendentes) {
    try {
      const resposta = await fetch(`/api/${operacao.tabela}`, {
        method: operacao.metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operacao.payload),
        signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
      });

      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status}`);
      }

      if (operacao.id !== undefined) {
        await bancoOffline.operacoesPendentes.delete(operacao.id);
      }

      // Só roda depois de confirmar que ESTA operação saiu da fila com
      // sucesso — nunca antes (docs/infra/offline/db.ts: OperacaoPendente.
      // limpezaAoConcluir). Melhor esforço: se falhar, o arquivo antigo só
      // fica órfão no bucket, não quebra nada visível pro dono.
      if (operacao.limpezaAoConcluir) {
        const { bucket, caminho } = operacao.limpezaAoConcluir;
        void supabaseNavegador.storage.from(bucket).remove([caminho]);
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
