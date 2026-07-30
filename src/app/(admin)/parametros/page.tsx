import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import type { ParametroRow, PropriedadeRow } from "@/infra/supabase/tipos";
import { FormularioPropriedade } from "./formulario-propriedade";
import { LinhaParametro } from "./linha-parametro";

export const dynamic = "force-dynamic";

export default async function PaginaParametros() {
  const supabase = criarClienteServidor();

  const [{ data: parametrosData }, { data: propriedadeData }] = await Promise.all([
    supabase.from("parametros_fazenda").select("*").order("chave"),
    supabase.from("propriedade").select("*").limit(1).maybeSingle(),
  ]);

  const parametros = (parametrosData ?? []) as ParametroRow[];
  const propriedade = (propriedadeData ?? null) as PropriedadeRow | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Parâmetros</h1>
        <p className="text-sm text-muted-foreground">
          Nenhum limiar, fator ou taxa de negócio fica fixo no código — está tudo aqui, editável. Os valores
          de capacidade de suporte (CAP_UA_HA_*) são ponto de partida e devem ser validados com
          agrônomo/zootecnista local antes de confiar neles para decisão de lotação.
        </p>
      </div>
      <FormularioPropriedade propriedade={propriedade} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parâmetro</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {parametros.map((parametro) => (
            <LinhaParametro
              key={parametro.chave}
              chave={parametro.chave}
              valorAtual={parametro.valor}
              unidade={parametro.unidade}
              descricao={parametro.descricao}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
