import {
  type LucideIcon,
  Sprout,
  Home,
  MapPin,
  Layers,
  Beef,
  Users,
  Stethoscope,
  Wallet,
  FileBarChart,
  LineChart,
  TrendingUp,
  Wrench,
  ClipboardCheck,
  Receipt,
  ListTodo,
  FileText,
  ShieldCheck,
  Package,
  UserCog,
  MessageSquareWarning,
  SlidersHorizontal,
  Building2,
  Upload,
  Wallet as WalletIcon,
} from "lucide-react";
import { BotaoSair } from "./botao-sair";
import { NavLink } from "./nav-link";
import { IndicadorSincronizacao } from "@/components/indicador-sincronizacao";

type ItemMenu = { href: string; label: string; icone: LucideIcon };
type GrupoMenu = { titulo: string; itens: ItemMenu[] };

const GRUPOS: GrupoMenu[] = [
  {
    titulo: "",
    itens: [{ href: "/", label: "Início", icone: Home }],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/pastos", label: "Pastos", icone: MapPin },
      { href: "/lotes", label: "Lotes", icone: Layers },
      { href: "/animais", label: "Animais", icone: Beef },
      { href: "/rebanho", label: "Rebanho", icone: Users },
      { href: "/sanidade", label: "Sanidade", icone: Stethoscope },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      { href: "/financeiro", label: "Financeiro", icone: Wallet },
      { href: "/financeiro/dre", label: "DRE por lote", icone: FileBarChart },
      { href: "/financeiro/cenarios", label: "Cenários", icone: LineChart },
      { href: "/mercado", label: "Mercado", icone: TrendingUp },
    ],
  },
  {
    titulo: "Recursos",
    itens: [
      { href: "/maquinas", label: "Máquinas", icone: Wrench },
      { href: "/checklist", label: "Checklist", icone: ClipboardCheck },
      { href: "/cotacoes", label: "Cotações", icone: Receipt },
      { href: "/insumos", label: "Insumos", icone: Package },
    ],
  },
  {
    titulo: "Planejamento",
    itens: [
      { href: "/tarefas", label: "Tarefas", icone: ListTodo },
      { href: "/relatorios", label: "Relatórios", icone: FileText },
    ],
  },
  {
    titulo: "Bot",
    itens: [
      { href: "/revisao", label: "Revisão do bot", icone: MessageSquareWarning },
      { href: "/cartao-bolso", label: "Cartão de bolso", icone: WalletIcon },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/compliance", label: "Compliance", icone: ShieldCheck },
      { href: "/trabalhadores", label: "Trabalhadores", icone: UserCog },
      { href: "/parametros", label: "Parâmetros", icone: SlidersHorizontal },
      { href: "/propriedades", label: "Propriedade", icone: Building2 },
      { href: "/importar", label: "Importar planilha", icone: Upload },
    ],
  },
];

const TODOS_ITENS = GRUPOS.flatMap((g) => g.itens);

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-secondary lg:text-secondary-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-secondary-foreground/15 px-5">
          <Sprout className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">Fazenda</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {GRUPOS.map((grupo, i) => (
            <div key={i} className={grupo.titulo ? "mt-5 first:mt-0" : ""}>
              {grupo.titulo && (
                <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-secondary-foreground/50">
                  {grupo.titulo}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {grupo.itens.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} icone={item.icone} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <nav
              className="flex flex-1 flex-wrap gap-1 lg:hidden"
              aria-label="Navegação principal (celular)"
            >
              {TODOS_ITENS.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} icone={item.icone} variante="topo" />
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <IndicadorSincronizacao />
              <BotaoSair />
            </div>
          </div>
        </header>
        <main className="container flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
