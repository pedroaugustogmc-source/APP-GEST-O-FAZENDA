import { describe, it, expect } from "vitest";
import { unidadesAnimais } from "./unidadesAnimais";
import type { Parametros } from "../tipos/index.ts";

const P = { UA_KG: 450 } as Parametros;

describe("unidadesAnimais", () => {
  it("bate com o Anexo A.3 (10.600 kg / 450 = 23,5556 UA)", () => {
    expect(unidadesAnimais(10600, P)).toBeCloseTo(23.5556, 3);
  });

  it("pasto vazio (peso zero) dá zero UA", () => {
    expect(unidadesAnimais(0, P)).toBe(0);
  });
});
