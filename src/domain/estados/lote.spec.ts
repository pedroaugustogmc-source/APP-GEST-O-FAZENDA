import { describe, it, expect } from "vitest";
import {
  transicionarStatusLote,
  transicaoValidaLote,
  TODOS_STATUS_LOTE,
  type StatusLote,
} from "./lote";
import { ErroTransicaoInvalida } from "./erro";

const VALIDAS: Array<[StatusLote, StatusLote]> = [
  ["rascunho", "ativo"],
  ["ativo", "vendido"],
  ["ativo", "encerrado"],
];

describe("transicionarStatusLote", () => {
  it.each(VALIDAS)("permite %s → %s", (atual, alvo) => {
    expect(transicionarStatusLote(atual, alvo)).toBe(alvo);
    expect(transicaoValidaLote(atual, alvo)).toBe(true);
  });

  // Todas as combinações possíveis (16 = 4x4) menos as 3 válidas acima devem
  // lançar erro de domínio — inclusive permanecer no mesmo estado.
  const todasCombinacoes: Array<[StatusLote, StatusLote]> = TODOS_STATUS_LOTE.flatMap((a) =>
    TODOS_STATUS_LOTE.map((b): [StatusLote, StatusLote] => [a, b])
  );
  const invalidas = todasCombinacoes.filter(
    ([a, b]) => !VALIDAS.some(([va, vb]) => va === a && vb === b)
  );

  it.each(invalidas)("rejeita %s → %s", (atual, alvo) => {
    expect(() => transicionarStatusLote(atual, alvo)).toThrow(ErroTransicaoInvalida);
    expect(transicaoValidaLote(atual, alvo)).toBe(false);
  });

  it("cobre as 16 combinações (3 válidas + 13 inválidas)", () => {
    expect(invalidas).toHaveLength(13);
  });
});
