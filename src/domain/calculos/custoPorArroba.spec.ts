import { describe, it, expect } from "vitest";
import { custoPorArroba } from "./custoPorArroba";

describe("custoPorArroba", () => {
  it("bate com o Anexo A: R$ 5.476,00 / 62,40 @ = R$ 87,76/@ (8776 centavos)", () => {
    const resultado = custoPorArroba(547600n, 62.4);
    expect(resultado.valor).toBe(8776n);
    expect(resultado.qualidade).toBe("firme");
  });

  it("usa arrobas de precisão plena, não a exibida com 2 casas (Anexo G)", () => {
    // 265*0.52/15 = 9.186666... (não 9.19) — usar o valor truncado mudaria o resultado.
    const arrobasPlena = (265 * 0.52) / 15;
    const resultado = custoPorArroba(7947600n, arrobasPlena * 40);
    expect(resultado.valor).toBe(21628n);
  });

  it("zero arrobas produzidas retorna sem_dado, não divide por zero", () => {
    const resultado = custoPorArroba(547600n, 0);
    expect(resultado.valor).toBeNull();
    expect(resultado.qualidade).toBe("sem_dado");
  });

  it("arrobas negativa (dado inconsistente) também retorna sem_dado", () => {
    expect(custoPorArroba(547600n, -1).qualidade).toBe("sem_dado");
  });
});
