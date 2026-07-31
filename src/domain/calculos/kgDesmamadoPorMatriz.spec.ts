import { describe, it, expect } from "vitest";
import { kgDesmamadoPorMatriz } from "./kgDesmamadoPorMatriz";

describe("kgDesmamadoPorMatriz", () => {
  it("divide o total desmamado pelas matrizes expostas, não pelas que desmamaram", () => {
    const resultado = kgDesmamadoPorMatriz([180, 175, 190], 60);
    expect(resultado.valor).toBeCloseTo((180 + 175 + 190) / 60, 4);
  });

  it("nenhuma matriz exposta retorna sem_dado", () => {
    expect(kgDesmamadoPorMatriz([], 0).qualidade).toBe("sem_dado");
  });

  it("nenhum bezerro desmamado ainda é kg zero por matriz, não sem_dado", () => {
    const resultado = kgDesmamadoPorMatriz([], 60);
    expect(resultado.valor).toBe(0);
    expect(resultado.qualidade).toBe("firme");
  });
});
