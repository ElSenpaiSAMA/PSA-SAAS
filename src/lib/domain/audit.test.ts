import { describe, expect, it } from "vitest";
import { auditCategory, changedFields, describeAudit,
  foldClockSegments,
  groupConsecutive, relativeTime, type AuditLike } from "./audit";

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

describe("relativeTime", () => {
  const now = new Date("2026-10-05T12:00:00Z").getTime();
  it.each([
    ["2026-10-05T11:59:30Z", "hace instantes"],
    ["2026-10-05T11:55:00Z", "hace 5 minutos"],
    ["2026-10-05T09:00:00Z", "hace 3 horas"],
    ["2026-10-04T12:00:00Z", "ayer"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
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

describe("pausas en el historial", () => {
  const T1 = "2026-10-06T13:00:00.000Z";
  const T2 = "2026-10-06T14:00:00.000Z";
  const m = "m1";
  const log = [
    { action: "UPDATE", table_name: "time_entries", old_data: { entry_type: "clock", membership_id: m, ended_at: null }, new_data: { entry_type: "clock", membership_id: m, started_at: "2026-10-06T09:00:00.000Z", ended_at: T1 } },
    { action: "INSERT", table_name: "time_entries", old_data: null, new_data: { entry_type: "break", membership_id: m, started_at: T1, ended_at: null } },
    { action: "UPDATE", table_name: "time_entries", old_data: { entry_type: "break", membership_id: m, ended_at: null }, new_data: { entry_type: "break", membership_id: m, started_at: T1, ended_at: T2 } },
    { action: "INSERT", table_name: "time_entries", old_data: null, new_data: { entry_type: "clock", membership_id: m, started_at: T2, ended_at: null } },
  ];

  it("describe pausar y reanudar", () => {
    expect(describeAudit(log[1])).toBe("pausó la jornada");
    expect(describeAudit(log[2])).toBe("reanudó la jornada");
  });

  it("oculta el cierre y la apertura de tramo que acompañan a la pausa", () => {
    expect(foldClockSegments(log).map(describeAudit)).toEqual(["pausó la jornada", "reanudó la jornada"]);
  });

  it("una salida normal se mantiene", () => {
    expect(foldClockSegments([log[0]]).map(describeAudit)).toEqual(["fichó salida"]);
  });
});

describe("groupConsecutive", () => {
  it("agrupa eventos seguidos iguales del mismo autor", () => {
    const ev = (user_id: string, action: string) => ({ user_id, action, table_name: null, old_data: null, new_data: null });
    const g = groupConsecutive([ev("a", "auth.login"), ev("a", "auth.login"), ev("b", "auth.login"), ev("a", "auth.logout")]);
    expect(g.map((x) => x.count)).toEqual([2, 1, 1]);
  });
});

describe("miembros de proyecto y ficha", () => {
  it("describe altas en proyectos y cambios de ficha sin exponer valores", () => {
    const ev = (table_name: string, action: string) => ({ action, table_name, old_data: null, new_data: { salary_annual: 40000 } });
    expect(describeAudit(ev("project_members", "INSERT"))).toBe("sumó a una persona a un proyecto");
    expect(describeAudit(ev("employee_records", "INSERT"))).toBe("registró un cambio en la ficha personal");
    expect(describeAudit(ev("employee_records", "INSERT"))).not.toMatch(/40/);
  });
});
