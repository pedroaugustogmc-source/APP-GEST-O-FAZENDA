import { z } from "zod";
import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/infra/supabase/server";

const esquemaAnimalImportado = z.object({
  brinco: z.string().nullable(),
  sexo: z.enum(["M", "F"]),
  categoria: z.enum(["bezerro", "bezerra", "garrote", "novilha", "vaca", "touro", "boi"]),
  data_nascimento: z.string().nullable(),
  peso_nascimento: z.number().nullable(),
  origem: z.enum(["nascimento", "compra", "importacao"]),
  linhaOriginal: z.record(z.string()),
});

const esquemaRequisicao = z.object({
  animais: z.array(esquemaAnimalImportado).min(1),
});

/**
 * Grava em lote as linhas já validadas pelo importador (docs/02-dados.md
 * §17). A validação linha a linha já rodou no navegador
 * (src/domain/validacao/importadorAnimais.ts) — aqui só revalida o formato
 * na borda (§39) e grava, com origem='importacao' + a linha original em
 * jsonb quando a origem real não foi informada pela planilha.
 */
export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const analisado = esquemaRequisicao.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json({ erro: analisado.error.issues[0]?.message ?? "Dado inválido" }, { status: 400 });
  }

  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  const { data: usuario } = await supabase
    .from("usuarios_acesso")
    .select("id")
    .eq("auth_user_id", sessao.user.id)
    .single();

  if (!usuario) {
    return NextResponse.json({ erro: "Usuário não encontrado em usuarios_acesso." }, { status: 403 });
  }

  const linhas = analisado.data.animais.map((animal) => ({
    brinco: animal.brinco,
    sexo: animal.sexo,
    categoria: animal.categoria,
    data_nascimento: animal.data_nascimento,
    peso_nascimento: animal.peso_nascimento,
    origem: animal.origem,
    linha_importada: animal.linhaOriginal,
    registrado_por: usuario.id,
  }));

  const { data, error } = await supabase.from("animais").insert(linhas).select("id");

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 400 });
  }

  return NextResponse.json({ gravados: data?.length ?? 0 }, { status: 201 });
}
