import { describe, it, expect } from "vitest";
import {
  transicionarStatusPasto,
  transicaoValidaPasto,
  aceitaEntradaDeLote,
  TODOS_STATUS_PASTO,
  type StatusPasto,
} from "./pasto";
import { ErroTransicaoInvalida } from "./erro";

const VALIDAS: Array<[StatusPasto, StatusPasto]> = [
  ["em_uso", "descanso"],
  ["descanso", "em_uso"],
  ["descanso", "vedado"],
  ["descanso", "reforma"],
  ["vedado", "descanso"],
  ["reforma", "descanso"],
];

describe("transicionarStatusPasto", () => {
  it.each(VALIDAS)("permite %s → %s", (atual, alvo) => {
    expect(transicionarStatusPasto(atual, alvo)).toBe(alvo);
  });

  const todasCombinacoes: Array<[StatusPasto, StatusPasto]> = TODOS_STATUS_PASTO.flatMap((a) =>
    TODOS_STATUS_PASTO.map((b): [StatusPasto, StatusPasto] => [a, b])
  );
  const invalidas = todasCombinacoes.filter(
    ([a, b]) => !VALIDAS.some(([va, vb]) => va === a && vb === b)
  );

  it.each(invalidas)("rejeita %s → %s", (atual, alvo) => {
    expect(() => transicionarStatusPasto(atual, alvo)).toThrow(ErroTransicaoInvalida);
    expect(transicaoValidaPasto(atual, alvo)).toBe(false);
  });

  it("em_uso não pode ir direto para vedado ou reforma (tem que passar por descanso)", () => {
    expect(transicaoValidaPasto("em_uso", "vedado")).toBe(false);
    expect(transicaoValidaPasto("em_uso", "reforma")).toBe(false);
  });
});

describe("aceitaEntradaDeLote", () => {
  it("pasto em reforma não aceita entrada de lote", () => {
    expect(aceitaEntradaDeLote("reforma")).toBe(false);
  });

  it.each<StatusPasto>(["em_uso", "descanso", "vedado"])(
    "pasto em %s aceita entrada de lote",
    (status) => {
      expect(aceitaEntradaDeLote(status)).toBe(true);
    }
  );
});
