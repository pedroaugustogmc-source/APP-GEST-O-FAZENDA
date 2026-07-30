export class ErroTransicaoInvalida extends Error {
  constructor(entidade: string, atual: string, alvo: string) {
    super(`Transição inválida para ${entidade}: "${atual}" → "${alvo}"`);
    this.name = "ErroTransicaoInvalida";
  }
}
