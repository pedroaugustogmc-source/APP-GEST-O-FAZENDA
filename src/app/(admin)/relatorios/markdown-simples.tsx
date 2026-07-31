import type { ReactNode } from "react";

// Renderer minúsculo pro `conteudo_md` dos relatórios — só os elementos que
// montarRelatorio.ts realmente produz (#, ##, listas com "- " e texto),
// sem trazer uma lib de markdown inteira pra isso (mesma filosofia "uma
// dependência a menos" já usada no cartão de bolso e nos gráficos SVG).
export function MarkdownSimples({ conteudo }: { conteudo: string }) {
  const linhas = conteudo.split("\n");
  const blocos: ReactNode[] = [];
  let listaAtual: string[] = [];

  function fecharLista() {
    if (listaAtual.length > 0) {
      blocos.push(
        <ul key={`lista-${blocos.length}`} className="list-disc pl-5">
          {listaAtual.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      listaAtual = [];
    }
  }

  linhas.forEach((linha, indice) => {
    if (linha.startsWith("## ")) {
      fecharLista();
      blocos.push(
        <h2 key={indice} className="mt-4 text-lg font-semibold text-foreground">
          {linha.slice(3)}
        </h2>
      );
    } else if (linha.startsWith("# ")) {
      fecharLista();
      blocos.push(
        <h1 key={indice} className="text-xl font-bold text-foreground">
          {linha.slice(2)}
        </h1>
      );
    } else if (linha.startsWith("- ")) {
      listaAtual.push(linha.slice(2));
    } else if (linha.trim() === "") {
      fecharLista();
    } else {
      fecharLista();
      blocos.push(
        <p key={indice} className="text-foreground">
          {linha}
        </p>
      );
    }
  });
  fecharLista();

  return <div className="flex flex-col gap-1 text-sm">{blocos}</div>;
}
