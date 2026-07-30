import * as React from "react";
import { cn } from "@/lib/utils";

// Select nativo (não Radix): em tela de toque, o seletor do sistema
// operacional é mais confiável que um dropdown customizado (§38 — dedo sujo,
// sol forte). Estilizado para combinar com os outros componentes.
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
