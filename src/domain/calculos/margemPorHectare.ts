import type { Centavos, Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: margem_por_hectare = margem_do_lote / area_ocupada_ha.
// Resultado em centavos/ha como número em ponto flutuante — hectare não é
// unidade inteira, forçar Centavos (bigint) aqui perderia a fração.
export function margemPorHectare(margemDoLote: Centavos, areaHa: number): Indicador<number> {
  if (areaHa <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "área ocupada desconhecida ou inválida",
    };
  }
  return { valor: Number(margemDoLote) / areaHa, n: 1, dataBase: null, qualidade: "firme" };
}
