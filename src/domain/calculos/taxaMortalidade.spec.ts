import { describe, it, expect } from "vitest";
import { taxaMortalidade } from "./taxaMortalidade";

describe("taxaMortalidade", () => {
  it("calcula a fração de mortes sobre cabeças médias do período", () => {
    const resultado = taxaMortalidade(3, 150);
    expect(resultado.valor).toBeCloseTo(0.02, 4);
  });

  it("zero cabeças no período retorna sem_dado", () => {
    expect(taxaMortalidade(0, 0).qualidade).toBe("sem_dado");
  });

  it("zero mortes é uma taxa firme de zero, não sem_dado", () => {
    const resultado = taxaMortalidade(0, 150);
    expect(resultado.valor).toBe(0);
    expect(resultado.qualidade).toBe("firme");
  });
});
