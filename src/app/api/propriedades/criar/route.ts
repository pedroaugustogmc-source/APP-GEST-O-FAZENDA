import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor, criarClienteServico } from "@/infra/supabase/server";

// docs/02-dados.md/ESTADO.md (Fase 6b): "criar fazenda" é uma ação
// administrativa pontual, não um fluxo de autocadastro (cadastro público
// continua desligado — só admin cria acesso, §M11). Decisão do dono: sem
// troca de fazenda em sessão — cada fazenda usa um login (e-mail) próprio, e
// quem cria aqui já digita a senha do primeiro admin da fazenda nova (mesmo
// fluxo manual que o README já pedia via Supabase Studio, só que pelo app).
const Esquema = z.object({
  propriedade: z.object({
    nome: z.string().min(1),
    municipio: z.string().min(1).default("Imperatriz"),
    uf: z.string().length(2).default("MA"),
    area_total_ha: z.number().positive().nullable().optional(),
  }),
  admin: z.object({
    nome: z.string().min(1),
    email: z.string().email(),
    telefone: z.string().min(8),
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  }),
});

function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST(request: Request) {
  const supabaseSessao = criarClienteServidor();

  const { data: sessao } = await supabaseSessao.auth.getUser();
  if (!sessao.user) return respostaErro("Sessão inválida.", 401);

  const { data: quemChama } = await supabaseSessao
    .from("usuarios_acesso")
    .select("papel")
    .eq("auth_user_id", sessao.user.id)
    .single();
  if (!quemChama || quemChama.papel !== "admin") {
    return respostaErro("Só um admin pode criar uma fazenda nova.", 403);
  }

  const corpo = await request.json().catch(() => null);
  const analisado = Esquema.safeParse(corpo);
  if (!analisado.success) {
    return respostaErro(analisado.error.issues[0]?.message ?? "Dado inválido", 400);
  }
  const { propriedade, admin } = analisado.data;

  const supabaseServico = criarClienteServico();

  const { data: novoAuthUser, error: erroAuth } = await supabaseServico.auth.admin.createUser({
    email: admin.email,
    password: admin.senha,
    email_confirm: true,
  });
  if (erroAuth || !novoAuthUser.user) {
    return respostaErro(`Falha ao criar o login do novo admin: ${erroAuth?.message ?? "erro desconhecido"}`, 400);
  }

  const { data: propriedadeCriada, error: erroPropriedade } = await supabaseServico
    .from("propriedade")
    .insert({
      nome: propriedade.nome,
      municipio: propriedade.municipio,
      uf: propriedade.uf,
      area_total_ha: propriedade.area_total_ha ?? null,
    })
    .select("id")
    .single();

  if (erroPropriedade || !propriedadeCriada) {
    await supabaseServico.auth.admin.deleteUser(novoAuthUser.user.id);
    return respostaErro(`Falha ao criar a propriedade: ${erroPropriedade?.message ?? "erro desconhecido"}`, 400);
  }

  const { error: erroUsuario } = await supabaseServico.from("usuarios_acesso").insert({
    auth_user_id: novoAuthUser.user.id,
    telefone: admin.telefone,
    plataforma: "telegram",
    nome: admin.nome,
    papel: "admin",
    status: "ativo",
    data_admissao: new Date().toISOString().slice(0, 10),
    propriedade_id: propriedadeCriada.id,
  });

  if (erroUsuario) {
    // CLAUDE.md regra 6 ("sem DELETE em tabela de fato") não se aplica aqui:
    // esta linha nunca chegou a existir de verdade pra ninguém — é a
    // reversão manual de uma criação em 3 passos que não é uma transação
    // única (auth.admin.createUser é uma chamada de API separada do
    // Postgres). `propriedade` também não é tabela de fato no sentido da
    // regra (é config/identidade, como `usuarios_acesso`), não um registro
    // de produção.
    await supabaseServico.from("propriedade").delete().eq("id", propriedadeCriada.id);
    await supabaseServico.auth.admin.deleteUser(novoAuthUser.user.id);
    return respostaErro(`Falha ao criar o admin da fazenda: ${erroUsuario.message}`, 400);
  }

  return NextResponse.json(
    { propriedadeId: propriedadeCriada.id, adminEmail: admin.email },
    { status: 201 }
  );
}
