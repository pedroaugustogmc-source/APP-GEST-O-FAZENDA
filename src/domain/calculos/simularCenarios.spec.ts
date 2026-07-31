import { describe, it, expect } from "vitest";
import { simularCenarios, type EntradaCenario } from "./simularCenarios";
import type { Parametros } from "../tipos/index.ts";

const P = {
  RENDIMENTO_CARCACA: 0.52,
  KG_POR_ARROBA: 15,
  VARIACAO_PRECO_CENARIO_PCT: 0.1,
  FATOR_GMD_SECA: 0.6,
} as unknown as Parametros;

function entradaBase(overrides: Partial<EntradaCenario> = {}): EntradaCenario {
  return {
    pesoAtual: 300,
    gmdBase: 0.6,
    precoAtualPorArroba: 24500n,
    custoDiario: 1000n,
    caixaInicial: 0n,
    pesoAlvoVenda: 420,
    diasNaEstiagem: new Array(90).fill(false),
    ...overrides,
  };
}

describe("simularCenarios", () => {
  it("gera exatamente 3 cenários com preços diferentes (alta > estável > queda)", () => {
    const resultado = simularCenarios(entradaBase(), P);
    expect(resultado).toHaveLength(3);
    const [alta, estavel, queda] = resultado;
    expect(alta!.precoPorArroba).toBeGreaterThan(estavel!.precoPorArroba);
    expect(estavel!.precoPorArroba).toBeGreaterThan(queda!.precoPorArroba);
  });

  it("cada cenário devolve exatamente 90 pontos de fluxo de caixa", () => {
    const resultado = simularCenarios(entradaBase(), P);
    for (const cenario of resultado) {
      expect(cenario.fluxoCaixaDiario).toHaveLength(90);
    }
  });

  it("atinge o peso-alvo dentro de 90 dias com GMD suficiente e sem seca", () => {
    // 300 -> 420 = 120 kg / 0,6 kg/dia = 200 dias... não atinge em 90 dias com esse GMD.
    // Ajusta pra um caso que realmente atinge: GMD mais alto.
    const resultado = simularCenarios(entradaBase({ gmdBase: 1.5 }), P);
    const estavel = resultado.find((c) => c.cenario === "estavel")!;
    expect(estavel.atingiuPesoAlvo).toBe(true);
    expect(estavel.diaVenda).not.toBeNull();
    expect(estavel.receitaProjetada).toBeGreaterThan(0n);
  });

  it("seca em todo o período atrasa (ou impede) atingir o peso-alvo comparado a sem seca", () => {
    const semSeca = simularCenarios(entradaBase({ gmdBase: 1.5 }), P).find((c) => c.cenario === "estavel")!;
    const comSeca = simularCenarios(
      entradaBase({ gmdBase: 1.5, diasNaEstiagem: new Array(90).fill(true) }),
      P
    ).find((c) => c.cenario === "estavel")!;

    expect(semSeca.atingiuPesoAlvo).toBe(true);
    // Com seca o GMD efetivo cai (fator 0,6) — ou demora mais, ou não atinge no período.
    if (comSeca.atingiuPesoAlvo) {
      expect(comSeca.diaVenda!).toBeGreaterThan(semSeca.diaVenda!);
    } else {
      expect(comSeca.pesoProjetadoKg).toBeLessThan(420);
    }
  });

  it("não atinge o peso-alvo em 90 dias: ainda projeta receita não realizada, não zero", () => {
    const resultado = simularCenarios(entradaBase({ gmdBase: 0.1 }), P);
    const estavel = resultado.find((c) => c.cenario === "estavel")!;
    expect(estavel.atingiuPesoAlvo).toBe(false);
    expect(estavel.diaVenda).toBeNull();
    expect(estavel.receitaProjetada).toBeGreaterThan(0n);
  });

  it("caixaMinimo é de fato o menor valor da série de fluxo de caixa", () => {
    const resultado = simularCenarios(entradaBase({ gmdBase: 1.5, caixaInicial: 100000n }), P);
    for (const cenario of resultado) {
      const minimoReal = cenario.fluxoCaixaDiario.reduce((min, v) => (v < min ? v : min), cenario.fluxoCaixaDiario[0]!);
      expect(cenario.caixaMinimo).toBe(minimoReal);
    }
  });
});
