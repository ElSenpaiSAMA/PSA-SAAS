"use client";

import { ChevronDown, CopyPlus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/submit-button";
import { formatMonth, shiftPeriod } from "@/lib/domain/periods";
import { cn } from "@/lib/utils";
import { copyToNextPeriod } from "./actions";

/**
 * Copia la OT (con sus tareas) al mes siguiente y navega a la copia. Con el período de
 * origen, la flecha abre los meses que siguen para copiarla a otro.
 */
export function CopyNextButton({
  orgId,
  workOrderId,
  targetLabel,
  period,
  variant = "text",
}: {
  orgId: string;
  workOrderId: string;
  /** Mes destino, p. ej. "Noviembre 2026" */
  targetLabel: string;
  /** Período de la OT: habilita "copiar a otro mes" */
  period?: { start: string; end: string };
  variant?: "text" | "full";
}) {
  const [pending, start] = useTransition();
  // Posición del menú en pantalla: se dibuja en el <body> para que ninguna tabla lo recorte
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(null);
  const open = menuAt !== null;
  const setOpen = (value: boolean) => {
    const rect = wrapper.current?.getBoundingClientRect();
    setMenuAt(value && rect ? { top: rect.bottom + 4, right: window.innerWidth - rect.right } : null);
  };
  const wrapper = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // El menú queda fijo en pantalla: si algo hace scroll o cambia el tamaño, se cierra
  useEffect(() => {
    if (!open) return;
    const close = () => setMenuAt(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const copy = (months: number) =>
    start(async () => {
      setOpen(false);
      const r = await copyToNextPeriod(orgId, workOrderId, months);
      // Si sale bien, la acción redirige a la OT nueva
      if (r?.status === "error") toast.error(r.message);
    });

  const others = period ? [2, 3, 4].map((m) => ({ months: m, label: formatMonth(shiftPeriod(period.start, period.end, m).start) })) : [];
  const text = variant === "text";
  const base = text
    ? "h-8 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
    : "h-10 border border-border bg-card text-sm font-medium hover:border-border-strong";

  return (
    <div
      ref={wrapper}
      className="relative z-10 inline-flex"
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (!wrapper.current?.contains(to) && !menu.current?.contains(to)) setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={pending}
        title={`Crear la OT de ${targetLabel} con las mismas tareas`}
        onClick={() => copy(1)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-50",
          base,
          text ? "rounded-l-lg px-2.5" : "rounded-l-xl px-4",
          others.length === 0 && (text ? "rounded-r-lg" : "rounded-r-xl"),
        )}
      >
        {pending ? <Spinner /> : <CopyPlus className="size-3.5" strokeWidth={1.75} />}
        Copiar a {targetLabel}
      </button>
      {others.length > 0 ? (
        <>
          <button
            type="button"
            disabled={pending}
            aria-label="Copiar a otro mes"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen(!open)}
            className={cn(
              "inline-flex items-center justify-center transition-colors disabled:opacity-50",
              base,
              text ? "rounded-r-lg px-1.5" : "-ml-px rounded-r-xl px-2.5",
            )}
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {open && menuAt
            ? createPortal(
                <div
                  ref={menu}
                  role="menu"
                  style={{ top: menuAt.top, right: menuAt.right }}
                  onBlur={(e) => {
                    const to = e.relatedTarget as Node | null;
                    if (!wrapper.current?.contains(to) && !menu.current?.contains(to)) setOpen(false);
                  }}
                  className="fixed z-[60] w-52 rounded-xl border border-border bg-card p-1 shadow-lg"
                >
                  <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] text-muted-foreground">Copiar a otro mes</p>
                  {others.map((o) => (
                    <button
                      key={o.months}
                      type="button"
                      role="menuitem"
                      onClick={() => copy(o.months)}
                      className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
    </div>
  );
}
