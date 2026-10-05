import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatMonth, monthStart, todayISO, toMonthParam, type ISODate } from "@/lib/domain/periods";
import { cn } from "@/lib/utils";

/** Navegación ‹ Octubre 2026 › por query param ?month=YYYY-MM (server component, sin JS). */
export function MonthNav({ month, basePath }: { month: ISODate; basePath: string }) {
  const href = (iso: ISODate) => `${basePath}?month=${toMonthParam(iso)}`;
  const isCurrent = monthStart(todayISO()) === month;
  const btn =
    "inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
      <Link href={href(addMonths(month, -1))} className={btn} aria-label="Mes anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 px-2 text-center text-[14px] font-semibold tracking-tight tabular">{formatMonth(month)}</span>
      <Link href={href(addMonths(month, 1))} className={btn} aria-label="Mes siguiente">
        <ChevronRight className="size-4" />
      </Link>
      <Link
        href={href(monthStart(todayISO()))}
        aria-disabled={isCurrent}
        className={cn(
          "ml-1 inline-flex h-9 items-center rounded-xl px-3 text-[12.5px] transition-colors",
          isCurrent ? "pointer-events-none text-muted-foreground/50" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        Hoy
      </Link>
    </div>
  );
}
