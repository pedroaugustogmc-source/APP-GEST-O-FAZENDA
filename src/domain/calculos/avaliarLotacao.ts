import type { Kg, Parametros } from "../tipos/index.ts";
import { lotacaoUaHa } from "./lotacaoUaHa.ts";

// docs/08-anexos.md Anexo B — assinatura fixa. docs/01-dominio.md §9/§12
// (alerta "superlotacao") e Anexo A.3 (fixture conferida à mão).
export function avaliarLotacao(
  pesoVivoTotal: Kg,
  ha: number,
  capim: string,
  pesoMedio: Kg,
  p: Parametros
): { lotacao: number; limite: number; excede: boolean; cabecasAMover: number } {
  const lotacao = lotacaoUaHa(pesoVivoTotal, ha, p);
  const capacidadeRef = capacidadeSuporteReferencia(capim, p);
  const limite = capacidadeRef * (1 + p.TOLERANCIA_LOTACAO);
  const excede = lotacao > limite;

  if (!excede || pesoMedio <= 0) {
    return { lotacao, limite, excede, cabecasAMover: 0 };
  }

  const pesoVivoSuportado = capacidadeRef * ha * p.UA_KG;
  const excesso = pesoVivoTotal - pesoVivoSuportado;
  // docs/08-anexos.md Anexo A.3: arredonda para CIMA — subdimensionar a
  // retirada mantém o pasto em risco.
  const cabecasAMover = Math.ceil(excesso / pesoMedio);

  return { lotacao, limite, excede, cabecasAMover };
}

// docs/01-dominio.md §10: CAP_UA_HA_MARANDU / _MOMBACA / _MASSAI / _DEFAULT.
// "usado quando o capim não está cadastrado" — mesma regra para nome de
// capim desconhecido/vazio, sem inventar capacidade.
function capacidadeSuporteReferencia(capim: string, p: Parametros): number {
  const chave = `CAP_UA_HA_${normalizarNomeCapim(capim)}`;
  const capacidade = p[chave] ?? p.CAP_UA_HA_DEFAULT;
  if (capacidade === undefined) {
    // Não inventa capacidade (CLAUDE.md regra 2) — se chegou aqui, o seed de
    // parametros_fazenda está incompleto, é erro de configuração, não de dado.
    throw new Error("CAP_UA_HA_DEFAULT não está cadastrado em parametros_fazenda.");
  }
  return capacidade;
}

// Evita regex com marca de combinação Unicode literal na fonte (frágil de
// ler/editar) — filtra por faixa de code point (U+0300–U+036F) explícita.
function normalizarNomeCapim(capim: string): string {
  const semAcentos = Array.from(capim.normalize("NFD"))
    .filter((caractere) => {
      const codigo = caractere.codePointAt(0) ?? 0;
      return codigo < 0x0300 || codigo > 0x036f;
    })
    .join("");
  return semAcentos.toUpperCase().trim();
}
