import type { Arrobas, Centavos } from "../tipos/index.ts";

// Não está no Anexo B — mas "receita_projetada" aparece no §9 e no Anexo A
// (arrobas_totais × preço/@). Sem esta função, essa multiplicação ficaria
// solta num componente, fora de domain/ e sem teste — exatamente o que
// CLAUDE.md regra 5 proíbe. Arrobas em precisão plena (Anexo G); só o
// resultado final em centavos é arredondado.
export function receitaProjetadaVenda(arrobas: Arrobas, precoPorArroba: Centavos): Centavos {
  return BigInt(Math.round(arrobas * Number(precoPorArroba)));
}
