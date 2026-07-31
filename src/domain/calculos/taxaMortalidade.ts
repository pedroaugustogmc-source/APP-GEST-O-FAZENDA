import type { Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: taxa_mortalidade_pct = mortes_periodo / cabecas_medias_periodo.
export function taxaMortalidade(mortesPeriodo: number, cabecasMediasPeriodo: number): Indicador<number> {
  if (cabecasMediasPeriodo <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "nenhuma cabeça no período",
    };
  }
  return { valor: mortesPeriodo / cabecasMediasPeriodo, n: cabecasMediasPeriodo, dataBase: null, qualidade: "firme" };
}
