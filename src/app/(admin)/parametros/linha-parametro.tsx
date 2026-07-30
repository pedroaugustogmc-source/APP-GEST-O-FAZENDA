"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { enfileirarOperacao } from "@/infra/offline/fila";

interface LinhaParametroProps {
  chave: string;
  valorAtual: string;
  unidade: string | null;
  descricao: string;
}

export function LinhaParametro({ chave, valorAtual, unidade, descricao }: LinhaParametroProps) {
  const [valor, setValor] = useState(valorAtual);
  const [pendente, iniciarTransicao] = useTransition();
  const mudou = valor !== valorAtual;

  function salvar() {
    iniciarTransicao(async () => {
      await enfileirarOperacao("parametros_fazenda", "PATCH", { chave, valor });
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{chave}</div>
        <div className="text-xs text-muted-foreground">{descricao}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input value={valor} onChange={(e) => setValor(e.target.value)} className="w-32" />
          {unidade && <span className="text-sm text-muted-foreground">{unidade}</span>}
        </div>
      </TableCell>
      <TableCell>
        {mudou && (
          <Button type="button" size="sm" onClick={salvar} disabled={pendente}>
            {pendente ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
