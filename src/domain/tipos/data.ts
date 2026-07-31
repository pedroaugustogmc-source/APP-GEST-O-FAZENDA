// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
import type { ISODate } from "./index.ts";

// Utilitário pequeno e compartilhado para as poucas funções de domínio que
// precisam quebrar um ISODate em ano/mês/dia (diasDeDescanso, elegiveisParaVacina,
// validacaoSemantica). Não é uma função do Anexo B — é suporte interno.
// Existe para não repetir `data.split("-").map(Number)` em 3 arquivos, o que
// sob `noUncheckedIndexedAccess` obrigaria a checar undefined em cada um.
export interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number;
}

export function partesDeISODate(data: ISODate): PartesData {
  const partes = data.split("-");
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) {
    throw new Error(`Data ISO inválida: "${data}"`);
  }

  return { ano, mes, dia };
}
