import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { ratearPorUaDia } from "@/domain/calculos/ratearPorUaDia";
import { partesDeISODate } from "@/domain/tipos/data";
import type { ISODate } from "@/domain/tipos";
import type { CentroCustoDB, TipoOperacaoDB } from "@/infra/supabase/tipos";

// docs/03-modulos.md M5 "adições extras": rateio automático de custo comum
// por UA × dias (docs/01-dominio.md §9). Ação administrativa pontual (ex.:
// conta de energia da sede, diária de peão que trabalhou em vários lotes) —
// não é um lançamento por lote feito à mão, é um único valor dividido entre
// os lotes ativos, gravando uma linha de `financeiro` por lote via
// ratearPorUaDia (Anexo A.5: soma dos rateios fecha exatamente com o custo
// original, por construção).
const Esquema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  categoria: z.string().min(1),
  descricao: z.string().min(1, "Descreva o que está sendo rateado (ex.: energia da sede)."),
  valor_centavos: z.string().regex(/^\d+$/, "Valor deve ser um número inteiro de centavos"),
});

// tipo_operacao (lotes) → centro_custo (financeiro): "engorda" e "misto" não
// têm centro_custo próprio no schema (docs/02-dados.md §13.4) — aproximação
// declarada em ESTADO.md: tratados como recria (fase pós-desmame, mesmo
// bucket operacional de pasto/suplemento).
const TIPO_OPERACAO_PARA_CENTRO_CUSTO: Record<TipoOperacaoDB, CentroCustoDB> = {
  cria: "cria",
  recria: "recria",
  engorda: "recria",
  leite: "leite",
  misto: "recria",
};

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

  const custo = BigInt(analisado.data.valor_centavos);
  if (custo <= 0n) return respostaErro("O valor a ratear precisa ser maior que zero.", 400);

  const parametros = await buscarParametros(supabase);
  const hoje = analisado.data.data as ISODate;

  const [{ data: lotesData }, { data: pesosData }] = await Promise.all([
    supabase.from("lotes").select("id, nome, tipo_operacao, cabecas_atuais, peso_entrada, data_entrada").eq("status", "ativo"),
    supabase.from("mv_indicadores_recria").select("lote_id, peso_ultima_kg"),
  ]);

  type LinhaLote = {
    id: string;
    nome: string;
    tipo_operacao: TipoOperacaoDB;
    cabecas_atuais: number;
    peso_entrada: number | null;
    data_entrada: ISODate;
  };
  const lotes = (lotesData ?? []) as LinhaLote[];
  if (lotes.length === 0) return respostaErro("Não há lote ativo para ratear o custo comum.", 409);

  const pesoAtualPorLote = new Map<string, number>();
  for (const linha of (pesosData ?? []) as Array<{ lote_id: string; peso_ultima_kg: number | null }>) {
    if (linha.peso_ultima_kg !== null) pesoAtualPorLote.set(linha.lote_id, linha.peso_ultima_kg);
  }

  const lotesSemPeso = lotes.filter((l) => (pesoAtualPorLote.get(l.id) ?? l.peso_entrada) === null);
  if (lotesSemPeso.length > 0) {
    return respostaErro(
      `Lote(s) sem peso conhecido, não é possível ratear por UA: ${lotesSemPeso.map((l) => l.nome).join(", ")}.`,
      409
    );
  }

  const entradaRateio = lotes.map((lote) => {
    const pesoAtual = pesoAtualPorLote.get(lote.id) ?? lote.peso_entrada!;
    return {
      id: lote.id,
      pesoVivoTotal: pesoAtual * lote.cabecas_atuais,
      dias: diasEntre(lote.data_entrada, hoje),
    };
  });

  let rateio: Array<{ id: string; valor: bigint }>;
  try {
    rateio = ratearPorUaDia(custo, entradaRateio, parametros);
  } catch (excecao) {
    return respostaErro(excecao instanceof Error ? excecao.message : "Falha ao ratear o custo comum.", 409);
  }

  const nomePorLote = new Map(lotes.map((l) => [l.id, l.nome]));
  const centroCustoPorLote = new Map(lotes.map((l) => [l.id, TIPO_OPERACAO_PARA_CENTRO_CUSTO[l.tipo_operacao]]));

  const linhas = rateio.map((item) => ({
    data: analisado.data.data,
    tipo: "custo" as const,
    categoria: analisado.data.categoria,
    subcategoria: "Rateio de custo comum (UA × dias)",
    descricao: `${analisado.data.descricao} — rateado com ${nomePorLote.get(item.id)}`,
    valor_centavos: item.valor.toString(),
    lote_id: item.id,
    centro_custo: centroCustoPorLote.get(item.id),
    prazo_dias: 0,
    pago: true,
    registrado_por: admin.id,
  }));

  const { data: gravadas, error } = await supabase.from("financeiro").insert(linhas).select("id, lote_id, valor_centavos");
  if (error) return respostaErro(error.message, 400);

  return NextResponse.json({
    rateado_em_lotes: rateio.length,
    lancamentos: (gravadas ?? []).map((g) => ({ loteId: g.lote_id, loteNome: nomePorLote.get(g.lote_id as string), valorCentavos: g.valor_centavos })),
  });
}

function diasEntre(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.max(1, Math.round((msB - msA) / (1000 * 60 * 60 * 24)));
}
