"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { TarefaRow } from "@/infra/supabase/tipos";

export function LinhaTarefa({ tarefa }: { tarefa: TarefaRow }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function marcar(acao: "concluir" | "cancelar") {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch(`/api/tarefas/${tarefa.id}/concluir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);
      router.refresh();
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui atualizar a tarefa.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {tarefa.descricao}
        {erro && <p className="text-xs font-normal text-critico">{erro}</p>}
      </TableCell>
      <TableCell className="text-muted-foreground">{tarefa.justificativa ?? "— sem dado —"}</TableCell>
      <TableCell>
        <Badge variant={tarefa.origem === "auto" ? "outline" : "secondary"}>{tarefa.origem}</Badge>
      </TableCell>
      <TableCell>{tarefa.score_prioridade !== null ? tarefa.score_prioridade.toFixed(1) : "— sem dado —"}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => marcar("concluir")} disabled={enviando}>
            Concluir
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => marcar("cancelar")} disabled={enviando}>
            Cancelar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
