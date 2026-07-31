// Extensões .ts explícitas — este módulo também roda na Edge Function Deno.
import type { ISODate } from "../tipos/index.ts";
import { partesDeISODate } from "../tipos/data.ts";
import type { CategoriaAnimal, SexoAnimal } from "../validacao/categoriaSexo.ts";

// docs/08-anexos.md Anexo B — assinatura fixa (o tipo RegraVacinal não vem
// definido no anexo; espelha as colunas de vacinas_catalogo relevantes para
// elegibilidade, docs/02-dados.md §13.4).
export interface RegraVacinal {
  nome: string;
  sexoAlvo: SexoAnimal | null;
  idadeMinMeses: number | null;
  idadeMaxMeses: number | null;
  categoriasAlvo: CategoriaAnimal[] | null;
  bloqueada: boolean;
  motivoBloqueio: string | null;
}

export interface AnimalParaVacina {
  id: string;
  sexo: SexoAnimal;
  categoria: CategoriaAnimal;
  nascimento: ISODate | null;
}

export interface ResultadoElegibilidade {
  elegiveis: string[];
  bloqueados: Array<{ id: string; motivo: string }>;
}

// docs/04-bot.md §32: "vacina fora da janela etária → não grava, explica a
// janela correta"; docs/03-modulos.md M4: "bloqueia brucelose fora da janela
// 3–8 meses ou em macho, explicando o motivo".
export function elegiveisParaVacina(
  animais: AnimalParaVacina[],
  regra: RegraVacinal,
  hoje: ISODate
): ResultadoElegibilidade {
  const elegiveis: string[] = [];
  const bloqueados: Array<{ id: string; motivo: string }> = [];

  for (const animal of animais) {
    const motivo = motivoBloqueio(animal, regra, hoje);
    if (motivo) {
      bloqueados.push({ id: animal.id, motivo });
    } else {
      elegiveis.push(animal.id);
    }
  }

  return { elegiveis, bloqueados };
}

function motivoBloqueio(animal: AnimalParaVacina, regra: RegraVacinal, hoje: ISODate): string | null {
  if (regra.bloqueada) {
    return regra.motivoBloqueio ?? `${regra.nome} está bloqueada.`;
  }

  if (regra.sexoAlvo !== null && animal.sexo !== regra.sexoAlvo) {
    return `${regra.nome} é só para sexo ${regra.sexoAlvo === "F" ? "fêmea" : "macho"}.`;
  }

  if (regra.categoriasAlvo !== null && !regra.categoriasAlvo.includes(animal.categoria)) {
    return `${regra.nome} não é indicada para a categoria "${animal.categoria}".`;
  }

  if (regra.idadeMinMeses !== null || regra.idadeMaxMeses !== null) {
    if (!animal.nascimento) {
      // Regra 2 do CLAUDE.md: sem data de nascimento não presumimos que está
      // dentro da janela — bloqueia e pede o dado que falta.
      return "sem data de nascimento cadastrada — não dá para confirmar a janela etária.";
    }

    const idade = idadeEmMesesCompletos(animal.nascimento, hoje);

    if (regra.idadeMinMeses !== null && idade < regra.idadeMinMeses) {
      return `abaixo da idade mínima de ${regra.idadeMinMeses} meses para ${regra.nome}.`;
    }
    if (regra.idadeMaxMeses !== null && idade > regra.idadeMaxMeses) {
      return `acima da idade máxima de ${regra.idadeMaxMeses} meses para ${regra.nome}.`;
    }
  }

  return null;
}

function idadeEmMesesCompletos(nascimento: ISODate, hoje: ISODate): number {
  const nasc = partesDeISODate(nascimento);
  const atual = partesDeISODate(hoje);

  let meses = (atual.ano - nasc.ano) * 12 + (atual.mes - nasc.mes);
  if (atual.dia < nasc.dia) meses -= 1;
  return Math.max(meses, 0);
}
