import type { Kg } from "../tipos/index.ts";

// Não está no Anexo B — acrescentada para "projeção da data de venda por
// lote" (M3). docs/01-dominio.md §9: peso_projetado(d) = peso_atual +
// gmd_medio_lote * d. Quem decide se o GMD de entrada é confiável (olhando
// Indicador<T>.qualidade) é o chamador — esta função só faz a conta.
export function pesoProjetado(pesoAtual: Kg, gmdMedio: number, dias: number): Kg {
  return pesoAtual + gmdMedio * dias;
}
