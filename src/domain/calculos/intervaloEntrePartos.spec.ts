import { describe, it, expect } from "vitest";
import { intervaloEntrePartos } from "./intervaloEntrePartos";

describe("intervaloEntrePartos", () => {
  it("dois partos: intervalo é a diferença simples em dias", () => {
    const resultado = intervaloEntrePartos(["2024-03-01", "2025-03-01"]);
    expect(resultado.valor).toBe(365);
    expect(resultado.n).toBe(1);
  });

  it("três partos: calcula a média dos dois intervalos", () => {
    const resultado = intervaloEntrePartos(["2023-01-01", "2024-01-01", "2025-01-01"]);
    // 2023->2024 = 365 dias (não bissexto), 2024->2025 = 366 (2024 é bissexto)
    expect(resultado.valor).toBeCloseTo((365 + 366) / 2, 1);
    expect(resultado.n).toBe(2);
  });

  it("ordena datas fora de ordem antes de calcular", () => {
    const resultado = intervaloEntrePartos(["2025-03-01", "2024-03-01"]);
    expect(resultado.valor).toBe(365);
  });

  it("um parto só não tem intervalo — sem_dado, não zero", () => {
    const resultado = intervaloEntrePartos(["2024-03-01"]);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
  });

  it("nenhum parto retorna sem_dado", () => {
    expect(intervaloEntrePartos([]).qualidade).toBe("sem_dado");
  });
});
