"use client";

import { Button } from "@/components/ui/button";

function paraCsv(indicadores: Record<string, unknown>): string {
  const linhas = [["indicador", "valor"]];
  for (const [chave, valor] of Object.entries(indicadores)) {
    const texto = typeof valor === "object" && valor !== null ? JSON.stringify(valor) : String(valor);
    linhas.push([chave, texto.replaceAll('"', '""')]);
  }
  return linhas.map((linha) => linha.map((celula) => `"${celula}"`).join(",")).join("\n");
}

export function ExportarCsv({ indicadores, nomeArquivo }: { indicadores: Record<string, unknown>; nomeArquivo: string }) {
  function exportar() {
    const csv = paraCsv(indicadores);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={exportar}>
      Exportar CSV
    </Button>
  );
}
