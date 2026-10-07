import { z } from "zod";
import { ROLES } from "@/lib/domain/permissions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const id = z.guid("Identificador inválido");
const email = z.string().trim().toLowerCase().pipe(z.email("Email inválido"));
const emptyToUndefined = z.literal("").transform(() => undefined);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email,
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Za-z]/, "Debe incluir una letra")
    .regex(/\d/, "Debe incluir un número"),
});

export const taskHoursSchema = z.object({
  taskId: id,
  date: isoDate,
  hours: z.coerce
    .number({ error: "Ingresá un número" })
    .min(0.25, "Mínimo 15 minutos")
    .max(12, "Máximo 12 horas por registro")
    .refine((h) => Number.isInteger(h * 4), "Usá fracciones de 15 minutos"),
});

export const vacationRequestSchema = z
  .object({
    kind: z.enum(["vacation", "personal", "sick", "other"], "Tipo de ausencia inválido").default("vacation"),
    startDate: isoDate,
    endDate: isoDate,
    reason: optionalText(200),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La fecha de fin debe ser posterior al inicio",
    path: ["endDate"],
  })
  .refine((v) => v.kind !== "other" || !!v.reason, {
    message: "Contá de qué se trata la ausencia",
    path: ["reason"],
  });

export const decisionNoteSchema = z.string().trim().max(300, "Máximo 300 caracteres");

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  clientName: optionalText(80),
  budgetedHours: emptyToUndefined.or(z.coerce.number().min(0).max(100_000)).optional(),
  hourlyRate: emptyToUndefined.or(z.coerce.number().min(0).max(10_000)).optional(),
  departmentId: emptyToUndefined.or(id).optional(),
});

export const taskSchema = z
  .object({
    projectId: id,
    workOrderId: emptyToUndefined.or(id).optional(),
    startDate: emptyToUndefined.or(isoDate).optional(),
    dueDate: emptyToUndefined.or(isoDate).optional(),
    title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    assignedTo: emptyToUndefined.or(id).optional(),
    estimatedHours: emptyToUndefined.or(z.coerce.number().min(0).max(1000)).optional(),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    message: "El vencimiento debe ser posterior al inicio",
    path: ["dueDate"],
  });

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

const assignableRole = z.enum(ROLES).exclude(["owner"]);

export const invitationSchema = z.object({
  email,
  role: assignableRole,
  managerId: emptyToUndefined.or(id).optional(),
  departmentId: emptyToUndefined.or(id).optional(),
  position: optionalText(80),
});

export const memberUpdateSchema = z.object({
  membershipId: id,
  // Vacío = no se toca (la persona todavía no eligió su nombre)
  fullName: emptyToUndefined.or(z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres")).optional(),
  role: assignableRole,
  managerId: emptyToUndefined.or(id).optional(),
  departmentId: emptyToUndefined.or(id).optional(),
  position: optionalText(80),
  weeklyHours: z.coerce.number().min(1, "Mínimo 1 hora").max(60, "Máximo 60 horas"),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  headId: emptyToUndefined.or(id).optional(),
});

export const projectMemberSchema = z.object({
  projectId: id,
  membershipId: id,
});

const period = {
  periodStart: isoDate,
  periodEnd: isoDate,
};
const validPeriod = (v: { periodStart: string; periodEnd: string }) => v.periodEnd >= v.periodStart;
const periodError = { message: "El fin debe ser posterior al inicio", path: ["periodEnd"] };

export const workOrderSchema = z
  .object({
    projectId: id,
    title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    ...period,
    budgetedHours: emptyToUndefined.or(z.coerce.number().min(0).max(100_000)).optional(),
    hourlyRate: emptyToUndefined.or(z.coerce.number().min(0).max(10_000)).optional(),
  })
  .refine(validPeriod, periodError);

export const duplicateWorkOrderSchema = z
  .object({
    workOrderId: id,
    title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    ...period,
  })
  .refine(validPeriod, periodError);

export const workOrderStatusSchema = z.enum(["draft", "approved", "in_progress", "closed"]);
export const billingStatusSchema = z.enum(["unbilled", "invoiced"]);

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

const optionalDate = emptyToUndefined.or(isoDate).optional().transform((v) => v ?? null);

/** Nueva versión de la ficha de empleado (vigente desde effectiveFrom). */
export const employeeRecordSchema = z.object({
  effectiveFrom: isoDate,
  national_id: optionalText(20),
  birth_date: optionalDate,
  phone: optionalText(30),
  personal_email: emptyToUndefined.or(email).optional().transform((v) => v ?? null),
  address: optionalText(200),
  emergency_contact: optionalText(120),
  hire_date: optionalDate,
  contract_type: emptyToUndefined
    .or(z.enum(["indefinido", "temporal", "practicas", "freelance"], "Tipo de contrato inválido"))
    .optional()
    .transform((v) => v ?? null),
  salary_annual: emptyToUndefined
    .or(z.coerce.number({ error: "Ingresá un número" }).min(0, "No puede ser negativo").max(10_000_000))
    .optional()
    .transform((v) => v ?? null),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .max(42)
    .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,38}$/.test(v), "IBAN inválido")
    .optional()
    .transform((v) => v || null),
  notes: optionalText(300),
});

