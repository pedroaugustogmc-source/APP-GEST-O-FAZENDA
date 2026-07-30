#!/usr/bin/env tsx
/**
 * Roda a fixture do Anexo A (docs/08-anexos.md) contra as funções reais de
 * src/domain/calculos/. Nesta fase (F1) nenhuma delas existe ainda — cada
 * linha aparece "não implementado", exatamente como o README avisa. Quando
 * F3/F4 implementarem as funções (Anexo B), este script passa a comparar de
 * verdade contra o gabarito, sem precisar ser reescrito.
 *
 * Import dinâmico por template literal de propósito: assim o TypeScript não
 * tenta resolver o caminho em tempo de compilação e `tsc --noEmit` não
 * quebra por causa de módulos que ainda não existem.
 */

async function importarSeExistir(nomeArquivo: string): Promise<Record<string, unknown> | null> {
  try {
    return await import(`../src/domain/calculos/${nomeArquivo}`);
  } catch {
    return null;
  }
}

function formatar(valor: number, casas = 2): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

interface ModGmd {
  gmd: (pesoAnterior: number, pesoAtual: number, dias: number) => { valor: number | null };
}
async function linhaGmd(): Promise<string> {
  const mod = await importarSeExistir("gmd");
  if (!mod) throw new Error("não implementado");
  const { gmd } = mod as unknown as ModGmd;
  const resultado = gmd(220.0, 265.0, 90);
  if (resultado.valor === null) throw new Error("retornou sem dado");
  return `${formatar(resultado.valor, 3)} kg/dia`;
}

interface ModArrobasProduzidas {
  arrobasProduzidas: (ganhoKg: number, p: Record<string, number>) => number;
}
async function linhaArrobasProduzidas(): Promise<string> {
  const mod = await importarSeExistir("arrobasProduzidas");
  if (!mod) throw new Error("não implementado");
  const { arrobasProduzidas } = mod as unknown as ModArrobasProduzidas;
  const r = arrobasProduzidas(1800, { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 });
  return `${formatar(r, 2)} @`;
}

interface ModArrobasCarcaca {
  arrobasCarcaca: (pesoVivo: number, p: Record<string, number>) => number;
}
async function linhaArrobasCarcaca(): Promise<string> {
  const mod = await importarSeExistir("arrobasCarcaca");
  if (!mod) throw new Error("não implementado");
  const { arrobasCarcaca } = mod as unknown as ModArrobasCarcaca;
  const r = arrobasCarcaca(265.0, { RENDIMENTO_CARCACA: 0.52, KG_POR_ARROBA: 15 });
  return `${formatar(r, 4)} @`;
}

interface ModCustoPorArroba {
  custoPorArroba: (custo: bigint, arrobas: number) => { valor: bigint | null };
}
async function linhaCustoPorArroba(): Promise<string> {
  const mod = await importarSeExistir("custoPorArroba");
  if (!mod) throw new Error("não implementado");
  const { custoPorArroba } = mod as unknown as ModCustoPorArroba;
  const r = custoPorArroba(547_600n, 62.4);
  if (r.valor === null) throw new Error("retornou sem dado");
  return `R$ ${formatar(Number(r.valor) / 100, 2)}/@`;
}

interface ModPontoEquilibrio {
  pontoEquilibrio: (custoAcumulado: bigint, arrobasVenda: number) => { valor: bigint | null };
}
async function linhaPontoEquilibrio(): Promise<string> {
  const mod = await importarSeExistir("pontoEquilibrio");
  if (!mod) throw new Error("não implementado");
  const { pontoEquilibrio } = mod as unknown as ModPontoEquilibrio;
  const r = pontoEquilibrio(7_947_600n, 367.4667);
  if (r.valor === null) throw new Error("retornou sem dado");
  return `R$ ${formatar(Number(r.valor) / 100, 2)}/@`;
}

