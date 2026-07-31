import type { Indicador, ISODate } from "../tipos/index.ts";
import { partesDeISODate } from "../tipos/data.ts";

// Não está no Anexo B — fórmula do §9: intervalo_entre_partos = média(data_parto_n - data_parto_n-1).
// Recebe as datas de parto de UMA matriz; precisa de pelo menos 2 partos
// para existir um intervalo (anti-padrão nº 3 do §6, aplicado aqui por
// analogia: sem duas medições não existe intervalo, existe chute).
export function intervaloEntrePartos(datasPartos: ISODate[]): Indicador<number> {
  if (datasPartos.length < 2) {
    return {
      valor: null,
      n: datasPartos.length,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "precisa de pelo menos 2 partos para calcular um intervalo",
    };
  }

  const ordenadas = [...datasPartos].sort();
  const intervalos: number[] = [];
  for (let i = 1; i < ordenadas.length; i += 1) {
    intervalos.push(diferencaDias(ordenadas[i - 1]!, ordenadas[i]!));
  }

  const media = intervalos.reduce((total, dias) => total + dias, 0) / intervalos.length;

  return {
    valor: media,
    n: intervalos.length,
    dataBase: ordenadas[ordenadas.length - 1]!,
    qualidade: "firme",
  };
}

function diferencaDias(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}
