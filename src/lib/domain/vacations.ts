export type VacationStatus = "pending" | "approved" | "rejected" | "cancelled";

export const ABSENCE_KINDS = ["vacation", "personal", "sick", "other"] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export const ABSENCE_LABEL: Record<AbsenceKind, string> = {
  vacation: "Vacaciones",
  personal: "Asuntos propios",
  sick: "Baja médica",
  other: "Otra ausencia",
};

export const ABSENCE_HINT: Record<AbsenceKind, string> = {
  vacation: "Descuenta de tu saldo anual",
  personal: "No descuenta vacaciones",
  sick: "No descuenta vacaciones. Se puede cargar con fecha pasada",
  other: "No descuenta vacaciones. Explicá el motivo",
};

/** Solo las vacaciones consumen el saldo anual. */
export const countsAgainstBalance = (kind: AbsenceKind | undefined) => (kind ?? "vacation") === "vacation";

export interface VacationRange {
  start_date: string; // YYYY-MM-DD
  end_date: string;
}

export interface VacationRequestLike extends VacationRange {
  membership_id: string;
  status: VacationStatus;
  /** Sin tipo = vacaciones (compatibilidad) */
  kind?: AbsenceKind;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const NO_HOLIDAYS: ReadonlySet<string> = new Set();

/** Días hábiles (lunes a viernes, sin festivos) entre dos fechas, ambas inclusive. */
export function businessDays(range: VacationRange, holidays: ReadonlySet<string> = NO_HOLIDAYS): number {
  const start = parseDate(range.start_date);
  const end = parseDate(range.end_date);
  if (end < start) return 0;
  let count = 0;
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && !holidays.has(d.toISOString().slice(0, 10))) count++;
  }
  return count;
}

export function rangesOverlap(a: VacationRange, b: VacationRange): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export interface VacationBalance {
  allowance: number;
  used: number;
  pending: number;
  available: number;
}

export function vacationBalance(
  allowance: number,
  requests: readonly VacationRequestLike[],
  year: number,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
): VacationBalance {
  const inYear = requests.filter((r) => r.start_date.startsWith(`${year}-`) && countsAgainstBalance(r.kind));
  const sum = (status: VacationStatus) =>
    inYear.filter((r) => r.status === status).reduce((acc, r) => acc + businessDays(r, holidays), 0);
  const used = sum("approved");
  const pending = sum("pending");
  return { allowance, used, pending, available: allowance - used - pending };
}

export type RequestValidationError =
  | "invalid_range"
  | "starts_in_past"
  | "overlaps_existing"
  | "insufficient_balance"
  | "no_business_days";

export function validateNewRequest(
  range: VacationRange,
  existing: readonly VacationRequestLike[],
  balance: VacationBalance,
  today: string,
  holidays: ReadonlySet<string> = NO_HOLIDAYS,
  kind: AbsenceKind = "vacation",
): RequestValidationError | null {
  if (range.end_date < range.start_date) return "invalid_range";
  // Una baja médica se registra muchas veces después de empezar
  if (range.start_date < today && kind !== "sick") return "starts_in_past";
  const days = businessDays(range, holidays);
  if (days === 0) return "no_business_days";
  const active = existing.filter((r) => r.status === "pending" || r.status === "approved");
  if (active.some((r) => rangesOverlap(r, range))) return "overlaps_existing";
  if (countsAgainstBalance(kind) && days > balance.available) return "insufficient_balance";
  return null;
}

/** Nadie puede decidir sobre su propia solicitud, y solo se deciden las pendientes. */
export function canDecide(request: VacationRequestLike, deciderMembershipId: string): boolean {
  return request.status === "pending" && request.membership_id !== deciderMembershipId;
}

export interface ApproverNode {
  id: string;
  manager_id: string | null;
  role_id: string;
  status: string;
}

/**
 * Quién aprueba las vacaciones de `membershipId` (espejo de la función
 * public.vacation_approvers de la base): el primer responsable hacia arriba que
 * pueda aprobar; si no hay, administración. `canApprove` y `isAdmin` deciden por rol.
 */
export function naturalApprovers(
  nodes: readonly ApproverNode[],
  membershipId: string,
  canApprove: (role: string) => boolean,
  isAdmin: (role: string) => boolean,
): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current = byId.get(membershipId)?.manager_id ?? null;
  for (let depth = 0; current && depth < 20; depth++) {
    const node = byId.get(current);
    if (!node) break;
    if (node.status === "active" && canApprove(node.role_id)) return [node.id];
    current = node.manager_id;
  }
  return nodes
    .filter((n) => n.id !== membershipId && n.status === "active" && isAdmin(n.role_id) && canApprove(n.role_id))
    .map((n) => n.id);
}
