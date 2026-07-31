import type { Parametros } from "../tipos/index.ts";

export type Decisao = "comprar" | "vender" | "segurar";

export interface ResultadoDecisaoMercado {
  decisao: Decisao;
  justificativa: string;
}

// Não está no Anexo B. docs/03-modulos.md M6: "Decisão semanal sugerida:
// COMPRAR / VENDER / SEGURAR, com justificativa curta e os números que a
// sustentam" — cruzada com o ponto de equilíbrio da fazenda (M5). Leitura
// registrada em ESTADO.md: VENDER quando o preço de mercado está bem acima
// do ponto de equilíbrio (boa margem pra vender o que já está pronto);
// COMPRAR quando está bem abaixo (bezerro/garrote barato em relação ao
// custo de produção da própria fazenda — oportunidade de repor lote pra
// recria); dentro da faixa, SEGURAR — sem vantagem clara de nenhum dos
// dois lados. Não é aconselhamento financeiro, é leitura mecânica de um
// número contra outro (mesma natureza do semáforo de distanciaBreakeven).
export function decisaoMercado(distanciaBreakevenPct: number, p: Parametros): ResultadoDecisaoMercado {
  const margem = p.MARGEM_DECISAO_MERCADO_PCT ?? 0.1;
  const pct = (distanciaBreakevenPct * 100).toFixed(1);

  if (distanciaBreakevenPct >= margem) {
    return {
      decisao: "vender",
      justificativa: `Preço de mercado ${pct}% acima do ponto de equilíbrio da fazenda — margem boa para vender agora.`,
    };
  }

  if (distanciaBreakevenPct <= -margem) {
    return {
      decisao: "comprar",
      justificativa: `Preço de mercado ${pct}% abaixo do ponto de equilíbrio da fazenda — animal barato em relação ao seu custo de produção, considere comprar para recria.`,
    };
  }

  return {
    decisao: "segurar",
    justificativa: `Preço de mercado a ${pct}% do ponto de equilíbrio da fazenda — dentro da faixa de indecisão (±${(margem * 100).toFixed(0)}%), sem vantagem clara para comprar nem vender.`,
  };
}
