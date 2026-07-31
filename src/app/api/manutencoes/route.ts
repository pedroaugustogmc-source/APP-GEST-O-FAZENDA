import { z } from "zod";
import { criarRotaEntidade } from "@/infra/supabase/criarRotaEntidade";

// docs/03-modulos.md M7 — registro administrativo de manutenção,
// complementar ao bot (que já grava o evento "manutencao" desde a F2, mas
// sem `proxima_em_horas`: o vaqueiro não sabe de cabeça o intervalo do
// fabricante). É esta tela que alimenta avaliarManutencao/o alerta
// manutencao_vencida/manutencao_proxima com um valor de verdade.
const esquemaCriacao = z.object({
  maquina_id: z.string().uuid(),
  plano_id: z.string().uuid().nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em AAAA-MM-DD"),
  tipo: z.string().min(1),
  preventiva: z.boolean().default(true),
  horas_no_momento: z.number().nonnegative().nullable().optional(),
  peca_trocada: z.string().nullable().optional(),
  custo_centavos: z.string().regex(/^\d+$/, "Valor deve ser um número inteiro de centavos").nullable().optional(),
  executado_por: z.string().nullable().optional(),
  proxima_em_horas: z.number().nonnegative().nullable().optional(),
  client_uuid: z.string().min(1),
});

const esquemaAtualizacao = z.object({
  id: z.string().uuid(),
  proxima_em_horas: z.number().nonnegative().nullable().optional(),
});

export const { POST, PATCH } = criarRotaEntidade({
  tabela: "manutencoes",
  esquemaCriacao,
  esquemaAtualizacao,
  comRegistradoPor: true,
});
