import { describe, it, expect } from "vitest";
import { arrobasCarcaca } from "./arrobasCarcaca";
import type { Parametros } from "../tipos/index.ts";

const P = { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 } as Parametros;

describe("arrobasCarcaca", () => {
  it("bate com o Anexo A (265,0 kg vivo -> 9,1867 @ de carcaça)", () => {
    expect(arrobasCarcaca(265.0, P)).toBeCloseTo(9.1867, 4);
  });

  it("nunca é igual ao peso vivo em @ sem aplicar o rendimento", () => {
    const resultado = arrobasCarcaca(265.0, P);
    const semRendimento = 265.0 / 15;
    expect(resultado).not.toBeCloseTo(semRendimento, 2);
  });
});