const isoInstant = z.iso.datetime({ offset: true, error: "Fecha y hora inválidas" });

/** Corrección de fichaje: corrige un tramo (entryId) o agrega uno olvidado. */
export const timeCorrectionSchema = z
  .object({
    entryId: emptyToUndefined.or(id).optional(),
    start: isoInstant,
    end: isoInstant,
    reason: z.string().trim().min(3, "Contá brevemente qué pasó").max(300),
  })
  .refine((v) => new Date(v.end) > new Date(v.start), { message: "La salida tiene que ser posterior a la entrada", path: ["end"] })
  .refine((v) => new Date(v.end).getTime() - new Date(v.start).getTime() <= 16 * 3_600_000, {
    message: "Un tramo no puede superar las 16 horas",
    path: ["end"],
  })
  .refine((v) => new Date(v.end).getTime() <= Date.now(), { message: "No se pueden corregir horas futuras", path: ["end"] });

/** Edición de una tarea existente (el proyecto y la OT no cambian). */
export const taskEditSchema = z
  .object({
    title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
    assignedTo: emptyToUndefined.or(id).optional(),
    estimatedHours: emptyToUndefined.or(z.coerce.number().min(0).max(1000)).optional(),
    startDate: emptyToUndefined.or(isoDate).optional(),
    dueDate: emptyToUndefined.or(isoDate).optional(),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    message: "El vencimiento debe ser posterior al inicio",
    path: ["dueDate"],
  });

/** Zonas horarias que se ofrecen en los ajustes (la base valida cualquier nombre IANA). */
export const TIMEZONES = [
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/London",
  "Atlantic/Canary",
  "America/Argentina/Buenos_Aires",
  "America/Mexico_City",
  "America/Bogota",
  "America/Santiago",
  "America/Lima",
  "America/Montevideo",
  "America/New_York",
  "UTC",
] as const;

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  defaultAnnualVacationDays: z.coerce.number({ error: "Ingresá un número" }).int("Días enteros").min(0).max(60, "Máximo 60"),
  defaultWeeklyHours: z.coerce.number({ error: "Ingresá un número" }).min(1, "Mínimo 1").max(60, "Máximo 60"),
  timezone: z.enum(TIMEZONES, "Zona horaria inválida"),
});

export const forumThreadSchema = z.object({
  category: z.enum(["question", "notice", "incident"], "Elegí una categoría"),
  title: z.string().trim().min(5, "Mínimo 5 caracteres").max(140, "Máximo 140 caracteres"),
  body: z.string().trim().min(1, "Escribí el mensaje").max(5000, "Máximo 5000 caracteres"),
});

export const forumPostSchema = z.object({
  body: z.string().trim().min(1, "Escribí una respuesta").max(5000, "Máximo 5000 caracteres"),
});

export const BOAT_TYPES = ["Velero", "Lancha / motor", "Catamarán", "Semirrígida", "Otro"] as const;
export const CONTACT_SERVICES = [
  "Aire acondicionado",
  "Refrigeración",
  "Generadores",
  "Potabilizadoras",
  "Sistemas eléctricos",
  "Hélices de proa",
  "ElectroMotor: arranque, alternador o dinamo",
  "Otro / no lo sé",
] as const;

/** Formulario de contacto de la web pública. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Contanos tu nombre").max(80),
  email,
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^\+?[\d\s()-]{7,20}$/.test(v), "Teléfono inválido")
    .optional()
    .transform((v) => v || null),
  boatType: z.enum(BOAT_TYPES, "Elegí el tipo de barco"),
  boatModel: optionalText(80),
  service: z.enum(CONTACT_SERVICES, "Elegí un servicio"),
  message: z.string().trim().min(10, "Contanos un poco más (mínimo 10 caracteres)").max(2000, "Máximo 2000 caracteres"),
  privacy: z.literal("on", "Necesitamos tu conformidad para responderte"),
});
