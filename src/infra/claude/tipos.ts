import { z } from "zod";

// docs/04-bot.md §30 — schema de saída do extrator, exato.
export const TipoEventoBotSchema = z.enum([
  "pesagem",
  "vacinacao",
  "movimentacao_pasto",
  "nivel_acude",
  "manutencao",
  "horas_maquina",
  "despesa",
  "receita",
  "mortalidade",
  "nascimento",
  "reproducao",
  "chuva",
  "producao_leite",
  "estoque",
  "demanda",
  "observacao",
  "bloqueio",
]);
export type TipoEventoBot = z.infer<typeof TipoEventoBotSchema>;

export const EventoExtraidoSchema = z.object({
  tipo: TipoEventoBotSchema,
  confianca: z.number().min(0).max(1),
  data_do_fato: z.string().nullable(),
  dados: z.record(z.unknown()),
  campos_faltantes: z.array(z.string()),
  pergunta_de_esclarecimento: z.string().nullable(),
});
export type EventoExtraido = z.infer<typeof EventoExtraidoSchema>;

export const RespostaExtratorSchema = z.object({
  eventos: z.array(EventoExtraidoSchema),
  resumo_para_confirmacao: z.string(),
});
export type RespostaExtrator = z.infer<typeof RespostaExtratorSchema>;

// docs/04-bot.md §30 "CONTEXTO INJETADO (dinâmico, montado pelo servidor)".
export interface ContextoExtrator {
  usuario: { nome: string; papel: string };
  pastosCadastrados: Array<{ id: string; nome: string; apelidos: string[] }>;
  lotesAtivos: Array<{ id: string; nome: string; categoria: string; pastoAtual: string | null; cabecas: number }>;
  maquinas: Array<{ id: string; nome: string; modelo: string }>;
  vacinasPermitidas: Array<{ nome: string; bloqueada: boolean; motivoBloqueio: string | null }>;
  insumos: Array<{ id: string; nome: string; unidade: string }>;
}

export interface ResultadoExtracao {
  eventos: EventoExtraido[];
  resumoParaConfirmacao: string;
  tokensEntrada: number;
  tokensSaida: number;
}
