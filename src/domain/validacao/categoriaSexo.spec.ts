import { describe, it, expect } from "vitest";
import { categoriasValidasParaSexo, sexoCategoriaCompativeis } from "./categoriaSexo";

describe("categoriasValidasParaSexo", () => {
  it("fêmea: bezerra, novilha, vaca", () => {
    expect(categoriasValidasParaSexo("F")).toEqual(["bezerra", "novilha", "vaca"]);
  });

  it("macho: bezerro, garrote, touro, boi", () => {
    expect(categoriasValidasParaSexo("M")).toEqual(["bezerro", "garrote", "touro", "boi"]);
  });
});

describe("sexoCategoriaCompativeis", () => {
  it("aceita combinações válidas", () => {
    expect(sexoCategoriaCompativeis("F", "vaca")).toBe(true);
    expect(sexoCategoriaCompativeis("M", "garrote")).toBe(true);
  });

  it("rejeita combinações inválidas", () => {
    expect(sexoCategoriaCompativeis("F", "garrote")).toBe(false);
    expect(sexoCategoriaCompativeis("M", "vaca")).toBe(false);
  });
});
