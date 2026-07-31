import Link from "next/link";
import { BotaoSair } from "./botao-sair";
import { IndicadorSincronizacao } from "@/components/indicador-sincronizacao";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/pastos", label: "Pastos" },
  { href: "/lotes", label: "Lotes" },
  { href: "/animais", label: "Animais" },
  { href: "/rebanho", label: "Rebanho" },
  { href: "/sanidade", label: "Sanidade" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/financeiro/dre", label: "DRE por lote" },
  { href: "/financeiro/cenarios", label: "Cenários" },
  { href: "/mercado", label: "Mercado" },
  { href: "/maquinas", label: "Máquinas" },
  { href: "/insumos", label: "Insumos" },
  { href: "/trabalhadores", label: "Trabalhadores" },
  { href: "/revisao", label: "Revisão do bot" },
  { href: "/parametros", label: "Parâmetros" },
  { href: "/importar", label: "Importar planilha" },
  { href: "/cartao-bolso", label: "Cartão de bolso" },
] as const;

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
          <nav className="flex flex-wrap gap-1" aria-label="Navegação principal">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <IndicadorSincronizacao />
            <BotaoSair />
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
