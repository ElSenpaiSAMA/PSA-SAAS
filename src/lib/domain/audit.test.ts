import { describe, expect, it } from "vitest";
import { auditCategory, changedFields, describeAudit, type AuditLike } from "./audit";

const entry = (partial: Partial<AuditLike>): AuditLike => ({
  action: "INSERT",
  table_name: null,
  old_data: null,
  new_data: null,
  ...partial,
});

describe("changedFields", () => {
  it("detecta campos modificados ignorando timestamps", () => {
    expect(
      changedFields(
        entry({
          action: "UPDATE",
          old_data: { status: "pending", updated_at: "a", reason: "x" },
          new_data: { status: "approved", updated_at: "b", reason: "x" },
        }),
      ),
    ).toEqual(["status"]);
  });

  it("sin datos previos no hay cambios", () => {
    expect(changedFields(entry({ new_data: { a: 1 } }))).toEqual([]);
  });
});

describe("describeAudit", () => {
  it("eventos de autenticación", () => {
    expect(describeAudit(entry({ action: "auth.login" }))).toBe("inició sesión");
  });

  it("fichaje: entrada y salida", () => {
    expect(describeAudit(entry({ table_name: "time_entries", new_data: { entry_type: "clock" } }))).toBe("fichó entrada");
    expect(
      describeAudit(
        entry({
          action: "UPDATE",
          table_name: "time_entries",
          old_data: { entry_type: "clock", ended_at: null },
          new_data: { entry_type: "clock", ended_at: "2026-10-05T17:00:00Z" },
        }),
      ),
    ).toBe("fichó salida");
  });

  it("vacaciones: aprobación", () => {
    expect(
      describeAudit(
        entry({
          action: "UPDATE",
          table_name: "vacation_requests",
          old_data: { status: "pending" },
          new_data: { status: "approved" },
        }),
      ),
    ).toBe("aprobó una solicitud de vacaciones");
  });

  it("tareas: cambio de estado", () => {
    expect(
      describeAudit(
        entry({
          action: "UPDATE",
          table_name: "tasks",
          old_data: { title: "API", status: "todo" },
          new_data: { title: "API", status: "in_progress" },
        }),
      ),
    ).toBe('movió "API" a en curso');
  });

  it("invitaciones", () => {
    expect(describeAudit(entry({ table_name: "invitations", new_data: { email: "a@b.com" } }))).toBe("invitó a a@b.com");
  });
});

describe("auditCategory", () => {
  it("clasifica por tabla o acción", () => {
    expect(auditCategory(entry({ action: "auth.login" }))).toBe("auth");
    expect(auditCategory(entry({ table_name: "tasks" }))).toBe("projects");
    expect(auditCategory(entry({ table_name: "memberships" }))).toBe("people");
    expect(auditCategory(entry({ table_name: "unknown" }))).toBe("other");
  });
});
