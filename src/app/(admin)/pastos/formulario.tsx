"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";

export function FormularioPasto() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [apelidos, setApelidos] = useState("");
  const [tamanhoHa, setTamanhoHa] = useState("");
  const [capim, setCapim] = useState("");
  const [temAcude, setTemAcude] = useState(false);
  const [nivelAcude, setNivelAcude] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("pastos", "POST", {
      nome,
      apelidos: apelidos
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      tamanho_ha: Number(tamanhoHa.replace(",", ".")),
      capim: capim || null,
      tem_acude: temAcude,
      nivel_acude: temAcude && nivelAcude ? Number(nivelAcude) : null,
      observacao: observacao || null,
    });

    setSalvando(false);
    setNome("");
    setApelidos("");
    setTamanhoHa("");
    setCapim("");
    setTemAcude(false);
    setNivelAcude("");
    setObservacao("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo pasto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apelidos">Apelidos (separados por vírgula)</Label>
            <Input
              id="apelidos"
              placeholder="pasto do buriti, buritizinho"
              value={apelidos}
              onChange={(e) => setApelidos(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tamanho">Tamanho (ha)</Label>
            <Input
              id="tamanho"
              inputMode="decimal"
              required
              value={tamanhoHa}
              onChange={(e) => setTamanhoHa(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="capim">Capim</Label>
            <Input
              id="capim"
              placeholder="ex.: Marandu, Mombaça, Massai"
              value={capim}
              onChange={(e) => setCapim(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="acude"
              type="checkbox"
              className="h-5 w-5"
              checked={temAcude}
              onChange={(e) => setTemAcude(e.target.checked)}
            />
            <Label htmlFor="acude">Tem açude</Label>
          </div>
          {temAcude && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="nivel">Nível do açude (%)</Label>
              <Input
                id="nivel"
                inputMode="numeric"
                value={nivelAcude}
                onChange={(e) => setNivelAcude(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="observacao">Observação</Label>
            <Input id="observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
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
