import { describe, it, expect } from "vitest";
import { elegiveisParaVacina, type AnimalParaVacina, type RegraVacinal } from "./elegiveisParaVacina";

const HOJE = "2026-07-31";

const BRUCELOSE: RegraVacinal = {
  nome: "Brucelose (B19)",
  sexoAlvo: "F",
  idadeMinMeses: 3,
  idadeMaxMeses: 8,
  categoriasAlvo: ["bezerra", "novilha"],
  bloqueada: false,
  motivoBloqueio: null,
};

const AFTOSA: RegraVacinal = {
  nome: "Febre Aftosa",
  sexoAlvo: null,
  idadeMinMeses: null,
  idadeMaxMeses: null,
  categoriasAlvo: null,
  bloqueada: true,
  motivoBloqueio: "O Maranhão é zona livre de febre aftosa sem vacinação desde abril de 2024.",
};

function animal(overrides: Partial<AnimalParaVacina>): AnimalParaVacina {
  return {
    id: "a1",
    sexo: "F",
    categoria: "bezerra",
    nascimento: "2026-03-01", // 4 meses antes de HOJE
    ...overrides,
  };
}

describe("elegiveisParaVacina", () => {
  it("fêmea de 4 meses é elegível para brucelose", () => {
    const resultado = elegiveisParaVacina([animal({})], BRUCELOSE, HOJE);
    expect(resultado.elegiveis).toEqual(["a1"]);
    expect(resultado.bloqueados).toEqual([]);
  });

  it("macho é bloqueado para brucelose por sexo, mesmo na idade certa", () => {
    const resultado = elegiveisParaVacina(
      [animal({ id: "a2", sexo: "M", categoria: "garrote" })],
      BRUCELOSE,
      HOJE
    );
    expect(resultado.elegiveis).toEqual([]);
    expect(resultado.bloqueados[0]!.id).toBe("a2");
    expect(resultado.bloqueados[0]!.motivo).toMatch(/sexo/i);
  });

  it("fêmea de 10 meses é bloqueada por estar fora da janela etária (acima do máximo)", () => {
    const resultado = elegiveisParaVacina(
      [animal({ id: "a3", nascimento: "2025-09-25" })],
      BRUCELOSE,
      HOJE
    );
    expect(resultado.bloqueados[0]!.id).toBe("a3");
    expect(resultado.bloqueados[0]!.motivo).toMatch(/idade máxima/i);
  });

  it("fêmea de 1 mês é bloqueada por estar abaixo da janela etária (abaixo do mínimo)", () => {
    const resultado = elegiveisParaVacina(
      [animal({ id: "a4", nascimento: "2026-06-25" })],
      BRUCELOSE,
      HOJE
    );
    expect(resultado.bloqueados[0]!.id).toBe("a4");
    expect(resultado.bloqueados[0]!.motivo).toMatch(/idade mínima/i);
  });

  it("sem data de nascimento cadastrada, não presume estar na janela", () => {
    const resultado = elegiveisParaVacina([animal({ id: "a5", nascimento: null })], BRUCELOSE, HOJE);
    expect(resultado.bloqueados[0]!.id).toBe("a5");
    expect(resultado.bloqueados[0]!.motivo).toMatch(/data de nascimento/i);
  });

  it("categoria fora do alvo (vaca) é bloqueada mesmo em fêmea na idade certa", () => {
    const resultado = elegiveisParaVacina(
      [animal({ id: "a6", categoria: "vaca", nascimento: "2020-01-01" })],
      BRUCELOSE,
      HOJE
    );
    expect(resultado.bloqueados[0]!.id).toBe("a6");
    expect(resultado.bloqueados[0]!.motivo).toMatch(/categoria/i);
  });

  it("vacina bloqueada (aftosa) bloqueia qualquer animal, sem checar sexo/idade", () => {
    const resultado = elegiveisParaVacina(
      [animal({ id: "a7", sexo: "M", categoria: "boi", nascimento: null })],
      AFTOSA,
      HOJE
    );
    expect(resultado.elegiveis).toEqual([]);
    expect(resultado.bloqueados[0]!.motivo).toBe(AFTOSA.motivoBloqueio);
  });

  it("vacina sem janela etária (idadeMin/Max null) não exige data de nascimento", () => {
    const semJanela: RegraVacinal = {
      nome: "Raiva",
      sexoAlvo: null,
      idadeMinMeses: null,
      idadeMaxMeses: null,
      categoriasAlvo: null,
      bloqueada: false,
      motivoBloqueio: null,
    };
    const resultado = elegiveisParaVacina([animal({ id: "a8", nascimento: null })], semJanela, HOJE);
    expect(resultado.elegiveis).toEqual(["a8"]);
  });
});
