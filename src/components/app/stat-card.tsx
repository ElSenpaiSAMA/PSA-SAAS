import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FadeIn, StatValue, type StatFormat } from "./stat-card.client";

// Celda de una banda de indicadores: va dentro de un contenedor con `gap-px bg-border`
// (las líneas divisorias son el fondo que asoma entre celdas), como en los PSA profesionales.
// Server Component: el ícono (una función) no cruza la frontera servidor→cliente;
// se renderiza acá y solo el número animado y la entrada viven en el cliente.
export function StatCard({
  label,
  value,
  format = "number",
  icon: Icon,
  hint,
  tone,
  index = 0,
  children,
}: {
  label: string;
  value: number;
  format?: StatFormat;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: "warning" | "danger" | "success";
  index?: number;
  children?: ReactNode;
}) {
  return (
    <FadeIn
      index={index}
      className="group bg-card p-5 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <Icon
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-500 group-hover:scale-110",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
            tone === "success" && "text-success",
          )}
          strokeWidth={1.75}
        />
      </div>
      <StatValue value={value} format={format} />
      {hint ? <p className="mt-2 text-[12.5px] text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </FadeIn>
  );
}
