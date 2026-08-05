import type { SupabaseClient } from "@supabase/supabase-js";

export interface OfensorAlerta {
  entidadeId: string | null;
  titulo: string;
  mensagem: string;
  severidade: "info" | "atencao" | "critico";
  acaoSugerida?: string;
  dados?: Record<string, unknown>;
}

const SEM_ENTIDADE = "__sem_entidade__";

/**
 * docs/01-dominio.md §12: "Cada alerta tem deduplicação (não repetir o mesmo
 * alerta aberto para a mesma entidade) e auto-resolução quando a condição
 * deixa de existir." A constraint `uq_alerta_aberto` do banco não basta
 * sozinha — Postgres trata `NULL` como distinto em unique constraints, então
 * vários alertas com `resolvido_em is null` passariam por ela sem conflito.
 * Por isso o dedup/auto-resolve é feito aqui, explicitamente, por tipo+entidade.
 */
export async function sincronizarAlertas(
  supabase: SupabaseClient,
  tipo: string,
  entidadeTipo: string | null,
  ofensores: OfensorAlerta[],
  propriedadeId: string
): Promise<void> {
  const { data: abertos } = await supabase
    .from("alertas")
    .select("id, entidade_id")
    .eq("tipo", tipo)
    .eq("propriedade_id", propriedadeId)
    .is("resolvido_em", null);

  const idsAbertos = new Map<string, string>(
    (abertos ?? []).map((a: { id: string; entidade_id: string | null }) => [a.entidade_id ?? SEM_ENTIDADE, a.id])
  );
  const chavesOfensores = new Set(ofensores.map((o) => o.entidadeId ?? SEM_ENTIDADE));

  for (const ofensor of ofensores) {
    const chave = ofensor.entidadeId ?? SEM_ENTIDADE;
    if (idsAbertos.has(chave)) continue;

    await supabase.from("alertas").insert({
      tipo,
      severidade: ofensor.severidade,
      entidade_tipo: entidadeTipo,
      entidade_id: ofensor.entidadeId,
      titulo: ofensor.titulo,
      mensagem: ofensor.mensagem,
      acao_sugerida: ofensor.acaoSugerida ?? null,
      dados: ofensor.dados ?? null,
      propriedade_id: propriedadeId,
    });
  }

  const paraFechar = [...idsAbertos.entries()].filter(([chave]) => !chavesOfensores.has(chave));
  for (const [, id] of paraFechar) {
    await supabase
      .from("alertas")
      .update({ resolvido_em: new Date().toISOString(), resolvido_auto: true })
      .eq("id", id);
  }
}
