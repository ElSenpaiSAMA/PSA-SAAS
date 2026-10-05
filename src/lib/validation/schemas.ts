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

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
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
    startDate: isoDate,
    endDate: isoDate,
    reason: optionalText(200),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La fecha de fin debe ser posterior al inicio",
    path: ["endDate"],
  });

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  clientName: optionalText(80),
  budgetedHours: emptyToUndefined.or(z.coerce.number().min(0).max(100_000)).optional(),
  departmentId: emptyToUndefined.or(id).optional(),
});

export const taskSchema = z.object({
  projectId: id,
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(120),
  assignedTo: emptyToUndefined.or(id).optional(),
  estimatedHours: emptyToUndefined.or(z.coerce.number().min(0).max(1000)).optional(),
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

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
