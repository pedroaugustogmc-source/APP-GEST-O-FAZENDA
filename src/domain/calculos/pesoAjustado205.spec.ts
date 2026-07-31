import { describe, it, expect } from "vitest";
import { pesoAjustado205 } from "./pesoAjustado205";

describe("pesoAjustado205", () => {
  it("desmame exatamente aos 205 dias devolve o próprio peso de desmame", () => {
    const resultado = pesoAjustado205(32, 180, 205);
    expect(resultado.valor).toBeCloseTo(180, 6);
    expect(resultado.qualidade).toBe("firme");
  });

  it("desmame antes dos 205 dias projeta o peso pra frente", () => {
    const resultado = pesoAjustado205(32, 150, 180);
    // taxa = (150-32)/180 = 0,655556 kg/dia; 32 + 0,655556*205 = 166,3889
    expect(resultado.valor).toBeCloseTo(166.3889, 3);
  });

  it("idade em dias <= 0 retorna sem_dado, nunca divide por zero", () => {
    const resultado = pesoAjustado205(32, 180, 0);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
  });
});
