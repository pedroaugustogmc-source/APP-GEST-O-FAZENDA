"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseReaisParaCentavos, formatarCentavos } from "@/lib/dinheiro";

interface LinhaOrcamento {
  fornecedor: string;
  preco: string;
  prazoDias: string;
  descontoAvistaPct: string;
  frete: string;
}

interface ResultadoComparacao {
  id: string;
  fornecedor: string;
  preco_centavos: string;
  prazo_dias: number;
  custo_efetivo_centavos: string;
  vencedora: boolean;
}

const LINHA_VAZIA: LinhaOrcamento = { fornecedor: "", preco: "", prazoDias: "0", descontoAvistaPct: "0", frete: "0" };

// docs/03-modulos.md M8 — "o admin cola 3 orçamentos de fornecedor... o
// sistema calcula o custo efetivo considerando prazo de pagamento e custo
// de oportunidade do capital." Ação síncrona: o resultado volta na hora,
// não passa pela fila offline (mesmo padrão de /financeiro/dre "ratear").
export function FormularioCotacoes() {
  const router = useRouter();
  const [insumo, setInsumo] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [linhas, setLinhas] = useState<LinhaOrcamento[]>([{ ...LINHA_VAZIA }, { ...LINHA_VAZIA }, { ...LINHA_VAZIA }]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoComparacao[] | null>(null);

  function atualizarLinha(indice: number, campo: keyof LinhaOrcamento, valor: string) {
    setLinhas((atual) => atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)));
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, { ...LINHA_VAZIA }]);
  }

  function removerLinha(indice: number) {
    setLinhas((atual) => atual.filter((_, i) => i !== indice));
  }

  async function comparar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setResultado(null);

    const preenchidas = linhas.filter((l) => l.fornecedor.trim() && l.preco.trim());
    if (preenchidas.length < 2) {
      setErro("Informe pelo menos 2 orçamentos (fornecedor + preço) para comparar.");
      return;
    }

    let cotacoes: Array<{
      fornecedor: string;
      preco_centavos: string;
      prazo_dias: number;
      desconto_avista_pct: number;
      frete_centavos: string;
    }>;
    try {
      cotacoes = preenchidas.map((l) => ({
        fornecedor: l.fornecedor,
        preco_centavos: parseReaisParaCentavos(l.preco).toString(),
        prazo_dias: Number(l.prazoDias) || 0,
        desconto_avista_pct: (Number(l.descontoAvistaPct) || 0) / 100,
        frete_centavos: parseReaisParaCentavos(l.frete || "0").toString(),
      }));
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Valor inválido em algum orçamento.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/cotacoes/comparar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ insumo, data, cotacoes }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.erro ?? `Falha (HTTP ${resposta.status})`);

      setResultado(corpo.resultado as ResultadoComparacao[]);
      router.refresh();
    } catch (excecao) {
      setErro(excecao instanceof Error ? excecao.message : "Não consegui comparar os orçamentos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comparar orçamentos</CardTitle>
        <CardDescription>
          O vencedor é calculado pelo custo efetivo (desconto à vista vs. custo de oportunidade do prazo) — pode não
          ser o de menor preço nominal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={comparar} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cotacao-insumo">Insumo / necessidade</Label>
              <Input id="cotacao-insumo" required placeholder="sal mineral" value={insumo} onChange={(e) => setInsumo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cotacao-data">Data</Label>
              <Input id="cotacao-data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {linhas.map((linha, indice) => (
              <div key={indice} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-5">
                <Input placeholder="fornecedor" value={linha.fornecedor} onChange={(e) => atualizarLinha(indice, "fornecedor", e.target.value)} />
                <Input inputMode="decimal" placeholder="preço R$" value={linha.preco} onChange={(e) => atualizarLinha(indice, "preco", e.target.value)} />
                <Input inputMode="numeric" placeholder="prazo (dias)" value={linha.prazoDias} onChange={(e) => atualizarLinha(indice, "prazoDias", e.target.value)} />
                <Input inputMode="decimal" placeholder="desconto à vista (%)" value={linha.descontoAvistaPct} onChange={(e) => atualizarLinha(indice, "descontoAvistaPct", e.target.value)} />
                <div className="flex gap-2">
                  <Input inputMode="decimal" placeholder="frete R$" value={linha.frete} onChange={(e) => atualizarLinha(indice, "frete", e.target.value)} />
                  {linhas.length > 2 && (
                    <Button type="button" variant="outline" onClick={() => removerLinha(indice)}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Button type="button" variant="outline" onClick={adicionarLinha}>
              + adicionar orçamento
            </Button>
          </div>

          {erro && <p className="text-sm text-critico">{erro}</p>}

          <div>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Comparando..." : "Comparar"}
            </Button>
          </div>

          {resultado && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="mb-2 font-medium text-foreground">Resultado:</p>
              <ul className="flex flex-col gap-1">
                {resultado
                  .slice()
                  .sort((a, b) => Number(BigInt(a.custo_efetivo_centavos) - BigInt(b.custo_efetivo_centavos)))
                  .map((r) => (
                    <li key={r.id} className={r.vencedora ? "font-semibold text-primary" : "text-muted-foreground"}>
                      {r.vencedora ? "Vencedor: " : ""}
                      {r.fornecedor} — preço nominal {formatarCentavos(BigInt(r.preco_centavos))}, prazo {r.prazo_dias} dia(s), custo efetivo{" "}
                      {formatarCentavos(BigInt(r.custo_efetivo_centavos))}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
