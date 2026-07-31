// Extensão .ts explícita — ver nota em estados/animal.ts (também roda na Edge Function Deno).
import { ErroTransicaoInvalida } from "./erro.ts";

// docs/01-dominio.md §11: pasto: em_uso ⇄ descanso → (vedado | reforma) → descanso
export type StatusPasto = "em_uso" | "descanso" | "vedado" | "reforma";

export const TODOS_STATUS_PASTO: StatusPasto[] = ["em_uso", "descanso", "vedado", "reforma"];

const TRANSICOES_VALIDAS: Record<StatusPasto, StatusPasto[]> = {
  em_uso: ["descanso"],
  descanso: ["em_uso", "vedado", "reforma"],
  vedado: ["descanso"],
  reforma: ["descanso"],
};

export function transicaoValidaPasto(atual: StatusPasto, alvo: StatusPasto): boolean {
  return atual !== alvo && TRANSICOES_VALIDAS[atual].includes(alvo);
}

export function transicionarStatusPasto(atual: StatusPasto, alvo: StatusPasto): StatusPasto {
  if (!transicaoValidaPasto(atual, alvo)) {
    throw new ErroTransicaoInvalida("pasto", atual, alvo);
  }
  return alvo;
}

/** Regra dura do §11: pasto em reforma não aceita entrada de lote. */
export function aceitaEntradaDeLote(status: StatusPasto): boolean {
  return status !== "reforma";
}
