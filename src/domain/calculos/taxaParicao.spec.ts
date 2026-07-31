import { describe, it, expect } from "vitest";
import { taxaParicao } from "./taxaParicao";

describe("taxaParicao", () => {
  it("calcula a fração de partos sobre matrizes expostas", () => {
    const resultado = taxaParicao(40, 60);
    expect(resultado.valor).toBeCloseTo(0.6667, 4);
  });

  it("nenhuma matriz exposta retorna sem_dado", () => {
    expect(taxaParicao(0, 0).qualidade).toBe("sem_dado");
  });
});
