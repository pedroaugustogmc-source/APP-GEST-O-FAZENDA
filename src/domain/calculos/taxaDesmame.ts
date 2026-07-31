import type { Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: taxa_desmame_pct = bezerros_desmamados / matrizes_expostas.
// docs/03-modulos.md M3: "o indicador-rei da cria".
export function taxaDesmame(bezerrosDesmamados: number, matrizesExpostas: number): Indicador<number> {
  if (matrizesExpostas <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma matriz exposta no período",
    };
  }
  return { valor: bezerrosDesmamados / matrizesExpostas, n: matrizesExpostas, dataBase: null, qualidade: "firme" };
}
