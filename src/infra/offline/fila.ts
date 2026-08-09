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

export interface OpcoesEnfileirar {
  // Fixa o client_uuid em vez de gerar um novo — pra mandar uma 2ª operação
  // (ex.: um POST de upsert seguinte) que atualiza a MESMA linha, sem
  // precisar saber o id que o servidor ainda não gerou. Ver
  // pastos/formulario.tsx — cadastro entra na fila na hora, foto (que pode
  // demorar ou falhar na rede) chega depois, sem travar o primeiro.
  clientUuidFixo?: string;
  // Rodado só depois que ESTA operação sincronizar com sucesso — seja na
  // tentativa imediata (void sincronizar() logo abaixo) ou numa retentativa
  // de fundo minutos depois (sincronizar.ts). Resolve o problema de "apaguei
  // o arquivo antigo cedo demais, antes de confirmar que o novo salvou de
  // verdade" sem a tela precisar ficar checando se a operação ainda está
  // pendente por conta própria.
  limpezaAoConcluir?: { bucket: string; caminho: string };
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
  opcoes?: OpcoesEnfileirar
): Promise<string> {
  const clientUuid = opcoes?.clientUuidFixo ?? gerarClientUuid();

  await bancoOffline.operacoesPendentes.add({
    clientUuid,
    tabela,
    metodo,
    payload: { ...payload, client_uuid: clientUuid },
    criadoEm: new Date().toISOString(),
    tentativas: 0,
    ...(opcoes?.limpezaAoConcluir ? { limpezaAoConcluir: opcoes.limpezaAoConcluir } : {}),
  });

  // Tenta sincronizar imediatamente; se não houver rede, fica na fila mesmo.
  void sincronizar();

  return clientUuid;
}

export async function contarPendentes(): Promise<number> {
  return bancoOffline.operacoesPendentes.count();
}
