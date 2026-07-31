import { describe, it, expect } from "vitest";
import { avaliarLotacao } from "./avaliarLotacao";
import type { Parametros } from "../tipos/index.ts";

const P = {
  UA_KG: 450,
  TOLERANCIA_LOTACAO: 0.1,
  CAP_UA_HA_MARANDU: 1.8,
  CAP_UA_HA_MOMBACA: 2.8,
  CAP_UA_HA_MASSAI: 2.0,
  CAP_UA_HA_DEFAULT: 1.5,
} as unknown as Parametros;

describe("avaliarLotacao", () => {
  it("bate com o Anexo A.3 inteiro: 2,356 UA/ha, limite 1,980, excede, mover 10 cabeças", () => {
    const resultado = avaliarLotacao(10600, 10, "Marandu", 265, P);
    expect(resultado.lotacao).toBeCloseTo(2.356, 3);
    expect(resultado.limite).toBeCloseTo(1.98, 3);
    expect(resultado.excede).toBe(true);
    expect(resultado.cabecasAMover).toBe(10);
  });

  it("dentro da capacidade não excede e não sugere mover cabeça nenhuma", () => {
    const resultado = avaliarLotacao(4000, 10, "Marandu", 200, P);
    expect(resultado.excede).toBe(false);
    expect(resultado.cabecasAMover).toBe(0);
  });

  it("nome de capim com acento/maiúscula resolve pra mesma capacidade (Mombaça)", () => {
    const comAcento = avaliarLotacao(10600, 10, "mombaça", 265, P);
    const semAcento = avaliarLotacao(10600, 10, "MOMBACA", 265, P);
    expect(comAcento.limite).toBe(semAcento.limite);
  });

  it("capim não cadastrado usa CAP_UA_HA_DEFAULT, sem inventar capacidade", () => {
    const resultado = avaliarLotacao(10600, 10, "capim-desconhecido", 265, P);
    expect(resultado.limite).toBeCloseTo(1.5 * 1.1, 3);
  });
});
