import { describe, it, expect } from "vitest";
import { gmd } from "./gmd";

describe("gmd", () => {
  it("calcula o GMD do gabarito do Anexo A (220,0 → 265,0 kg em 90 dias)", () => {
    const resultado = gmd(220.0, 265.0, 90);
    expect(resultado.valor).toBeCloseTo(0.5, 10);
    expect(resultado.qualidade).toBe("firme");
    expect(resultado.n).toBe(2);
  });

  it("dias <= 0 retorna sem_dado, nunca divide por zero", () => {
    const resultado = gmd(220.0, 265.0, 0);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
    expect(resultado.motivo).toBeDefined();
  });

  it("dias negativo (pesagens fora de ordem) retorna sem_dado", () => {
    const resultado = gmd(220.0, 265.0, -5);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
  });

  it("perda de peso gera GMD negativo, sem mascarar o sinal", () => {
    const resultado = gmd(265.0, 240.0, 30);
    expect(resultado.valor).toBeCloseTo(-25 / 30, 10);
    expect(resultado.qualidade).toBe("firme");
  });

  it("peso igual gera GMD zero", () => {
    const resultado = gmd(220.0, 220.0, 30);
    expect(resultado.valor).toBe(0);
  });
});
