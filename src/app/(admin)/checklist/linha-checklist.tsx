"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { ChecklistItemRow } from "@/infra/supabase/tipos";

export function LinhaChecklist({ item, temTarefaAberta }: { item: ChecklistItemRow; temTarefaAberta: boolean }) {
  const router = useRouter();
  const [alternando, setAlternando] = useState(false);

  async function alternarAtivo() {
    setAlternando(true);
    await enfileirarOperacao("checklist_itens", "PATCH", { id: item.id, ativo: !item.ativo });
    setAlternando(false);
    router.refresh();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{item.descricao}</TableCell>
      <TableCell>{item.categoria}</TableCell>
      <TableCell>a cada {item.recorrencia_dias} dia(s)</TableCell>
      <TableCell>{new Date(`${item.proxima_execucao}T00:00:00`).toLocaleDateString("pt-BR")}</TableCell>
      <TableCell>{temTarefaAberta && <Badge variant="secondary">tarefa aberta</Badge>}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={item.ativo ? "default" : "outline"}>{item.ativo ? "ativo" : "pausado"}</Badge>
          <Button type="button" variant="outline" onClick={alternarAtivo} disabled={alternando}>
            {item.ativo ? "Pausar" : "Reativar"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
