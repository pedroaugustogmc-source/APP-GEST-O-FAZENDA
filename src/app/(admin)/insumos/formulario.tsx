"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";

export function FormularioInsumo() {
  const router = useRouter();
  const [insumo, setInsumo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("");
  const [minimoAlerta, setMinimoAlerta] = useState("");
  const [validade, setValidade] = useState("");
  const [localArmazenamento, setLocalArmazenamento] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("estoque_insumos", "POST", {
      insumo,
      categoria,
      unidade,
      minimo_alerta: minimoAlerta ? Number(minimoAlerta.replace(",", ".")) : 0,
      validade: validade || null,
      local_armazenamento: localArmazenamento || null,
    });

    setSalvando(false);
    setInsumo("");
    setCategoria("");
    setUnidade("");
    setMinimoAlerta("");
    setValidade("");
    setLocalArmazenamento("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo insumo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="insumo">Insumo</Label>
            <Input id="insumo" placeholder="sal mineral" required value={insumo} onChange={(e) => setInsumo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Input
              id="categoria"
              placeholder="Alimentação, Sanidade, Pastagem..."
              required
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="unidade">Unidade</Label>
            <Input id="unidade" placeholder="kg, saco, litro, dose" required value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="minimoAlerta">Mínimo antes de alertar</Label>
            <Input
              id="minimoAlerta"
              inputMode="decimal"
              value={minimoAlerta}
              onChange={(e) => setMinimoAlerta(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="validade">Validade (opcional)</Label>
            <Input id="validade" type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="local">Onde fica guardado</Label>
            <Input id="local" value={localArmazenamento} onChange={(e) => setLocalArmazenamento(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
