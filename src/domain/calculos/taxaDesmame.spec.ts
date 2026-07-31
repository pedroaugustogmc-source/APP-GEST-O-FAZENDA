import { describe, it, expect } from "vitest";
import { taxaDesmame } from "./taxaDesmame";

describe("taxaDesmame", () => {
  it("calcula a fração de bezerros desmamados sobre matrizes expostas", () => {
    const resultado = taxaDesmame(38, 60);
    expect(resultado.valor).toBeCloseTo(0.6333, 4);
  });

  it("nenhuma matriz exposta retorna sem_dado", () => {
    expect(taxaDesmame(0, 0).qualidade).toBe("sem_dado");
  });
});
