import type { Centavos } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// distancia_breakeven_pct = (preco_mercado_arroba - ponto_equilibrio_arroba) / ponto_equilibrio_arroba
export function distanciaBreakeven(precoMercado: Centavos, pe: Centavos): number {
  if (pe <= 0n) {
    throw new Error("Ponto de equilíbrio inválido (<= 0) — não há base para calcular a distância.");
  }
  return Number(precoMercado - pe) / Number(pe);
}
