import { sexoCategoriaCompativeis, type CategoriaAnimal, type SexoAnimal } from "./categoriaSexo";

// docs/02-dados.md §17 — validação linha a linha do importador de planilha.
// Pura: recebe as linhas já parseadas (infra/importador/csv.ts faz o parse
// de verdade com papaparse) e devolve o que pode ser gravado e o relatório
// de rejeição. Nenhuma linha inválida é "corrigida por adivinhação".

export interface LinhaBruta {
  numeroLinha: number; // 1-based, contando o cabeçalho
  valores: Record<string, string>;
}

export interface MapeamentoColunasAnimais {
  brinco?: string;
  sexo: string;
  categoria: string;
  data_nascimento?: string;
  peso_nascimento?: string;
  origem?: string;
}

export type OrigemAnimalImportado = "nascimento" | "compra" | "importacao";

export interface AnimalParaImportar {
  brinco: string | null;
  sexo: SexoAnimal;
  categoria: CategoriaAnimal;
  data_nascimento: string | null;
  peso_nascimento: number | null;
  // 'importacao' quando a planilha não diz se nasceu na fazenda ou foi
  // comprado — marcar nascimento/compra sem essa informação seria inventar
  // dado (CLAUDE.md regra 2).
  origem: OrigemAnimalImportado;
  linhaOriginal: Record<string, string>;
}

export interface LinhaRejeitada {
  numeroLinha: number;
  motivo: string;
  linhaOriginal: Record<string, string>;
}

const CATEGORIAS_VALIDAS = new Set<CategoriaAnimal>([
  "bezerro",
  "bezerra",
  "garrote",
  "novilha",
  "vaca",
  "touro",
  "boi",
]);

export function mapearLinhasParaAnimais(
  linhas: LinhaBruta[],
  mapeamento: MapeamentoColunasAnimais,
  hoje: string,
  // CLAUDE.md regra 3: nenhum limiar de negócio fica fixo no código — este
  // vem de parametros_fazenda.PESO_NASCIMENTO_MAX_KG (seed em supabase/seed.sql).
  pesoNascimentoMaxKg: number
): { validas: AnimalParaImportar[]; rejeitadas: LinhaRejeitada[] } {
  const validas: AnimalParaImportar[] = [];
  const rejeitadas: LinhaRejeitada[] = [];
  const brincosVistos = new Set<string>();

  for (const linha of linhas) {
    const bruto = linha.valores;
    const rejeitar = (motivo: string) => {
      rejeitadas.push({ numeroLinha: linha.numeroLinha, motivo, linhaOriginal: bruto });
    };

    const sexoBruto = (bruto[mapeamento.sexo] ?? "").trim().toUpperCase();
    if (sexoBruto !== "M" && sexoBruto !== "F") {
      rejeitar(`Sexo "${bruto[mapeamento.sexo] ?? ""}" não reconhecido — esperado M ou F`);
      continue;
    }
    const sexo = sexoBruto as SexoAnimal;

    const categoriaBruto = (bruto[mapeamento.categoria] ?? "").trim().toLowerCase() as CategoriaAnimal;
    if (!CATEGORIAS_VALIDAS.has(categoriaBruto)) {
      rejeitar(`Categoria "${bruto[mapeamento.categoria] ?? ""}" não reconhecida`);
      continue;
    }

    if (!sexoCategoriaCompativeis(sexo, categoriaBruto)) {
      rejeitar(`Categoria "${categoriaBruto}" incompatível com sexo "${sexo}"`);
      continue;
    }

    let dataNascimento: string | null = null;
    if (mapeamento.data_nascimento) {
      const dataBruta = (bruto[mapeamento.data_nascimento] ?? "").trim();
      if (dataBruta) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataBruta)) {
          rejeitar(`Data de nascimento "${dataBruta}" não está no formato AAAA-MM-DD`);
          continue;
        }
        if (dataBruta > hoje) {
          rejeitar(`Data de nascimento "${dataBruta}" está no futuro`);
          continue;
        }
        dataNascimento = dataBruta;
      }
    }

    let pesoNascimento: number | null = null;
    if (mapeamento.peso_nascimento) {
      const pesoBruto = (bruto[mapeamento.peso_nascimento] ?? "").trim();
      if (pesoBruto) {
        const peso = Number(pesoBruto.replace(",", "."));
        if (!Number.isFinite(peso) || peso <= 0 || peso > pesoNascimentoMaxKg) {
          rejeitar(`Peso ao nascer "${pesoBruto}" fora da faixa plausível (0–${pesoNascimentoMaxKg} kg)`);
          continue;
        }
        pesoNascimento = peso;
      }
    }

    const brinco = mapeamento.brinco ? (bruto[mapeamento.brinco] ?? "").trim() || null : null;
    if (brinco) {
      if (brincosVistos.has(brinco)) {
        rejeitar(`Brinco "${brinco}" duplicado dentro da própria planilha`);
        continue;
      }
      brincosVistos.add(brinco);
    }

    let origem: OrigemAnimalImportado = "importacao";
    if (mapeamento.origem) {
      const origemBruta = (bruto[mapeamento.origem] ?? "").trim().toLowerCase();
      if (origemBruta === "nascimento" || origemBruta === "compra") {
        origem = origemBruta;
      }
      // Qualquer outro valor (vazio, "não sei", etc.) fica honesto como
      // 'importacao' em vez de forçar nascimento/compra sem essa certeza.
    }

    validas.push({
      brinco,
      sexo,
      categoria: categoriaBruto,
      data_nascimento: dataNascimento,
      peso_nascimento: pesoNascimento,
      origem,
      linhaOriginal: bruto,
    });
  }

  return { validas, rejeitadas };
}
