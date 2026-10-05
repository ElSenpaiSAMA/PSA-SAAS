import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  invitationSchema,
  signUpSchema,
  taskHoursSchema,
  vacationRequestSchema,
} from "./schemas";

describe("signUpSchema", () => {
  it("normaliza email y acepta contraseña válida", () => {
    const r = signUpSchema.parse({ fullName: " Ana ", email: " ANA@Demo.com ", password: "secreto123" });
    expect(r).toEqual({ fullName: "Ana", email: "ana@demo.com", password: "secreto123" });
  });

  it("exige letras y números en la contraseña", () => {
    const r = signUpSchema.safeParse({ fullName: "Ana", email: "a@b.com", password: "solamente" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).password).toContain("Debe incluir un número");
  });
});

describe("taskHoursSchema", () => {
  const base = { taskId: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", date: "2026-10-05" };

  it("acepta fracciones de 15 minutos", () => {
    expect(taskHoursSchema.parse({ ...base, hours: "1.75" }).hours).toBe(1.75);
  });

  it("rechaza fracciones arbitrarias y rangos fuera de límite", () => {
    expect(taskHoursSchema.safeParse({ ...base, hours: "1.3" }).success).toBe(false);
    expect(taskHoursSchema.safeParse({ ...base, hours: "0" }).success).toBe(false);
    expect(taskHoursSchema.safeParse({ ...base, hours: "13" }).success).toBe(false);
  });
});

describe("vacationRequestSchema", () => {
  it("rechaza fin anterior al inicio con error en endDate", () => {
    const r = vacationRequestSchema.safeParse({ startDate: "2026-10-10", endDate: "2026-10-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).endDate).toBeDefined();
  });

  it("convierte motivo vacío en null", () => {
    expect(
      vacationRequestSchema.parse({ startDate: "2026-10-10", endDate: "2026-10-12", reason: "" }).reason,
    ).toBeNull();
  });
});

describe("invitationSchema", () => {
  it("no permite invitar como owner", () => {
    expect(invitationSchema.safeParse({ email: "x@y.com", role: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "x@y.com", role: "manager" }).success).toBe(true);
  });

  it("manager vacío se transforma en undefined", () => {
    expect(invitationSchema.parse({ email: "x@y.com", role: "employee", managerId: "" }).managerId).toBeUndefined();
  });
});
