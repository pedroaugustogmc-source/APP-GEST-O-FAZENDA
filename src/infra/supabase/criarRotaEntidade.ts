import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { criarClienteServidor } from "./server";

interface OpcoesRotaEntidade<
  TCriacao extends Record<string, unknown>,
  TAtualizacao extends Record<string, unknown>,
> {
  tabela: string;
  /** Coluna usada para localizar a linha no PATCH. Default: "id". */
  chavePrimaria?: string;
  /** Ausente = esta entidade não aceita criação por aqui (ex.: parametros_fazenda). */
  esquemaCriacao?: ZodType<TCriacao>;
  esquemaAtualizacao: ZodType<TAtualizacao>;
  /**
   * Quando true, injeta registrado_por = usuarios_acesso.id do admin logado,
   * ignorando qualquer valor vindo do cliente (docs/02-dados.md §16:
   * "registrado_por... preenchido pelo servidor e rejeitado se vier do
   * cliente"). Necessário para lotes e animais.
   */
  comRegistradoPor?: boolean;
}

function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

/**
 * Fábrica de rota — todas as entidades da F1 seguem o mesmo formato
 * (valida com Zod na borda §39, grava via cliente com sessão do admin,
 * RLS decide o resto). POST é upsert por client_uuid para a fila offline
 * (§36 item 4: reenvio não duplica); PATCH localiza pela chave primária.
 */
export function criarRotaEntidade<
  TCriacao extends Record<string, unknown>,
  TAtualizacao extends Record<string, unknown>,
>(opcoes: OpcoesRotaEntidade<TCriacao, TAtualizacao>) {
  const chave = opcoes.chavePrimaria ?? "id";

  async function obterUsuarioLogado() {
    const supabase = criarClienteServidor();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) return null;

    const { data: usuario } = await supabase
      .from("usuarios_acesso")
      .select("id")
      .eq("auth_user_id", sessao.user.id)
      .single();

    return usuario?.id ?? null;
  }

  async function POST(request: Request) {
    if (!opcoes.esquemaCriacao) {
      return respostaErro("Esta entidade não aceita criação por este caminho.", 405);
    }

    const corpo = await request.json().catch(() => null);
    const analisado = opcoes.esquemaCriacao.safeParse(corpo);
    if (!analisado.success) {
      return respostaErro(analisado.error.issues[0]?.message ?? "Dado inválido", 400);
    }

    let dados: Record<string, unknown> = { ...analisado.data };

    if (opcoes.comRegistradoPor) {
      const usuarioId = await obterUsuarioLogado();
      if (!usuarioId) return respostaErro("Sessão inválida ou usuário sem cadastro em usuarios_acesso.", 401);
      dados = { ...dados, registrado_por: usuarioId };
    }

    const supabase = criarClienteServidor();
    const temClientUuid = typeof dados.client_uuid === "string" && dados.client_uuid.length > 0;

    const { data, error } = await (temClientUuid
      ? supabase.from(opcoes.tabela).upsert(dados, { onConflict: "client_uuid" })
      : supabase.from(opcoes.tabela).insert(dados)
    )
      .select()
      .single();

    if (error) return respostaErro(error.message, 400);
    return NextResponse.json(data, { status: 201 });
  }

  async function PATCH(request: Request) {
    const corpo = await request.json().catch(() => null);
    const analisado = opcoes.esquemaAtualizacao.safeParse(corpo);
    if (!analisado.success) {
      return respostaErro(analisado.error.issues[0]?.message ?? "Dado inválido", 400);
    }

    const { [chave]: valorChave, ...campos } = analisado.data as Record<string, unknown>;
    if (valorChave === undefined || valorChave === null || valorChave === "") {
      return respostaErro(`Campo "${chave}" é obrigatório`, 400);
    }

    const supabase = criarClienteServidor();
    const { data, error } = await supabase
      .from(opcoes.tabela)
      .update(campos)
      .eq(chave, valorChave)
      .select()
      .single();

    if (error) return respostaErro(error.message, 400);
    return NextResponse.json(data);
  }

  return { POST, PATCH };
}
