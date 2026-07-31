import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatarCentavos } from "@/lib/dinheiro";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import type { FinanceiroRow, LoteRow } from "@/infra/supabase/tipos";
import { FormularioFinanceiro } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaFinanceiro() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();

  const [{ data: lancamentosData }, { data: lotesData }] = await Promise.all([
    supabase.from("financeiro").select("*").is("deletado_em", null).order("data", { ascending: false }).limit(200),
    supabase.from("lotes").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  const lancamentos = (lancamentosData ?? []) as FinanceiroRow[];
  const lotes = (lotesData ?? []) as Array<Pick<LoteRow, "id" | "nome">>;
  const nomePorLote = new Map(lotes.map((l) => [l.id, l.nome]));

  const vencidosNaoPagos = lancamentos.filter((l) => !l.pago && l.vencimento && l.vencimento < hoje);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Lançamento direto pelo admin. O bot já grava despesa/receita por voz desde a Fase 2 — esta tela
          complementa (compras administrativas, correções, contas que não passam pelo campo).
        </p>
      </div>

      {vencidosNaoPagos.length > 0 && (
        <div className="rounded-md border border-critico bg-critico/5 p-4 text-sm">
          <p className="font-semibold text-critico">
            {vencidosNaoPagos.length} conta(s) vencida(s) e ainda não paga(s)/recebida(s).
          </p>
        </div>
      )}

      <FormularioFinanceiro lotes={lotes} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Centro de custo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lancamentos.map((lancamento) => {
            const vencido = !lancamento.pago && lancamento.vencimento && lancamento.vencimento < hoje;
            return (
              <TableRow key={lancamento.id}>
                <TableCell>{new Date(`${lancamento.data}T00:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Badge variant={lancamento.tipo === "receita" ? "default" : "outline"}>{lancamento.tipo}</Badge>
                </TableCell>
                <TableCell>
                  {lancamento.categoria}
                  {lancamento.subcategoria && <span className="text-muted-foreground"> · {lancamento.subcategoria}</span>}
                </TableCell>
                <TableCell>{lancamento.lote_id ? nomePorLote.get(lancamento.lote_id) ?? "— sem dado —" : "—"}</TableCell>
                <TableCell>{lancamento.centro_custo}</TableCell>
                <TableCell className={lancamento.tipo === "receita" ? "text-primary" : "text-foreground"}>
                  {formatarCentavos(lancamento.valor_centavos)}
                </TableCell>
                <TableCell>
                  {lancamento.pago ? (
                    <Badge variant="outline">pago</Badge>
                  ) : vencido ? (
                    <Badge variant="critico">vencido</Badge>
                  ) : (
                    <Badge variant="outline">pendente</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {lancamentos.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhum lançamento ainda — comece pelo formulário acima ou espere o bot registrar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
