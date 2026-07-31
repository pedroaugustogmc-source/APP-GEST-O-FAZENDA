"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";

// docs/03-modulos.md M8: "checklist automatizado de manutenção (cerca,
// curral, bebedouro, maquinário) com recorrência." Cada item aqui é um
// TEMPLATE — o worker semanal (src/app/api/workers/rotina-semanal) gera
// uma tarefa nova quando proxima_execucao <= hoje.
export function FormularioChecklistItem() {
  const router = useRouter();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [recorrenciaDias, setRecorrenciaDias] = useState("30");
  const [proximaExecucao, setProximaExecucao] = useState(() => new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    const dias = Number(recorrenciaDias);
    if (!Number.isFinite(dias) || dias <= 0) {
      setErro("A recorrência precisa ser um número de dias maior que zero.");
      return;
    }

    setSalvando(true);
    await enfileirarOperacao("checklist_itens", "POST", {
      descricao,
      categoria,
      recorrencia_dias: dias,
      proxima_execucao: proximaExecucao,
      ativo: true,
    });
    setSalvando(false);
    setDescricao("");
    setCategoria("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo item de checklist</CardTitle>
        <CardDescription>Ex.: revisar cerca do pasto 3, a cada 30 dias.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="checklist-descricao">O que checar</Label>
            <Input id="checklist-descricao" required placeholder="revisar cerca do pasto 3" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="checklist-categoria">Categoria</Label>
            <Input id="checklist-categoria" required placeholder="cerca, curral, bebedouro..." value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="checklist-recorrencia">Recorrência (dias)</Label>
            <Input id="checklist-recorrencia" inputMode="numeric" required value={recorrenciaDias} onChange={(e) => setRecorrenciaDias(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="checklist-proxima">Próxima checagem</Label>
            <Input id="checklist-proxima" type="date" required value={proximaExecucao} onChange={(e) => setProximaExecucao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-critico sm:col-span-2 lg:col-span-4">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
