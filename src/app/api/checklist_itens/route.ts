import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  descricao: z.string().min(1),
  categoria: z.string().min(1),
  recorrencia_dias: z.number().int().min(1),
  proxima_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  ativo: z.boolean().default(true),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  descricao: z.string().min(1).optional(),
  categoria: z.string().min(1).optional(),
  recorrencia_dias: z.number().int().min(1).optional(),
  ultima_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  proxima_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ativo: z.boolean().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "checklist_itens",
  esquemaCriacao,
  esquemaAtualizacao,
  comPropriedadeId: true,
});
