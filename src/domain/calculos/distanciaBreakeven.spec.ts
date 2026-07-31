import { describe, it, expect } from "vitest";
import { distanciaBreakeven } from "./distanciaBreakeven";

describe("distanciaBreakeven", () => {
  it("bate com o Anexo A: (24500 - 21628) / 21628 = +13,28%", () => {
    expect(distanciaBreakeven(24500n, 21628n)).toBeCloseTo(0.1328, 3);
  });

  it("preço de mercado abaixo do ponto de equilíbrio dá distância negativa (semáforo vermelho)", () => {
    expect(distanciaBreakeven(15000n, 21628n)).toBeLessThan(0);
  });

  it("ponto de equilíbrio zero ou negativo lança erro em vez de dividir por zero", () => {
    expect(() => distanciaBreakeven(24500n, 0n)).toThrow();
    expect(() => distanciaBreakeven(24500n, -100n)).toThrow();
  });
});
