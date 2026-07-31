// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// score = impacto*0,40 + urgencia*0,30 + risco_se_nao_fizer*0,20 − custo_normalizado*0,10
// Os pesos são constantes da fórmula, não parâmetros de fazenda: a
// assinatura fixa do Anexo B não recebe `Parametros`, então não há como
// lê-los de `parametros_fazenda` — exceção sancionada à regra 3 do
// CLAUDE.md, do mesmo jeito que RENDIMENTO_CARCACA/KG_POR_ARROBA já são
// constantes embutidas em outras fórmulas do próprio Anexo B.
const PESO_IMPACTO = 0.4;
const PESO_URGENCIA = 0.3;
const PESO_RISCO = 0.2;
const PESO_CUSTO = 0.1;

// Limiares só para categorizar a justificativa em texto (não mudam o
// score nem gate nenhuma decisão do sistema) — mesma razão acima, hardcoded
// dentro da função por não haver `Parametros` na assinatura fixa.
const LIMIAR_ALTO = 7;
const LIMIAR_MEDIO = 4;

export interface EntradaScoreTarefa {
  impacto: number;
  urgencia: number;
  risco: number;
  custoNormalizado: number;
}

export interface ResultadoScoreTarefa {
  score: number;
  justificativa: string;
}

export function scoreTarefa(e: EntradaScoreTarefa): ResultadoScoreTarefa {
  for (const [nome, valor] of Object.entries(e)) {
    if (valor < 0 || valor > 10) {
      throw new Error(`Componente "${nome}" de scoreTarefa precisa estar entre 0 e 10 (recebi ${valor}).`);
    }
  }

  const score = e.impacto * PESO_IMPACTO + e.urgencia * PESO_URGENCIA + e.risco * PESO_RISCO - e.custoNormalizado * PESO_CUSTO;

  return { score, justificativa: montarJustificativa(e) };
}

type Nivel = "baixo" | "médio" | "alto";

function nivel(valor: number): Nivel {
  if (valor >= LIMIAR_ALTO) return "alto";
  if (valor >= LIMIAR_MEDIO) return "médio";
  return "baixo";
}

// Concordância de gênero em português: "impacto"/"risco"/"custo" são
// masculinos, "urgência" é feminino — não dá pra usar o mesmo rótulo pros 4.
const ROTULO_MASCULINO: Record<Nivel, string> = { baixo: "baixo", médio: "médio", alto: "alto" };
const ROTULO_FEMININO: Record<Nivel, string> = { baixo: "baixa", médio: "média", alto: "alta" };

function montarJustificativa(e: EntradaScoreTarefa): string {
  const partes: string[] = [];

  if (nivel(e.impacto) !== "baixo") partes.push(`impacto ${ROTULO_MASCULINO[nivel(e.impacto)]}`);
  if (nivel(e.urgencia) !== "baixo") partes.push(`urgência ${ROTULO_FEMININO[nivel(e.urgencia)]}`);
  if (nivel(e.risco) !== "baixo") partes.push(`risco ${ROTULO_MASCULINO[nivel(e.risco)]} se não fizer`);

  const custoAlto = nivel(e.custoNormalizado) === "alto";

  if (partes.length === 0) {
    return custoAlto
      ? "Impacto, urgência e risco baixos, e custo alto reduz ainda mais a prioridade."
      : "Prioridade baixa em todos os fatores.";
  }

  const inicio = partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  const verbo = partes.length === 1 ? "eleva" : "elevam";
  const frase = `${capitalizar(inicio)} ${verbo} a prioridade`;
  return custoAlto ? `${frase}, mas o custo alto reduz.` : `${frase}.`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
