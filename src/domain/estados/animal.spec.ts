import { describe, it, expect } from "vitest";
import {
  transicionarStatusAnimal,
  transicaoValidaAnimal,
  podeReceberEventoEm,
  TODOS_STATUS_ANIMAL,
  type StatusAnimal,
} from "./animal";
import { ErroTransicaoInvalida } from "./erro";

const VALIDAS: Array<[StatusAnimal, StatusAnimal]> = [
  ["ativo", "vendido"],
  ["ativo", "morto"],
  ["ativo", "descartado"],
];

describe("transicionarStatusAnimal", () => {
  it.each(VALIDAS)("permite %s → %s", (atual, alvo) => {
    expect(transicionarStatusAnimal(atual, alvo)).toBe(alvo);
  });

  const todasCombinacoes: Array<[StatusAnimal, StatusAnimal]> = TODOS_STATUS_ANIMAL.flatMap((a) =>
    TODOS_STATUS_ANIMAL.map((b): [StatusAnimal, StatusAnimal] => [a, b])
  );
  const invalidas = todasCombinacoes.filter(
    ([a, b]) => !VALIDAS.some(([va, vb]) => va === a && vb === b)
  );

  it.each(invalidas)("rejeita %s → %s", (atual, alvo) => {
    expect(() => transicionarStatusAnimal(atual, alvo)).toThrow(ErroTransicaoInvalida);
    expect(transicaoValidaAnimal(atual, alvo)).toBe(false);
  });
});

describe("podeReceberEventoEm", () => {
  it("animal ativo aceita evento em qualquer data", () => {
    expect(podeReceberEventoEm("ativo", null, "2026-01-01")).toBe(true);
  });

  it("animal vendido sem data de saída registrada não bloqueia (dado ausente, não presume)", () => {
    expect(podeReceberEventoEm("vendido", null, "2026-01-01")).toBe(true);
  });

  it("animal morto rejeita evento com data posterior à saída", () => {
    expect(podeReceberEventoEm("morto", "2026-01-10", "2026-01-15")).toBe(false);
  });

  it("animal morto aceita evento com data igual ou anterior à saída", () => {
    expect(podeReceberEventoEm("morto", "2026-01-10", "2026-01-10")).toBe(true);
    expect(podeReceberEventoEm("morto", "2026-01-10", "2026-01-05")).toBe(true);
  });
});
