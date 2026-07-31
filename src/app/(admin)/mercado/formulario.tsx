"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { parseReaisParaCentavos } from "@/lib/dinheiro";
import type { TipoPrecoMercadoDB } from "@/infra/supabase/tipos";
import { ORDEM_TIPOS_PRECO } from "./consultas";

const ROTULOS_TIPO: Record<TipoPrecoMercadoDB, string> = {
  arroba_boi: "Arroba do boi gordo",
  arroba_vaca: "Arroba da vaca gorda",
  bezerro: "Bezerro (cabeça)",
  bezerra: "Bezerra (cabeça)",
  garrote: "Garrote (cabeça)",
  novilha: "Novilha (cabeça)",
  leite_litro: "Leite (litro)",
};

const UNIDADE_PADRAO: Record<TipoPrecoMercadoDB, string> = {
  arroba_boi: "@",
  arroba_vaca: "@",
  bezerro: "cabeça",
  bezerra: "cabeça",
  garrote: "cabeça",
  novilha: "cabeça",
  leite_litro: "litro",
};

// docs/03-modulos.md M6: "sempre com fonte e data_referencia gravados: o
// sistema nunca exibe preço sem dizer de onde veio e de quando é." Pela fila
// offline padrão (mesma razão de /financeiro — offline é o estado normal do
// admin também, CLAUDE.md regra 8, não só do bot de campo).
export function FormularioPrecoMercado() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPrecoMercadoDB>("arroba_boi");
  const [valor, setValor] = useState("");
  const [praca, setPraca] = useState("Imperatriz-MA");
  const [fonte, setFonte] = useState("");
  const [dataReferencia, setDataReferencia] = useState(() => new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    let centavos: bigint;
    try {
      centavos = parseReaisParaCentavos(valor);
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Valor inválido.");
      return;
    }
    if (centavos <= 0n) {
      setErro("O valor precisa ser maior que zero.");
      return;
    }
    if (!fonte.trim()) {
      setErro("Informe de onde veio o preço (feira, corretor, jornal do campo).");
      return;
    }

    setSalvando(true);
    await enfileirarOperacao("precos_mercado", "POST", {
      tipo,
      valor_centavos: centavos.toString(),
      unidade: UNIDADE_PADRAO[tipo],
      praca,
      fonte,
      data_referencia: dataReferencia,
    });
    setSalvando(false);
    setFonte("");
    setValor("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo preço</CardTitle>
        <CardDescription>Toda entrada exige fonte e data — nunca aparece preço sem dizer de onde veio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco-tipo">Categoria</Label>
            <Select id="preco-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPrecoMercadoDB)}>
              {ORDEM_TIPOS_PRECO.map((t) => (
                <option key={t} value={t}>
                  {ROTULOS_TIPO[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco-valor">Valor (R$/{UNIDADE_PADRAO[tipo]})</Label>
            <Input id="preco-valor" inputMode="decimal" required placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco-data">Data de referência</Label>
            <Input id="preco-data" type="date" required value={dataReferencia} onChange={(e) => setDataReferencia(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco-praca">Praça</Label>
            <Input id="preco-praca" value={praca} onChange={(e) => setPraca(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="preco-fonte">Fonte</Label>
            <Input id="preco-fonte" required placeholder="ex.: feira do sábado, corretor João, rádio rural" value={fonte} onChange={(e) => setFonte(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-critico sm:col-span-2 lg:col-span-3">{erro}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
