import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  nome: z.string().min(1),
  telefone: z.string().min(8),
  plataforma: z.enum(["telegram", "whatsapp"]),
  papel: z.enum(["admin", "gerente", "trabalhador"]).default("trabalhador"),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
  data_admissao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD")
    .nullable()
    .optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  status: z.enum(["ativo", "inativo"]).optional(),
  data_desligamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD")
    .nullable()
    .optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "usuarios_acesso",
  esquemaCriacao,
  esquemaAtualizacao,
});
