import { criarClienteServidor } from "@/infra/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { elegiveisParaVacina, type AnimalParaVacina, type RegraVacinal } from "@/domain/calculos/elegiveisParaVacina";
import { hojeEmFortaleza } from "@/domain/tipos/data";

export const dynamic = "force-dynamic";

interface LinhaCatalogo {
  id: string;
  nome: string;
  obrigatoria: boolean;
  bloqueada: boolean;
  motivo_bloqueio: string | null;
  sexo_alvo: "M" | "F" | null;
  idade_min_meses: number | null;
  idade_max_meses: number | null;
  categorias_alvo: string[] | null;
  previne: string;
  epoca_observacao: string | null;
}

export default async function PaginaSanidade() {
  const supabase = criarClienteServidor();
  const hoje = hojeEmFortaleza();

  const [{ data: catalogoData }, { data: animaisData }, { data: aplicadasData }] = await Promise.all([
    supabase.from("vacinas_catalogo").select("*").eq("ativo", true).order("nome"),
    supabase.from("animais").select("id, sexo, categoria, data_nascimento").eq("status", "ativo").is("deletado_em", null),
    supabase.from("vacinas_aplicadas").select("vacina_id, custo_centavos"),
  ]);

  const catalogo = (catalogoData ?? []) as LinhaCatalogo[];
  const animais: AnimalParaVacina[] = (
    (animaisData ?? []) as Array<{ id: string; sexo: "M" | "F"; categoria: string; data_nascimento: string | null }>
  ).map((a) => ({
    id: a.id,
    sexo: a.sexo,
    categoria: a.categoria as AnimalParaVacina["categoria"],
    nascimento: a.data_nascimento,
  }));
  const aplicadas = (aplicadasData ?? []) as Array<{ vacina_id: string; custo_centavos: number | null }>;

  const custoMedioPorVacina = new Map<string, number>();
  for (const vacina of catalogo) {
    const custos = aplicadas.filter((a) => a.vacina_id === vacina.id && a.custo_centavos !== null).map((a) => a.custo_centavos!);
    if (custos.length > 0) custoMedioPorVacina.set(vacina.id, custos.reduce((t, c) => t + c, 0) / custos.length);
  }

  const linhas = catalogo.map((vacina) => {
    if (vacina.bloqueada) {
      return { vacina, elegiveis: 0, atrasados: 0, custoMedioCentavos: null };
    }
    const regra: RegraVacinal = {
      nome: vacina.nome,
      sexoAlvo: vacina.sexo_alvo,
      idadeMinMeses: vacina.idade_min_meses,
      idadeMaxMeses: vacina.idade_max_meses,
      categoriasAlvo: vacina.categorias_alvo as RegraVacinal["categoriasAlvo"],
      bloqueada: vacina.bloqueada,
      motivoBloqueio: vacina.motivo_bloqueio,
    };
    const avaliacao = elegiveisParaVacina(animais, regra, hoje);
    const atrasados = avaliacao.bloqueados.filter((b) => b.motivo.includes("idade máxima")).length;
    return {
      vacina,
      elegiveis: avaliacao.elegiveis.length,
      atrasados,
      custoMedioCentavos: custoMedioPorVacina.get(vacina.id) ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Calendário sanitário</h1>
        <p className="text-sm text-muted-foreground">
          Quais animais entram na janela de cada vacina agora, por idade e sexo — calculado sozinho a partir de{" "}
          <code>vacinas_catalogo</code> (docs/03-modulos.md M4).
        </p>
      </div>

      <Card className="border-critico bg-critico/5">
        <CardHeader>
          <CardTitle className="text-base text-critico">Aviso obrigatório — Febre Aftosa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          O Maranhão é, desde abril de 2024, zona livre de febre aftosa sem vacinação — a vacina deixou de ser
          aplicada e seu armazenamento/uso passou a ser proibido no estado. Se ainda houver vacina de aftosa em
          estoque ou no protocolo da fazenda, isso precisa ser revisado com a AGED/veterinário imediatamente. O
          sistema bloqueia qualquer registro de aplicação de aftosa.
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vacina</TableHead>
            <TableHead>Previne</TableHead>
            <TableHead>Elegíveis agora</TableHead>
            <TableHead>Atrasados</TableHead>
            <TableHead>Custo médio estimado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map(({ vacina, elegiveis, atrasados, custoMedioCentavos }) => (
            <TableRow key={vacina.id}>
              <TableCell className="font-medium">
                {vacina.nome} {vacina.obrigatoria && <Badge variant="outline">obrigatória</Badge>}
              </TableCell>
              <TableCell>{vacina.previne}</TableCell>
              <TableCell>
                {vacina.bloqueada ? (
                  <Badge variant="critico">bloqueada</Badge>
                ) : elegiveis > 0 ? (
                  <span className="font-semibold">{elegiveis}</span>
                ) : (
                  0
                )}
              </TableCell>
              <TableCell>
                {!vacina.bloqueada && atrasados > 0 ? (
                  <span className="font-semibold text-critico">{atrasados}</span>
                ) : vacina.bloqueada ? (
                  "—"
                ) : (
                  0
                )}
              </TableCell>
              <TableCell>
                {custoMedioCentavos !== null
                  ? (custoMedioCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "— sem dado —"}
              </TableCell>
            </TableRow>
          ))}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhuma vacina cadastrada no catálogo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Este calendário é ponto de partida organizacional, não prescrição. O protocolo definitivo precisa ser
          fechado com seu médico-veterinário, considerando o histórico sanitário específico da propriedade.
        </CardContent>
      </Card>
    </div>
  );
}
