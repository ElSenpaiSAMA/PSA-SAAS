import type { ISODate } from "./periods";

/** Campos versionados de la ficha (todo lo que puede cambiar con el tiempo). */
export const RECORD_FIELDS = [
  "national_id",
  "birth_date",
  "phone",
  "personal_email",
  "address",
  "emergency_contact",
  "hire_date",
  "contract_type",
  "salary_annual",
  "iban",
  "notes",
] as const;
export type RecordField = (typeof RECORD_FIELDS)[number];

export type RecordValues = { [K in RecordField]: string | number | null };

export interface RecordVersion extends RecordValues {
  id: string;
  effective_from: ISODate;
  created_at: string;
}

export const FIELD_LABEL: Record<RecordField, string> = {
  national_id: "DNI / NIE",
  birth_date: "Fecha de nacimiento",
  phone: "Teléfono",
  personal_email: "Email personal",
  address: "Domicilio",
  emergency_contact: "Contacto de emergencia",
  hire_date: "Fecha de alta",
  contract_type: "Tipo de contrato",
  salary_annual: "Salario bruto anual",
  iban: "IBAN",
  notes: "Notas",
};

export const FIELD_GROUPS: { title: string; fields: RecordField[] }[] = [
  { title: "Identidad y contacto", fields: ["national_id", "birth_date", "phone", "personal_email", "address", "emergency_contact"] },
  { title: "Contrato y retribución", fields: ["hire_date", "contract_type", "salary_annual", "iban"] },
];

export const CONTRACT_LABEL: Record<string, string> = {
  indefinido: "Indefinido",
  temporal: "Temporal",
  practicas: "Prácticas",
  freelance: "Freelance",
};

/** Más reciente primero; ante igual vigencia, la última registrada. */
function byEffectiveDesc(a: RecordVersion, b: RecordVersion) {
  return b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at);
}

/** La versión vigente en `date`: la última con effective_from <= date. */
export function recordAt<T extends RecordVersion>(versions: readonly T[], date: ISODate): T | null {
  return [...versions].sort(byEffectiveDesc).find((v) => v.effective_from <= date) ?? null;
}

/** Versiones programadas para después de `date` (cambios con vigencia futura). */
export function upcomingVersions<T extends RecordVersion>(versions: readonly T[], date: ISODate): T[] {
  return versions.filter((v) => v.effective_from > date).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

export interface FieldChange {
  field: RecordField;
  from: RecordValues[RecordField];
  to: RecordValues[RecordField];
}

/** Normaliza para comparar: vacío = null; el salario como número (numeric puede llegar como texto). */
function norm(field: RecordField, v: unknown): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  return field === "salary_annual" ? Number(v) : String(v);
}

/** Campos que cambian entre dos versiones (prev null = alta: todo lo informado es "nuevo"). Las notas no cuentan. */
export function diffVersions(prev: RecordValues | null, next: RecordValues): FieldChange[] {
  return RECORD_FIELDS.filter((f) => f !== "notes")
    .map((field) => ({ field, from: prev ? norm(field, prev[field]) : null, to: norm(field, next[field]) }))
    .filter((c) => c.from !== c.to);
}

export interface TimelineEntry<T extends RecordVersion> {
  version: T;
  changes: FieldChange[];
  isFirst: boolean;
}

/** Historial cronológico (más reciente primero) con lo que cambió en cada versión. */
export function recordTimeline<T extends RecordVersion>(versions: readonly T[]): TimelineEntry<T>[] {
  const asc = [...versions].sort((a, b) => -byEffectiveDesc(a, b));
  return asc
    .map((version, i) => ({ version, changes: diffVersions(i ? asc[i - 1] : null, version), isFirst: i === 0 }))
    .reverse();
}

/** Campos que cambiaron dentro de [from, to] (para resaltarlos al navegar por meses). */
export function changedInRange<T extends RecordVersion>(versions: readonly T[], from: ISODate, to: ISODate): Set<RecordField> {
  const out = new Set<RecordField>();
  for (const entry of recordTimeline(versions)) {
    if (entry.isFirst || entry.version.effective_from < from || entry.version.effective_from > to) continue;
    for (const c of entry.changes) out.add(c.field);
  }
  return out;
}

/** Años de antigüedad completos a una fecha. */
export function seniorityYears(hireDate: ISODate | null, at: ISODate): number | null {
  if (!hireDate || hireDate > at) return null;
  const [hy, hm, hd] = hireDate.split("-").map(Number);
  const [ay, am, ad] = at.split("-").map(Number);
  return ay - hy - (am < hm || (am === hm && ad < hd) ? 1 : 0);
}

/** "ES91 •••• •••• 1332": suficiente para reconocerlo sin exponerlo entero. */
export function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  const compact = iban.replace(/\s+/g, "");
  if (compact.length < 8) return "••••";
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`;
}

export function formatFieldValue(field: RecordField, value: RecordValues[RecordField]): string {
  if (value === null || value === "") return "—";
  if (field === "contract_type") return CONTRACT_LABEL[String(value)] ?? String(value);
  if (field === "salary_annual") {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
  }
  if (field === "birth_date" || field === "hire_date") {
    const [y, m, d] = String(value).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(value);
}
