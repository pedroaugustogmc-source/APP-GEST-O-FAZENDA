import { describe, it, expect } from "vitest";
import {
  validarPesoPlausivel,
  validarDataNaoFutura,
  validarDataPosteriorAReferencia,
  validarEntidadeReferenciada,
  validarAnimalPodeReceberEvento,
  validarPastoAceitaEntrada,
  validarGmdPlausivel,
  validarCabecasNaoExcedeLote,
  validarElegibilidadeVacina,
  validarIntervaloVacinal,
  validarValorFinanceiroPlausivel,
} from "./validacaoSemantica";
import type { AnimalParaVacina, RegraVacinal } from "../calculos/elegiveisParaVacina";

describe("validarPesoPlausivel", () => {
  it("caso positivo: peso dentro da faixa grava", () => {
    expect(validarPesoPlausivel(220, "bezerro", { min: 20, max: 300 }).acao).toBe("gravar");
  });

  it("caso negativo: peso acima do máximo recusa e pergunta", () => {
    const resultado = validarPesoPlausivel(400, "bezerro", { min: 20, max: 300 });
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/fora do normal/);
  });
});

describe("validarDataNaoFutura", () => {
  it("caso positivo: data de hoje ou passada grava", () => {
    expect(validarDataNaoFutura("2026-07-31", "2026-07-31").acao).toBe("gravar");
  });

  it("caso negativo: data no futuro recusa", () => {
    expect(validarDataNaoFutura("2026-08-01", "2026-07-31").acao).toBe("recusar");
  });
});

describe("validarDataPosteriorAReferencia", () => {
  it("caso positivo: data do fato após a referência grava", () => {
    expect(validarDataPosteriorAReferencia("2026-05-01", "2026-02-01").acao).toBe("gravar");
  });

  it("caso positivo: sem data de referência cadastrada, não bloqueia por dado ausente", () => {
    expect(validarDataPosteriorAReferencia("2026-05-01", null).acao).toBe("gravar");
  });

  it("caso negativo: data do fato anterior à referência recusa", () => {
    expect(validarDataPosteriorAReferencia("2026-01-01", "2026-02-01").acao).toBe("recusar");
  });
});

describe("validarEntidadeReferenciada", () => {
  it("caso positivo: entidade existe grava", () => {
    expect(validarEntidadeReferenciada(true, []).acao).toBe("gravar");
  });

  it("caso negativo: entidade não existe recusa e sugere candidatos próximos", () => {
    const resultado = validarEntidadeReferenciada(false, ["Buriti", "Buritizinho"]);
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/Buriti/);
  });
});

describe("validarAnimalPodeReceberEvento", () => {
  it("caso positivo: animal ativo recebe evento", () => {
    expect(validarAnimalPodeReceberEvento("ativo", null, "2026-07-31").acao).toBe("gravar");
  });

  it("caso negativo: animal vendido recebendo evento posterior à saída recusa e alerta admin", () => {
    const resultado = validarAnimalPodeReceberEvento("vendido", "2026-01-01", "2026-02-01");
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") {
      expect(resultado.alertarAdmin).toBe(true);
      expect(resultado.pergunta).toMatch(/vendido/);
    }
  });
});

describe("validarPastoAceitaEntrada", () => {
  it("caso positivo: pasto em descanso aceita entrada", () => {
    expect(validarPastoAceitaEntrada("descanso", null).acao).toBe("gravar");
  });

  it("caso negativo: pasto em reforma recusa e sugere alternativa", () => {
    const resultado = validarPastoAceitaEntrada("reforma", "Baixão");
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/Baixão/);
  });
});

describe("validarGmdPlausivel", () => {
  it("caso positivo: GMD dentro do limite grava", () => {
    const indicador = { valor: 0.5, n: 2, dataBase: null, qualidade: "firme" as const };
    expect(validarGmdPlausivel(indicador, 2.5).acao).toBe("gravar");
  });

  it("caso positivo: sem dado de GMD (valor null) grava — não há o que avaliar", () => {
    const indicador = { valor: null, n: 0, dataBase: null, qualidade: "sem_dado" as const };
    expect(validarGmdPlausivel(indicador, 2.5).acao).toBe("gravar");
  });

  it("caso negativo: GMD acima do limite positivo vai para revisão", () => {
    const indicador = { valor: 3.0, n: 2, dataBase: null, qualidade: "firme" as const };
    expect(validarGmdPlausivel(indicador, 2.5).acao).toBe("revisao");
  });

  it("caso negativo: GMD negativo forte (perda implausível) vai para revisão", () => {
    const indicador = { valor: -3.0, n: 2, dataBase: null, qualidade: "firme" as const };
    expect(validarGmdPlausivel(indicador, 2.5).acao).toBe("revisao");
  });
});

