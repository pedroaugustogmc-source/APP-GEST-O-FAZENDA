import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  nome: z.string().min(1),
  apelidos: z.array(z.string()).default([]),
  tamanho_ha: z.number().positive(),
  capim: z.string().nullable().optional(),
  tem_acude: z.boolean().default(false),
  nivel_acude: z.number().min(0).max(100).nullable().optional(),
  observacao: z.string().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  status: z.enum(["em_uso", "descanso", "vedado", "reforma"]).optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "pastos",
  esquemaCriacao,
  esquemaAtualizacao,
  comPropriedadeId: true,
});
