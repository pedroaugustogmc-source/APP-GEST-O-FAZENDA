import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { MaquinaRow } from "@/infra/supabase/tipos";
import { FormularioMaquina } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaMaquinas() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("maquinas").select("*").order("nome");
  const maquinas = (data ?? []) as MaquinaRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Máquinas</h1>
      <FormularioMaquina />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Ano</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {maquinas.map((maquina) => (
            <TableRow key={maquina.id}>
              <TableCell className="font-medium">{maquina.nome}</TableCell>
              <TableCell>{maquina.tipo}</TableCell>
              <TableCell>
                {maquina.fabricante ? `${maquina.fabricante} ${maquina.modelo}` : maquina.modelo}
              </TableCell>
              <TableCell>{maquina.ano ?? "— sem dado —"}</TableCell>
              <TableCell>
                <Badge variant={maquina.status === "ativa" ? "default" : "outline"}>{maquina.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {maquinas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhuma máquina cadastrada — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
