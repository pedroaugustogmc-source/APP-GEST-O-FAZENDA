import { describe, it, expect } from "vitest";
import { custoPorHora } from "./custoPorHora";

describe("custoPorHora", () => {
  it("divide o custo acumulado pelas horas de uso", () => {
    const r = custoPorHora(120000n, 40);
    expect(r.valor).toBe(3000n);
    expect(r.qualidade).toBe("firme");
  });

  it("arredonda pro centavo mais próximo", () => {
    const r = custoPorHora(100000n, 3);
    expect(r.valor).toBe(BigInt(Math.round(100000 / 3)));
  });

  it("zero horas dá sem_dado, nunca divisão por zero", () => {
    const r = custoPorHora(50000n, 0);
    expect(r.valor).toBeNull();
    expect(r.qualidade).toBe("sem_dado");
  });

  it("horas negativas (dado corrompido) também dá sem_dado, não custo negativo", () => {
    const r = custoPorHora(50000n, -5);
    expect(r.valor).toBeNull();
    expect(r.qualidade).toBe("sem_dado");
  });
});
