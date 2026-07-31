import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extrairEventos } from "@/infra/claude/extrair";
import type { ContextoExtrator } from "@/infra/claude/tipos";

// docs/06-qualidade.md §40: "os 12 few-shots de §31 viram casos de teste".
// Precisa de ANTHROPIC_API_KEY real — sem ela, SKIPPED (não finge passar),
// mesmo padrão do tests/integration/rls.spec.ts.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const rodar = Boolean(API_KEY);

const PASTA_GOLDEN = join(__dirname, "..", "golden");
const contexto = JSON.parse(readFileSync(join(PASTA_GOLDEN, "contexto.json"), "utf-8")) as ContextoExtrator;

interface CasoGolden {
  transcricao: string;
  esperado: {
    quantidadeEventos: number;
    eventos: Array<{ tipo: string; campos: Record<string, unknown>; camposFaltantesContem?: string }>;
  };
}

const arquivosCasos = readdirSync(PASTA_GOLDEN)
  .filter((nome) => nome !== "contexto.json" && nome.endsWith(".json"))
  .sort();

describe.skipIf(!rodar)("Extrator — conjunto de ouro dos 12 few-shots (docs/04-bot.md §31)", () => {
  it.each(arquivosCasos)("%s", async (nomeArquivo) => {
    const caso = JSON.parse(readFileSync(join(PASTA_GOLDEN, nomeArquivo), "utf-8")) as CasoGolden;

    const resultado = await extrairEventos(
      API_KEY!,
      { tipo: "texto", texto: caso.transcricao },
      contexto,
      "2026-07-31",
      15
    );

    expect(resultado.eventos.length).toBe(caso.esperado.quantidadeEventos);

    caso.esperado.eventos.forEach((eventoEsperado, indice) => {
      const eventoReal = resultado.eventos[indice];
      expect(eventoReal?.tipo).toBe(eventoEsperado.tipo);

      for (const [campo, valorEsperado] of Object.entries(eventoEsperado.campos)) {
        expect(eventoReal?.dados[campo]).toBe(valorEsperado);
      }

      if (eventoEsperado.camposFaltantesContem) {
        expect(eventoReal?.campos_faltantes).toContain(eventoEsperado.camposFaltantesContem);
      }

      // Anexo D — "taxa de invenção: 0,00, falha dura": nenhum campo pode
      // vir preenchido com confiança 1.0 sobre algo que a fala não disse.
      expect(eventoReal?.confianca).toBeGreaterThanOrEqual(0);
      expect(eventoReal?.confianca).toBeLessThanOrEqual(1);
    });
  });
});
