import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z
  .object({
    maquina_id: z.string().uuid(),
    item: z.string().min(1),
    intervalo_horas: z.number().int().positive().nullable().optional(),
    intervalo_dias: z.number().int().positive().nullable().optional(),
    peca_referencia: z.string().nullable().optional(),
    custo_estimado_centavos: z.string().regex(/^\d+$/).nullable().optional(),
    observacao: z.string().nullable().optional(),
    client_uuid: z.string().min(1),
  })
  .refine((v) => v.intervalo_horas != null || v.intervalo_dias != null, {
    message: "Informe o intervalo em horas ou em dias (ck_intervalo).",
  });

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  item: z.string().min(1).optional(),
  intervalo_horas: z.number().int().positive().nullable().optional(),
  intervalo_dias: z.number().int().positive().nullable().optional(),
  peca_referencia: z.string().nullable().optional(),
  custo_estimado_centavos: z.string().regex(/^\d+$/).nullable().optional(),
  observacao: z.string().nullable().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "plano_manutencao",
  esquemaCriacao,
  esquemaAtualizacao,
});
