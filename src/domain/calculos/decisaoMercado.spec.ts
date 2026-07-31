import { describe, it, expect } from "vitest";
import { decisaoMercado } from "./decisaoMercado";
import type { Parametros } from "../tipos";

const p = { MARGEM_DECISAO_MERCADO_PCT: 0.1 } as unknown as Parametros;

describe("decisaoMercado", () => {
  it("distância bem acima da margem sugere vender", () => {
    expect(decisaoMercado(0.15, p).decisao).toBe("vender");
  });

  it("distância bem abaixo da margem (negativa) sugere comprar", () => {
    expect(decisaoMercado(-0.15, p).decisao).toBe("comprar");
  });

  it("distância dentro da faixa de indecisão sugere segurar", () => {
    expect(decisaoMercado(0.03, p).decisao).toBe("segurar");
    expect(decisaoMercado(-0.03, p).decisao).toBe("segurar");
  });

  it("nos limites exatos da margem, já conta como vender/comprar (>= e <=)", () => {
    expect(decisaoMercado(0.1, p).decisao).toBe("vender");
    expect(decisaoMercado(-0.1, p).decisao).toBe("comprar");
  });

  it("usa 0.1 como margem default quando o parâmetro não está configurado", () => {
    const semParametro = {} as unknown as Parametros;
    expect(decisaoMercado(0.12, semParametro).decisao).toBe("vender");
  });

  it("justificativa cita o percentual", () => {
    expect(decisaoMercado(0.15, p).justificativa).toContain("15.0%");
  });
});
