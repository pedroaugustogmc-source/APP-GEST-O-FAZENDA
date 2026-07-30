"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { TabelaSincronizavel } from "@/infra/offline/db";

interface SeletorStatusProps<T extends string> {
  id: string;
  tabela: TabelaSincronizavel;
  atual: T;
  opcoes: readonly T[];
  ehValida: (atual: T, alvo: T) => boolean;
  rotulos?: Partial<Record<T, string>>;
}

/**
 * Troca de status genérica para lote/animal/pasto — a validação de qual
 * transição é permitida vem sempre de src/domain/estados/*, nunca de um
 * `if` solto aqui (CLAUDE.md regra 5).
 */
export function SeletorStatus<T extends string>({
  id,
  tabela,
  atual,
  opcoes,
  ehValida,
  rotulos,
}: SeletorStatusProps<T>) {
  const [selecionado, setSelecionado] = useState<T>(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const mudou = selecionado !== atual;

  function salvar() {
    setErro(null);
    if (!ehValida(atual, selecionado)) {
      setErro("Essa mudança de status não é permitida.");
      return;
    }
    iniciarTransicao(async () => {
      await enfileirarOperacao(tabela, "PATCH", { id, status: selecionado });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selecionado}
        onChange={(evento) => setSelecionado(evento.target.value as T)}
        className="h-10 w-auto"
        aria-label="Status"
      >
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {rotulos?.[opcao] ?? opcao}
          </option>
        ))}
      </Select>
      {mudou && (
        <Button type="button" size="sm" onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
      )}
      {erro && <span className="text-xs text-critico">{erro}</span>}
    </div>
  );
}
