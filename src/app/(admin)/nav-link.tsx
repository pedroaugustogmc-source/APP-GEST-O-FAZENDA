"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icone,
  variante = "lateral",
}: {
  href: string;
  label: string;
  icone: ReactNode;
  variante?: "lateral" | "topo";
}) {
  const pathname = usePathname();
  const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (variante === "topo") {
    return (
      <Link
        href={href}
        aria-current={ativo ? "page" : undefined}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
          ativo ? "bg-accent font-semibold text-foreground" : "text-foreground hover:bg-accent"
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        // bg-primary (verde escuro) sobre bg-secondary (marrom escuro) do
        // menu lateral tem quase a mesma luminosidade — a diferença é só de
        // matiz, difícil de perceber a olho (pior ainda com sol forte na
        // tela, condição real de uso do §38). bg-accent é claro (85% de
        // luminosidade) contra um fundo escuro — contraste alto de verdade,
        // não sutil. Mesma cor que o menu do celular ("topo") já usa pra
        // marcar a página ativa.
        ativo
          ? "bg-accent text-accent-foreground font-semibold"
          : "text-secondary-foreground/90 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
      )}
    >
      {icone}
      {label}
    </Link>
  );
}
