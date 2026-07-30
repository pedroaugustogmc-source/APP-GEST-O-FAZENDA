import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SeletorStatus } from "@/components/seletor-status";
import { transicaoValidaPasto, TODOS_STATUS_PASTO, type StatusPasto } from "@/domain/estados/pasto";
import type { PastoRow } from "@/infra/supabase/tipos";
import { FormularioPasto } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaPastos() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("pastos").select("*").order("nome");
  const pastos = (data ?? []) as PastoRow[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Pastos</h1>
      <FormularioPasto />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tamanho (ha)</TableHead>
            <TableHead>Capim</TableHead>
            <TableHead>Açude</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pastos.map((pasto) => (
            <TableRow key={pasto.id}>
              <TableCell className="font-medium">{pasto.nome}</TableCell>
              <TableCell>{pasto.tamanho_ha.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{pasto.capim ?? "— sem dado —"}</TableCell>
              <TableCell>
                {pasto.tem_acude ? (
                  pasto.nivel_acude !== null ? (
                    `${pasto.nivel_acude}%`
                  ) : (
                    "— sem dado —"
                  )
                ) : (
                  <Badge variant="outline">sem açude</Badge>
                )}
              </TableCell>
              <TableCell>
                <SeletorStatus<StatusPasto>
                  id={pasto.id}
                  tabela="pastos"
                  atual={pasto.status}
                  opcoes={TODOS_STATUS_PASTO}
                  ehValida={transicaoValidaPasto}
                />
              </TableCell>
            </TableRow>
          ))}
          {pastos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum pasto cadastrado — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
