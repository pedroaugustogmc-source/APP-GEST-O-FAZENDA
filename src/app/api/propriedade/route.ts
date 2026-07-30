import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  nome: z.string().min(1),
  municipio: z.string().min(1).default("Imperatriz"),
  area_total_ha: z.number().positive().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1).optional(),
  municipio: z.string().min(1).optional(),
  area_total_ha: z.number().positive().nullable().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "propriedade",
  esquemaCriacao,
  esquemaAtualizacao,
});
