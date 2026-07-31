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
export type TipoFinanceiroDB = "custo" | "receita";
export type CentroCustoDB = "cria" | "recria" | "leite" | "estrutura" | "administrativo";
export type TipoPrecoMercadoDB =
  | "arroba_boi"
  | "arroba_vaca"
  | "bezerro"
  | "bezerra"
  | "garrote"
  | "novilha"
  | "leite_litro";

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
  propriedade_id: string;
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
  propriedade_id: string;
}

export interface AnimalRow {
  id: string;
  brinco: string | null;
  lote_id: string | null;
  sexo: SexoAnimalDB;
  categoria: CategoriaAnimalDB;
  data_nascimento: string | null;
  matriz_id: string | null;
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
  horas_uso_total: number;
  horimetro_ultima_leitura: number | null;
  horimetro_lido_em: string | null;
  status: "ativa" | "parada" | "manutencao" | "vendida";
  ficha_cuidados: Record<string, string> | null;
  observacao: string | null;
  client_uuid: string | null;
  criado_em: string;
  propriedade_id: string;
}

export interface PlanoManutencaoRow {
  id: string;
  maquina_id: string;
  item: string;
  intervalo_horas: number | null;
  intervalo_dias: number | null;
  peca_referencia: string | null;
  custo_estimado_centavos: number | null;
  observacao: string | null;
  client_uuid: string | null;
}

export interface ManutencaoRow {
  id: string;
  maquina_id: string;
  plano_id: string | null;
  data: string;
  tipo: string;
  preventiva: boolean;
  horas_no_momento: number | null;
  peca_trocada: string | null;
  custo_centavos: number | null;
  executado_por: string | null;
  proxima_em_horas: number | null;
  mensagem_id: string | null;
  client_uuid: string | null;
  registrado_por: string;
  registrado_em: string;
}

export interface HoraMaquinaRow {
  id: string;
  maquina_id: string;
  data: string;
  horas: number;
  atividade: string | null;
  operador: string | null;
  mensagem_id: string | null;
  registrado_por: string;
  registrado_em: string;
}

export interface CotacaoRow {
  id: string;
  insumo: string;
  fornecedor: string;
  quantidade: number | null;
  unidade: string | null;
  preco_centavos: number;
  prazo_dias: number;
  desconto_avista_pct: number;
  frete_centavos: number;
  custo_efetivo_centavos: number | null;
  data: string;
  vencedora: boolean;
  registrado_por: string;
  registrado_em: string;
}

export type StatusTarefaDB = "pendente" | "em_andamento" | "concluida" | "cancelada";
export type OrigemTarefaDB = "auto" | "manual" | "bot";

export interface TarefaRow {
  id: string;
  data: string;
  prazo: string | null;
  tipo: string;
  descricao: string;
  origem: OrigemTarefaDB;
  prioridade: number | null;
  score_prioridade: number | null;
  justificativa: string | null;
  impacto_estimado: number | null;
  custo_estimado_centavos: number | null;
  responsavel_id: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  status: StatusTarefaDB;
  concluida_em: string | null;
  calendar_event_id: string | null;
  registrado_por: string | null;
  registrado_em: string;
}

export interface ChecklistItemRow {
  id: string;
  descricao: string;
  categoria: string;
  recorrencia_dias: number;
  ultima_execucao: string | null;
  proxima_execucao: string;
  ativo: boolean;
  client_uuid: string | null;
  criado_em: string;
}

export type TipoRelatorioDB = "semanal" | "trimestral" | "sob_demanda" | "geral";

export interface RelatorioRow {
  id: string;
  tipo: TipoRelatorioDB;
  periodo_inicio: string;
  periodo_fim: string;
  conteudo_md: string;
  indicadores: Record<string, unknown> | null;
  gerado_em: string;
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
  propriedade_id: string;
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

export interface FinanceiroRow {
  id: string;
  data: string;
  tipo: TipoFinanceiroDB;
  categoria: string;
  subcategoria: string | null;
  descricao: string | null;
  valor_centavos: number;
  lote_id: string | null;
  centro_custo: CentroCustoDB;
  maquina_id: string | null;
  /** Fornecedor quando tipo=custo; comprador quando tipo=receita (Anexo H). */
  fornecedor: string | null;
  forma_pagamento: string | null;
  prazo_dias: number;
  vencimento: string | null;
  pago: boolean;
  nota_fiscal: string | null;
  /** Anexo H — nota fiscal de produtor. */
  quantidade: number | null;
  unidade: string | null;
  mensagem_id: string | null;
  client_uuid: string | null;
  registrado_por: string;
  registrado_em: string;
  deletado_em: string | null;
  estorna_id: string | null;
  propriedade_id: string;
}

export interface PrecoMercadoRow {
  id: string;
  tipo: TipoPrecoMercadoDB;
  valor_centavos: number;
  unidade: string;
  praca: string;
  fonte: string;
  data_referencia: string;
  registrado_por: string | null;
  registrado_em: string;
  client_uuid: string | null;
}
