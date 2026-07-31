import { describe, it, expect } from "vitest";
import { scoreTarefa } from "./scoreTarefa";

describe("scoreTarefa", () => {
  it("bate com a fórmula do §9: impacto*0,40 + urgencia*0,30 + risco*0,20 - custo*0,10", () => {
    const r = scoreTarefa({ impacto: 8, urgencia: 6, risco: 5, custoNormalizado: 3 });
    expect(r.score).toBeCloseTo(8 * 0.4 + 6 * 0.3 + 5 * 0.2 - 3 * 0.1, 6);
  });

  it("todos os componentes em zero dá score zero e justificativa de prioridade baixa", () => {
    const r = scoreTarefa({ impacto: 0, urgencia: 0, risco: 0, custoNormalizado: 0 });
    expect(r.score).toBe(0);
    expect(r.justificativa).toBe("Prioridade baixa em todos os fatores.");
  });

  it("custo alto sozinho (resto baixo) aparece na justificativa mesmo sem outro fator", () => {
    const r = scoreTarefa({ impacto: 0, urgencia: 0, risco: 0, custoNormalizado: 10 });
    expect(r.score).toBeCloseTo(-1, 6);
    expect(r.justificativa).toContain("custo alto");
  });

  it("todos os componentes no máximo (10) dá score 8 e cita os 4 fatores com concordância de gênero", () => {
    const r = scoreTarefa({ impacto: 10, urgencia: 10, risco: 10, custoNormalizado: 10 });
    expect(r.score).toBeCloseTo(8, 6);
    expect(r.justificativa).toContain("Impacto alto");
    expect(r.justificativa).toContain("urgência alta");
    expect(r.justificativa).toContain("risco alto se não fizer");
    expect(r.justificativa).toContain("mas o custo alto reduz");
  });

  it("um único fator alto usa o verbo no singular", () => {
    const r = scoreTarefa({ impacto: 9, urgencia: 0, risco: 0, custoNormalizado: 0 });
    expect(r.justificativa).toMatch(/^Impacto alto eleva a prioridade\.$/);
  });

  it("lança erro se algum componente estiver fora de 0..10", () => {
    expect(() => scoreTarefa({ impacto: -1, urgencia: 5, risco: 5, custoNormalizado: 5 })).toThrow();
    expect(() => scoreTarefa({ impacto: 5, urgencia: 11, risco: 5, custoNormalizado: 5 })).toThrow();
  });
});
