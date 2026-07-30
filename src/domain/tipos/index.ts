// Tipos-base do domínio (Anexo B de docs/08-anexos.md). Assinatura fixa —
// não altere os nomes ou o formato aqui; funções de calculo/* dependem disto.

export type Centavos = bigint;
export type Kg = number; // uma casa decimal
export type Arrobas = number; // quatro casas internas, duas na exibição
export type ISODate = string; // 'YYYY-MM-DD'

export interface Parametros {
  UA_KG: number;
  KG_POR_ARROBA: number;
  RENDIMENTO_CARCACA: number;
  TOLERANCIA_LOTACAO: number;
  TAXA_OPORTUNIDADE_MES: number;
  DIAS_DADO_VELHO: number;
  CONFIANCA_MINIMA_BOT: number;
  GMD_META_RECRIA: number;
  NIVEL_ACUDE_CRITICO: number;
  DIAS_DESCANSO_MINIMO: number;
  [k: string]: number;
}

/** Resultado que carrega a própria confiabilidade. Nenhum indicador trafega "pelado". */
export interface Indicador<T> {
  valor: T | null;
  n: number; // tamanho da amostra
  dataBase: ISODate | null; // data do dado mais recente que o sustenta
  qualidade: "firme" | "estimativa_fraca" | "sem_dado";
  motivo?: string; // por que é fraca / por que não há dado
}
