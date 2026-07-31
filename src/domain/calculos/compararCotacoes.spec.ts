import { describe, it, expect } from "vitest";
import { compararCotacoes } from "./compararCotacoes";
import type { Parametros } from "../tipos/index.ts";

const P = { TAXA_OPORTUNIDADE_MES: 0.015 } as Parametros;

describe("compararCotacoes", () => {
  it("critério de aceite §41.12 — Anexo A.4: aponta o vencedor por custo efetivo, não o de menor preço nominal", () => {
    const resultado = compararCotacoes(
      [
        { id: "A", totalCentavos: 1350000n, prazoDias: 0, descontoAvistaPct: 0.07 }, // preço nominal maior
        { id: "B", totalCentavos: 1280000n, prazoDias: 30, descontoAvistaPct: 0 }, // menor preço nominal
        { id: "C", totalCentavos: 1300000n, prazoDias: 60, descontoAvistaPct: 0 },
      ],
      P
    );

    const porId = new Map(resultado.map((r) => [r.id, r]));
    expect(porId.get("A")!.custoEfetivo).toBe(1255500n);
    expect(porId.get("B")!.custoEfetivo).toBe(1261084n);
    expect(porId.get("C")!.custoEfetivo).toBe(1261860n);
    expect(porId.get("A")!.vencedora).toBe(true);
    expect(porId.get("B")!.vencedora).toBe(false);
    expect(porId.get("C")!.vencedora).toBe(false);
  });

  it("lista vazia devolve lista vazia, não lança erro", () => {
    expect(compararCotacoes([], P)).toEqual([]);
  });

  it("cotação única já é a vencedora por definição", () => {
    const resultado = compararCotacoes([{ id: "único", totalCentavos: 5000n, prazoDias: 0, descontoAvistaPct: 0 }], P);
    expect(resultado).toEqual([{ id: "único", custoEfetivo: 5000n, vencedora: true }]);
  });

  it("empate no custo efetivo: a primeira da lista vence, de forma determinística", () => {
    const resultado = compararCotacoes(
      [
        { id: "primeira", totalCentavos: 10000n, prazoDias: 0, descontoAvistaPct: 0 },
        { id: "segunda", totalCentavos: 10000n, prazoDias: 0, descontoAvistaPct: 0 },
      ],
      P
    );
    expect(resultado.find((r) => r.id === "primeira")!.vencedora).toBe(true);
    expect(resultado.find((r) => r.id === "segunda")!.vencedora).toBe(false);
  });
});
