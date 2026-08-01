"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PropriedadeRow } from "@/infra/supabase/tipos";

// Ação síncrona direto na tabela (PATCH /api/propriedade, já existe desde a
// F1) — não passa pela fila offline, mesmo padrão de outras telas de
// configuração pontual (não é um cadastro de campo do dia a dia).
export function FormularioEditarPropriedade({ propriedade }: { propriedade: PropriedadeRow }) {
  const router = useRouter();
  const [nome, setNome] = useState(propriedade.nome);
  const [municipio, setMunicipio] = useState(propriedade.municipio);
  const [areaTotalHa, setAreaTotalHa] = useState(propriedade.area_total_ha?.toString() ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resposta = await fetch("/api/propriedade", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: propriedade.id,
          nome,
          municipio,
          area_total_ha: areaTotalHa.trim() ? Number(areaTotalHa) : null,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);
      router.refresh();
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="propriedade-nome">Nome da fazenda</Label>
        <Input id="propriedade-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="propriedade-municipio">Município</Label>
        <Input id="propriedade-municipio" required value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="propriedade-area">Área total (ha)</Label>
        <Input
          id="propriedade-area"
          inputMode="decimal"
          value={areaTotalHa}
          onChange={(e) => setAreaTotalHa(e.target.value)}
        />
      </div>
      {erro && <p className="sm:col-span-3 text-sm text-critico">{erro}</p>}
      <div className="sm:col-span-3">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