interface ModUnidadesAnimais {
  unidadesAnimais: (pesoVivoTotal: number, p: Record<string, number>) => number;
}
async function linhaUnidadesAnimais(): Promise<string> {
  const mod = await importarSeExistir("unidadesAnimais");
  if (!mod) throw new Error("não implementado");
  const { unidadesAnimais } = mod as unknown as ModUnidadesAnimais;
  const r = unidadesAnimais(10_600, { UA_KG: 450 });
  return `${formatar(r, 4)} UA`;
}

interface ModLotacaoUaHa {
  lotacaoUaHa: (pesoVivoTotal: number, ha: number, p: Record<string, number>) => number;
}
async function linhaLotacaoUaHa(): Promise<string> {
  const mod = await importarSeExistir("lotacaoUaHa");
  if (!mod) throw new Error("não implementado");
  const { lotacaoUaHa } = mod as unknown as ModLotacaoUaHa;
  const r = lotacaoUaHa(10_600, 10, { UA_KG: 450 });
  return `${formatar(r, 3)} UA/ha`;
}

interface ModCustoEfetivoCotacao {
  custoEfetivoCotacao: (
    totalCentavos: bigint,
    prazoDias: number,
    descontoAvistaPct: number,
    p: Record<string, number>
  ) => bigint;
}
async function linhaCustoEfetivoCotacaoA(): Promise<string> {
  const mod = await importarSeExistir("custoEfetivoCotacao");
  if (!mod) throw new Error("não implementado");
  const { custoEfetivoCotacao } = mod as unknown as ModCustoEfetivoCotacao;
  const r = custoEfetivoCotacao(1_350_000n, 0, 7, { TAXA_OPORTUNIDADE_MES: 0.015 });
  return `R$ ${formatar(Number(r) / 100, 2)}`;
}

interface LinhaGabarito {
  indicador: string;
  esperado: string;
  obter: () => Promise<string>;
}

const LINHAS: LinhaGabarito[] = [
  { indicador: "GMD do lote", esperado: "0,500 kg/dia", obter: linhaGmd },
  { indicador: "Arrobas produzidas no período", esperado: "62,40 @", obter: linhaArrobasProduzidas },
  { indicador: "Arrobas de carcaça por animal na venda", esperado: "9,1867 @", obter: linhaArrobasCarcaca },
  { indicador: "Custo por arroba produzida", esperado: "R$ 87,76/@", obter: linhaCustoPorArroba },
  { indicador: "Ponto de equilíbrio", esperado: "R$ 216,28/@", obter: linhaPontoEquilibrio },
  { indicador: "UA no pasto (Anexo A.3)", esperado: "23,5556 UA", obter: linhaUnidadesAnimais },
  { indicador: "Lotação UA/ha (Anexo A.3)", esperado: "2,356 UA/ha", obter: linhaLotacaoUaHa },
  { indicador: "Custo efetivo — cotação A (Anexo A.4)", esperado: "R$ 12.555,00", obter: linhaCustoEfetivoCotacaoA },
];

async function main() {
  console.log("Gabarito — docs/08-anexos.md Anexo A\n");

  const larguraIndicador = Math.max(...LINHAS.map((l) => l.indicador.length), "indicador".length);
  let implementados = 0;
  let divergencias = 0;

  for (const linha of LINHAS) {
    let obtido: string;
    let bate: string;

    try {
      obtido = await linha.obter();
      implementados += 1;
      if (obtido === linha.esperado) {
        bate = "SIM";
      } else {
        bate = "NÃO — divergiu";
        divergencias += 1;
      }
    } catch {
      obtido = "não implementado";
      bate = "—";
    }

    console.log(
      `${linha.indicador.padEnd(larguraIndicador)}  esperado: ${linha.esperado.padEnd(16)}  obtido: ${obtido.padEnd(20)}  bate: ${bate}`
    );
  }

  console.log(`\n${implementados}/${LINHAS.length} indicadores implementados.`);
  if (implementados < LINHAS.length) {
    console.log(
      "Normal fora da F3/F4 — as funções de src/domain/calculos/ chegam junto com os módulos que as consomem (docs/07-entrega.md §43)."
    );
  }

  if (divergencias > 0) {
    console.log(`\n${divergencias} indicador(es) implementados divergem do Anexo A — o código está errado, não o gabarito.`);
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
