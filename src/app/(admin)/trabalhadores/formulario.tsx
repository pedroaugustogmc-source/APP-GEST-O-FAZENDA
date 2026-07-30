"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { PlataformaBotDB } from "@/infra/supabase/tipos";

export function FormularioTrabalhador() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [plataforma, setPlataforma] = useState<PlataformaBotDB>("telegram");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("usuarios_acesso", "POST", {
      nome,
      telefone,
      plataforma,
      papel: "trabalhador",
      status: "ativo",
      data_admissao: new Date().toISOString().slice(0, 10),
    });

    setSalvando(false);
    setNome("");
    setTelefone("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo trabalhador</CardTitle>
        <CardDescription>
          Ele só vai conseguir usar o bot depois que a Fase 2 estiver no ar — mas já dá para cadastrar o
          número agora, para não esquecer ninguém do piloto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone (com DDD e +55)</Label>
            <Input
              id="telefone"
              placeholder="+5599999999999"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plataforma">Onde ele vai falar com o bot</Label>
            <Select
              id="plataforma"
              value={plataforma}
              onChange={(e) => setPlataforma(e.target.value as PlataformaBotDB)}
            >
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp (só a partir da Fase 6)</option>
            </Select>
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
