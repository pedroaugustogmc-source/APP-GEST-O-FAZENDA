import { describe, it, expect } from "vitest";
import { margemPorHectare } from "./margemPorHectare";

describe("margemPorHectare", () => {
  it("bate com o Anexo A: R$ 10.553,33 / 10,00 ha = R$ 1.055,33/ha", () => {
    const resultado = margemPorHectare(1055333n, 10);
    expect(resultado.valor).toBeCloseTo(105533.3, 1);
  });

  it("área zero ou negativa retorna sem_dado", () => {
    expect(margemPorHectare(1055333n, 0).qualidade).toBe("sem_dado");
    expect(margemPorHectare(1055333n, -5).qualidade).toBe("sem_dado");
  });
});
