import { describe, it, expect } from "vitest";
import { avaliarManutencao } from "./avaliarManutencao";

describe("avaliarManutencao", () => {
  it("sem plano de manutenção cadastrado (proximaEmHoras null) dá status ok, sem inventar urgência", () => {
    const r = avaliarManutencao(500, null, 20);
    expect(r.status).toBe("ok");
    expect(r.horasRestantes).toBeNull();
  });

  it("bem longe da próxima manutenção dá status ok", () => {
    const r = avaliarManutencao(100, 300, 20);
    expect(r.status).toBe("ok");
    expect(r.horasRestantes).toBe(200);
  });

  it("dentro da antecedência de alerta dá status proxima", () => {
    const r = avaliarManutencao(285, 300, 20);
    expect(r.status).toBe("proxima");
    expect(r.horasRestantes).toBe(15);
  });

  it("horas de uso já passou da próxima manutenção dá status vencida", () => {
    const r = avaliarManutencao(320, 300, 20);
    expect(r.status).toBe("vencida");
    expect(r.horasRestantes).toBe(-20);
  });

  it("exatamente no limite (horasRestantes === 0) conta como vencida", () => {
    const r = avaliarManutencao(300, 300, 20);
    expect(r.status).toBe("vencida");
  });

  it("exatamente na borda da antecedência conta como proxima", () => {
    const r = avaliarManutencao(280, 300, 20);
    expect(r.status).toBe("proxima");
  });
});
