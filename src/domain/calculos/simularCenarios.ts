import type { Arrobas, Centavos, Kg, Parametros } from "../tipos/index.ts";
import { arrobasCarcaca } from "./arrobasCarcaca.ts";
import { receitaProjetadaVenda } from "./receitaProjetadaVenda.ts";
import { margemProjetada } from "./margemProjetada.ts";

// Não está no Anexo B. docs/03-modulos.md M5 pede "3 cenários (Code
// Execution)" — decisão registrada em ESTADO.md: implemento como função
// pura e testada em vez de chamar a ferramenta de execução de código da
// Claude API, porque a projeção é uma fórmula fechada (CLAUDE.md regra 5).
//
// anti-padrão nº 12 (docs/06-qualidade.md): "ignorar a seca... projeção sem
// sensibilidade à estiagem sempre erra pro otimista" — por isso a seca não é
// um 4º cenário, é um fator que reduz o GMD DENTRO de cada um dos 3
// cenários de preço, nos dias marcados como estiagem.
export type CenarioPreco = "alta" | "estavel" | "queda";

export interface EntradaCenario {
  pesoAtual: Kg;
  gmdBase: number; // kg/dia, sem desconto de seca
  precoAtualPorArroba: Centavos;
  custoDiario: Centavos; // custo médio diário do lote (rateado)
  caixaInicial: Centavos;
  pesoAlvoVenda: Kg;
  /** Exatamente 90 posições — true nos dias dentro do período de estiagem. */
  diasNaEstiagem: boolean[];
}

export interface ResultadoCenario {
  cenario: CenarioPreco;
  precoPorArroba: Centavos;
  atingiuPesoAlvo: boolean;
  diaVenda: number | null; // índice 0–89
  pesoProjetadoKg: Kg;
  arrobasProjetadas: Arrobas;
  receitaProjetada: Centavos;
  margemProjetada: Centavos;
  caixaFinal: Centavos;
  caixaMinimo: Centavos;
  fluxoCaixaDiario: Centavos[];
}

export function simularCenarios(entrada: EntradaCenario, p: Parametros): ResultadoCenario[] {
  return (["alta", "estavel", "queda"] as CenarioPreco[]).map((cenario) => simularUmCenario(cenario, entrada, p));
}

function simularUmCenario(cenario: CenarioPreco, entrada: EntradaCenario, p: Parametros): ResultadoCenario {
  const variacao = p.VARIACAO_PRECO_CENARIO_PCT ?? 0.1;
  const multiplicador = cenario === "alta" ? 1 + variacao : cenario === "queda" ? 1 - variacao : 1;
  const precoPorArroba = BigInt(Math.round(Number(entrada.precoAtualPorArroba) * multiplicador));
  const fatorSeca = p.FATOR_GMD_SECA ?? 0.6;

  let peso = entrada.pesoAtual;
  let caixa = entrada.caixaInicial;
  let caixaMinimo = caixa;
  let diaVenda: number | null = null;
  let receita: Centavos = 0n;
  const fluxo: Centavos[] = [];

  for (let dia = 0; dia < entrada.diasNaEstiagem.length; dia += 1) {
    if (diaVenda === null) {
      const gmdDoDia = entrada.diasNaEstiagem[dia] ? entrada.gmdBase * fatorSeca : entrada.gmdBase;
      peso += gmdDoDia;
      caixa -= entrada.custoDiario;

      if (peso >= entrada.pesoAlvoVenda) {
        diaVenda = dia;
        const arrobas = arrobasCarcaca(peso, p);
        receita = receitaProjetadaVenda(arrobas, precoPorArroba);
        caixa += receita;
      }
    }

    if (caixa < caixaMinimo) caixaMinimo = caixa;
    fluxo.push(caixa);
  }

  const atingiuPesoAlvo = diaVenda !== null;
  const diasDecorridos = atingiuPesoAlvo ? diaVenda! + 1 : entrada.diasNaEstiagem.length;
  const custoAcumulado = entrada.custoDiario * BigInt(diasDecorridos);
  const arrobasProjetadas = arrobasCarcaca(peso, p);
  const receitaFinal = atingiuPesoAlvo ? receita : receitaProjetadaVenda(arrobasProjetadas, precoPorArroba);

  return {
    cenario,
    precoPorArroba,
    atingiuPesoAlvo,
    diaVenda,
    pesoProjetadoKg: peso,
    arrobasProjetadas,
    receitaProjetada: receitaFinal,
    margemProjetada: margemProjetada(receitaFinal, custoAcumulado),
    caixaFinal: caixa,
    caixaMinimo,
    fluxoCaixaDiario: fluxo,
  };
}
