import { describe, it, expect } from "vitest";
import { desligarUsuario } from "./usuario";
import { ErroTransicaoInvalida } from "./erro";

describe("desligarUsuario", () => {
  it("desliga um usuário ativo, carregando a data recebida por parâmetro", () => {
    const resultado = desligarUsuario("ativo", "2026-07-30");
    expect(resultado).toEqual({ status: "inativo", dataDesligamento: "2026-07-30" });
  });

  it("rejeita desligar quem já está inativo", () => {
    expect(() => desligarUsuario("inativo", "2026-07-30")).toThrow(ErroTransicaoInvalida);
  });

  it("não lê relógio: duas chamadas com a mesma data dão o mesmo resultado", () => {
    const a = desligarUsuario("ativo", "2026-01-01");
    const b = desligarUsuario("ativo", "2026-01-01");
    expect(a).toEqual(b);
  });
});
