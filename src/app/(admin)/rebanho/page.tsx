import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { hojeEmFortaleza } from "@/domain/tipos/data";
import { buscarIndicadoresCria, buscarIndicadoresRecria } from "@/infra/supabase/indicadoresRebanho";
import type { Indicador } from "@/domain/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaRebanho() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();
  const parametros = await buscarParametros(supabase);

  const [cria, recria] = await Promise.all([
    buscarIndicadoresCria(supabase, parametros, hoje),
    buscarIndicadoresRecria(supabase, parametros, hoje),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rebanho</h1>
        <p className="text-sm text-muted-foreground">
          Dois painéis separados de propósito (docs/03-modulos.md M3) — misturar cria com recria esconde onde a
          margem está sendo perdida.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Cria</h2>
        <p className="text-sm text-muted-foreground">Últimos 12 meses · {cria.matrizesExpostas} matriz(es) exposta(s) no período.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoIndicador titulo="Taxa de prenhez" indicador={cria.taxaPrenhez} sufixo="%" percentual />
          <CartaoIndicador titulo="Taxa de parição" indicador={cria.taxaParicao} sufixo="%" percentual />
          <CartaoIndicador titulo="Taxa de desmame" indicador={cria.taxaDesmame} sufixo="%" percentual destaque />
          <CartaoIndicador titulo="Mortalidade de bezerro" indicador={cria.taxaMortalidadeBezerro} sufixo="%" percentual inverso />
          <CartaoIndicador titulo="Intervalo entre partos" indicador={cria.intervaloEntrePartosDias} sufixo=" dias" />
          <CartaoIndicador titulo="Kg desmamado por matriz" indicador={cria.kgDesmamadoPorMatriz} sufixo=" kg" />
          <CartaoNumero titulo="Peso ao desmame (real)" valor={cria.pesoDesmameMedioKg} sufixo=" kg" />
          <CartaoNumero titulo="Peso ao desmame (ajustado 205d)" valor={cria.pesoAjustado205MedioKg} sufixo=" kg" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Recria</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Dias no pasto</TableHead>
              <TableHead>GMD</TableHead>
              <TableHead>Ganho/ha</TableHead>
              <TableHead>Peso atual</TableHead>
              <TableHead>Venda projetada (peso-alvo)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recria.map((lote) => (
              <TableRow key={lote.loteId}>
                <TableCell className="font-medium">{lote.loteNome}</TableCell>
                <TableCell>{lote.categoria}</TableCell>
                <TableCell>{lote.diasNoPasto ?? "— sem dado —"}</TableCell>
                <TableCell>
                  {lote.gmd.valor !== null ? (
                    <span className={lote.gmdAbaixoMeta ? "font-semibold text-critico" : ""}>
                      {lote.gmd.valor.toFixed(3)} kg/dia
                    </span>
                  ) : (
                    "— sem dado —"
                  )}
                </TableCell>
                <TableCell>{lote.ganhoPorHectare !== null ? `${lote.ganhoPorHectare.toFixed(1)} kg/ha` : "— sem dado —"}</TableCell>
                <TableCell>{lote.pesoAtualKg !== null ? `${lote.pesoAtualKg.toLocaleString("pt-BR")} kg` : "— sem dado —"}</TableCell>
                <TableCell>
                  {lote.dataVendaProjetada
                    ? new Date(`${lote.dataVendaProjetada}T00:00:00`).toLocaleDateString("pt-BR")
                    : "— sem dado —"}
                </TableCell>
              </TableRow>
            ))}
            {recria.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum lote de recria ativo — cadastre em Lotes ou aguarde o bot registrar movimentação.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Comparação com o mesmo período do ano anterior e conversão de suplemento ainda não têm dado suficiente
          acumulado nesta fazenda — aparecem quando houver histórico (não é bug, é honestidade estatística, §9).
        </p>
      </section>
    </div>
  );
}

function CartaoIndicador({
  titulo,
  indicador,
  sufixo,
  percentual,
  destaque,
  inverso,
}: {
  titulo: string;
  indicador: Indicador<number>;
  sufixo: string;
  percentual?: boolean;
  destaque?: boolean;
  inverso?: boolean;
}) {
  const valorExibido =
    indicador.valor === null
      ? "— sem dado —"
      : `${(percentual ? indicador.valor * 100 : indicador.valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${sufixo}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-numero-grande ${destaque ? "text-primary" : inverso ? "text-critico" : "text-foreground"}`}>
          {valorExibido}
        </p>
        {indicador.qualidade === "estimativa_fraca" && (
          <CardDescription>estimativa fraca{indicador.motivo ? ` — ${indicador.motivo}` : ""}</CardDescription>
        )}
        {indicador.qualidade === "sem_dado" && indicador.motivo && <CardDescription>{indicador.motivo}</CardDescription>}
      </CardContent>
    </Card>
  );
}

function CartaoNumero({ titulo, valor, sufixo }: { titulo: string; valor: number | null; sufixo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-numero-grande text-foreground">
          {valor !== null ? `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${sufixo}` : "— sem dado —"}
        </p>
      </CardContent>
    </Card>
  );
}
