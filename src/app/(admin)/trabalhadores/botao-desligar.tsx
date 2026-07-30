"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { desligarUsuario, type StatusUsuario } from "@/domain/estados/usuario";

interface BotaoDesligarProps {
  id: string;
  status: StatusUsuario;
}

/**
 * §M11: desligar não apaga o que a pessoa registrou — só derruba o acesso.
 * A regra (não pode desligar quem já tá desligado; desligamento sempre
 * carrega a data) vem de src/domain/estados/usuario.ts, não de um `if` aqui.
 */
export function BotaoDesligar({ id, status }: BotaoDesligarProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  if (status === "inativo") {
    return <span className="text-sm text-muted-foreground">desligado</span>;
  }

  function desligar() {
    setErro(null);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const resultado = desligarUsuario(status, hoje);
      iniciarTransicao(async () => {
        await enfileirarOperacao("usuarios_acesso", "PATCH", {
          id,
          status: resultado.status,
          data_desligamento: resultado.dataDesligamento,
        });
      });
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não foi possível desligar.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="critico" size="sm" onClick={desligar} disabled={pendente}>
        {pendente ? "Desligando..." : "Desligar"}
      </Button>
      {erro && <span className="text-xs text-critico">{erro}</span>}
    </div>
  );
}
