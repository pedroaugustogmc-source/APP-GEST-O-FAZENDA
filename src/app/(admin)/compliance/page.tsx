import { criarClienteServidor } from "@/infra/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AnimalRow, FinanceiroRow } from "@/infra/supabase/tipos";
import { BotaoImprimir } from "./botao-imprimir";
import { ExportarCsv } from "../relatorios/exportar-csv";

export const dynamic = "force-dynamic";

// docs/08-anexos.md Anexo H: "Preparamos o dado. A validação do que é
// exigido hoje é feita com a AGED-MA e com o contador/veterinário da
// propriedade. Nunca afirme ao usuário que um documento está 'em
// conformidade'." — mesmo tratamento do aviso obrigatório de /sanidade (F3).
// Sem .nao-imprimir de propósito: se esta tela for impressa/exportada e sair
// da mão de quem já sabe do aviso, o disclaimer precisa viajar junto com o
// papel — é exatamente quando um documento sem contexto do sistema poderia
// ser lido como "oficial" por engano.
function AvisoObrigatorio() {
  return (
    <Card className="border-critico bg-critico/5">
      <CardHeader>
        <CardTitle className="text-base text-critico">Aviso obrigatório</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        Exigências, prazos e formatos de documentação agropecuária mudam por estado e por período. Este módulo
        organiza o dado que a fazenda já tem — ele <strong>não emite GTA, nota fiscal nem nenhum documento oficial</strong>.
        A validação do que é exigido hoje precisa ser feita com a <strong>AGED-MA</strong> e com o
        contador/veterinário da propriedade. O sistema nunca afirma que um documento está &ldquo;em
        conformidade&rdquo;.
      </CardContent>
    </Card>
  );
}

interface LinhaEfetivo {
  categoria: string;
  sexo: "M" | "F";
  cabecas: number;
}

interface LinhaLoteSaida {
  id: string;
  nome: string;
  categoria: string;
  cabecas_atuais: number;
  status: string;
  data_saida: string | null;
}

interface LinhaMovimentacao {
  lote_id: string;
  data: string;
  cabecas: number;
  motivo: string | null;
  pasto_origem_id: string | null;
  pasto_destino_id: string | null;
}

