import type { Indicador, Kg } from "../tipos/index.ts";

// Não está no Anexo B (assinatura fixa) — acrescentada porque M3 exige "peso
// ao desmame (real e ajustado 205 dias)" e docs/01-dominio.md §9 já dá a
// fórmula: peso_ajustado_205 = peso_nascimento + ((peso_desmame - peso_nascimento) / idade_dias) * 205
export function pesoAjustado205(pesoNascimento: Kg, pesoDesmame: Kg, idadeDias: number): Indicador<Kg> {
  if (idadeDias <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "idade em dias inválida (<= 0) para ajustar o peso ao desmame",
    };
  }

  const valor = pesoNascimento + ((pesoDesmame - pesoNascimento) / idadeDias) * 205;

  return { valor, n: 1, dataBase: null, qualidade: "firme" };
}
