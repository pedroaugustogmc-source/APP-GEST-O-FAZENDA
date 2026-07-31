// Conversão texto-digitado (reais) <-> centavos, sem passar por float —
// CLAUDE.md regra 4 é sobre armazenamento/domínio (bigint sempre), mas essa
// disciplina só vale de verdade se a borda de entrada (o que o admin digita
// num <input>) também nunca passa por Math.round(parseFloat(x) * 100),
// que pode arredondar errado para certos valores decimais.
export function parseReaisParaCentavos(texto: string): bigint {
  const limpo = texto.trim();
  if (!limpo) return 0n;

  const semMilhar = limpo.replace(/\./g, "").replace(",", ".");
  const negativo = semMilhar.startsWith("-");
  const semSinal = negativo ? semMilhar.slice(1) : semMilhar;
  const [parteReaisBruta, parteCentavosBruta] = semSinal.split(".");

  const parteReais = parteReaisBruta || "0";
  const parteCentavos = (parteCentavosBruta ?? "").padEnd(2, "0").slice(0, 2) || "00";

  if (!/^\d+$/.test(parteReais) || !/^\d{2}$/.test(parteCentavos)) {
    throw new Error(`Valor "${texto}" não é um número válido.`);
  }

  const total = BigInt(parteReais) * 100n + BigInt(parteCentavos);
  return negativo ? -total : total;
}

export function formatarCentavos(centavos: bigint | number | null): string {
  if (centavos === null) return "— sem dado —";
  const valor = typeof centavos === "bigint" ? Number(centavos) : centavos;
  return (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
