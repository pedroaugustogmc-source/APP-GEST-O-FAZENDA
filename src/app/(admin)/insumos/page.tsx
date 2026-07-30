import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { InsumoRow } from "@/infra/supabase/tipos";
import { FormularioInsumo } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaInsumos() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("estoque_insumos").select("*").order("insumo");
  const insumos = (data ?? []) as InsumoRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Insumos</h1>
      <FormularioInsumo />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Quantidade</TableHead>
            <TableHead>Mínimo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {insumos.map((insumo) => (
            <TableRow key={insumo.id}>
              <TableCell className="font-medium">{insumo.insumo}</TableCell>
              <TableCell>{insumo.categoria}</TableCell>
              <TableCell>{insumo.unidade}</TableCell>
              <TableCell>{insumo.quantidade}</TableCell>
              <TableCell>{insumo.minimo_alerta}</TableCell>
            </TableRow>
          ))}
          {insumos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum insumo cadastrado — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">
        Entrada e saída de estoque (compra, consumo) chegam na Fase 4/5 junto com o financeiro — aqui é só o
        catálogo do que existe.
      </p>
    </div>
  );
}
