import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatarCentavos } from "@/lib/dinheiro";
import { buscarDrePorLote, type LinhaDre } from "./consultas";
import { RatearFormulario } from "./ratear-formulario";

export const dynamic = "force-dynamic";

// docs/03-modulos.md M5, "adição sênior — DRE simplificado por lote":
// receita projetada − custo acumulado = margem projetada, com cria e
// recria separados. "Essa é a métrica mais importante da fazenda."
export default async function PaginaDre() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();
  const parametros = await buscarParametros(supabase);
  const linhas = await buscarDrePorLote(supabase, parametros, hoje);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">DRE por lote</h1>
        <p className="text-sm text-muted-foreground">
          Custo separado por centro de custo cria/recria — numa operação cria-recria, misturar os dois esconde onde
          a margem está sendo perdida. Ponto de equilíbrio e distância do mercado usam as arrobas totais do lote
          hoje (peso atual × rendimento de carcaça).
        </p>
      </div>

      <RatearFormulario />

      <div className="flex flex-col gap-4">
        {linhas.map((linha) => (
          <CartaoLote key={linha.loteId} linha={linha} />
        ))}
        {linhas.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nenhum lote ativo — cadastre em Lotes.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CartaoLote({ linha }: { linha: LinhaDre }) {
  const semaforo =
    linha.distanciaBreakevenPct === null ? null : linha.distanciaBreakevenPct >= 0 ? "text-primary" : "text-critico";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {linha.loteNome} <span className="font-normal text-muted-foreground">· {linha.categoria} · {linha.cabecasAtuais} cabeça(s)</span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{linha.diasAtivo} dia(s) ativo</span>
        </div>
        <CardDescription>
          Custo cria: {formatarCentavos(linha.custoCriaCentavos)} · Custo recria: {formatarCentavos(linha.custoRecriaCentavos)}
          {linha.custoOutroCentavos !== 0n && <> · Outros centros de custo: {formatarCentavos(linha.custoOutroCentavos)}</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Custo acumulado</TableHead>
              <TableHead>Arrobas (hoje)</TableHead>
              <TableHead>Custo/@</TableHead>
              <TableHead>Ponto de equilíbrio</TableHead>
              <TableHead>Preço de mercado</TableHead>
              <TableHead>Distância do breakeven</TableHead>
              <TableHead>Receita projetada</TableHead>
              <TableHead>Margem projetada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{formatarCentavos(linha.custoAcumuladoCentavos)}</TableCell>
              <TableCell>{linha.arrobasTotais !== null ? linha.arrobasTotais.toFixed(2) : "— sem dado —"}</TableCell>
              <TableCell>{linha.custoPorArroba.valor !== null ? formatarCentavos(linha.custoPorArroba.valor) : "— sem dado —"}</TableCell>
              <TableCell>{linha.pontoEquilibrio.valor !== null ? formatarCentavos(linha.pontoEquilibrio.valor) : "— sem dado —"}</TableCell>
              <TableCell>
                {linha.precoMercadoCentavos !== null ? (
                  <>
                    {formatarCentavos(linha.precoMercadoCentavos)}
                    <span className="block text-xs text-muted-foreground">ref. {linha.precoMercadoDataReferencia}</span>
                  </>
                ) : (
                  "— sem dado —"
                )}
              </TableCell>
              <TableCell className={semaforo ? `font-semibold ${semaforo}` : ""}>
                {linha.distanciaBreakevenPct !== null ? `${(linha.distanciaBreakevenPct * 100).toFixed(1)}%` : "— sem dado —"}
              </TableCell>
              <TableCell>{linha.receitaProjetadaCentavos !== null ? formatarCentavos(linha.receitaProjetadaCentavos) : "— sem dado —"}</TableCell>
              <TableCell className={linha.margemProjetadaCentavos !== null && linha.margemProjetadaCentavos < 0n ? "font-semibold text-critico" : ""}>
                {linha.margemProjetadaCentavos !== null ? formatarCentavos(linha.margemProjetadaCentavos) : "— sem dado —"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {linha.custoPorArroba.qualidade === "sem_dado" && linha.custoPorArroba.motivo && (
          <p className="mt-2 text-xs text-muted-foreground">{linha.custoPorArroba.motivo}</p>
        )}
      </CardContent>
    </Card>
  );
}
