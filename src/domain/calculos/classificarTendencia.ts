import type { Parametros } from "../tipos/index.ts";

export type Tendencia = "alta" | "baixa" | "estavel";

// Não está no Anexo B. docs/03-modulos.md M6 — tendência de mercado por
// categoria (boi, vaca, bezerro, bezerra): leitura mecânica da variação de
// 15 dias já registrada em precos_mercado (nunca uma previsão de preço
// futuro), classificada contra LIMIAR_TENDENCIA_ESTAVEL_PCT pra separar
// ruído de dia a dia de um movimento real de mercado.
export function classificarTendencia(variacaoQuinzenalPct: number, p: Parametros): Tendencia {
  const limiar = p.LIMIAR_TENDENCIA_ESTAVEL_PCT ?? 0.03;

  if (variacaoQuinzenalPct >= limiar) return "alta";
  if (variacaoQuinzenalPct <= -limiar) return "baixa";
  return "estavel";
}
