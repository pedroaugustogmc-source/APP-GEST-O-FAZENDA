"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatarCentavos, parseReaisParaCentavos } from "@/lib/dinheiro";
import { simularCenarios, type ResultadoCenario, type CenarioPreco } from "@/domain/calculos/simularCenarios";
import type { Parametros } from "@/domain/tipos";
import type { LoteParaSimulacao } from "./consultas";

const DIAS_SIMULACAO = 90;

const CORES: Record<CenarioPreco, string> = {
  alta: "#16a34a",
  estavel: "#2563eb",
  queda: "#dc2626",
};

const ROTULOS: Record<CenarioPreco, string> = {
  alta: "Preço em alta",
  estavel: "Preço estável",
  queda: "Preço em queda",
};

interface SimuladorCenariosProps {
  lotes: LoteParaSimulacao[];
  parametros: Parametros;
}

// docs/03-modulos.md M5 "Cenários": 3 cenários de preço (alta/estável/queda)
// × seca (que atrasa o GMD e empurra a data de venda), com gráfico de fluxo
// de caixa de 90 dias. Decisão de arquitetura (ESTADO.md): simularCenarios é
// função pura testada, não Code Execution da Claude API — roda direto no
// cliente, sem round-trip de rede, porque não tem I/O nenhum.
export function SimuladorCenarios({ lotes, parametros }: SimuladorCenariosProps) {
  const [loteId, setLoteId] = useState(lotes[0]?.loteId ?? "");
  const lote = lotes.find((l) => l.loteId === loteId) ?? null;

  const [pesoAtual, setPesoAtual] = useState("");
  const [gmdBase, setGmdBase] = useState("");
  const [precoAtual, setPrecoAtual] = useState("");
  const [custoDiario, setCustoDiario] = useState("");
  const [caixaInicial, setCaixaInicial] = useState("");
  const [pesoAlvoVenda, setPesoAlvoVenda] = useState("");
  const [inicioEstiagem, setInicioEstiagem] = useState("");
  const [duracaoEstiagem, setDuracaoEstiagem] = useState("0");
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoCenario[] | null>(null);

  function selecionarLote(id: string) {
    setLoteId(id);
    setResultados(null);
    setErro(null);
    const selecionado = lotes.find((l) => l.loteId === id);
    if (!selecionado) return;
    setPesoAtual(selecionado.pesoAtualKg !== null ? String(selecionado.pesoAtualKg) : "");
    setGmdBase(selecionado.gmdBaseSugerido !== null ? selecionado.gmdBaseSugerido.toFixed(3) : "");
    setPrecoAtual(
      selecionado.precoAtualPorArrobaCentavos !== null
        ? (Number(BigInt(selecionado.precoAtualPorArrobaCentavos)) / 100).toFixed(2).replace(".", ",")
        : ""
    );
    setCustoDiario((Number(BigInt(selecionado.custoDiarioSugeridoCentavos)) / 100).toFixed(2).replace(".", ","));
    setCaixaInicial("0,00");
    setPesoAlvoVenda(String(selecionado.pesoAlvoVendaKg));
    setInicioEstiagem("");
    setDuracaoEstiagem("0");
  }

  function simular() {
    setErro(null);
    setResultados(null);

    const pesoAtualNum = Number(pesoAtual.replace(",", "."));
    const gmdBaseNum = Number(gmdBase.replace(",", "."));
    const pesoAlvoNum = Number(pesoAlvoVenda.replace(",", "."));
    const inicioEstiagemNum = inicioEstiagem === "" ? null : Number(inicioEstiagem);
    const duracaoEstiagemNum = Number(duracaoEstiagem);

    if (!Number.isFinite(pesoAtualNum) || pesoAtualNum <= 0) return setErro("Peso atual inválido.");
    if (!Number.isFinite(gmdBaseNum) || gmdBaseNum <= 0) return setErro("GMD base inválido — precisa ser maior que zero.");
    if (!Number.isFinite(pesoAlvoNum) || pesoAlvoNum <= pesoAtualNum) return setErro("Peso-alvo de venda precisa ser maior que o peso atual.");

    let precoCentavos: bigint;
    let custoCentavos: bigint;
    let caixaCentavos: bigint;
    try {
      precoCentavos = parseReaisParaCentavos(precoAtual);
      custoCentavos = parseReaisParaCentavos(custoDiario);
      caixaCentavos = parseReaisParaCentavos(caixaInicial);
    } catch (excecao) {
      return setErro(excecao instanceof Error ? excecao.message : "Valor em reais inválido.");
    }
    if (precoCentavos <= 0n) return setErro("Preço atual por arroba precisa ser maior que zero.");

    const diasNaEstiagem = Array.from({ length: DIAS_SIMULACAO }, (_, dia) => {
      if (inicioEstiagemNum === null || duracaoEstiagemNum <= 0) return false;
      return dia >= inicioEstiagemNum && dia < inicioEstiagemNum + duracaoEstiagemNum;
    });

    const entrada = {
      pesoAtual: pesoAtualNum,
      gmdBase: gmdBaseNum,
      precoAtualPorArroba: precoCentavos,
      custoDiario: custoCentavos,
      caixaInicial: caixaCentavos,
      pesoAlvoVenda: pesoAlvoNum,
      diasNaEstiagem,
    };

    setResultados(simularCenarios(entrada, parametros));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros da simulação</CardTitle>
          <CardDescription>
            Valores sugeridos a partir do lote escolhido — ajuste antes de simular. A estiagem reduz o GMD nos dias
            marcados (fator FATOR_GMD_SECA), empurrando a data de venda.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="sim-lote">Lote (recria)</Label>
            <Select id="sim-lote" value={loteId} onChange={(e) => selecionarLote(e.target.value)}>
              {lotes.length === 0 && <option value="">Nenhum lote de recria ativo</option>}
              {lotes.map((l) => (
                <option key={l.loteId} value={l.loteId}>
                  {l.loteNome} ({l.categoria})
                </option>
              ))}
            </Select>
          </div>

          <Campo label="Peso atual (kg)" value={pesoAtual} onChange={setPesoAtual} />
          <Campo label="GMD base (kg/dia)" value={gmdBase} onChange={setGmdBase} />
          <Campo label="Peso-alvo de venda (kg)" value={pesoAlvoVenda} onChange={setPesoAlvoVenda} />
          <Campo label="Preço atual por @ (R$)" value={precoAtual} onChange={setPrecoAtual} inputMode="decimal" />
          <Campo label="Custo diário do lote (R$)" value={custoDiario} onChange={setCustoDiario} inputMode="decimal" />
          <Campo label="Caixa inicial (R$)" value={caixaInicial} onChange={setCaixaInicial} inputMode="decimal" />
          <Campo label="Início da estiagem (dia 0–89, opcional)" value={inicioEstiagem} onChange={setInicioEstiagem} />
          <Campo label="Duração da estiagem (dias)" value={duracaoEstiagem} onChange={setDuracaoEstiagem} />

          {lote && !lote.precoAtualPorArrobaCentavos && (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              — sem dado — nenhum preço de mercado registrado para {lote.categoria}; preencha manualmente antes de simular.
            </p>
          )}
          {erro && <p className="text-sm text-critico sm:col-span-2 lg:col-span-4">{erro}</p>}

          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" onClick={simular} disabled={lotes.length === 0}>
              Simular 3 cenários
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultados && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo de caixa projetado (90 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <GraficoFluxoCaixa resultados={resultados} />
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                {resultados.map((r) => (
                  <span key={r.cenario} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CORES[r.cenario] }} />
                    {ROTULOS[r.cenario]}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {resultados.map((r) => (
              <CartaoCenario key={r.cenario} resultado={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CartaoCenario({ resultado }: { resultado: ResultadoCenario }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CORES[resultado.cenario] }} />
          <CardTitle className="text-base">{ROTULOS[resultado.cenario]}</CardTitle>
        </div>
        <CardDescription>Preço projetado: {formatarCentavos(resultado.precoPorArroba)}/@</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        <Linha
          label="Venda"
          valor={
            resultado.atingiuPesoAlvo
              ? `dia ${resultado.diaVenda! + 1} (atingiu o peso-alvo)`
              : "não atingiu o peso-alvo em 90 dias"
          }
        />
        <Linha label="Peso projetado" valor={`${resultado.pesoProjetadoKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`} />
        <Linha label="Arrobas projetadas" valor={resultado.arrobasProjetadas.toFixed(2)} />
        <Linha label="Receita projetada" valor={formatarCentavos(resultado.receitaProjetada)} />
        <Linha
          label="Margem projetada"
          valor={formatarCentavos(resultado.margemProjetada)}
          critico={resultado.margemProjetada < 0n}
        />
        <Linha label="Caixa final" valor={formatarCentavos(resultado.caixaFinal)} critico={resultado.caixaFinal < 0n} />
        <Linha label="Caixa mínimo no período" valor={formatarCentavos(resultado.caixaMinimo)} critico={resultado.caixaMinimo < 0n} />
      </CardContent>
    </Card>
  );
}

function Linha({ label, valor, critico }: { label: string; valor: string; critico?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={critico ? "font-semibold text-critico" : "font-medium text-foreground"}>{valor}</span>
    </div>
  );
}

const MARGEM_GRAFICO = { topo: 10, base: 20, esquerda: 10, direita: 10 };

function GraficoFluxoCaixa({ resultados }: { resultados: ResultadoCenario[] }) {
  const largura = 720;
  const altura = 240;

  const { caminhos, zeroY, minY, maxY } = useMemo(() => {
    const margem = MARGEM_GRAFICO;
    const todosValores = resultados.flatMap((r) => r.fluxoCaixaDiario.map((c) => Number(c)));
    const min = Math.min(0, ...todosValores);
    const max = Math.max(0, ...todosValores);
    const faixa = max - min || 1;

    const areaAltura = altura - margem.topo - margem.base;
    const areaLargura = largura - margem.esquerda - margem.direita;

    function y(valor: number) {
      return margem.topo + areaAltura - ((valor - min) / faixa) * areaAltura;
    }

    const linhas = resultados.map((r) => {
      const n = r.fluxoCaixaDiario.length;
      const pontos = r.fluxoCaixaDiario.map((c, i) => {
        const x = margem.esquerda + (i / Math.max(1, n - 1)) * areaLargura;
        return `${x.toFixed(1)},${y(Number(c)).toFixed(1)}`;
      });
      return { cenario: r.cenario, d: `M ${pontos.join(" L ")}` };
    });

    return { caminhos: linhas, zeroY: y(0), minY: min, maxY: max };
  }, [resultados]);

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="h-56 w-full" role="img" aria-label="Fluxo de caixa projetado nos 3 cenários, 90 dias">
      <line
        x1={MARGEM_GRAFICO.esquerda}
        y1={zeroY}
        x2={largura - MARGEM_GRAFICO.direita}
        y2={zeroY}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeDasharray="4 4"
      />
      {caminhos.map((c) => (
        <path key={c.cenario} d={c.d} fill="none" stroke={CORES[c.cenario]} strokeWidth={2} />
      ))}
      <text x={MARGEM_GRAFICO.esquerda} y={12} fontSize={10} fill="currentColor" opacity={0.6}>
        {maxY >= 0 ? `máx. ${(maxY / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""}
      </text>
      <text x={MARGEM_GRAFICO.esquerda} y={altura - 6} fontSize={10} fill="currentColor" opacity={0.6}>
        {minY < 0 ? `mín. ${(minY / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""}
      </text>
    </svg>
  );
}
