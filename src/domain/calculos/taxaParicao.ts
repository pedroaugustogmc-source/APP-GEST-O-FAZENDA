import type { Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: taxa_parição_pct = partos / matrizes_expostas.
export function taxaParicao(partos: number, matrizesExpostas: number): Indicador<number> {
  if (matrizesExpostas <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma matriz exposta no período",
    };
  }
  return { valor: partos / matrizesExpostas, n: matrizesExpostas, dataBase: null, qualidade: "firme" };
}
