import { describe, it, expect } from "vitest";
import { arrobasProduzidas } from "./arrobasProduzidas";
import type { Parametros } from "../tipos/index.ts";

const P = { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 } as Parametros;

describe("arrobasProduzidas", () => {
  it("bate com o Anexo A (1.800 kg de ganho -> 62,40 @)", () => {
    expect(arrobasProduzidas(1800, P)).toBeCloseTo(62.4, 4);
  });

  it("ganho zero produz zero arroba", () => {
    expect(arrobasProduzidas(0, P)).toBe(0);
  });

  it("ganho negativo (perda de peso) produz arroba negativa, sem mascarar", () => {
    expect(arrobasProduzidas(-100, P)).toBeCloseTo(-3.4667, 4);
  });
});
