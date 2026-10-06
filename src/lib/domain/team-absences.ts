import { addDays, monthEnd, type ISODate } from "./periods";

export type AbsenceCell = "approved" | "pending" | null;

export interface AbsenceRequest {
  id: string;
  membership_id: string;
  start_date: ISODate;
  end_date: ISODate;
  status: string;
}

export interface GridDay {
  date: ISODate;
  day: number;
  /** 0 = lunes … 6 = domingo */
  weekday: number;
  weekend: boolean;
  holiday: boolean;
}

export interface GridRow {
  memberId: string;
  cells: AbsenceCell[];
  /** Días hábiles de ausencia aprobada en el mes */
  approvedDays: number;
  pendingDays: number;
}

const weekdayOf = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

/** Grilla persona × día del mes con las ausencias aprobadas y pendientes del equipo. */
export function absenceGrid(
  memberIds: readonly string[],
  requests: readonly AbsenceRequest[],
  month: ISODate,
  holidays: ReadonlySet<string>,
): { days: GridDay[]; rows: GridRow[] } {
  const days: GridDay[] = [];
  for (let d = month; d <= monthEnd(month); d = addDays(d, 1)) {
    const weekday = weekdayOf(d);
    days.push({ date: d, day: Number(d.slice(8)), weekday, weekend: weekday >= 5, holiday: holidays.has(d) });
  }

  const rows = memberIds.map((memberId) => {
    const own = requests.filter((r) => r.membership_id === memberId && (r.status === "approved" || r.status === "pending"));
    const cells: AbsenceCell[] = days.map((day) => {
      const hit = own.filter((r) => r.start_date <= day.date && r.end_date >= day.date);
      if (hit.some((r) => r.status === "approved")) return "approved";
      if (hit.length) return "pending";
      return null;
    });
    const working = (i: number) => !days[i].weekend && !days[i].holiday;
    return {
      memberId,
      cells,
      approvedDays: cells.filter((c, i) => c === "approved" && working(i)).length,
      pendingDays: cells.filter((c, i) => c === "pending" && working(i)).length,
    };
  });

  return { days, rows };
}

/** Otras personas del equipo ausentes (aprobado o pendiente) en algún día de la solicitud. */
export function overlappingPeople(request: AbsenceRequest, requests: readonly AbsenceRequest[]): string[] {
  const people = requests
    .filter(
      (r) =>
        r.id !== request.id &&
        r.membership_id !== request.membership_id &&
        (r.status === "approved" || r.status === "pending") &&
        r.start_date <= request.end_date &&
        r.end_date >= request.start_date,
    )
    .map((r) => r.membership_id);
  return [...new Set(people)];
}
