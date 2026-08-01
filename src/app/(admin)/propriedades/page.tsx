import { criarClienteServidor } from "@/infra/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PropriedadeRow } from "@/infra/supabase/tipos";
import { FormularioEditarPropriedade } from "./formulario-editar";
import { FormularioCriarPropriedade } from "./formulario-criar";

export const dynamic = "force-dynamic";

// Fase 6b (ver ESTADO.md e o plano desta sessão): RLS de `propriedade` agora
// só deixa cada admin/gerente enxergar a própria fazenda (id =
// current_propriedade_id()) — antes disso qualquer admin via qualquer linha.
// Por isso um único `.select("*")` já devolve no máximo 1 linha.
export default async function PaginaPropriedades() {
  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  const { data: quemChama } = sessao.user
    ? await supabase.from("usuarios_acesso").select("papel").eq("auth_user_id", sessao.user.id).maybeSingle()
    : { data: null };
  const ehAdmin = quemChama?.papel === "admin";

  const { data } = await supabase.from("propriedade").select("*").maybeSingle();
  const propriedade = data as PropriedadeRow | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Propriedade</h1>
        <p className="text-sm text-muted-foreground">
          Dados da sua fazenda e, se você for admin, criação de uma fazenda nova com seu próprio primeiro admin.
          Sem troca de fazenda em sessão: cada fazenda usa um login (e-mail) separado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          {propriedade ? (
            <FormularioEditarPropriedade propriedade={propriedade} />
          ) : (
            <p className="text-sm text-muted-foreground">— sem dado —</p>
          )}
        </CardContent>
      </Card>

      {ehAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar nova fazenda</CardTitle>
            <CardDescription>
              Cria uma propriedade separada com seu próprio primeiro admin — nenhum dado da sua fazenda atual é
              visível de lá, nem o contrário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioCriarPropriedade />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
