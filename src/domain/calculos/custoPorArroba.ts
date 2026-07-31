import type { Arrobas, Centavos, Indicador } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// custo_por_arroba = custo_total_acumulado_lote / arrobas_produzidas_periodo
//
// docs/08-anexos.md Anexo G: "calcule com precisão plena; arredonde só na
// exibição" — arrobas chega em ponto flutuante de precisão plena; só o
// resultado final em centavos é arredondado (Centavos é bigint, não existe
// centavo fracionário).
export function custoPorArroba(custo: Centavos, arrobas: Arrobas): Indicador<Centavos> {
  if (arrobas <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma arroba produzida no período",
    };
  }

  const valor = BigInt(Math.round(Number(custo) / arrobas));
  return { valor, n: 1, dataBase: null, qualidade: "firme" };
}
