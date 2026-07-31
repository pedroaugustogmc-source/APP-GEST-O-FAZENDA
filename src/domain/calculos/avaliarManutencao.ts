// Não está no Anexo B. docs/01-dominio.md §12: `manutencao_vencida` (horas
// desde a última troca > intervalo) e `manutencao_proxima` (faltam menos
// que ALERTA_MANUTENCAO_HORAS). Mesma leitura alimenta o alerta e o
// semáforo da tela /maquinas — uma função só, sem duplicar a regra.
export type StatusManutencao = "ok" | "proxima" | "vencida";

export interface ResultadoAvaliarManutencao {
  status: StatusManutencao;
  /** Horas restantes até a próxima manutenção prevista; negativo = já passou. Null se não há plano cadastrado. */
  horasRestantes: number | null;
}

export function avaliarManutencao(
  horasUsoTotal: number,
  proximaEmHoras: number | null,
  alertaAntecedenciaHoras: number
): ResultadoAvaliarManutencao {
  // Sem plano/manutenção anterior registrado — não há base pra afirmar
  // urgência nenhuma (CLAUDE.md regra 2: nada de dado inventado).
  if (proximaEmHoras === null) {
    return { status: "ok", horasRestantes: null };
  }

  const horasRestantes = proximaEmHoras - horasUsoTotal;

  if (horasRestantes <= 0) {
    return { status: "vencida", horasRestantes };
  }
  if (horasRestantes <= alertaAntecedenciaHoras) {
    return { status: "proxima", horasRestantes };
  }
  return { status: "ok", horasRestantes };
}
