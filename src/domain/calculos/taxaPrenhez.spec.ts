import { describe, it, expect } from "vitest";
import { taxaPrenhez } from "./taxaPrenhez";

describe("taxaPrenhez", () => {
  it("calcula a fração de matrizes prenhas", () => {
    const resultado = taxaPrenhez(45, 60);
    expect(resultado.valor).toBeCloseTo(0.75, 4);
    expect(resultado.qualidade).toBe("firme");
  });

  it("nenhuma matriz exposta retorna sem_dado, não divide por zero", () => {
    const resultado = taxaPrenhez(0, 0);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
  });
});
