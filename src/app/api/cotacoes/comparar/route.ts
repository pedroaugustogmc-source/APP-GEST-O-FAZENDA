import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { compararCotacoes } from "@/domain/calculos/compararCotacoes";

// docs/03-modulos.md M8 "negociação assistida": o admin cola os orçamentos
// de uma vez, o sistema aponta o vencedor por custo efetivo (§41.12) — ação
// em lote síncrona (mesmo padrão de /api/financeiro/ratear, F4), não CRUD
// simples por linha. Frete entra no total antes do deságio: é parte do que
// se paga, à vista ou financiado — interpretação declarada em ESTADO.md,
// já que o §9 não menciona frete na fórmula.
const EsquemaCotacao = z.object({
  fornecedor: z.string().min(1),
  quantidade: z.number().positive().nullable().optional(),
  unidade: z.string().nullable().optional(),
  preco_centavos: z.string().regex(/^\d+$/, "Preço deve ser um número inteiro de centavos"),
  prazo_dias: z.number().int().min(0),
  desconto_avista_pct: z.number().min(0).max(1),
  frete_centavos: z.string().regex(/^\d+$/).default("0"),
});

const Esquema = z.object({
  insumo: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  cotacoes: z.array(EsquemaCotacao).min(2, "Informe pelo menos 2 orçamentos para comparar."),
});

function respostaErro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST(request: Request) {
  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return respostaErro("Sessão inválida.", 401);

  const { data: admin } = await supabase.from("usuarios_acesso").select("id").eq("auth_user_id", sessao.user.id).single();
  if (!admin) return respostaErro("Usuário sem cadastro em usuarios_acesso.", 401);

  const corpo = await request.json().catch(() => null);
  const analisado = Esquema.safeParse(corpo);
  if (!analisado.success) return respostaErro(analisado.error.issues[0]?.message ?? "Corpo inválido", 400);

  const parametros = await buscarParametros(supabase);

  const entradas = analisado.data.cotacoes.map((c, i) => ({
    id: String(i),
    totalCentavos: BigInt(c.preco_centavos) + BigInt(c.frete_centavos),
    prazoDias: c.prazo_dias,
    descontoAvistaPct: c.desconto_avista_pct,
  }));

  const resultado = compararCotacoes(entradas, parametros);
  const custoEfetivoPorIndice = new Map(resultado.map((r, i) => [i, r]));

  const linhas = analisado.data.cotacoes.map((c, i) => ({
    insumo: analisado.data.insumo,
    fornecedor: c.fornecedor,
    quantidade: c.quantidade ?? null,
    unidade: c.unidade ?? null,
    preco_centavos: c.preco_centavos,
    prazo_dias: c.prazo_dias,
    desconto_avista_pct: c.desconto_avista_pct,
    frete_centavos: c.frete_centavos,
    custo_efetivo_centavos: custoEfetivoPorIndice.get(i)!.custoEfetivo.toString(),
    data: analisado.data.data,
    vencedora: custoEfetivoPorIndice.get(i)!.vencedora,
    registrado_por: admin.id,
  }));

  const { data: gravadas, error } = await supabase
    .from("cotacoes")
    .insert(linhas)
    .select("id, fornecedor, preco_centavos, prazo_dias, custo_efetivo_centavos, vencedora");

  if (error) return respostaErro(error.message, 400);

  return NextResponse.json({ resultado: gravadas });
}
