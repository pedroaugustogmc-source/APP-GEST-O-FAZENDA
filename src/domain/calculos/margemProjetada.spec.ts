import { describe, it, expect } from "vitest";
import { margemProjetada } from "./margemProjetada";

describe("margemProjetada", () => {
  it("bate com o Anexo A: R$ 90.029,33 - R$ 79.476,00 = R$ 10.553,33", () => {
    expect(margemProjetada(9002933n, 7947600n)).toBe(1055333n);
  });

  it("custo maior que receita dá margem negativa, sem mascarar prejuízo", () => {
    expect(margemProjetada(50000n, 80000n)).toBe(-30000n);
  });

  it("receita igual ao custo dá margem exatamente zero", () => {
    expect(margemProjetada(50000n, 50000n)).toBe(0n);
  });
});