describe("validarCabecasNaoExcedeLote", () => {
  it("caso positivo: cabeças dentro do efetivo grava", () => {
    expect(validarCabecasNaoExcedeLote(38, 40).acao).toBe("gravar");
  });

  it("caso negativo: cabeças acima do efetivo recusa", () => {
    expect(validarCabecasNaoExcedeLote(50, 40).acao).toBe("recusar");
  });
});

const REGRA_BRUCELOSE: RegraVacinal = {
  nome: "Brucelose (B19)",
  sexoAlvo: "F",
  idadeMinMeses: 3,
  idadeMaxMeses: 8,
  categoriasAlvo: ["bezerra", "novilha"],
  bloqueada: false,
  motivoBloqueio: null,
};

const REGRA_AFTOSA: RegraVacinal = {
  nome: "Febre Aftosa",
  sexoAlvo: null,
  idadeMinMeses: null,
  idadeMaxMeses: null,
  categoriasAlvo: null,
  bloqueada: true,
  motivoBloqueio: "O Maranhão é zona livre de febre aftosa sem vacinação desde abril de 2024.",
};

function animalVacina(overrides: Partial<AnimalParaVacina>): AnimalParaVacina {
  return { id: "a1", sexo: "F", categoria: "bezerra", nascimento: "2026-04-01", ...overrides };
}

describe("validarElegibilidadeVacina", () => {
  it("caso positivo: animal elegível grava", () => {
    expect(validarElegibilidadeVacina(animalVacina({}), REGRA_BRUCELOSE, "2026-07-31").acao).toBe("gravar");
  });

  it("caso negativo: vacina bloqueada (aftosa) recusa com o aviso legal", () => {
    const resultado = validarElegibilidadeVacina(animalVacina({}), REGRA_AFTOSA, "2026-07-31");
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/zona livre/i);
  });

  it("caso negativo: fora da janela etária recusa explicando a janela", () => {
    const resultado = validarElegibilidadeVacina(
      animalVacina({ nascimento: "2020-01-01" }),
      REGRA_BRUCELOSE,
      "2026-07-31"
    );
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/idade máxima/i);
  });
});

describe("validarIntervaloVacinal", () => {
  it("caso positivo: sem aplicação incompatível recente grava", () => {
    const resultado = validarIntervaloVacinal("Clostridioses", ["Brucelose (B19)"], 30, [], "2026-07-31");
    expect(resultado.acao).toBe("gravar");
  });

  it("caso negativo: incompatível dentro do intervalo mínimo recusa e sugere a data certa", () => {
    const resultado = validarIntervaloVacinal(
      "Clostridioses",
      ["Brucelose (B19)"],
      30,
      [{ vacina: "Brucelose (B19)", data: "2026-05-16" }],
      "2026-05-20"
    );
    expect(resultado.acao).toBe("recusar");
    if (resultado.acao === "recusar") expect(resultado.pergunta).toMatch(/15\/06\/2026/);
  });
});

describe("validarValorFinanceiroPlausivel", () => {
  it("caso positivo: valor dentro da faixa histórica grava", () => {
    expect(validarValorFinanceiroPlausivel(150000n, 120000n, 10).acao).toBe("gravar");
  });

  it("caso positivo: sem histórico ainda, não bloqueia por dado ausente", () => {
    expect(validarValorFinanceiroPlausivel(150000n, null, 10).acao).toBe("gravar");
  });

  it("caso negativo: valor mais de 10x a mediana vai para revisão", () => {
    expect(validarValorFinanceiroPlausivel(2000000n, 120000n, 10).acao).toBe("revisao");
  });
});
