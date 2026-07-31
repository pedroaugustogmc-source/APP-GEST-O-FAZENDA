import { describe, it, expect } from "vitest";
import { relacaoTroca } from "./relacaoTroca";

describe("relacaoTroca", () => {
  it("boi gordo 8x mais caro que o bezerro dá relação 8", () => {
    expect(relacaoTroca(400000n, 50000n)).toBeCloseTo(8, 6);
  });

  it("preço de bezerro zero ou negativo lança erro em vez de dividir por zero", () => {
    expect(() => relacaoTroca(400000n, 0n)).toThrow();
    expect(() => relacaoTroca(400000n, -100n)).toThrow();
  });
});
