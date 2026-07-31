import { partesDeISODate } from "@/domain/tipos/data";
import type { ISODate } from "@/domain/tipos";
import type { CalendarAdapter, EventoAgenda } from "./tipos";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CredenciaisGoogleCalendar {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

/**
 * Implementação Google Calendar do CalendarAdapter — só `fetch` contra a
 * API REST v3 + troca de refresh token por access token via OAuth2, sem
 * SDK `googleapis` (mesma filosofia "uma dependência a menos" de
 * infra/messaging/telegram.ts). O access token é obtido uma vez por
 * instância do adapter e reaproveitado entre chamadas — o worker semanal
 * sincroniza até `LIMITE_TAREFAS_CALENDAR` eventos numa única execução.
 */
export function criarAdapterGoogleCalendar(credenciais: CredenciaisGoogleCalendar): CalendarAdapter {
  let tokenPromise: Promise<string> | null = null;

  async function obterAccessToken(): Promise<string> {
    if (!tokenPromise) {
      tokenPromise = trocarRefreshTokenPorAccessToken(credenciais).catch((erro) => {
        tokenPromise = null; // permite nova tentativa numa próxima chamada
        throw erro;
      });
    }
    return tokenPromise;
  }

  return {
    async criarOuAtualizarEvento(evento: EventoAgenda, externalId?: string | null): Promise<string> {
      const token = await obterAccessToken();
      const corpo = paraEventoGoogle(evento);

      const url = externalId
        ? `${CALENDAR_API}/calendars/${encodeURIComponent(credenciais.calendarId)}/events/${encodeURIComponent(externalId)}`
        : `${CALENDAR_API}/calendars/${encodeURIComponent(credenciais.calendarId)}/events`;

      const resposta = await fetch(url, {
        method: externalId ? "PATCH" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });

      if (!resposta.ok) {
        throw new Error(`Google Calendar (${externalId ? "atualizar" : "criar"} evento) falhou: HTTP ${resposta.status} — ${await resposta.text()}`);
      }

      const dados = (await resposta.json()) as { id: string };
      return dados.id;
    },

    async removerEvento(externalId: string): Promise<void> {
      const token = await obterAccessToken();
      const url = `${CALENDAR_API}/calendars/${encodeURIComponent(credenciais.calendarId)}/events/${encodeURIComponent(externalId)}`;

      const resposta = await fetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });

      // 410 Gone = já removido antes (idempotente); 404 tratado como sucesso pelo mesmo motivo.
      if (!resposta.ok && resposta.status !== 410 && resposta.status !== 404) {
        throw new Error(`Google Calendar (remover evento) falhou: HTTP ${resposta.status} — ${await resposta.text()}`);
      }
    },
  };
}

/**
 * Lê as 4 env vars do Google Calendar e monta as credenciais, ou retorna
 * null se alguma faltar — chamado tanto pelo worker semanal quanto pela
 * rota de concluir tarefa, pra não duplicar essa checagem em 2 lugares.
 * Só este helper (não o adapter em si) lê `process.env`, mantendo
 * criarAdapterGoogleCalendar portável (mesma disciplina de infra/messaging).
 */
export function credenciaisGoogleCalendarDoAmbiente(): CredenciaisGoogleCalendar | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!clientId || !clientSecret || !refreshToken || !calendarId) return null;
  return { clientId, clientSecret, refreshToken, calendarId };
}

async function trocarRefreshTokenPorAccessToken(credenciais: CredenciaisGoogleCalendar): Promise<string> {
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      refresh_token: credenciais.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Renovação do token do Google Calendar falhou: HTTP ${resposta.status} — ${await resposta.text()}`);
  }

  const dados = (await resposta.json()) as { access_token?: string };
  if (!dados.access_token) throw new Error("Google Calendar não devolveu access_token na renovação.");
  return dados.access_token;
}

// Evento de dia inteiro: `end.date` é EXCLUSIVO na API do Google (dia
// seguinte ao `start.date`), mesmo pra um evento de 1 dia só.
function paraEventoGoogle(evento: EventoAgenda): Record<string, unknown> {
  return {
    summary: evento.titulo,
    description: evento.descricao,
    start: { date: evento.data },
    end: { date: somarUmDia(evento.data) },
  };
}

function somarUmDia(data: ISODate): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + 1));
  const ano = resultado.getUTCFullYear();
  const mes = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(resultado.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
