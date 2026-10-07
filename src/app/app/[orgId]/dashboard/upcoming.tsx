import Link from "next/link";
import { ArrowRight, Palmtree, PartyPopper, SquareCheckBig } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { addDays, daysBetween, type ISODate } from "@/lib/domain/periods";

export interface UpcomingItem {
  date: ISODate;
  kind: "task" | "absence" | "holiday";
  title: string;
  href?: string;
}

const ICON = { task: SquareCheckBig, absence: Palmtree, holiday: PartyPopper };
const TONE = { task: "text-accent", absence: "text-success", holiday: "text-danger" };
const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function dayLabel(date: ISODate, today: ISODate) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** Agenda de los próximos 7 días: vencimientos propios, ausencias del equipo y festivos. */
export function Upcoming({ today, items }: { today: ISODate; items: UpcomingItem[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => items.some((it) => it.date === d));

  return (
    <Card>
      <CardHeader
        title="Próximos 7 días"
        action={
          <Link href={`/app/calendar`} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
            Calendario <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="pt-3">
        {days.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Semana despejada: sin vencimientos, ausencias ni festivos.</p>
        ) : (
          <ol className="grid gap-4">
            {days.map((day) => (
              <li key={day} className="grid grid-cols-[64px_1fr] gap-3">
                <span className="pt-0.5 text-[12px] font-medium text-muted-foreground capitalize">{dayLabel(day, today)}</span>
                <ul className="grid gap-1.5">
                  {items
                    .filter((it) => it.date === day)
                    .map((it, i) => {
                      const Icon = ICON[it.kind];
                      const content = (
                        <>
                          <Icon className={`size-3.5 shrink-0 ${TONE[it.kind]}`} strokeWidth={1.75} />
                          <span className="truncate">{it.title}</span>
                        </>
                      );
                      return (
                        <li key={i}>
                          {it.href ? (
                            <Link href={it.href} className="flex items-center gap-2 text-[13px] transition-colors hover:text-accent">
                              {content}
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2 text-[13px]">{content}</span>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
