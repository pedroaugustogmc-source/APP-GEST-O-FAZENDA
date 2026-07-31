import { describe, it, expect } from "vitest";
import { custoRecriaPorAnimal } from "./custoRecriaPorAnimal";

describe("custoRecriaPorAnimal", () => {
  it("divide o custo do desmame até a venda pelos animais do lote", () => {
    const resultado = custoRecriaPorAnimal(547600n, 40);
    expect(resultado.valor).toBe(BigInt(Math.round(547600 / 40)));
  });

  it("lote sem animais retorna sem_dado", () => {
    expect(custoRecriaPorAnimal(547600n, 0).qualidade).toBe("sem_dado");
  });
});
