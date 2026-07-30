import { ErroTransicaoInvalida } from "./erro";

// docs/01-dominio.md §11: lote: rascunho → ativo → (vendido | encerrado)
export type StatusLote = "rascunho" | "ativo" | "vendido" | "encerrado";

export const TODOS_STATUS_LOTE: StatusLote[] = ["rascunho", "ativo", "vendido", "encerrado"];

const TRANSICOES_VALIDAS: Record<StatusLote, StatusLote[]> = {
  rascunho: ["ativo"],
  ativo: ["vendido", "encerrado"],
  vendido: [],
  encerrado: [],
};

export function transicaoValidaLote(atual: StatusLote, alvo: StatusLote): boolean {
  return atual !== alvo && TRANSICOES_VALIDAS[atual].includes(alvo);
}

export function transicionarStatusLote(atual: StatusLote, alvo: StatusLote): StatusLote {
  if (!transicaoValidaLote(atual, alvo)) {
    throw new ErroTransicaoInvalida("lote", atual, alvo);
  }
  return alvo;
}