interface LinhaVacinaAplicada {
  id: string;
  vacina: string;
  animal_id: string | null;
  lote_id: string | null;
  data: string;
  dose: string;
  lote_fabricacao: string | null;
  laboratorio: string | null;
  validade: string | null;
  aplicado_por: string | null;
  n_animais: number | null;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarData(data: string | null): string {
  return data ? new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR") : "— sem dado —";
}

export default async function PaginaCompliance({
  searchParams,
}: {
  searchParams: { brinco?: string };
}) {
  const supabase = criarClienteServidor();

  const [{ data: efetivoData }, { data: lotesSaidaData }, { data: pastosData }, { data: vacinasData }, { data: financeiroData }] =
    await Promise.all([
      supabase.from("mv_efetivo_por_categoria").select("categoria, sexo, cabecas").order("categoria"),
      supabase
        .from("lotes")
        .select("id, nome, categoria, cabecas_atuais, status, data_saida")
        .in("status", ["vendido", "encerrado"])
        .order("data_saida", { ascending: false })
        .limit(20),
      supabase.from("pastos").select("id, nome"),
      supabase
        .from("vacinas_aplicadas")
        .select("id, vacina, animal_id, lote_id, data, dose, lote_fabricacao, laboratorio, validade, aplicado_por, n_animais")
        .order("data", { ascending: false })
        .limit(50),
      supabase
        .from("financeiro")
        .select("id, data, categoria, valor_centavos, quantidade, unidade, fornecedor, nota_fiscal, lote_id")
        .eq("tipo", "receita")
        .is("deletado_em", null)
        .order("data", { ascending: false })
        .limit(30),
    ]);

  const efetivo = (efetivoData ?? []) as LinhaEfetivo[];
  const lotesSaida = (lotesSaidaData ?? []) as LinhaLoteSaida[];
  const nomePorPasto = new Map(((pastosData ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));
  const vacinas = (vacinasData ?? []) as LinhaVacinaAplicada[];
  const financeiro = (financeiroData ?? []) as FinanceiroRow[];

  const idsLotesSaida = lotesSaida.map((l) => l.id);
  const { data: movimentacoesData } =
    idsLotesSaida.length > 0
      ? await supabase
          .from("movimentacoes_pasto")
          .select("lote_id, data, cabecas, motivo, pasto_origem_id, pasto_destino_id")
          .in("lote_id", idsLotesSaida)
          .order("data", { ascending: false })
      : { data: [] };
  const movimentacoes = (movimentacoesData ?? []) as LinhaMovimentacao[];
  const movimentacoesPorLote = new Map<string, LinhaMovimentacao[]>();
  for (const mov of movimentacoes) {
    const lista = movimentacoesPorLote.get(mov.lote_id) ?? [];
    lista.push(mov);
    movimentacoesPorLote.set(mov.lote_id, lista);
  }
  const vacinasPorLote = new Map<string, LinhaVacinaAplicada[]>();
  for (const vac of vacinas) {
    if (!vac.lote_id) continue;
    const lista = vacinasPorLote.get(vac.lote_id) ?? [];
    lista.push(vac);
    vacinasPorLote.set(vac.lote_id, lista);
  }

  const brincoBuscado = searchParams.brinco?.trim();
  let animalEncontrado: AnimalRow | null = null;
  let maeEncontrada: AnimalRow | null = null;
  let vacinasDoAnimal: LinhaVacinaAplicada[] = [];
  let movimentacoesDoLoteAnimal: LinhaMovimentacao[] = [];
  let buscaSemResultado = false;

  if (brincoBuscado) {
    const { data: animalData } = await supabase.from("animais").select("*").eq("brinco", brincoBuscado).maybeSingle();
    animalEncontrado = (animalData ?? null) as AnimalRow | null;
    if (!animalEncontrado) {
      buscaSemResultado = true;
    } else {
      if (animalEncontrado.matriz_id) {
        const { data: maeData } = await supabase.from("animais").select("*").eq("id", animalEncontrado.matriz_id).maybeSingle();
        maeEncontrada = (maeData ?? null) as AnimalRow | null;
      }
      const { data: vacinasAnimalData } = await supabase
        .from("vacinas_aplicadas")
        .select("id, vacina, animal_id, lote_id, data, dose, lote_fabricacao, laboratorio, validade, aplicado_por, n_animais")
        .or(`animal_id.eq.${animalEncontrado.id}${animalEncontrado.lote_id ? `,lote_id.eq.${animalEncontrado.lote_id}` : ""}`)
        .order("data", { ascending: false });
      vacinasDoAnimal = (vacinasAnimalData ?? []) as LinhaVacinaAplicada[];

      if (animalEncontrado.lote_id) {
        const { data: movAnimalData } = await supabase
          .from("movimentacoes_pasto")
          .select("lote_id, data, cabecas, motivo, pasto_origem_id, pasto_destino_id")
          .eq("lote_id", animalEncontrado.lote_id)
          .order("data", { ascending: false });
        movimentacoesDoLoteAnimal = (movAnimalData ?? []) as LinhaMovimentacao[];
      }
    }
  }

  const csvEfetivo: Record<string, unknown> = {};
  for (const linha of efetivo) csvEfetivo[`${capitalizar(linha.categoria)} (${linha.sexo})`] = linha.cabecas;

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; }
          .nao-imprimir { display: none !important; }
        }
        @page { size: A4; margin: 20mm; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Preparo de dado para GTA, vacinação, declaração de rebanho, rastreabilidade e nota fiscal de produtor
            (Anexo H). Não substitui documento oficial.
          </p>
        </div>
        <div className="nao-imprimir">
          <BotaoImprimir />
        </div>
      </div>

      <AvisoObrigatorio />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Declaração de rebanho — efetivo por categoria e sexo</CardTitle>
          <div className="nao-imprimir">
            <ExportarCsv indicadores={csvEfetivo} nomeArquivo={`declaracao-rebanho-${new Date().toISOString().slice(0, 10)}.csv`} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Efetivo de hoje (animais ativos agora) — não reconstitui o efetivo em uma data passada.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Cabeças</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {efetivo.map((linha) => (
                <TableRow key={`${linha.categoria}-${linha.sexo}`}>
                  <TableCell className="font-medium">{capitalizar(linha.categoria)}</TableCell>
                  <TableCell>{linha.sexo}</TableCell>
                  <TableCell>{linha.cabecas}</TableCell>
                </TableRow>
              ))}
              {efetivo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    — sem dado —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preparo de GTA — lotes vendidos/encerrados recentes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Quantidade e categoria movimentada, origem/destino e situação vacinal do lote — a GTA em si (número,
            transportadora, comprador) é preenchida fora do sistema.
          </p>
          {lotesSaida.map((lote) => (
            <div key={lote.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold">{lote.nome}</span> · {capitalizar(lote.categoria)} ·{" "}
                  {lote.cabecas_atuais} cabeça(s)
                </div>
                <Badge variant={lote.status === "vendido" ? "default" : "secondary"}>{lote.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Saída: {formatarData(lote.data_saida)}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Movimentações</p>
                  {(movimentacoesPorLote.get(lote.id) ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">— sem dado —</p>
                  )}
                  <ul className="flex flex-col gap-1 text-sm">
                    {(movimentacoesPorLote.get(lote.id) ?? []).map((mov, indice) => (
                      <li key={indice}>
                        {formatarData(mov.data)}: {nomePorPasto.get(mov.pasto_origem_id ?? "") ?? "fora da propriedade"} →{" "}
                        {nomePorPasto.get(mov.pasto_destino_id ?? "") ?? "— sem dado —"} ({mov.cabecas} cab.
                        {mov.motivo ? `, ${mov.motivo}` : ""})
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Situação vacinal</p>
                  {(vacinasPorLote.get(lote.id) ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">— sem dado —</p>
                  )}
                  <ul className="flex flex-col gap-1 text-sm">
                    {(vacinasPorLote.get(lote.id) ?? []).map((vac) => (
                      <li key={vac.id}>
                        {vac.vacina} — {formatarData(vac.data)} (dose {vac.dose})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
          {lotesSaida.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lote vendido ou encerrado recentemente.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comprovação de vacinação</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Vacina</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Lote de fabricação</TableHead>
                <TableHead>Laboratório</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Aplicado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vacinas.map((vac) => (
                <TableRow key={vac.id}>
                  <TableCell>{formatarData(vac.data)}</TableCell>
                  <TableCell className="font-medium">{vac.vacina}</TableCell>
                  <TableCell>{vac.dose}</TableCell>
                  <TableCell>{vac.lote_fabricacao ?? "— sem dado —"}</TableCell>
                  <TableCell>{vac.laboratorio ?? "— sem dado —"}</TableCell>
                  <TableCell>{formatarData(vac.validade)}</TableCell>
                  <TableCell>{vac.aplicado_por ?? "— sem dado —"}</TableCell>
                </TableRow>
              ))}
              {vacinas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    — sem dado —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="nao-imprimir">
        <CardHeader>
          <CardTitle>Rastreabilidade individual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="brinco">Brinco</Label>
              <Input id="brinco" name="brinco" defaultValue={brincoBuscado ?? ""} placeholder="Ex.: 1234" />
            </div>
            <Button type="submit">Buscar</Button>
          </form>

          {buscaSemResultado && <p className="text-sm text-muted-foreground">Nenhum animal com esse brinco.</p>}

          {animalEncontrado && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
              <p>
                <span className="font-semibold">Brinco {animalEncontrado.brinco}</span> — {capitalizar(animalEncontrado.categoria)},{" "}
                {animalEncontrado.sexo}
              </p>
              <p>Nascimento: {formatarData(animalEncontrado.data_nascimento)}</p>
              <p>Mãe: {maeEncontrada ? `Brinco ${maeEncontrada.brinco ?? "— sem dado —"}` : "— sem dado —"}</p>
              <p>Origem: {animalEncontrado.origem}</p>
              <p>Situação: {animalEncontrado.status}</p>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Movimentações do lote atual (rastreabilidade é por lote, não por animal individualmente)
                </p>
                {movimentacoesDoLoteAnimal.length === 0 && <p className="text-muted-foreground">— sem dado —</p>}
                <ul className="flex flex-col gap-1">
                  {movimentacoesDoLoteAnimal.map((mov, indice) => (
                    <li key={indice}>
                      {formatarData(mov.data)}: {nomePorPasto.get(mov.pasto_origem_id ?? "") ?? "fora da propriedade"} →{" "}
                      {nomePorPasto.get(mov.pasto_destino_id ?? "") ?? "— sem dado —"}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sanidade</p>
                {vacinasDoAnimal.length === 0 && <p className="text-muted-foreground">— sem dado —</p>}
                <ul className="flex flex-col gap-1">
                  {vacinasDoAnimal.map((vac) => (
                    <li key={vac.id}>
                      {vac.vacina} — {formatarData(vac.data)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nota fiscal de produtor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Nota fiscal</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financeiro.map((linha) => (
                <TableRow key={linha.id}>
                  <TableCell>{formatarData(linha.data)}</TableCell>
                  <TableCell className="font-medium">{linha.categoria}</TableCell>
                  <TableCell>
                    {linha.quantidade !== null ? `${linha.quantidade} ${linha.unidade ?? ""}`.trim() : "— sem dado —"}
                  </TableCell>
                  <TableCell>{linha.fornecedor ?? "— sem dado —"}</TableCell>
                  <TableCell>{linha.nota_fiscal ?? "— sem dado —"}</TableCell>
                  <TableCell>{(linha.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                </TableRow>
              ))}
              {financeiro.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    — sem dado —
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
