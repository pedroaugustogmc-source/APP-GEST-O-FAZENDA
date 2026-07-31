import type { Centavos } from "../tipos/index.ts";

// Não está no Anexo B. docs/03-modulos.md M6: "Relação de troca (quantos
// bezerros equivalem a um boi gordo) — indicador clássico de decisão em
// cria-recria." Preço de cabeça inteira dos dois lados (não R$/@) — quem
// chama já resolveu a conversão de arroba pra cabeça, se precisar (ex.:
// preço do boi gordo vem de arroba_boi × arrobas de um peso de referência).
export function relacaoTroca(precoBoiGordoPorCabeca: Centavos, precoBezerroPorCabeca: Centavos): number {
  if (precoBezerroPorCabeca <= 0n) {
    throw new Error("Preço do bezerro inválido (<= 0) — não há base para calcular a relação de troca.");
  }
  return Number(precoBoiGordoPorCabeca) / Number(precoBezerroPorCabeca);
}
