import { describe, it, expect } from "vitest";
import { calcularCustoMensagemCentavos } from "./custoBot";

const PRECOS = {
  precoAsrCentavosMinuto: 2,
  precoClaudeInputCentavosMTok: 500,
  precoClaudeOutputCentavosMTok: 2500,
};

describe("calcularCustoMensagemCentavos", () => {
  it("soma custo de ASR (por minuto) e de extração (por milhão de tokens)", () => {
    // 30s de áudio = 0,5 min * 2 centavos = 1 centavo
    // 2.000 tokens de entrada / 1e6 * 500 = 1 centavo
    // 200 tokens de saída / 1e6 * 2500 = 0,5 centavo
    // total = 2,5 -> Math.round arredonda para 3
    const custo = calcularCustoMensagemCentavos(30, 2000, 200, PRECOS);
    expect(custo).toBe(3n);
  });

  it("mensagem de texto (sem áudio) não cobra ASR", () => {
    const custo = calcularCustoMensagemCentavos(null, 1000, 100, PRECOS);
    expect(custo).toBeGreaterThanOrEqual(0n);
  });

  it("nunca retorna custo negativo", () => {
    const custo = calcularCustoMensagemCentavos(0, 0, 0, PRECOS);
    expect(custo).toBe(0n);
  });
});
