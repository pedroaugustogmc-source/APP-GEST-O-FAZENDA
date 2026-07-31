import { describe, it, expect } from "vitest";
import { lotacaoUaHa } from "./lotacaoUaHa";
import type { Parametros } from "../tipos/index.ts";

const P = { UA_KG: 450 } as Parametros;

describe("lotacaoUaHa", () => {
  it("bate com o Anexo A.3 (23,5556 UA / 10,00 ha = 2,356 UA/ha)", () => {
    expect(lotacaoUaHa(10600, 10, P)).toBeCloseTo(2.356, 3);
  });

  it("ha <= 0 lança erro em vez de dividir por zero silenciosamente", () => {
    expect(() => lotacaoUaHa(10600, 0, P)).toThrow();
    expect(() => lotacaoUaHa(10600, -1, P)).toThrow();
  });
});
