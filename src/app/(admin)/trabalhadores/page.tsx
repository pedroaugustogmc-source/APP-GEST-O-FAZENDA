import { criarClienteServidor } from "@/infra/supabase/server";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { UsuarioAcessoRow } from "@/infra/supabase/tipos";
import { FormularioTrabalhador } from "./formulario";
import { BotaoDesligar } from "./botao-desligar";

export const dynamic = "force-dynamic";

export default async function PaginaTrabalhadores() {
  const supabase = criarClienteServidor();
  const { data } = await supabase.from("usuarios_acesso").select("*").order("criado_em", { ascending: false });
  const usuarios = (data ?? []) as UsuarioAcessoRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Trabalhadores</h1>
        <p className="text-sm text-muted-foreground">
          O trabalhador nunca consulta dado — só grava, e só pelo bot (Fase 2). O que ele já registrou não
          se apaga quando ele é desligado; só o acesso é que cai.
        </p>
      </div>
      <FormularioTrabalhador />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell className="font-medium">{usuario.nome}</TableCell>
              <TableCell>{usuario.telefone}</TableCell>
              <TableCell>{usuario.plataforma}</TableCell>
              <TableCell>{usuario.papel}</TableCell>
              <TableCell>
                <Badge variant={usuario.status === "ativo" ? "default" : "outline"}>{usuario.status}</Badge>
              </TableCell>
              <TableCell>
                {usuario.papel === "trabalhador" ? (
                  <BotaoDesligar id={usuario.id} status={usuario.status} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {usuarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhum trabalhador cadastrado — comece pelo formulário acima.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
