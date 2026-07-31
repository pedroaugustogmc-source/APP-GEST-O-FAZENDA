"use client";

import { Button } from "@/components/ui/button";

// docs/08-anexos.md Anexo E — entregável explícito da Fase 2: "PDF A6 para
// imprimir e plastificar: 10 frases prontas — exatamente as do §31 — com o
// título 'É só falar assim'". Frases copiadas literalmente da coluna
// "Entrada (fala real)" de docs/04-bot.md §31 — nenhuma foi reescrita.
const FRASES = [
  "Passei o lote dois pro pasto do buriti hoje de manhã, foram trinta e oito cabeça.",
  "O açude do baixão tá pela metade e o gado tá bebendo muito.",
  "Pesei a boiada do três, deu duzentos e dezoito de média, quarenta bicho.",
  "Morreu um bezerro no pasto novo, acho que foi cobra.",
  "Rodei o trator vermelho seis hora hoje roçando.",
  "Comprei dez saco de sal a cento e vinte o saco.",
  "Vacinei as bezerra de brucelose, foram quinze, lote da vacina B dois três quatro.",
  "Choveu bem ontem, uns quarenta milímetro.",
  "Precisa arrumar a cerca do pasto de cima, tem três palanque caído.",
  "Tirei cento e dez litro de leite hoje cedo.",
] as const;

export default function PaginaCartaoBolso() {
  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; }
          .nao-imprimir { display: none !important; }
        }
        @page {
          size: 105mm 148mm;
          margin: 8mm;
        }
        .cartao-a6 {
          width: 105mm;
          min-height: 148mm;
          margin: 0 auto;
        }
      `}</style>

      <div className="nao-imprimir flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cartão de bolso</h1>
          <p className="text-sm text-muted-foreground">
            Imprima e plastifique (formato A6). Sem menu, sem comando, sem palavra em inglês — só as frases que o
            vaqueiro já fala no dia a dia.
          </p>
        </div>
        <Button type="button" onClick={() => window.print()}>
          Imprimir / salvar como PDF
        </Button>
      </div>

      <div className="cartao-a6 rounded-lg border border-border bg-background p-6 text-foreground">
        <h2 className="mb-1 text-center text-xl font-bold">É só falar assim</h2>
        <p className="mb-4 text-center text-xs text-muted-foreground">
          Manda uma nota de voz pro número da fazenda no Telegram, do jeito que você fala.
        </p>
        <ol className="flex flex-col gap-2 text-sm">
          {FRASES.map((frase, indice) => (
            <li key={indice} className="flex gap-2">
              <span className="font-semibold">{indice + 1}.</span>
              <span>&ldquo;{frase}&rdquo;</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
