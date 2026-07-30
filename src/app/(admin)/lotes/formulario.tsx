"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import type { CategoriaAnimalDB, TipoOperacaoDB } from "@/infra/supabase/tipos";

const CATEGORIAS: CategoriaAnimalDB[] = [
  "bezerro",
  "bezerra",
  "garrote",
  "novilha",
  "vaca",
  "touro",
  "boi",
];
const TIPOS_OPERACAO: TipoOperacaoDB[] = ["cria", "recria", "engorda", "leite", "misto"];

interface FormularioLoteProps {
  pastos: Array<{ id: string; nome: string }>;
}

export function FormularioLote({ pastos }: FormularioLoteProps) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaAnimalDB>("garrote");
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacaoDB>("recria");
  const [pesoEntrada, setPesoEntrada] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [pastoId, setPastoId] = useState("");
  const [cabecasAtuais, setCabecasAtuais] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);

    await enfileirarOperacao("lotes", "POST", {
      nome,
      categoria,
      tipo_operacao: tipoOperacao,
      peso_entrada: pesoEntrada ? Number(pesoEntrada.replace(",", ".")) : null,
      data_entrada: dataEntrada,
      pasto_id: pastoId || null,
      cabecas_atuais: cabecasAtuais ? Number(cabecasAtuais) : 0,
      observacao: observacao || null,
    });

    setSalvando(false);
    setNome("");
    setPesoEntrada("");
    setDataEntrada("");
    setPastoId("");
    setCabecasAtuais("");
    setObservacao("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo lote</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaAnimalDB)}
            >
              {CATEGORIAS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipoOperacao">Tipo de operação</Label>
            <Select
              id="tipoOperacao"
              value={tipoOperacao}
              onChange={(e) => setTipoOperacao(e.target.value as TipoOperacaoDB)}
            >
              {TIPOS_OPERACAO.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pasto">Pasto</Label>
            <Select id="pasto" value={pastoId} onChange={(e) => setPastoId(e.target.value)}>
              <option value="">— sem dado —</option>
              {pastos.map((pasto) => (
                <option key={pasto.id} value={pasto.id}>
                  {pasto.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pesoEntrada">Peso médio de entrada (kg)</Label>
            <Input
              id="pesoEntrada"
              inputMode="decimal"
              value={pesoEntrada}
              onChange={(e) => setPesoEntrada(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cabecas">Cabeças</Label>
            <Input
              id="cabecas"
              inputMode="numeric"
              value={cabecasAtuais}
              onChange={(e) => setCabecasAtuais(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataEntrada">Data de entrada</Label>
            <Input
              id="dataEntrada"
              type="date"
              required
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
            />
          </div>
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
