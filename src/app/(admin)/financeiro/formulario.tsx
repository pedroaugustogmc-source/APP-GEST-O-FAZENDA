"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enfileirarOperacao } from "@/infra/offline/fila";
import { parseReaisParaCentavos } from "@/lib/dinheiro";
import { CATEGORIAS_FINANCEIRAS } from "@/domain/tipos/categoriasFinanceiras";

interface FormularioFinanceiroProps {
  lotes: Array<{ id: string; nome: string }>;
}

const CENTROS_CUSTO = ["cria", "recria", "leite", "estrutura", "administrativo"] as const;

export function FormularioFinanceiro({ lotes }: FormularioFinanceiroProps) {
  const router = useRouter();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<"custo" | "receita">("custo");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_FINANCEIRAS[0]);
  const [subcategoria, setSubcategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [loteId, setLoteId] = useState("");
  const [centroCusto, setCentroCusto] = useState<(typeof CENTROS_CUSTO)[number]>("estrutura");
  const [fornecedor, setFornecedor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [prazoDias, setPrazoDias] = useState("0");
  const [vencimento, setVencimento] = useState("");
  const [pago, setPago] = useState(true);
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

    setSalvando(true);

    await enfileirarOperacao("financeiro", "POST", {
      data,
      tipo,
      categoria,
      subcategoria: subcategoria || null,
      descricao: descricao || null,
      valor_centavos: centavos.toString(),
      lote_id: loteId || null,
      centro_custo: centroCusto,
      fornecedor: fornecedor || null,
      forma_pagamento: formaPagamento || null,
      prazo_dias: Number(prazoDias) || 0,
      vencimento: vencimento || null,
      pago,
    });

    setSalvando(false);
    setSubcategoria("");
    setDescricao("");
    setValor("");
    setFornecedor("");
    setFormaPagamento("");
    setPrazoDias("0");
    setVencimento("");
    setPago(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo lançamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "custo" | "receita")}>
              <option value="custo">Custo</option>
              <option value="receita">Receita</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subcategoria">Subcategoria</Label>
            <Input id="subcategoria" placeholder="ex.: sal mineral" value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input id="valor" inputMode="decimal" required placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="centro_custo">Centro de custo</Label>
            <Select id="centro_custo" value={centroCusto} onChange={(e) => setCentroCusto(e.target.value as (typeof CENTROS_CUSTO)[number])}>
              {CENTROS_CUSTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lote">Lote (opcional)</Label>
            <Select id="lote" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">— nenhum —</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fornecedor">Fornecedor</Label>
            <Input id="fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="forma_pagamento">Forma de pagamento</Label>
            <Input id="forma_pagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prazo_dias">Prazo (dias)</Label>
            <Input id="prazo_dias" type="number" min={0} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vencimento">Vencimento</Label>
            <Input id="vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input id="pago" type="checkbox" className="h-5 w-5" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            <Label htmlFor="pago">Já pago/recebido</Label>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
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
