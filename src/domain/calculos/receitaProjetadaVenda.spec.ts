import { describe, it, expect } from "vitest";
import { receitaProjetadaVenda } from "./receitaProjetadaVenda";
import { arrobasCarcaca } from "./arrobasCarcaca";
import type { Parametros } from "../tipos/index.ts";

const P = { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 } as Parametros;

describe("receitaProjetadaVenda", () => {
  it("bate com o Anexo A: 367,4667 @ x R$ 245,00/@ = R$ 90.029,33", () => {
    const arrobasVenda = arrobasCarcaca(265.0, P) * 40; // precisão plena, não o 367,4667 exibido
    expect(receitaProjetadaVenda(arrobasVenda, 24500n)).toBe(9002933n);
  });

  it("zero arroba dá zero receita", () => {
    expect(receitaProjetadaVenda(0, 24500n)).toBe(0n);
  });
});
