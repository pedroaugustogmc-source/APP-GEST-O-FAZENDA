"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BotaoGerarRelatorio() {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setErro(null);
    setGerando(true);
    try {
      const resposta = await fetch("/api/relatorios/gerar", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);
      router.push(`/relatorios/${corpo.id}`);
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui gerar o relatório.");
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={gerar} disabled={gerando}>
        {gerando ? "Gerando..." : "Gerar relatório geral agora"}
      </Button>
      {erro && <p className="text-sm text-critico">{erro}</p>}
    </div>
  );
}
