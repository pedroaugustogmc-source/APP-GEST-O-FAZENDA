// Não está no Anexo B — fórmula do §9: cabecas_medias_periodo = (cabecas_inicio + cabecas_fim) / 2.
// Único consumidor: taxaMortalidade — não precisa de Indicador<T> porque
// sempre é computável a partir de dois inteiros já conhecidos.
export function cabecasMediasPeriodo(cabecasInicio: number, cabecasFim: number): number {
  return (cabecasInicio + cabecasFim) / 2;
}
