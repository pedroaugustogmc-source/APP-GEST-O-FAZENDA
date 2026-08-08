import { describe, it, expect } from "vitest";
import { classificarTendencia } from "./classificarTendencia";
import type { Parametros } from "../tipos";

const p = { LIMIAR_TENDENCIA_ESTAVEL_PCT: 0.03 } as unknown as Parametros;

describe("classificarTendencia", () => {
  it("variação positiva acima do limiar é alta", () => {
    expect(classificarTendencia(0.05, p)).toBe("alta");
  });

  it("variação negativa abaixo do limiar (em módulo) é baixa", () => {
    expect(classificarTendencia(-0.05, p)).toBe("baixa");
  });

  it("variação dentro do limiar, positiva ou negativa, é estável", () => {
    expect(classificarTendencia(0.02, p)).toBe("estavel");
    expect(classificarTendencia(-0.02, p)).toBe("estavel");
  });

  it("nos limites exatos do limiar, já conta como alta/baixa (>= e <=)", () => {
    expect(classificarTendencia(0.03, p)).toBe("alta");
    expect(classificarTendencia(-0.03, p)).toBe("baixa");
  });

  it("variação zero é estável", () => {
    expect(classificarTendencia(0, p)).toBe("estavel");
  });

  it("usa 0.03 como limiar default quando o parâmetro não está configurado", () => {
    const semParametro = {} as unknown as Parametros;
    expect(classificarTendencia(0.04, semParametro)).toBe("alta");
    expect(classificarTendencia(0.01, semParametro)).toBe("estavel");
  });
});
