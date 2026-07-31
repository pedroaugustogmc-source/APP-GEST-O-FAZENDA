import type { Arrobas, Kg, Parametros } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// arroba é carcaça, nunca peso vivo — sempre aplicar RENDIMENTO_CARCACA
// (anti-padrão nº 4 de docs/06-qualidade.md).
export function arrobasCarcaca(pesoVivo: Kg, p: Parametros): Arrobas {
  return (pesoVivo * p.RENDIMENTO_CARCACA) / p.KG_POR_ARROBA;
}
