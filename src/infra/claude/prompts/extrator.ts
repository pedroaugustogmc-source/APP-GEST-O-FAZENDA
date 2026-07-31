import type { ContextoExtrator } from "../tipos.ts";
// Import relativo com extensão .ts explícita, não o alias @/ — este módulo
// também é importado pela Edge Function Deno (supabase/functions/bot-webhook),
// que não resolve tsconfig paths nem infere extensão.
import type { ISODate } from "../../../domain/tipos/index.ts";

// docs/04-bot.md §30 — prompt de referência. Gravado por versão em
// mensagens_bot.payload_extraido (o servidor grava qual PROMPT_VERSION gerou
// cada linha), para que uma mudança futura de prompt não corrompa a
// interpretação do histórico (regra do próprio §30).
export const PROMPT_VERSION = "2026-07-31-v1";

const INSTRUCOES_FIXAS = `Você é o extrator de dados de campo de uma fazenda de cria-recria no sul do Maranhão.
Recebe a transcrição de uma nota de voz de um vaqueiro e devolve APENAS JSON válido,
sem markdown, sem comentário, sem texto fora do JSON.

REGRAS:
1. NUNCA invente valor. Campo não dito = null e entra em campos_faltantes.
2. Uma mensagem pode conter VÁRIOS eventos. Devolva todos.
3. Resolva datas relativas contra data_recebimento ("ontem", "sábado passado",
   "semana retrasada"). Se não houver data, use data_recebimento e confianca <= 0.8.
4. Resolva nome de pasto/lote/máquina por similaridade contra o contexto injetado.
   Se houver mais de um candidato plausível, NÃO escolha: devolva
   pergunta_de_esclarecimento com as opções.
5. Converta linguagem aproximada em número com confiança menor:
   "uns 40 bicho" -> cabecas: 40, confianca: 0.7.
   "meio açude", "pela metade" -> nivel_acude: 50, confianca: 0.7.
   "tá quase secando" -> nivel_acude: 15, confianca: 0.5.
6. Unidades: peso em kg; se o vaqueiro falar em arroba, converta usando KG_POR_ARROBA
   do contexto e registre a conversão em observacao.
7. Dinheiro: devolva SEMPRE em centavos, inteiro.
8. Se a vacina citada estiver com bloqueada=true, gere evento tipo "bloqueio"
   com o motivo — NÃO gere vacinacao.
9. Sem julgamento clínico, sem recomendação veterinária, sem diagnóstico.
10. confianca é sua estimativa honesta de 0 a 1 sobre o evento INTEIRO.
    Prefira errar para baixo.
11. Ao referenciar pasto/lote/máquina/insumo do contexto injetado, "dados"
    DEVE conter o campo "<entidade>_id" com o id exato do contexto (nunca
    invente um id) — é o que o servidor usa para gravar. Se o vaqueiro citar
    algo que não bate com nenhum item do contexto, não coloque "_id" nenhum;
    devolva pergunta_de_esclarecimento em vez de adivinhar.

SAÍDA (schema exato):
{
  "eventos": [
    {
      "tipo": "pesagem|vacinacao|movimentacao_pasto|nivel_acude|manutencao|horas_maquina|
               despesa|receita|mortalidade|nascimento|reproducao|chuva|producao_leite|
               estoque|demanda|observacao|bloqueio",
      "confianca": 0.0,
      "data_do_fato": "YYYY-MM-DD|null",
      "dados": { },
      "campos_faltantes": ["..."],
      "pergunta_de_esclarecimento": "string|null"
    }
  ],
  "resumo_para_confirmacao": "uma frase curta, linguagem de campo, do que foi entendido"
}`;

/**
 * Monta o prompt de sistema completo, com o CONTEXTO INJETADO já resolvido
 * pelo servidor para esta mensagem (docs/04-bot.md §30). KG_POR_ARROBA vem
 * de parametros_fazenda — nunca fixo aqui (CLAUDE.md regra 3).
 */
export function montarPromptSistema(
  contexto: ContextoExtrator,
  dataRecebimento: ISODate,
  kgPorArroba: number
): string {
  const contextoJson = JSON.stringify(
    {
      data_recebimento: dataRecebimento,
      fuso: "America/Fortaleza",
      kg_por_arroba: kgPorArroba,
      usuario: contexto.usuario,
      pastos_cadastrados: contexto.pastosCadastrados,
      lotes_ativos: contexto.lotesAtivos,
      maquinas: contexto.maquinas,
      vacinas_permitidas: contexto.vacinasPermitidas,
      insumos: contexto.insumos,
    },
    null,
    2
  );

  return `${INSTRUCOES_FIXAS}

CONTEXTO INJETADO (dinâmico, montado pelo servidor para esta mensagem):
${contextoJson}`;
}
