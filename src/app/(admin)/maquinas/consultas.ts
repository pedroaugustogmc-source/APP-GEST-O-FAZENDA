import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarManutencao, type StatusManutencao } from "@/domain/calculos/avaliarManutencao";
import { custoPorHora } from "@/domain/calculos/custoPorHora";
import type { Centavos, Indicador, Parametros } from "@/domain/tipos";
import type { MaquinaRow, PlanoManutencaoRow, ManutencaoRow } from "@/infra/supabase/tipos";

export interface MaquinaComIndicadores {
  maquina: MaquinaRow;
  statusManutencao: StatusManutencao;
  horasRestantes: number | null;
  custoAcumuladoCentavos: Centavos;
  custoPorHora: Indicador<Centavos>;
  planos: PlanoManutencaoRow[];
  historicoManutencoes: ManutencaoRow[];
}

// docs/03-modulos.md M7: ficha de cuidados + alerta preditivo + custo
// acumulado/hora, tudo numa consulta só, reaproveitando avaliarManutencao
// (mesma leitura do alerta manutencao_vencida/manutencao_proxima do
// worker gerar-alertas — a tela e o alerta nunca podem discordar).
export async function buscarMaquinasComIndicadores(supabase: SupabaseClient, parametros: Parametros): Promise<MaquinaComIndicadores[]> {
  const [{ data: maquinasData }, { data: planosData }, { data: manutencoesData }, { data: financeiroData }] = await Promise.all([
    supabase.from("maquinas").select("*").order("nome"),
    supabase.from("plano_manutencao").select("*"),
    supabase.from("manutencoes").select("*").order("data", { ascending: false }),
    supabase.from("financeiro").select("maquina_id, valor_centavos").eq("tipo", "custo").is("deletado_em", null).not("maquina_id", "is", null),
  ]);

  const maquinas = (maquinasData ?? []) as MaquinaRow[];
  const planos = (planosData ?? []) as PlanoManutencaoRow[];
  const manutencoes = (manutencoesData ?? []) as ManutencaoRow[];

  const custoPorMaquina = new Map<string, Centavos>();
  for (const linha of (financeiroData ?? []) as Array<{ maquina_id: string; valor_centavos: number }>) {
    custoPorMaquina.set(linha.maquina_id, (custoPorMaquina.get(linha.maquina_id) ?? 0n) + BigInt(linha.valor_centavos));
  }

  // manutencoes já vem ordenado desc por data — a primeira com
  // proxima_em_horas por máquina é a mais recente que tem essa informação.
  const proximaPorMaquina = new Map<string, number>();
  for (const m of manutencoes) {
    if (m.proxima_em_horas !== null && !proximaPorMaquina.has(m.maquina_id)) {
      proximaPorMaquina.set(m.maquina_id, m.proxima_em_horas);
    }
  }

  const alertaAntecedencia = parametros.ALERTA_MANUTENCAO_HORAS ?? 20;

  return maquinas.map((maquina) => {
    const avaliacao = avaliarManutencao(maquina.horas_uso_total, proximaPorMaquina.get(maquina.id) ?? null, alertaAntecedencia);
    const custoAcumuladoCentavos = custoPorMaquina.get(maquina.id) ?? 0n;

    return {
      maquina,
      statusManutencao: avaliacao.status,
      horasRestantes: avaliacao.horasRestantes,
      custoAcumuladoCentavos,
      custoPorHora: custoPorHora(custoAcumuladoCentavos, maquina.horas_uso_total),
      planos: planos.filter((p) => p.maquina_id === maquina.id),
      historicoManutencoes: manutencoes.filter((m) => m.maquina_id === maquina.id).slice(0, 5),
    };
  });
}
