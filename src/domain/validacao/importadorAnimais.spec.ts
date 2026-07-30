import { describe, it, expect } from "vitest";
import { mapearLinhasParaAnimais, type LinhaBruta, type MapeamentoColunasAnimais } from "./importadorAnimais";

const mapeamento: MapeamentoColunasAnimais = {
  brinco: "Brinco",
  sexo: "Sexo",
  categoria: "Categoria",
  data_nascimento: "Nascimento",
  peso_nascimento: "PesoNasc",
};

const HOJE = "2026-07-30";
const PESO_NASCIMENTO_MAX_KG = 100; // mesmo default do parametros_fazenda (supabase/seed.sql)

function linha(numeroLinha: number, valores: Record<string, string>): LinhaBruta {
  return { numeroLinha, valores };
}

describe("mapearLinhasParaAnimais", () => {
  it("aceita uma linha válida completa", () => {
    const { validas, rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Brinco: "123", Sexo: "F", Categoria: "bezerra", Nascimento: "2026-01-10", PesoNasc: "32,5" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(0);
    expect(validas).toEqual([
      {
        brinco: "123",
        sexo: "F",
        categoria: "bezerra",
        data_nascimento: "2026-01-10",
        peso_nascimento: 32.5,
        origem: "importacao",
        linhaOriginal: { Brinco: "123", Sexo: "F", Categoria: "bezerra", Nascimento: "2026-01-10", PesoNasc: "32,5" },
      },
    ]);
  });

  it("aceita linha sem brinco, data ou peso (campos opcionais)", () => {
    const { validas, rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Brinco: "", Sexo: "M", Categoria: "garrote", Nascimento: "", PesoNasc: "" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(0);
    expect(validas[0]?.brinco).toBeNull();
    expect(validas[0]?.data_nascimento).toBeNull();
    expect(validas[0]?.peso_nascimento).toBeNull();
  });

  it("rejeita sexo não reconhecido", () => {
    const { rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Sexo: "macho", Categoria: "garrote" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0]?.motivo).toMatch(/Sexo/);
  });

  it("rejeita categoria incompatível com o sexo", () => {
    const { rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Sexo: "F", Categoria: "garrote" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0]?.motivo).toMatch(/incompatível/);
  });

  it("rejeita data de nascimento no futuro", () => {
    const { rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Sexo: "M", Categoria: "bezerro", Nascimento: "2099-01-01" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0]?.motivo).toMatch(/futuro/);
  });

  it("rejeita peso ao nascer implausível", () => {
    const { rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Sexo: "M", Categoria: "bezerro", PesoNasc: "400" })],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0]?.motivo).toMatch(/faixa plausível/);
  });

  it("usa o limite plausível recebido por parâmetro, não fixo no código", () => {
    const { validas, rejeitadas } = mapearLinhasParaAnimais(
      [linha(2, { Sexo: "M", Categoria: "boi", PesoNasc: "150" })],
      mapeamento,
      HOJE,
      200 // fazenda com limite maior configurado em parametros_fazenda
    );
    expect(rejeitadas).toHaveLength(0);
    expect(validas[0]?.peso_nascimento).toBe(150);
  });

  it("rejeita brinco duplicado dentro da própria planilha", () => {
    const { validas, rejeitadas } = mapearLinhasParaAnimais(
      [
        linha(2, { Brinco: "77", Sexo: "M", Categoria: "bezerro" }),
        linha(3, { Brinco: "77", Sexo: "F", Categoria: "bezerra" }),
      ],
      mapeamento,
      HOJE,
      PESO_NASCIMENTO_MAX_KG
    );
    expect(validas).toHaveLength(1);
    expect(rejeitadas).toHaveLength(1);
    expect(rejeitadas[0]?.motivo).toMatch(/duplicado/);
  });

  it("planilha vazia não gera válidas nem rejeitadas", () => {
    const { validas, rejeitadas } = mapearLinhasParaAnimais([], mapeamento, HOJE, PESO_NASCIMENTO_MAX_KG);
    expect(validas).toHaveLength(0);
    expect(rejeitadas).toHaveLength(0);
  });
});
