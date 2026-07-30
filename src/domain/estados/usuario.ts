import { ErroTransicaoInvalida } from "./erro";
import type { ISODate } from "../tipos";

// docs/01-dominio.md §8 / §M11: usuarios_acesso.status ativo → inativo.
// Não é uma das máquinas de estado do §11, mas a regra de negócio (não pode
// desligar quem já está desligado; desligamento sempre carrega a data) é
// exatamente o tipo de coisa que não pode virar um `if` solto num componente.
export type StatusUsuario = "ativo" | "inativo";

export interface DesligamentoUsuario {
  status: "inativo";
  dataDesligamento: ISODate;
}

export function desligarUsuario(statusAtual: StatusUsuario, hoje: ISODate): DesligamentoUsuario {
  if (statusAtual === "inativo") {
    throw new ErroTransicaoInvalida("usuario", statusAtual, "inativo");
  }
  return { status: "inativo", dataDesligamento: hoje };
}
