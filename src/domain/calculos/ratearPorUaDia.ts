import type { Centavos, Kg, Parametros } from "../tipos/index.ts";
import { unidadesAnimais } from "./unidadesAnimais.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// rateio_custo_comum(lote) = custo_comum * (UA_lote * dias_lote) / Σ(UA_i * dias_i)
//
// Anexo A.5, "regra de fechamento obrigatória": a soma dos rateios tem que
// fechar EXATAMENTE com o custo original. O algoritmo do próprio anexo não é
// "maior resto" genérico — é mais simples e determinístico: arredonda todas
// as parcelas normalmente, EXCETO a maior; a maior recebe o resíduo
// (custo − Σ das demais). Isso garante Σ === custo por construção, sem
// depender de nenhuma propriedade de arredondamento.
export function ratearPorUaDia(
  custo: Centavos,
  lotes: Array<{ id: string; pesoVivoTotal: Kg; dias: number }>,
  p: Parametros
): Array<{ id: string; valor: Centavos }> {
  if (lotes.length === 0) {
    if (custo !== 0n) {
      throw new Error("Não há lote para ratear o custo comum.");
    }
    return [];
  }

  if (lotes.length === 1) {
    return [{ id: lotes[0]!.id, valor: custo }];
  }

  const uaDias = lotes.map((lote) => unidadesAnimais(lote.pesoVivoTotal, p) * lote.dias);
  const total = uaDias.reduce((soma, valor) => soma + valor, 0);

  if (total <= 0) {
    throw new Error("UA-dia total é zero — não há base para ratear o custo comum.");
  }

  let indiceMaior = 0;
  for (let i = 1; i < uaDias.length; i += 1) {
    if (uaDias[i]! > uaDias[indiceMaior]!) indiceMaior = i;
  }

  const custoComoNumero = Number(custo);
  const valores: Centavos[] = lotes.map((_, i) => {
    if (i === indiceMaior) return 0n; // preenchido depois, com o resíduo
    const fracao = uaDias[i]! / total;
    return BigInt(Math.round(custoComoNumero * fracao));
  });

  const somaSemMaior = valores.reduce((soma, valor, i) => (i === indiceMaior ? soma : soma + valor), 0n);
  valores[indiceMaior] = custo - somaSemMaior;

  return lotes.map((lote, i) => ({ id: lote.id, valor: valores[i]! }));
}
