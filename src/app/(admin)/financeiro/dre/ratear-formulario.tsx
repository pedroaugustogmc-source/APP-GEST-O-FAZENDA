"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseReaisParaCentavos, formatarCentavos } from "@/lib/dinheiro";
import { CATEGORIAS_FINANCEIRAS } from "@/domain/tipos/categoriasFinanceiras";

interface RateioResultado {
  rateado_em_lotes: number;
  lancamentos: Array<{ loteId: string; loteNome: string; valorCentavos: number }>;
}

// docs/03-modulos.md M5 — rateio de custo comum por UA × dias. Ação
// pontual, não vai pela fila offline (é admin, com conexão — só o
// trabalhador de campo é sempre offline, CLAUDE.md regra 7/8): manda o
// valor total, o servidor divide entre os lotes ativos e grava uma linha
// de `financeiro` por lote (src/app/api/financeiro/ratear/route.ts).
export function RatearFormulario() {
  const router = useRouter();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_FINANCEIRAS[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<RateioResultado | null>(null);

  async function ratear(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setResultado(null);

    let centavos: bigint;
    try {
      centavos = parseReaisParaCentavos(valor);
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Valor inválido.");
      return;
    }
    if (centavos <= 0n) {
      setErro("O valor a ratear precisa ser maior que zero.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Descreva o que está sendo rateado (ex.: energia da sede, diária do peão).");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/financeiro/ratear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data, categoria, descricao, valor_centavos: centavos.toString() }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);

      setResultado(corpo as RateioResultado);
      setDescricao("");
      setValor("");
      router.refresh();
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui ratear o custo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ratear custo comum entre os lotes ativos</CardTitle>
        <CardDescription>
          Peso por UA × dias no lote (docs/01-dominio.md §9). Um valor só (ex.: conta de energia, diária de peão que
          trabalhou em vários lotes) vira uma linha de custo por lote, na proporção do peso vivo e do tempo de cada
          um.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={ratear} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ratear-data">Data</Label>
            <Input id="ratear-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ratear-categoria">Categoria</Label>
            <Select id="ratear-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ratear-valor">Valor total (R$)</Label>
            <Input id="ratear-valor" inputMode="decimal" required placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ratear-descricao">O que é</Label>
            <Input id="ratear-descricao" required placeholder="ex.: energia da sede" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-critico sm:col-span-2 lg:col-span-4">{erro}</p>}
          {resultado && (
            <div className="text-sm text-foreground sm:col-span-2 lg:col-span-4">
              <p className="font-medium">Rateado entre {resultado.rateado_em_lotes} lote(s):</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {resultado.lancamentos.map((l) => (
                  <li key={l.loteId}>
                    {l.loteNome}: {formatarCentavos(BigInt(l.valorCentavos))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Rateando..." : "Ratear"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
