import { describe, it, expect } from "vitest";
import { ratearPorUaDia } from "./ratearPorUaDia";
import type { Parametros } from "../tipos/index.ts";

const P = { UA_KG: 450 } as Parametros;

describe("ratearPorUaDia", () => {
  it("bate com o Anexo A.5: R$ 6.000,00 rateado entre RECRIA-01 e CRIA-01", () => {
    const resultado = ratearPorUaDia(600000n, [
      { id: "RECRIA-01", pesoVivoTotal: 40 * 265, dias: 30 },
      { id: "CRIA-01", pesoVivoTotal: 60 * 420, dias: 30 },
    ], P);

    const porId = new Map(resultado.map((r) => [r.id, r.valor]));
    expect(porId.get("RECRIA-01")).toBe(177654n);
    expect(porId.get("CRIA-01")).toBe(422346n);
    expect(porId.get("RECRIA-01")! + porId.get("CRIA-01")!).toBe(600000n);
  });

  it("Anexo A.5 — regra de fechamento obrigatória: soma bate para 1.000 combinações aleatórias", () => {
    for (let tentativa = 0; tentativa < 1000; tentativa += 1) {
      const nLotes = 2 + Math.floor(Math.random() * 6); // 2 a 7 lotes
      const custo = BigInt(Math.floor(Math.random() * 10_000_000) + 1); // até R$ 100.000,00
      const lotes = Array.from({ length: nLotes }, (_, i) => ({
        id: `lote-${i}`,
        pesoVivoTotal: Math.random() * 50_000 + 100,
        dias: Math.floor(Math.random() * 90) + 1,
      }));

      const resultado = ratearPorUaDia(custo, lotes, P);
      const soma = resultado.reduce((total, r) => total + r.valor, 0n);

      expect(soma).toBe(custo);
    }
  });

  it("lote único recebe o custo inteiro, sem rateio", () => {
    const resultado = ratearPorUaDia(50000n, [{ id: "unico", pesoVivoTotal: 1000, dias: 10 }], P);
    expect(resultado).toEqual([{ id: "unico", valor: 50000n }]);
  });

  it("nenhum lote e custo zero retorna lista vazia", () => {
    expect(ratearPorUaDia(0n, [], P)).toEqual([]);
  });

  it("nenhum lote mas custo diferente de zero lança erro (não há como ratear)", () => {
    expect(() => ratearPorUaDia(1000n, [], P)).toThrow();
  });

  it("todos os lotes com peso/dias zero (UA-dia total zero) lança erro em vez de dividir por zero", () => {
    expect(() =>
      ratearPorUaDia(1000n, [
        { id: "a", pesoVivoTotal: 0, dias: 0 },
        { id: "b", pesoVivoTotal: 0, dias: 0 },
      ], P)
    ).toThrow();
  });
});
