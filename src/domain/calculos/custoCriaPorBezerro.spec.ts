import { describe, it, expect } from "vitest";
import { custoCriaPorBezerro } from "./custoCriaPorBezerro";

describe("custoCriaPorBezerro", () => {
  it("soma manutenção de matriz e touro, divide pelos bezerros desmamados", () => {
    const resultado = custoCriaPorBezerro(1_800_000n, 200_000n, 38);
    expect(resultado.valor).toBe(BigInt(Math.round(2_000_000 / 38)));
    expect(resultado.qualidade).toBe("firme");
  });

  it("zero bezerros desmamados retorna sem_dado", () => {
    expect(custoCriaPorBezerro(1_800_000n, 200_000n, 0).qualidade).toBe("sem_dado");
  });
});
