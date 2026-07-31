import { describe, it, expect } from "vitest";
import { diasDeDescanso } from "./diasDeDescanso";

describe("diasDeDescanso", () => {
  it("calcula a diferença em dias entre a saída anterior e a entrada nova", () => {
    expect(diasDeDescanso("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("pasto sem saída anterior registrada retorna null (sem dado, não zero)", () => {
    expect(diasDeDescanso(null, "2026-01-31")).toBeNull();
  });

  it("mesma data de saída e entrada retorna 0 dias de descanso", () => {
    expect(diasDeDescanso("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("entrada nova anterior à saída (dado inconsistente) retorna null, não negativo", () => {
    expect(diasDeDescanso("2026-02-01", "2026-01-01")).toBeNull();
  });

  it("atravessa virada de ano corretamente", () => {
    expect(diasDeDescanso("2025-12-15", "2026-01-15")).toBe(31);
  });
});
