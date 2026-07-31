import type { Centavos, Indicador } from "../tipos/index.ts";

// Não está no Anexo B. docs/03-modulos.md M7, "adições extras": "custo
// acumulado por máquina e custo por hora trabalhada" — mesmo formato de
// custoPorArroba (F4), trocando arrobas por horas de uso.
export function custoPorHora(custoAcumulado: Centavos, horas: number): Indicador<Centavos> {
  if (horas <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma hora de uso registrada no período",
    };
  }

  const valor = BigInt(Math.round(Number(custoAcumulado) / horas));
  return { valor, n: 1, dataBase: null, qualidade: "firme" };
}
