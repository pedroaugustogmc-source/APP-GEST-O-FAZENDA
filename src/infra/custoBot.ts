// Import relativo com extensão .ts explícita, não o alias @/ — este módulo
// também roda na Edge Function Deno (supabase/functions/bot-webhook), que não
// resolve tsconfig paths nem infere extensão.
import type { Centavos } from "../domain/tipos/index.ts";

// docs/08-anexos.md Anexo I — "custo_por_mensagem = transcrição(duração) +
// extração(tokens_contexto + tokens_saída)". Os preços vêm de
// parametros_fazenda (PRECO_ASR_CENTAVOS_MINUTO, PRECO_CLAUDE_INPUT_CENTAVOS_MTOK,
// PRECO_CLAUDE_OUTPUT_CENTAVOS_MTOK) — nunca fixos aqui (CLAUDE.md regra 3),
// porque preço de fornecedor externo muda sem aviso e o admin precisa poder
// corrigir sem deploy.
export interface PrecosBot {
  precoAsrCentavosMinuto: number;
  precoClaudeInputCentavosMTok: number;
  precoClaudeOutputCentavosMTok: number;
}

export function calcularCustoMensagemCentavos(
  duracaoAudioSegundos: number | null,
  tokensEntrada: number,
  tokensSaida: number,
  precos: PrecosBot
): Centavos {
  const custoAsr = duracaoAudioSegundos ? (duracaoAudioSegundos / 60) * precos.precoAsrCentavosMinuto : 0;
  const custoEntrada = (tokensEntrada / 1_000_000) * precos.precoClaudeInputCentavosMTok;
  const custoSaida = (tokensSaida / 1_000_000) * precos.precoClaudeOutputCentavosMTok;

  const totalCentavos = Math.round(custoAsr + custoEntrada + custoSaida);
  return BigInt(Math.max(totalCentavos, 0));
}
