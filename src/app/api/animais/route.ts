import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  brinco: z.string().nullable().optional(),
  sexo: z.enum(["M", "F"]),
  categoria: z.enum(["bezerro", "bezerra", "garrote", "novilha", "vaca", "touro", "boi"]),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD")
    .nullable()
    .optional(),
  origem: z.enum(["nascimento", "compra", "importacao"]).default("nascimento"),
  peso_nascimento: z.number().positive().nullable().optional(),
  lote_id: z.string().uuid().nullable().optional(),
  linha_importada: z.record(z.string()).nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  status: z.enum(["ativo", "vendido", "morto", "descartado"]).optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "animais",
  esquemaCriacao,
  esquemaAtualizacao,
  comRegistradoPor: true,
});
