"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { categoriasValidasParaSexo, type SexoAnimal } from "@/domain/validacao/categoriaSexo";

interface FormularioAnimalProps {
  lotes: Array<{ id: string; nome: string }>;
}

export function FormularioAnimal({ lotes }: FormularioAnimalProps) {
  const router = useRouter();
  const [brinco, setBrinco] = useState("");
  const [sexo, setSexo] = useState<SexoAnimal>("F");
  const categoriasDisponiveis = useMemo(() => categoriasValidasParaSexo(sexo), [sexo]);
  const [categoria, setCategoria] = useState(categoriasDisponiveis[0]);
  const [dataNascimento, setDataNascimento] = useState("");
  const [pesoNascimento, setPesoNascimento] = useState("");
  const [origem, setOrigem] = useState<"nascimento" | "compra">("nascimento");
  const [loteId, setLoteId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function mudarSexo(novoSexo: SexoAnimal) {
    setSexo(novoSexo);
    setCategoria(categoriasValidasParaSexo(novoSexo)[0]);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (dataNascimento && dataNascimento > new Date().toISOString().slice(0, 10)) {
      setErro("Data de nascimento não pode estar no futuro.");
      return;
    }

    setSalvando(true);

    await enfileirarOperacao("animais", "POST", {
      brinco: brinco || null,
      sexo,
      categoria,
      data_nascimento: dataNascimento || null,
      peso_nascimento: pesoNascimento ? Number(pesoNascimento.replace(",", ".")) : null,
      origem,
      lote_id: loteId || null,
    });

    setSalvando(false);
    setBrinco("");
    setDataNascimento("");
    setPesoNascimento("");
    setLoteId("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo animal</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brinco">Brinco (opcional)</Label>
            <Input id="brinco" value={brinco} onChange={(e) => setBrinco(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sexo">Sexo</Label>
            <Select id="sexo" value={sexo} onChange={(e) => mudarSexo(e.target.value as SexoAnimal)}>
              <option value="F">Fêmea</option>
              <option value="M">Macho</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)}>
              {categoriasDisponiveis.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="origem">Origem</Label>
            <Select id="origem" value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)}>
              <option value="nascimento">Nascimento na fazenda</option>
              <option value="compra">Compra</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataNascimento">Data de nascimento (opcional)</Label>
            <Input
              id="dataNascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pesoNascimento">Peso ao nascer, kg (opcional)</Label>
            <Input
              id="pesoNascimento"
              inputMode="decimal"
              value={pesoNascimento}
              onChange={(e) => setPesoNascimento(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="lote">Lote (opcional)</Label>
            <Select id="lote" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">— sem dado —</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.nome}
                </option>
              ))}
            </Select>
          </div>
          {erro && <p className="text-sm text-critico sm:col-span-2">{erro}</p>}
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
