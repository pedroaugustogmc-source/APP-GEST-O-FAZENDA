import type { Kg, Parametros } from "../tipos/index.ts";
import { unidadesAnimais } from "./unidadesAnimais.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// lotacao_ua_ha = UA_total_no_pasto / pasto.tamanho_ha
export function lotacaoUaHa(pesoVivoTotal: Kg, ha: number, p: Parametros): number {
  if (ha <= 0) {
    throw new Error("Tamanho de pasto inválido (ha <= 0) — não deveria acontecer, o schema exige ha > 0.");
  }
  return unidadesAnimais(pesoVivoTotal, p) / ha;
}
