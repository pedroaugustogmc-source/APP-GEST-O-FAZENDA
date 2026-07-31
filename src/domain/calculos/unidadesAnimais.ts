import type { Kg, Parametros } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// UA = peso_vivo_total_kg / UA_KG (default 450).
export function unidadesAnimais(pesoVivoTotal: Kg, p: Parametros): number {
  return pesoVivoTotal / p.UA_KG;
}
