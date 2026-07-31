import { describe, it, expect } from "vitest";
import { pesoProjetado } from "./pesoProjetado";

describe("pesoProjetado", () => {
  it("projeta o peso pra frente pelo GMD médio", () => {
    expect(pesoProjetado(265, 0.5, 30)).toBe(280);
  });

  it("zero dias devolve o peso atual, sem projeção", () => {
    expect(pesoProjetado(265, 0.5, 0)).toBe(265);
  });

  it("GMD negativo projeta perda de peso", () => {
    expect(pesoProjetado(265, -0.2, 10)).toBe(263);
  });
});
