import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { ChecklistItemRow } from "@/infra/supabase/tipos";
import { FormularioChecklistItem } from "./formulario";
import { LinhaChecklist } from "./linha-checklist";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M8 — checklist automatizado de manutenção com
// recorrência. Cada item é um template; o worker semanal
// (/api/workers/rotina-semanal) gera uma tarefa em /tarefas quando vence.
export default async function PaginaChecklist() {
  const supabase = criarClienteServidor();

  const [{ data: itensData }, { data: tarefasAbertasData }] = await Promise.all([
    supabase.from("checklist_itens").select("*").order("proxima_execucao"),
    supabase.from("tarefas").select("entidade_id").eq("entidade_tipo", "checklist_itens").eq("status", "pendente"),
  ]);

  const itens = (itensData ?? []) as ChecklistItemRow[];
  const idsComTarefaAberta = new Set(((tarefasAbertasData ?? []) as Array<{ entidade_id: string | null }>).map((t) => t.entidade_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Checklist</h1>
        <p className="text-sm text-muted-foreground">
          Itens recorrentes de manutenção (cerca, curral, bebedouro, maquinário). Quando a data vence, uma tarefa
          aparece em <span className="font-medium">Tarefas</span> automaticamente.
        </p>
      </div>

      <FormularioChecklistItem />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>O que checar</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Recorrência</TableHead>
            <TableHead>Próxima checagem</TableHead>
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <LinhaChecklist key={item.id} item={item} temTarefaAberta={idsComTarefaAberta.has(item.id)} />
          ))}
          {itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum item de checklist ainda — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
