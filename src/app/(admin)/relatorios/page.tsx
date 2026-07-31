import Link from "next/link";
import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RelatorioRow } from "@/infra/supabase/tipos";
import { BotaoGerarRelatorio } from "./botao-gerar";

export const dynamic = "force-dynamic";

const ROTULO_TIPO: Record<string, string> = {
  geral: "Geral (sob demanda)",
  semanal: "Consolidação semanal",
  trimestral: "Briefing trimestral",
  sob_demanda: "Sob demanda",
};

// docs/03-modulos.md M9 — relatórios. Geral é sob demanda (botão abaixo);
// semanal e trimestral são gerados sozinhos pelo worker
// /api/workers/rotina-semanal e aparecem aqui automaticamente.
export default async function PaginaRelatorios() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("relatorios").select("id, tipo, periodo_inicio, periodo_fim, gerado_em").order("gerado_em", { ascending: false }).limit(50);
  const relatorios = (data ?? []) as Array<Pick<RelatorioRow, "id" | "tipo" | "periodo_inicio" | "periodo_fim" | "gerado_em">>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Linguagem direta, sem jargão — todo número vem com contexto e data. A consolidação semanal e o briefing
          trimestral são gerados sozinhos; o geral é sob demanda.
        </p>
      </div>

      <BotaoGerarRelatorio />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Gerado em</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relatorios.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Badge variant="outline">{ROTULO_TIPO[r.tipo] ?? r.tipo}</Badge>
              </TableCell>
              <TableCell>
                {new Date(`${r.periodo_inicio}T00:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${r.periodo_fim}T00:00:00`).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>{new Date(r.gerado_em).toLocaleString("pt-BR")}</TableCell>
              <TableCell>
                <Link href={`/relatorios/${r.id}`} className="font-medium text-primary hover:underline">
                  Ver →
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {relatorios.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum relatório gerado ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
