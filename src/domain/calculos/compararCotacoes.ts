import type { Centavos, Parametros } from "../tipos/index.ts";
import { custoEfetivoCotacao } from "./custoEfetivoCotacao.ts";

// Não está no Anexo B. docs/03-modulos.md M8, "negociação assistida": "o
// admin cola 3 orçamentos de fornecedor... o sistema calcula o custo
// efetivo considerando prazo de pagamento e custo de oportunidade do
// capital... exibe o vencedor real, não o mais barato aparente." Critério
// de aceite §41.12. custoEfetivoCotacao (Anexo B, F4) já faz a conta por
// linha — esta função só aplica em lote e marca a vencedora.
export interface EntradaCotacao {
  id: string;
  totalCentavos: Centavos;
  prazoDias: number;
  descontoAvistaPct: number;
}

export interface ResultadoCotacao {
  id: string;
  custoEfetivo: Centavos;
  vencedora: boolean;
}

export function compararCotacoes(cotacoes: EntradaCotacao[], p: Parametros): ResultadoCotacao[] {
  if (cotacoes.length === 0) return [];

  const comCusto = cotacoes.map((c) => ({
    id: c.id,
    custoEfetivo: custoEfetivoCotacao(c.totalCentavos, c.prazoDias, c.descontoAvistaPct, p),
  }));

  let indiceVencedora = 0;
  for (let i = 1; i < comCusto.length; i += 1) {
    if (comCusto[i]!.custoEfetivo < comCusto[indiceVencedora]!.custoEfetivo) indiceVencedora = i;
  }

  return comCusto.map((c, i) => ({ ...c, vencedora: i === indiceVencedora }));
}
