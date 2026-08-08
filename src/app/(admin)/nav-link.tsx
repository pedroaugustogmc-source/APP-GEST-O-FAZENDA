"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icone: Icone,
  variante = "lateral",
}: {
  href: string;
  label: string;
  icone: LucideIcon;
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
        ativo
          ? "bg-primary text-primary-foreground"
          : "text-secondary-foreground/90 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
      )}
    >
      <Icone className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
