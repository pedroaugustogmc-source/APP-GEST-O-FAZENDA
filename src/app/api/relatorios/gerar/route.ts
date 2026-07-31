import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/infra/supabase/server";
import { buscarParametros } from "@/infra/supabase/parametros";
import { montarRelatorioGeral } from "@/infra/relatorios/montarRelatorio";
import { hojeEmFortaleza } from "@/domain/tipos/data";

// docs/03-modulos.md M9.1: "relatório geral da fazenda (sob demanda)."
// Ação síncrona (mesmo padrão de /api/financeiro/ratear e
// /api/cotacoes/comparar): monta na hora e já devolve o id gravado, pra
// redirecionar pra tela de detalhe.
export async function POST() {
  const supabase = criarClienteServidor();

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });

  const parametros = await buscarParametros(supabase);
  const hoje = hojeEmFortaleza();
  const relatorio = await montarRelatorioGeral(supabase, parametros, hoje);

  const { data, error } = await supabase
    .from("relatorios")
    .insert({
      tipo: relatorio.tipo,
      periodo_inicio: relatorio.periodoInicio,
      periodo_fim: relatorio.periodoFim,
      conteudo_md: relatorio.conteudoMd,
      indicadores: relatorio.indicadores,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
