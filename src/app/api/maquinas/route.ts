import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["trator", "implemento", "veiculo", "bomba", "gerador", "outro"]),
  fabricante: z.string().nullable().optional(),
  modelo: z.string().min(1),
  ano: z.number().int().min(1950).max(2100).nullable().optional(),
  numero_serie: z.string().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  status: z.enum(["ativa", "parada", "manutencao", "vendida"]).optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "maquinas",
  esquemaCriacao,
  esquemaAtualizacao,
});
