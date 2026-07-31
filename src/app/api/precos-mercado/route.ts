import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

// docs/03-modulos.md M6: "Entrada de preço por registro manual do admin...
// Sempre com fonte e data_referencia gravados: o sistema nunca exibe preço
// sem dizer de onde veio e de quando é." Sem PATCH de propósito — preço de
// mercado é um retrato do dia; corrigir é lançar uma entrada nova com fonte
// e data certas, não editar a antiga (mesmo espírito da regra 6: fato
// registrado não se apaga nem se reescreve por baixo).
const esquemaCriacao = z.object({
  tipo: z.enum(["arroba_boi", "arroba_vaca", "bezerro", "bezerra", "garrote", "novilha", "leite_litro"]),
  valor_centavos: z.string().regex(/^\d+$/, "Valor deve ser um número inteiro de centavos"),
  unidade: z.string().min(1).default("@"),
  praca: z.string().min(1).default("Imperatriz-MA"),
  fonte: z.string().min(1, "Informe de onde veio o preço (ex.: feira, corretor, jornal do campo)."),
  data_referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({ id: z.string().uuid() });

export const { POST } = criarRotaEntidade({
  tabela: "precos_mercado",
  esquemaCriacao,
  esquemaAtualizacao,
  comRegistradoPor: true,
});
