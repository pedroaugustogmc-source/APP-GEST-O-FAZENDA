import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { TarefaRow } from "@/infra/supabase/tipos";
import { LinhaTarefa } from "./linha-tarefa";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M8 "escala de trabalho por prioridade" + §41.13:
// "dado o início da semana, existe uma agenda com tarefas ordenadas e cada
// uma com uma frase de justificativa." Geradas automaticamente pelo worker
// /api/workers/rotina-semanal (score via scoreTarefa, Anexo B) — o admin só
// marca concluído/cancelado aqui.
export default async function PaginaTarefas() {
  const supabase = criarClienteServidor();

  const { data } = await supabase
    .from("tarefas")
    .select("*")
    .in("status", ["pendente", "em_andamento"])
    .order("score_prioridade", { ascending: false, nullsFirst: false });

  const tarefas = (data ?? []) as TarefaRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tarefas da semana</h1>
        <p className="text-sm text-muted-foreground">
          Priorizadas automaticamente (score = impacto×0,40 + urgência×0,30 + risco×0,20 − custo×0,10) a partir dos
          alertas abertos e do checklist recorrente. As de maior score sobem para o Google Calendar quando
          configurado.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Justificativa</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tarefas.map((tarefa) => (
            <LinhaTarefa key={tarefa.id} tarefa={tarefa} />
          ))}
          {tarefas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhuma tarefa pendente — a rotina semanal gera a agenda automaticamente toda segunda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
