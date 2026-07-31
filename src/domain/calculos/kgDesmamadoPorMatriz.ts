import type { Indicador, Kg } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: kg_desmamado_por_matriz = Σ(peso_desmame) / matrizes_expostas.
export function kgDesmamadoPorMatriz(pesosDesmame: Kg[], matrizesExpostas: number): Indicador<number> {
  if (matrizesExpostas <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma matriz exposta no período",
    };
  }
  const soma = pesosDesmame.reduce((total, peso) => total + peso, 0);
  return { valor: soma / matrizesExpostas, n: pesosDesmame.length, dataBase: null, qualidade: "firme" };
}
