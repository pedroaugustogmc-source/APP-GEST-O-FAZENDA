// Extensões .ts explícitas — este módulo também roda na Edge Function Deno.
import type { ISODate } from "../tipos/index.ts";
import { partesDeISODate } from "../tipos/data.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// dias_de_descanso = data_entrada_lote_novo - data_saida_lote_anterior
//
// Consumidor: gravação de movimentacoes_pasto (dias_descanso_destino, "calculado
// na gravação, congelado para histórico" — comentário do DDL em docs/02-dados.md §13.3).
export function diasDeDescanso(saidaAnterior: ISODate | null, entradaNova: ISODate): number | null {
  // Regra 2 do CLAUDE.md: pasto sem histórico de saída anterior não tem
  // "dias de descanso" conhecidos — nunca 0, nunca inventado. "— sem dado —".
  if (!saidaAnterior) return null;

  const partesSaida = partesDeISODate(saidaAnterior);
  const partesEntrada = partesDeISODate(entradaNova);
  const saida = Date.UTC(partesSaida.ano, partesSaida.mes - 1, partesSaida.dia);
  const entrada = Date.UTC(partesEntrada.ano, partesEntrada.mes - 1, partesEntrada.dia);
  const dias = Math.round((entrada - saida) / (1000 * 60 * 60 * 24));

  // Datas inconsistentes (entrada nova antes da saída anterior) não produzem
  // um número de descanso negativo — isso é sinal de dado errado a montante,
  // não um resultado válido para exibir.
  if (dias < 0) return null;

  return dias;
}
