// docs/04-bot.md §32 — "barreira antes de gravar". Cada função aqui é uma
// linha da tabela do §32, pura (recebe os dados já buscados pelo chamador,
// nunca faz I/O). O pipeline do bot (supabase/functions/bot-webhook) chama a
// que for relevante para cada tipo de evento antes de gravar.
//
// docs/08-anexos.md Anexo C, "Regras do copy": uma pergunta por vez, nunca
// duas frases quando uma resolve, nunca termo técnico, nunca culpar o
// usuário. Os textos abaixo, quando citados literalmente na Anexo C, são
// reproduzidos exatamente — não parafraseados.
// Extensões .ts explícitas — este módulo também roda na Edge Function Deno.
import type { Centavos, ISODate, Indicador } from "../tipos/index.ts";
import { partesDeISODate } from "../tipos/data.ts";
import type { CategoriaAnimal } from "./categoriaSexo.ts";
import { podeReceberEventoEm, type StatusAnimal } from "../estados/animal.ts";
import { aceitaEntradaDeLote, type StatusPasto } from "../estados/pasto.ts";
import { elegiveisParaVacina, type AnimalParaVacina, type RegraVacinal } from "../calculos/elegiveisParaVacina.ts";

export type ResultadoValidacao =
  | { acao: "gravar" }
  | { acao: "revisao"; motivo: string }
  | { acao: "recusar"; pergunta: string; alertarAdmin?: boolean };

const GRAVAR: ResultadoValidacao = { acao: "gravar" };

// ── 1. Peso fora da faixa plausível para a categoria ────────────────────────
export function validarPesoPlausivel(
  peso: number,
  categoria: CategoriaAnimal,
  limites: { min: number; max: number }
): ResultadoValidacao {
  if (peso < limites.min || peso > limites.max) {
    return { acao: "recusar", pergunta: `${peso} kg num ${categoria} tá fora do normal. Confere pra mim?` };
  }
  return GRAVAR;
}

// ── 2. Data do fato no futuro ────────────────────────────────────────────────
export function validarDataNaoFutura(dataDoFato: ISODate, hoje: ISODate): ResultadoValidacao {
  if (dataDoFato > hoje) {
    return { acao: "recusar", pergunta: "Essa data ainda não chegou. Pode confirmar quando foi mesmo?" };
  }
  return GRAVAR;
}

// ── 3. Data do fato anterior à entrada do lote / nascimento do animal ──────
export function validarDataPosteriorAReferencia(
  dataDoFato: ISODate,
  dataReferencia: ISODate | null
): ResultadoValidacao {
  // Sem data de referência cadastrada, não há o que comparar — não inventa
  // um bloqueio sobre um dado que não existe (CLAUDE.md regra 2).
  if (!dataReferencia) return GRAVAR;
  if (dataDoFato < dataReferencia) {
    return {
      acao: "recusar",
      pergunta: "Essa data é de antes de o lote entrar ou do animal nascer. Pode confirmar a data certa?",
    };
  }
  return GRAVAR;
}

// ── 4. Lote/pasto/máquina/insumo inexistente ────────────────────────────────
export function validarEntidadeReferenciada(
  existe: boolean,
  candidatosProximos: string[]
): ResultadoValidacao {
  if (existe) return GRAVAR;
  if (candidatosProximos.length > 0) {
    return { acao: "recusar", pergunta: `Não achei esse nome. Você quis dizer ${candidatosProximos.join(" ou ")}?` };
  }
  return { acao: "recusar", pergunta: "Não achei esse nome cadastrado. Pode confirmar?" };
}

// ── 5. Animal morto/vendido recebendo evento posterior à saída ─────────────
export function validarAnimalPodeReceberEvento(
  status: StatusAnimal,
  dataSaida: ISODate | null,
  dataEvento: ISODate
): ResultadoValidacao {
  if (podeReceberEventoEm(status, dataSaida, dataEvento)) return GRAVAR;
  return {
    acao: "recusar",
    // Anexo C, texto literal.
    pergunta: "Esse animal já foi dado como vendido. Quer que eu registre assim mesmo pro patrão conferir?",
    alertarAdmin: true,
  };
}

// ── 6. Movimentação para pasto em reforma ───────────────────────────────────
export function validarPastoAceitaEntrada(
  status: StatusPasto,
  sugestaoAlternativa: string | null
): ResultadoValidacao {
  if (aceitaEntradaDeLote(status)) return GRAVAR;
  const sugestao = sugestaoAlternativa ? ` Que tal o pasto ${sugestaoAlternativa}?` : "";
  return { acao: "recusar", pergunta: `Esse pasto está em reforma, não recebe lote agora.${sugestao}` };
}

