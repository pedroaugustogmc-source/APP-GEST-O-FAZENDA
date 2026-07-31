// Extensão .ts explícita — este módulo também roda na Edge Function Deno.
import type { Indicador, Kg } from "../tipos/index.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9:
// gmd_kg_dia = (peso_atual - peso_anterior) / dias_entre_pesagens
//
// Único consumidor nesta fase: src/domain/validacao/validacaoSemantica.ts,
// regra "GMD implícito absurdo" do §32. Anti-padrão nº 3 de docs/06-qualidade.md
// ("calcular GMD com uma pesagem só") não se aplica a esta função — ela sempre
// recebe duas pesagens já existentes; a decisão de "não há pesagem anterior,
// não calcule" é do chamador, antes de invocar esta função.
export function gmd(pesoAnterior: Kg, pesoAtual: Kg, dias: number): Indicador<number> {
  if (dias <= 0) {
    return {
      valor: null,
      n: 0,
      dataBase: null,
      qualidade: "sem_dado",
      motivo: "período entre pesagens inválido (dias <= 0)",
    };
  }

  const valor = (pesoAtual - pesoAnterior) / dias;

  return {
    valor,
    n: 2,
    // esta função não recebe datas — o chamador, que tem o contexto completo
    // das duas pesagens, é quem preenche dataBase se precisar exibi-la.
    dataBase: null,
    qualidade: "firme",
  };
}
