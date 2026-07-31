import type { Centavos, Indicador } from "../tipos/index.ts";

// Não está no Anexo B — fórmula do §9: custo_recria_por_animal =
// custos_do_desmame_ate_venda / animais_do_lote.
export function custoRecriaPorAnimal(custoDesmameAteVenda: Centavos, animaisDoLote: number): Indicador<Centavos> {
  if (animaisDoLote <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "lote sem animais",
    };
  }

  const valor = BigInt(Math.round(Number(custoDesmameAteVenda) / animaisDoLote));
  return { valor, n: animaisDoLote, dataBase: null, qualidade: "firme" };
}