// ── 7. GMD implícito absurdo (> limite ou negativo forte) ───────────────────
// docs/04-bot.md §32 fala em "> 2,5 kg/dia ou negativo forte" sem quantificar
// o negativo — trato como o mesmo limite em módulo, para os dois lados,
// em vez de inventar um segundo número não documentado.
export function validarGmdPlausivel(
  resultadoGmd: Indicador<number>,
  limiteMaxKgDia: number
): ResultadoValidacao {
  if (resultadoGmd.valor === null) return GRAVAR;
  if (Math.abs(resultadoGmd.valor) > limiteMaxKgDia) {
    return { acao: "revisao", motivo: `GMD implícito de ${resultadoGmd.valor.toFixed(3)} kg/dia é implausível` };
  }
  return GRAVAR;
}

// ── 8. Cabeças maior que o efetivo do lote ──────────────────────────────────
export function validarCabecasNaoExcedeLote(
  cabecasInformadas: number,
  cabecasAtuaisLote: number
): ResultadoValidacao {
  if (cabecasInformadas > cabecasAtuaisLote) {
    return {
      acao: "recusar",
      pergunta: `O lote tem ${cabecasAtuaisLote} cabeças, você falou ${cabecasInformadas}. Confere esse número?`,
    };
  }
  return GRAVAR;
}

// ── 9 e 10. Vacina bloqueada / fora da janela etária ────────────────────────
// elegiveisParaVacina já resolve as duas linhas do §32 numa passada: bloqueio
// (motivo = aviso legal do Anexo B/vacinas_catalogo.motivo_bloqueio) tem
// prioridade sobre janela etária dentro da própria função.
export function validarElegibilidadeVacina(
  animal: AnimalParaVacina,
  regra: RegraVacinal,
  hoje: ISODate
): ResultadoValidacao {
  const resultado = elegiveisParaVacina([animal], regra, hoje);
  const bloqueio = resultado.bloqueados[0];
  if (!bloqueio) return GRAVAR;
  return { acao: "recusar", pergunta: capitalizar(bloqueio.motivo) };
}

// ── 11. Vacina incompatível no mesmo dia ────────────────────────────────────
export function validarIntervaloVacinal(
  vacinaNome: string,
  incompativelCom: string[],
  intervaloMinimoDias: number | null,
  aplicacoesRecentes: Array<{ vacina: string; data: ISODate }>,
  dataEvento: ISODate
): ResultadoValidacao {
  if (intervaloMinimoDias === null) return GRAVAR;

  for (const aplicacao of aplicacoesRecentes) {
    if (!incompativelCom.includes(aplicacao.vacina)) continue;

    const diasEntre = Math.abs(diferencaDias(aplicacao.data, dataEvento));
    if (diasEntre < intervaloMinimoDias) {
      const dataSugerida = somarDias(aplicacao.data, intervaloMinimoDias);
      return {
        acao: "recusar",
        pergunta: `${vacinaNome} no mesmo período de ${aplicacao.vacina} não pode. O certo é lá pro dia ${formatarDataBR(dataSugerida)}.`,
      };
    }
  }

  return GRAVAR;
}

// ── 12. Valor financeiro com ordem de grandeza atípica ──────────────────────
export function validarValorFinanceiroPlausivel(
  valorCentavos: Centavos,
  medianaHistoricaCentavos: Centavos | null,
  fatorAtipico: number
): ResultadoValidacao {
  // Sem histórico ainda, não há base de comparação — não bloqueia por falta
  // de dado (CLAUDE.md regra 2).
  if (medianaHistoricaCentavos === null || medianaHistoricaCentavos <= 0n) return GRAVAR;

  const limite = medianaHistoricaCentavos * BigInt(Math.round(fatorAtipico));
  if (valorCentavos > limite) {
    return {
      acao: "revisao",
      motivo: `Valor ${valorCentavos} centavos é mais de ${fatorAtipico}× a mediana histórica (${medianaHistoricaCentavos} centavos)`,
    };
  }
  return GRAVAR;
}

// ── utilitários internos (não são funções de domain/calculos — não têm
// assinatura fixa no Anexo B, são só apoio de formatação/data para este arquivo) ──

function diferencaDias(a: ISODate, b: ISODate): number {
  const partesA = partesDeISODate(a);
  const partesB = partesDeISODate(b);
  const msA = Date.UTC(partesA.ano, partesA.mes - 1, partesA.dia);
  const msB = Date.UTC(partesB.ano, partesB.mes - 1, partesB.dia);
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

function somarDias(data: ISODate, dias: number): ISODate {
  const partes = partesDeISODate(data);
  const resultado = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia + dias));
  const anoR = resultado.getUTCFullYear();
  const mesR = String(resultado.getUTCMonth() + 1).padStart(2, "0");
  const diaR = String(resultado.getUTCDate()).padStart(2, "0");
  return `${anoR}-${mesR}-${diaR}`;
}

function formatarDataBR(data: ISODate): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
