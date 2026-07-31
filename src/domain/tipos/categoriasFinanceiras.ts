// docs/03-modulos.md M5 — categorias fixas do financeiro; subcategoria é
// livre. Vocabulário de domínio (como categoria_animal), não limiar
// numérico — não é o tipo de "número mágico" que a Regra 3 do CLAUDE.md
// manda parametrizar.
export const CATEGORIAS_FINANCEIRAS = [
  "Alimentação",
  "Sanidade",
  "Mão de obra",
  "Pastagem",
  "Máquinas e combustível",
  "Infraestrutura",
  "Administrativo",
  "Frete e comercialização",
  "Aquisição de animais",
  "Financeiro",
] as const;

export type CategoriaFinanceira = (typeof CATEGORIAS_FINANCEIRAS)[number];
