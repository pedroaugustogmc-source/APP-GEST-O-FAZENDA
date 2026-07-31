import type { Centavos, Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: custo_cria_por_bezerro =
// (custo_manutencao_matrizes + custo_touros) / bezerros_desmamados.
export function custoCriaPorBezerro(
  custoManutencaoMatrizes: Centavos,
  custoTouros: Centavos,
  bezerrosDesmamados: number
): Indicador<Centavos> {
  if (bezerrosDesmamados <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhum bezerro desmamado no período",
    };
  }

  const valor = BigInt(Math.round(Number(custoManutencaoMatrizes + custoTouros) / bezerrosDesmamados));
  return { valor, n: bezerrosDesmamados, dataBase: null, qualidade: "firme" };
}
