import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

const esquemaAtualizacao = z.object({
  chave: z.string().min(1),
  valor: z.string().min(1),
});

// Sem esquemaCriacao: parametros_fazenda só é populado pelo seed (§10), nunca
// criado pela UI — só editado.
export const { POST, PATCH } = criarRotaEntidade({
  tabela: "parametros_fazenda",
  chavePrimaria: "chave",
  esquemaAtualizacao,
});
