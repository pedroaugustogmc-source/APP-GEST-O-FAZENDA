// docs/02-dados.md §13.3, constraint ck_categoria_sexo — a mesma regra que o
// banco garante por CHECK, disponível como função pura para validar antes de
// gravar (formulário, importador) e devolver uma mensagem em vez de um erro
// de SQL cru.

export type SexoAnimal = "M" | "F";
export type CategoriaAnimal =
  | "bezerro"
  | "bezerra"
  | "garrote"
  | "novilha"
  | "vaca"
  | "touro"
  | "boi";

const CATEGORIAS_POR_SEXO: Record<SexoAnimal, CategoriaAnimal[]> = {
  F: ["bezerra", "novilha", "vaca"],
  M: ["bezerro", "garrote", "touro", "boi"],
};

export function categoriasValidasParaSexo(sexo: SexoAnimal): CategoriaAnimal[] {
  return CATEGORIAS_POR_SEXO[sexo];
}

export function sexoCategoriaCompativeis(sexo: SexoAnimal, categoria: CategoriaAnimal): boolean {
  return CATEGORIAS_POR_SEXO[sexo].includes(categoria);
}
