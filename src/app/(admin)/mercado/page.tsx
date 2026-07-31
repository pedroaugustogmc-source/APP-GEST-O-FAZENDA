import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarCentavos } from "@/lib/dinheiro";
import { distanciaBreakeven } from "@/domain/calculos/distanciaBreakeven";
import { decisaoMercado, type Decisao } from "@/domain/calculos/decisaoMercado";
import { relacaoTroca } from "@/domain/calculos/relacaoTroca";
import { arrobasCarcaca } from "@/domain/calculos/arrobasCarcaca";
import { receitaProjetadaVenda } from "@/domain/calculos/receitaProjetadaVenda";
import { calcularPontoEquilibrioFazenda, buscarSeriesPrecos, type SeriePreco } from "./consultas";
import { FormularioPrecoMercado } from "./formulario";

export const dynamic = "force-dynamic";

const ROTULOS_TIPO: Record<string, string> = {
  arroba_boi: "Arroba do boi gordo",
  arroba_vaca: "Arroba da vaca gorda",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  garrote: "Garrote",
  novilha: "Novilha",
  leite_litro: "Leite",
};

const ROTULOS_DECISAO: Record<Decisao, string> = { comprar: "COMPRAR", vender: "VENDER", segurar: "SEGURAR" };

// docs/03-modulos.md M6 — Inteligência de mercado: preços por categoria
// (sempre com fonte + data), série com variação semanal/mensal, decisão
// semanal sugerida cruzada com o ponto de equilíbrio da fazenda (M5), e
// relação de troca bezerro↔boi gordo.
export default async function PaginaMercado() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();
  const parametros = await buscarParametros(supabase);

  const [series, pontoEquilibrioFazenda] = await Promise.all([
    buscarSeriesPrecos(supabase, parametros, hoje),
    calcularPontoEquilibrioFazenda(supabase, parametros),
  ]);

  const precoBoi = series.find((s) => s.tipo === "arroba_boi") ?? null;
  const precoBezerro = series.find((s) => s.tipo === "bezerro") ?? null;

  const distancia =
    precoBoi && pontoEquilibrioFazenda.valor !== null && pontoEquilibrioFazenda.valor > 0n
      ? distanciaBreakeven(precoBoi.valorCentavos, pontoEquilibrioFazenda.valor)
      : null;
  const decisao = distancia !== null ? decisaoMercado(distancia, parametros) : null;

  let relacao: number | null = null;
  if (precoBoi && precoBezerro) {
    const pesoReferencia = parametros.PESO_REFERENCIA_BOI_GORDO_KG ?? 500;
    const arrobasBoi = arrobasCarcaca(pesoReferencia, parametros);
    const precoBoiPorCabeca = receitaProjetadaVenda(arrobasBoi, precoBoi.valorCentavos);
    relacao = relacaoTroca(precoBoiPorCabeca, precoBezerro.valorCentavos);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mercado</h1>
        <p className="text-sm text-muted-foreground">
          Preço médio da região (praça Imperatriz/sul do MA). Todo número aqui é entrada manual do admin — sempre
          com fonte e data.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ponto de equilíbrio da fazenda</CardTitle>
            <CardDescription>Custo acumulado ÷ arrobas totais de todos os lotes ativos, hoje.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-numero-grande text-foreground">
              {pontoEquilibrioFazenda.valor !== null ? `${formatarCentavos(pontoEquilibrioFazenda.valor)}/@` : "— sem dado —"}
            </p>
            {pontoEquilibrioFazenda.motivo && <p className="text-xs text-muted-foreground">{pontoEquilibrioFazenda.motivo}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisão semanal sugerida</CardTitle>
            <CardDescription>Preço da arroba do boi gordo cruzado com o ponto de equilíbrio da fazenda.</CardDescription>
          </CardHeader>
          <CardContent>
            {decisao ? (
              <>
                <p
                  className={`text-numero-grande ${decisao.decisao === "vender" ? "text-primary" : decisao.decisao === "comprar" ? "text-critico" : "text-foreground"}`}
                >
                  {ROTULOS_DECISAO[decisao.decisao]}
                </p>
                <p className="text-xs text-muted-foreground">{decisao.justificativa}</p>
              </>
            ) : (
              <p className="text-numero-grande text-muted-foreground">— sem dado —</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relação de troca (bezerro ↔ boi gordo)</CardTitle>
          <CardDescription>
            Quantos bezerros equivalem a um boi gordo de {parametros.PESO_REFERENCIA_BOI_GORDO_KG ?? 500} kg — indicador
            clássico de decisão em cria-recria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-numero-grande text-foreground">
            {relacao !== null ? `${relacao.toFixed(2)} bezerro(s) por boi gordo` : "— sem dado —"}
          </p>
        </CardContent>
      </Card>

      <FormularioPrecoMercado />

      <div className="flex flex-col gap-4">
        {series.map((serie) => (
          <CartaoPreco key={serie.tipo} serie={serie} />
        ))}
        {series.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhum preço registrado ainda — use o formulário acima.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CartaoPreco({ serie }: { serie: SeriePreco }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{ROTULOS_TIPO[serie.tipo] ?? serie.tipo}</CardTitle>
          {serie.desatualizado && <Badge variant="critico">desatualizado</Badge>}
        </div>
        <CardDescription>
          Fonte: {serie.fonte} · Ref. {new Date(`${serie.dataReferencia}T00:00:00`).toLocaleDateString("pt-BR")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-8">
        <div>
          <p className="text-xs text-muted-foreground">Preço atual</p>
          <p className="text-numero-grande text-foreground">
            {formatarCentavos(serie.valorCentavos)}/{serie.unidade}
          </p>
        </div>
        <VariacaoLinha label="Variação semanal" pct={serie.variacaoSemanalPct} />
        <VariacaoLinha label="Variação mensal" pct={serie.variacaoMensalPct} />
        {serie.historico.length > 1 && <Sparkline historico={serie.historico} />}
      </CardContent>
    </Card>
  );
}

function VariacaoLinha({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${pct === null ? "text-muted-foreground" : pct >= 0 ? "text-primary" : "text-critico"}`}>
        {pct !== null ? `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%` : "— sem dado —"}
      </p>
    </div>
  );
}

function Sparkline({ historico }: { historico: Array<{ dataReferencia: string; valorCentavos: bigint }> }) {
  const largura = 160;
  const altura = 40;
  const valores = historico.map((h) => Number(h.valorCentavos));
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;

  const pontos = valores.map((v, i) => {
    const x = (i / Math.max(1, valores.length - 1)) * largura;
    const y = altura - ((v - min) / faixa) * altura;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="h-10 w-40" role="img" aria-label="Série histórica de preço">
      <polyline points={pontos.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-primary" />
    </svg>
  );
}
