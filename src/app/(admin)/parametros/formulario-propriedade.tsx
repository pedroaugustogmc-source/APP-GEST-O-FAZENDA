"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { PropriedadeRow } from "@/infra/supabase/tipos";

interface FormularioPropriedadeProps {
  propriedade: PropriedadeRow | null;
}

export function FormularioPropriedade({ propriedade }: FormularioPropriedadeProps) {
  const router = useRouter();
  const [nome, setNome] = useState(propriedade?.nome ?? "");
  const [municipio, setMunicipio] = useState(propriedade?.municipio ?? "Imperatriz");
  const [areaTotalHa, setAreaTotalHa] = useState(propriedade?.area_total_ha?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("propriedade", propriedade ? "PATCH" : "POST", {
      ...(propriedade ? { id: propriedade.id } : {}),
      nome,
      municipio,
      area_total_ha: areaTotalHa ? Number(areaTotalHa.replace(",", ".")) : null,
    });

    setSalvando(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propriedade</CardTitle>
        <CardDescription>
          {propriedade
            ? "Editar os dados da fazenda."
            : "Ainda sem dado — preencha para a fazenda aparecer nos relatórios das próximas fases."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nomeProp">Nome da fazenda</Label>
            <Input id="nomeProp" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="municipio">Município</Label>
            <Input id="municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="area">Área total (ha)</Label>
            <Input
              id="area"
              inputMode="decimal"
              value={areaTotalHa}
              onChange={(e) => setAreaTotalHa(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
