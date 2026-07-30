import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SeletorStatus } from "@/components/seletor-status";
import { transicaoValidaAnimal, TODOS_STATUS_ANIMAL, type StatusAnimal } from "@/domain/estados/animal";
import type { AnimalRow, LoteRow } from "@/infra/supabase/tipos";
import { FormularioAnimal } from "./formulario";

export const dynamic = "force-dynamic";

export default async function PaginaAnimais() {
  const supabase = criarClienteServidor();

  const [{ data: animaisData }, { data: lotesData }] = await Promise.all([
    supabase.from("animais").select("*").is("deletado_em", null).order("registrado_em", { ascending: false }),
    supabase.from("lotes").select("id, nome").is("deletado_em", null).order("nome"),
  ]);

  const animais = (animaisData ?? []) as AnimalRow[];
  const lotes = (lotesData ?? []) as Array<Pick<LoteRow, "id" | "nome">>;
  const nomeLote = new Map(lotes.map((lote) => [lote.id, lote.nome]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Animais</h1>
      <FormularioAnimal lotes={lotes} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Brinco</TableHead>
            <TableHead>Sexo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Nascimento</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animais.map((animal) => (
            <TableRow key={animal.id}>
              <TableCell className="font-medium">{animal.brinco ?? "— sem dado —"}</TableCell>
              <TableCell>{animal.sexo}</TableCell>
              <TableCell>{animal.categoria}</TableCell>
              <TableCell>{animal.lote_id ? nomeLote.get(animal.lote_id) ?? "— sem dado —" : "— sem dado —"}</TableCell>
              <TableCell>{animal.data_nascimento ?? "— sem dado —"}</TableCell>
              <TableCell>
                <SeletorStatus<StatusAnimal>
                  id={animal.id}
                  tabela="animais"
                  atual={animal.status}
                  opcoes={TODOS_STATUS_ANIMAL}
                  ehValida={transicaoValidaAnimal}
                />
              </TableCell>
            </TableRow>
          ))}
          {animais.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum animal cadastrado — comece pelo formulário acima ou pelo importador de planilha.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
