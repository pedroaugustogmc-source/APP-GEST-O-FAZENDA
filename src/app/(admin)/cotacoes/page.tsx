import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatarCentavos } from "@/lib/dinheiro";
import type { CotacaoRow } from "@/infra/supabase/tipos";
import { FormularioCotacoes } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaCotacoes() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("cotacoes").select("*").order("data", { ascending: false }).limit(100);
  const cotacoes = (data ?? []) as CotacaoRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cotações</h1>
        <p className="text-sm text-muted-foreground">
          Comparador de orçamentos por custo efetivo — considera prazo de pagamento e desconto à vista, não só o
          preço nominal.
        </p>
      </div>

      <FormularioCotacoes />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Insumo</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Preço nominal</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Custo efetivo</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cotacoes.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{new Date(`${c.data}T00:00:00`).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>{c.insumo}</TableCell>
              <TableCell>{c.fornecedor}</TableCell>
              <TableCell>{formatarCentavos(BigInt(c.preco_centavos))}</TableCell>
              <TableCell>{c.prazo_dias} dia(s)</TableCell>
              <TableCell>{c.custo_efetivo_centavos !== null ? formatarCentavos(BigInt(c.custo_efetivo_centavos)) : "— sem dado —"}</TableCell>
              <TableCell>{c.vencedora && <Badge>vencedor</Badge>}</TableCell>
            </TableRow>
          ))}
          {cotacoes.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhuma cotação comparada ainda — use o formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
