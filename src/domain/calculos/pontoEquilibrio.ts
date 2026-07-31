import type { Arrobas, Centavos, Indicador } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// ponto_equilibrio_arroba = custo_total_producao_acumulado / arrobas_produzidas_periodo
// "Essa é a métrica mais importante da fazenda" (docs/03-modulos.md M5).
export function pontoEquilibrio(custoAcumulado: Centavos, arrobasVenda: Arrobas): Indicador<Centavos> {
  if (arrobasVenda <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma arroba disponível para venda no período",
    };
  }

  const valor = BigInt(Math.round(Number(custoAcumulado) / arrobasVenda));
  return { valor, n: 1, dataBase: null, qualidade: "firme" };
}
