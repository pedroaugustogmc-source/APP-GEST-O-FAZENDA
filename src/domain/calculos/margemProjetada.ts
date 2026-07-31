import type { Centavos } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// margem_projetada_lote = receita_projetada_venda - custo_acumulado_lote
// Subtração exata de bigint — nenhum arredondamento aqui (os dois lados já
// chegam em centavos inteiros).
export function margemProjetada(receita: Centavos, custo: Centavos): Centavos {
  return receita - custo;
}
