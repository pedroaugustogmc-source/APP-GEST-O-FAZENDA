import { describe, it, expect } from "vitest";
import { pontoEquilibrio } from "./pontoEquilibrio";
import { arrobasCarcaca } from "./arrobasCarcaca";
import type { Parametros } from "../tipos/index.ts";

const P = { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 } as Parametros;

describe("pontoEquilibrio", () => {
  it("bate com o Anexo A: R$ 79.476,00 / 367,4667 @ = R$ 216,28/@ (21628 centavos)", () => {
    const arrobasVenda = arrobasCarcaca(265.0, P) * 40;
    const resultado = pontoEquilibrio(7947600n, arrobasVenda);
    expect(resultado.valor).toBe(21628n);
    expect(resultado.qualidade).toBe("firme");
  });

  it("lote sem arroba disponível pra venda retorna sem_dado", () => {
    expect(pontoEquilibrio(7947600n, 0).qualidade).toBe("sem_dado");
  });
});
