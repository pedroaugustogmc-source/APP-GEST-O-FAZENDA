import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaCriacao = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["bezerro", "bezerra", "garrote", "novilha", "vaca", "touro", "boi"]),
  tipo_operacao: z.enum(["cria", "recria", "engorda", "leite", "misto"]),
  peso_entrada: z.number().positive().nullable().optional(),
  data_entrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  pasto_id: z.string().uuid().nullable().optional(),
  cabecas_atuais: z.number().int().min(0).default(0),
  observacao: z.string().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  status: z.enum(["rascunho", "ativo", "vendido", "encerrado"]).optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "lotes",
  esquemaCriacao,
  esquemaAtualizacao,
  comRegistradoPor: true,
  comPropriedadeId: true,
});
