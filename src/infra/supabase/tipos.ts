// Tipos de linha das tabelas usadas pela F1. Não é o schema inteiro (27
// tabelas) — só o que os cadastros desta fase leem/gravam. Quando o projeto
// Supabase estiver deployado, `supabase gen types typescript` pode gerar o
// arquivo completo; até lá, mantemos este subconjunto fiel ao DDL de
// docs/02-dados.md + supabase/migrations/20260730120000_schema_inicial.sql.

export type StatusPastoDB = "em_uso" | "descanso" | "vedado" | "reforma";
export type StatusLoteDB = "rascunho" | "ativo" | "vendido" | "encerrado";
export type StatusAnimalDB = "ativo" | "vendido" | "morto" | "descartado";
export type SexoAnimalDB = "M" | "F";
export type CategoriaAnimalDB =
  | "bezerro"
  | "bezerra"
  | "garrote"
  | "novilha"
  | "vaca"
  | "touro"
  | "boi";
export type TipoOperacaoDB = "cria" | "recria" | "engorda" | "leite" | "misto";
export type TipoMaquinaDB = "trator" | "implemento" | "veiculo" | "bomba" | "gerador" | "outro";
export type PapelUsuarioDB = "admin" | "gerente" | "trabalhador";
export type StatusUsuarioDB = "ativo" | "inativo";
export type PlataformaBotDB = "telegram" | "whatsapp";

export interface PastoRow {
  id: string;
  nome: string;
  apelidos: string[];
  tamanho_ha: number;
  capim: string | null;
  capacidade_ua_ha_ref: number | null;
  tem_acude: boolean;
  nivel_acude: number | null;
  nivel_acude_em: string | null;
  status: StatusPastoDB;
  lote_atual_id: string | null;
  observacao: string | null;
  client_uuid: string | null;
  criado_em: string;
}

export interface LoteRow {
  id: string;
  nome: string;
  categoria: CategoriaAnimalDB;
  tipo_operacao: TipoOperacaoDB;
  peso_entrada: number | null;
  data_entrada: string;
  data_saida: string | null;
  area_ha: number | null;
  pasto_id: string | null;
  cabecas_atuais: number;
  status: StatusLoteDB;
  observacao: string | null;
  client_uuid: string | null;
  registrado_por: string;
  registrado_em: string;
  deletado_em: string | null;
}

export interface AnimalRow {
  id: string;
  brinco: string | null;
  lote_id: string | null;
  sexo: SexoAnimalDB;
  categoria: CategoriaAnimalDB;
  data_nascimento: string | null;
  origem: "nascimento" | "compra" | "importacao";
  peso_nascimento: number | null;
  status: StatusAnimalDB;
  data_saida: string | null;
  client_uuid: string | null;
  linha_importada: Record<string, string> | null;
  registrado_por: string;
  registrado_em: string;
  deletado_em: string | null;
}

export interface MaquinaRow {
  id: string;
  nome: string;
  tipo: TipoMaquinaDB;
  fabricante: string | null;
  modelo: string;
  ano: number | null;
  numero_serie: string | null;
  status: "ativa" | "parada" | "manutencao" | "vendida";
  observacao: string | null;
  client_uuid: string | null;
  criado_em: string;
}

export interface InsumoRow {
  id: string;
  insumo: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  minimo_alerta: number;
  validade: string | null;
  local_armazenamento: string | null;
  client_uuid: string | null;
  atualizado_em: string;
}

export interface UsuarioAcessoRow {
  id: string;
  telefone: string;
  plataforma: PlataformaBotDB;
  nome: string;
  papel: PapelUsuarioDB;
  status: StatusUsuarioDB;
  data_admissao: string | null;
  data_desligamento: string | null;
  client_uuid: string | null;
  criado_em: string;
}

export interface ParametroRow {
  chave: string;
  valor: string;
  tipo_dado: "number" | "text" | "date" | "boolean";
  unidade: string | null;
  descricao: string;
  editavel: boolean;
  atualizado_em: string;
}

export interface PropriedadeRow {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  area_total_ha: number | null;
  inscricao_estadual: string | null;
  criado_em: string;
}

export type StatusMensagemDB =
  | "recebida"
  | "transcrita"
  | "extraida"
  | "gravada"
  | "revisao"
  | "erro"
  | "descartada";

export interface MensagemBotRow {
  id: string;
  client_uuid: string;
  usuario_id: string | null;
  telefone_origem: string;
  plataforma: PlataformaBotDB;
  tipo: "audio" | "texto" | "foto" | "documento";
  duracao_segundos: number | null;
  transcricao: string | null;
  payload_extraido: Record<string, unknown> | null;
  eventos_gerados: Record<string, unknown> | null;
  confianca_media: number | null;
  status: StatusMensagemDB;
  erro: string | null;
  tentativas: number;
  custo_api_centavos: number;
  recebido_em: string;
  processado_em: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
}
