import { ErroTransicaoInvalida } from "./erro";

// docs/01-dominio.md §11: animal: ativo → (vendido | morto | descartado)
export type StatusAnimal = "ativo" | "vendido" | "morto" | "descartado";

export const TODOS_STATUS_ANIMAL: StatusAnimal[] = ["ativo", "vendido", "morto", "descartado"];

const TRANSICOES_VALIDAS: Record<StatusAnimal, StatusAnimal[]> = {
  ativo: ["vendido", "morto", "descartado"],
  vendido: [],
  morto: [],
  descartado: [],
};

export function transicaoValidaAnimal(atual: StatusAnimal, alvo: StatusAnimal): boolean {
  return atual !== alvo && TRANSICOES_VALIDAS[atual].includes(alvo);
}

export function transicionarStatusAnimal(atual: StatusAnimal, alvo: StatusAnimal): StatusAnimal {
  if (!transicaoValidaAnimal(atual, alvo)) {
    throw new ErroTransicaoInvalida("animal", atual, alvo);
  }
  return alvo;
}

/**
 * Regra dura do §11: animal morto/vendido não pode receber evento (pesagem,
 * vacina, movimentação) com data posterior à data de saída.
 */
export function podeReceberEventoEm(
  status: StatusAnimal,
  dataSaida: string | null,
  dataEvento: string
): boolean {
  if (status === "ativo") return true;
  if (!dataSaida) return true;
  return dataEvento <= dataSaida;
}
