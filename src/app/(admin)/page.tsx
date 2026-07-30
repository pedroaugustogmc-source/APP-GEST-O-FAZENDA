import Link from "next/link";
import { criarClienteServidor } from "@/infra/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECOES = [
  { titulo: "Pastos", tabela: "pastos", href: "/pastos" },
  { titulo: "Lotes", tabela: "lotes", href: "/lotes" },
  { titulo: "Animais", tabela: "animais", href: "/animais" },
  { titulo: "Máquinas", tabela: "maquinas", href: "/maquinas" },
  { titulo: "Insumos", tabela: "estoque_insumos", href: "/insumos" },
  { titulo: "Trabalhadores", tabela: "usuarios_acesso", href: "/trabalhadores" },
] as const;

export default async function PaginaInicial() {
  const supabase = criarClienteServidor();

  const contagens = await Promise.all(
    SECOES.map(async (secao) => {
      const { count } = await supabase
        .from(secao.tabela)
        .select("*", { count: "exact", head: true });
      return { ...secao, contagem: count ?? 0 };
    })
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">
        O que você quer cadastrar hoje?
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contagens.map((secao) => (
          <Link key={secao.href} href={secao.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{secao.titulo}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-numero-grande text-primary">{secao.contagem}</p>
                <p className="text-sm text-muted-foreground">
                  cadastrado{secao.contagem === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
