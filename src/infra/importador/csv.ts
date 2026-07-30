import Papa from "papaparse";
import type { LinhaBruta } from "@/domain/validacao/importadorAnimais";

export interface CsvAnalisado {
  colunas: string[];
  linhas: LinhaBruta[];
}

/**
 * Parse de verdade (papaparse) — por isso vive em infra, não em domain
 * (regra: domain zero import de biblioteca externa). A validação de negócio
 * em cima do resultado é toda pura, em src/domain/validacao/importadorAnimais.ts.
 */
export function analisarCsv(conteudo: string): CsvAnalisado {
  const resultado = Papa.parse<Record<string, string>>(conteudo, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (cabecalho) => cabecalho.trim(),
  });

  const colunas = resultado.meta.fields ?? [];
  const linhas: LinhaBruta[] = resultado.data.map((valores, indice) => ({
    numeroLinha: indice + 2, // +1 pelo cabeçalho, +1 porque planilha começa em 1
    valores,
  }));

  return { colunas, linhas };
}
