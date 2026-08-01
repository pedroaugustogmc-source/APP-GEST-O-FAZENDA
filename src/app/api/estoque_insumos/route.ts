import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  insumo: z.string().min(1),
  categoria: z.string().min(1),
  unidade: z.string().min(1),
  minimo_alerta: z.number().min(0).default(0),
  validade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD")
    .nullable()
    .optional(),
  local_armazenamento: z.string().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  minimo_alerta: z.number().min(0).optional(),
  validade: z.string().nullable().optional(),
  local_armazenamento: z.string().nullable().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "estoque_insumos",
  esquemaCriacao,
  esquemaAtualizacao,
  comPropriedadeId: true,
});
