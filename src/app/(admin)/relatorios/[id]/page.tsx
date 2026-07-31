import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/infra/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import type { RelatorioRow } from "@/infra/supabase/tipos";
import { MarkdownSimples } from "../markdown-simples";
import { ExportarCsv } from "../exportar-csv";
import { BotaoImprimir } from "./botao-imprimir";

export const dynamic = "force-dynamic";

const ROTULO_TIPO: Record<string, string> = {
  geral: "Relatório geral",
  semanal: "Consolidação semanal",
  trimestral: "Briefing trimestral",
  sob_demanda: "Relatório sob demanda",
};

// docs/03-modulos.md M9.4: "exportação em PDF e CSV." PDF fica pela
// impressão do navegador (mesmo @page da F2, /cartao-bolso) — decisão
// registrada em ESTADO.md, sem lib de geração de PDF nova.
export default async function PaginaRelatorio({ params }: { params: { id: string } }) {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("relatorios").select("*").eq("id", params.id).maybeSingle();
  const relatorio = data as RelatorioRow | null;

  if (!relatorio) notFound();

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; }
          .nao-imprimir { display: none !important; }
        }
        @page { size: A4; margin: 20mm; }
      `}</style>

      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{ROTULO_TIPO[relatorio.tipo] ?? relatorio.tipo}</h1>
          <p className="text-sm text-muted-foreground">
            Período: {relatorio.periodo_inicio} a {relatorio.periodo_fim} · Gerado em{" "}
            {new Date(relatorio.gerado_em).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          <BotaoImprimir />
          {relatorio.indicadores && (
            <ExportarCsv indicadores={relatorio.indicadores} nomeArquivo={`relatorio-${relatorio.tipo}-${relatorio.periodo_fim}.csv`} />
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <MarkdownSimples conteudo={relatorio.conteudo_md} />
        </CardContent>
      </Card>
    </div>
  );
}
