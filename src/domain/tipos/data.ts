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

// docs/01-dominio.md §4: fuso America/Fortaleza — "hoje" nunca é o UTC cru (à
// noite em Fortaleza, UTC já virou o dia seguinte). Usado tanto pela Edge
// Function (Deno) quanto pelo Next.js (Node) — Intl.DateTimeFormat é padrão
// nos dois runtimes, sem precisar de framework.
export function hojeEmFortaleza(): ISODate {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(new Date()) as ISODate;
}
