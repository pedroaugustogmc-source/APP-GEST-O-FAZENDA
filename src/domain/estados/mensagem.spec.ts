import { describe, it, expect } from "vitest";
import {
  transicionarStatusMensagem,
  transicaoValidaMensagem,
  mensagemEhImutavel,
  TODOS_STATUS_MENSAGEM,
  type StatusMensagem,
} from "./mensagem";
import { ErroTransicaoInvalida } from "./erro";

const VALIDAS: Array<[StatusMensagem, StatusMensagem]> = [
  ["recebida", "transcrita"],
  ["recebida", "erro"],
  ["transcrita", "extraida"],
  ["transcrita", "erro"],
  ["extraida", "gravada"],
  ["extraida", "revisao"],
  ["extraida", "erro"],
  ["revisao", "gravada"],
  ["revisao", "descartada"],
];

describe("transicionarStatusMensagem", () => {
  it.each(VALIDAS)("permite %s → %s", (atual, alvo) => {
    expect(transicionarStatusMensagem(atual, alvo)).toBe(alvo);
    expect(transicaoValidaMensagem(atual, alvo)).toBe(true);
  });

  const todasCombinacoes: Array<[StatusMensagem, StatusMensagem]> = TODOS_STATUS_MENSAGEM.flatMap(
    (a) => TODOS_STATUS_MENSAGEM.map((b): [StatusMensagem, StatusMensagem] => [a, b])
  );
  const invalidas = todasCombinacoes.filter(
    ([a, b]) => !VALIDAS.some(([va, vb]) => va === a && vb === b)
  );

  it.each(invalidas)("rejeita %s → %s", (atual, alvo) => {
    expect(() => transicionarStatusMensagem(atual, alvo)).toThrow(ErroTransicaoInvalida);
    expect(transicaoValidaMensagem(atual, alvo)).toBe(false);
  });
});

describe("mensagemEhImutavel", () => {
  it("mensagem gravada é imutável", () => {
    expect(mensagemEhImutavel("gravada")).toBe(true);
  });

  it.each(TODOS_STATUS_MENSAGEM.filter((s) => s !== "gravada"))(
    "mensagem em %s não é imutável",
    (status) => {
      expect(mensagemEhImutavel(status)).toBe(false);
    }
  );
});
