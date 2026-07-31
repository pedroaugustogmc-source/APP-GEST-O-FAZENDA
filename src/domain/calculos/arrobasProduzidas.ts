import type { Arrobas, Kg, Parametros } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// arrobas_produzidas = (kg_ganhos * RENDIMENTO_CARCACA) / KG_POR_ARROBA
export function arrobasProduzidas(ganhoKg: Kg, p: Parametros): Arrobas {
  return (ganhoKg * p.RENDIMENTO_CARCACA) / p.KG_POR_ARROBA;
}
