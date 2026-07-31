import type { ISODate } from "@/domain/tipos";

// docs/05-arquitetura.md §34: "Agenda: Google Calendar API." Interface
// pequena, no mesmo espírito de MessagingAdapter (src/infra/messaging) — a
// lógica de priorização (src/app/api/workers/rotina-semanal) não conhece
// Google, só sabe criar/atualizar/remover um evento por id externo.
export interface EventoAgenda {
  titulo: string;
  descricao?: string;
  /** Evento de dia inteiro — casa com `tarefas.prazo`/`data`, que são `date`, não `timestamptz`. */
  data: ISODate;
}

export interface CalendarAdapter {
  /** externalId presente = atualiza o evento existente; ausente = cria um novo. Retorna o id do evento no provedor. */
  criarOuAtualizarEvento(evento: EventoAgenda, externalId?: string | null): Promise<string>;
  removerEvento(externalId: string): Promise<void>;
}
