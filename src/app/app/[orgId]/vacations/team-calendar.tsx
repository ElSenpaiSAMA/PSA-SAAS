import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { AbsenceCell, GridDay } from "@/lib/domain/team-absences";
import { cn } from "@/lib/utils";

export interface TeamCalendarRow {
  memberId: string;
  name: string;
  position: string | null;
  available: number;
  approvedDays: number;
  pendingDays: number;
  cells: AbsenceCell[];
}

const WEEKDAY = ["L", "M", "X", "J", "V", "S", "D"];

/** Grilla persona × día del mes con las ausencias del equipo (aprobadas y pendientes). */
export function TeamCalendar({ orgId, days, rows, today }: { orgId: string; days: GridDay[]; rows: TeamCalendarRow[]; today: string }) {
  const cols = `minmax(12rem, 15rem) repeat(${days.length}, minmax(1.6rem, 1fr))`;

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[56rem]">
          {/* Cabecera de días */}
          <div
            className="grid border-b border-border bg-muted/40 text-[10.5px] text-muted-foreground"
            style={{ gridTemplateColumns: cols }}
          >
            <div className="sticky left-0 z-10 bg-muted/90 px-3 py-2 font-medium backdrop-blur">Persona</div>
            {days.map((d) => (
              <div
                key={d.date}
                className={cn(
                  "flex flex-col items-center py-1.5 tabular",
                  (d.weekend || d.holiday) && "bg-muted",
                  d.date === today && "font-semibold text-accent",
                )}
                title={d.holiday ? "Festivo" : undefined}
              >
                <span>{WEEKDAY[d.weekday]}</span>
                <span className={cn("text-[11.5px]", d.date === today && "rounded-full bg-accent px-1.5 text-accent-foreground")}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.memberId} className="group grid border-b border-border last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <Link
                href={`/app/${orgId}/staff/${row.memberId}`}
                className="sticky left-0 z-10 flex items-center gap-2.5 bg-card px-3 py-2 transition-colors group-hover:bg-muted/60"
              >
                <Avatar name={row.name} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{row.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.available} días disponibles
                    {row.approvedDays ? ` · ${row.approvedDays} este mes` : ""}
                  </span>
                </span>
              </Link>
              {row.cells.map((cell, i) => {
                const d = days[i];
                const prevSame = i > 0 && row.cells[i - 1] === cell;
                const nextSame = i < row.cells.length - 1 && row.cells[i + 1] === cell;
                return (
                  <div
                    key={d.date}
                    className={cn(
                      "relative flex items-center py-2",
                      (d.weekend || d.holiday) && "bg-muted/60",
                      d.date === today && "bg-accent-soft/50",
                    )}
                  >
                    {cell ? (
                      <span
                        title={cell === "approved" ? "Aprobada" : "Pendiente de aprobación"}
                        className={cn(
                          "h-5 w-full",
                          !prevSame && "ml-1 rounded-l-md",
                          !nextSame && "mr-1 rounded-r-md",
                          cell === "approved"
                            ? "bg-success/70"
                            : "bg-[repeating-linear-gradient(135deg,var(--color-warning)_0_4px,color-mix(in_oklab,var(--color-warning)_45%,transparent)_4px_8px)]",
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-success/70" /> Aprobada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-[repeating-linear-gradient(135deg,var(--color-warning)_0_4px,color-mix(in_oklab,var(--color-warning)_45%,transparent)_4px_8px)]" />{" "}
          Pendiente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-muted" /> Fin de semana o festivo
        </span>
      </div>
    </div>
  );
}
