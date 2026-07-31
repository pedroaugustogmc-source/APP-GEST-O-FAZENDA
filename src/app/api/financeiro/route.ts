import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

// valor_centavos chega como string (não number, não bigint — JSON não
// serializa bigint) já convertida na borda do cliente a partir do valor em
// reais digitado; o Postgres faz o cast de texto pra bigint no insert.
// CLAUDE.md regra 4: dinheiro é bigint em centavos, nunca float — é por isso
// que a conversão reais->centavos acontece no formulário via parsing de
// string, não via `Math.round(parseFloat(x) * 100)`.
const esquemaCriacao = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  tipo: z.enum(["custo", "receita"]),
  categoria: z.string().min(1),
  subcategoria: z.string().nullable().optional(),
  descricao: z.string().nullable().optional(),
  valor_centavos: z.string().regex(/^\d+$/, "Valor deve ser um número inteiro de centavos"),
  lote_id: z.string().uuid().nullable().optional(),
  centro_custo: z.enum(["cria", "recria", "leite", "estrutura", "administrativo"]),
  fornecedor: z.string().nullable().optional(),
  forma_pagamento: z.string().nullable().optional(),
  prazo_dias: z.number().int().min(0).default(0),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pago: z.boolean().default(true),
  nota_fiscal: z.string().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  pago: z.boolean().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "financeiro",
  esquemaCriacao,
  esquemaAtualizacao,
  comRegistradoPor: true,
});
