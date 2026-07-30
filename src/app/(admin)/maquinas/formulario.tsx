"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { TipoMaquinaDB } from "@/infra/supabase/tipos";

const TIPOS: TipoMaquinaDB[] = ["trator", "implemento", "veiculo", "bomba", "gerador", "outro"];

export function FormularioMaquina() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoMaquinaDB>("trator");
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("maquinas", "POST", {
      nome,
      tipo,
      fabricante: fabricante || null,
      modelo,
      ano: ano ? Number(ano) : null,
      numero_serie: numeroSerie || null,
    });

    setSalvando(false);
    setNome("");
    setFabricante("");
    setModelo("");
    setAno("");
    setNumeroSerie("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova máquina</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome (como você chama ela)</Label>
            <Input id="nome" placeholder="trator vermelho" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMaquinaDB)}>
              {TIPOS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fabricante">Fabricante</Label>
            <Input id="fabricante" value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="modelo">Modelo</Label>
            <Input id="modelo" required value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ano">Ano</Label>
            <Input id="ano" inputMode="numeric" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="numeroSerie">Número de série (opcional)</Label>
            <Input id="numeroSerie" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
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
