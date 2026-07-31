import type { Centavos, Parametros } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// custo_efetivo_cotacao = preco_a_prazo / (1 + TAXA_OPORTUNIDADE_MES)^(prazo_dias/30)
// Anexo A.4: desconto à vista entra ANTES do deságio do prazo (prazo=0 zera
// o expoente, sobra só o desconto).
export function custoEfetivoCotacao(
  totalCentavos: Centavos,
  prazoDias: number,
  descontoAvistaPct: number,
  p: Parametros
): Centavos {
  const totalComDesconto = Number(totalCentavos) * (1 - descontoAvistaPct);
  const fatorDesagio = Math.pow(1 + p.TAXA_OPORTUNIDADE_MES, prazoDias / 30);
  return BigInt(Math.round(totalComDesconto / fatorDesagio));
}
