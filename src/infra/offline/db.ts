import Dexie, { type Table } from "dexie";

// Tabelas que os cadastros da F1 escrevem (docs/05-arquitetura.md §36).
// Cada uma tem coluna client_uuid no Postgres (ver migração) para o servidor
// dedupliciar reenvios.
export const TABELAS_SINCRONIZAVEIS = [
  "pastos",
  "lotes",
  "animais",
  "maquinas",
  "estoque_insumos",
  "usuarios_acesso",
  "parametros_fazenda",
  "propriedade",
] as const;

export type TabelaSincronizavel = (typeof TABELAS_SINCRONIZAVEIS)[number];

export interface OperacaoPendente {
  id?: number;
  clientUuid: string;
  tabela: TabelaSincronizavel;
  metodo: "POST" | "PATCH";
  payload: Record<string, unknown>;
  criadoEm: string;
  tentativas: number;
  ultimoErro?: string;
}

class BancoOffline extends Dexie {
  operacoesPendentes!: Table<OperacaoPendente, number>;

  constructor() {
    super("fazenda-offline");
    this.version(1).stores({
      operacoesPendentes: "++id, clientUuid, tabela, criadoEm",
    });
  }
}

export const bancoOffline = new BancoOffline();
