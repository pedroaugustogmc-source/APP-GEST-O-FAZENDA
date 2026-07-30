import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SeletorStatus } from "@/components/seletor-status";
import { transicaoValidaLote, TODOS_STATUS_LOTE, type StatusLote } from "@/domain/estados/lote";
import type { LoteRow, PastoRow } from "@/infra/supabase/tipos";
import { FormularioLote } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaLotes() {
  const supabase = criarClienteServidor();

  const [{ data: lotesData }, { data: pastosData }] = await Promise.all([
    supabase.from("lotes").select("*").is("deletado_em", null).order("nome"),
    supabase.from("pastos").select("id, nome").order("nome"),
  ]);

  const lotes = (lotesData ?? []) as LoteRow[];
  const pastos = (pastosData ?? []) as Array<Pick<PastoRow, "id" | "nome">>;
  const nomePasto = new Map(pastos.map((pasto) => [pasto.id, pasto.nome]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Lotes</h1>
      <FormularioLote pastos={pastos} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Operação</TableHead>
            <TableHead>Pasto</TableHead>
            <TableHead>Cabeças</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.map((lote) => (
            <TableRow key={lote.id}>
              <TableCell className="font-medium">{lote.nome}</TableCell>
              <TableCell>{lote.categoria}</TableCell>
              <TableCell>{lote.tipo_operacao}</TableCell>
              <TableCell>{lote.pasto_id ? nomePasto.get(lote.pasto_id) ?? "— sem dado —" : "— sem dado —"}</TableCell>
              <TableCell>{lote.cabecas_atuais}</TableCell>
              <TableCell>
                <SeletorStatus<StatusLote>
                  id={lote.id}
                  tabela="lotes"
                  atual={lote.status}
                  opcoes={TODOS_STATUS_LOTE}
                  ehValida={transicaoValidaLote}
                />
              </TableCell>
            </TableRow>
          ))}
          {lotes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum lote cadastrado — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
