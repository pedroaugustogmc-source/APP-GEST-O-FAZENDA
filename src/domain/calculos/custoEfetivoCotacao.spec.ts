import { describe, it, expect } from "vitest";
import { custoEfetivoCotacao } from "./custoEfetivoCotacao";
import type { Parametros } from "../tipos/index.ts";

const P = { TAXA_OPORTUNIDADE_MES: 0.015 } as Parametros;

describe("custoEfetivoCotacao", () => {
  it("Anexo A.4 — fornecedor A: R$ 13.500,00 com 7% à vista, prazo 0 -> R$ 12.555,00", () => {
    expect(custoEfetivoCotacao(1350000n, 0, 0.07, P)).toBe(1255500n);
  });

  it("Anexo A.4 — fornecedor B: R$ 12.800,00, 30 dias, sem desconto -> R$ 12.610,84", () => {
    expect(custoEfetivoCotacao(1280000n, 30, 0, P)).toBe(1261084n);
  });

  it("Anexo A.4 — fornecedor C: R$ 13.000,00, 60 dias, sem desconto -> R$ 12.618,60", () => {
    expect(custoEfetivoCotacao(1300000n, 60, 0, P)).toBe(1261860n);
  });

  it("o vencedor real (A) não é o de menor preço nominal (B)", () => {
    const a = custoEfetivoCotacao(1350000n, 0, 0.07, P);
    const b = custoEfetivoCotacao(1280000n, 30, 0, P);
    expect(a).toBeLessThan(b); // A é o vencedor de custo efetivo mesmo com preço nominal maior
  });
});
