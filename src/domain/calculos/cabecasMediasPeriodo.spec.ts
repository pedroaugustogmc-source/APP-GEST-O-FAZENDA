import { describe, it, expect } from "vitest";
import { cabecasMediasPeriodo } from "./cabecasMediasPeriodo";

describe("cabecasMediasPeriodo", () => {
  it("calcula a média simples entre início e fim do período", () => {
    expect(cabecasMediasPeriodo(140, 160)).toBe(150);
  });

  it("rebanho estável (início == fim) dá a própria contagem", () => {
    expect(cabecasMediasPeriodo(150, 150)).toBe(150);
  });

  it("período sem nenhuma cabeça dá zero", () => {
    expect(cabecasMediasPeriodo(0, 0)).toBe(0);
  });
});
