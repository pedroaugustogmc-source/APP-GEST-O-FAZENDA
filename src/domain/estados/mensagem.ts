// Extensão .ts explícita — ver nota em estados/animal.ts (também roda na Edge Function Deno).
import { ErroTransicaoInvalida } from "./erro.ts";

// docs/01-dominio.md §11:
// mensagem: recebida → transcrita → extraida → (gravada | revisao | erro)
//                                   revisao → (gravada | descartada)
export type StatusMensagem =
  | "recebida"
  | "transcrita"
  | "extraida"
  | "gravada"
  | "revisao"
  | "erro"
  | "descartada";

export const TODOS_STATUS_MENSAGEM: StatusMensagem[] = [
  "recebida",
  "transcrita",
  "extraida",
  "gravada",
  "revisao",
  "erro",
  "descartada",
];

const TRANSICOES_VALIDAS: Record<StatusMensagem, StatusMensagem[]> = {
  // recebida → erro: esgotadas as tentativas de transcrição (§33).
  recebida: ["transcrita", "erro"],
  // transcrita → erro: esgotadas as tentativas de extração (§33).
  transcrita: ["extraida", "erro"],
  extraida: ["gravada", "revisao", "erro"],
  revisao: ["gravada", "descartada"],
  // gravada é terminal e imutável (§11): correção gera nova mensagem de estorno, nunca reabre esta.
  gravada: [],
  erro: [],
  descartada: [],
};

export function transicaoValidaMensagem(atual: StatusMensagem, alvo: StatusMensagem): boolean {
  return atual !== alvo && TRANSICOES_VALIDAS[atual].includes(alvo);
}

export function transicionarStatusMensagem(
  atual: StatusMensagem,
  alvo: StatusMensagem
): StatusMensagem {
  if (!transicaoValidaMensagem(atual, alvo)) {
    throw new ErroTransicaoInvalida("mensagem", atual, alvo);
  }
  return alvo;
}

/** Regra dura do §11: mensagem gravada é imutável — nunca pode ser reaberta. */
export function mensagemEhImutavel(status: StatusMensagem): boolean {
  return status === "gravada";
}
