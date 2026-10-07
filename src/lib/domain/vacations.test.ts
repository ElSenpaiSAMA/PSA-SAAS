import { describe, expect, it } from "vitest";
import {
  businessDays,
  canDecide,
  rangesOverlap,
  validateNewRequest,
  vacationBalance,
  type VacationRequestLike,
  naturalApprovers,
} from "./vacations";

const req = (
  start_date: string,
  end_date: string,
  status: VacationRequestLike["status"] = "approved",
  membership_id = "m1",
): VacationRequestLike => ({ start_date, end_date, status, membership_id });

describe("businessDays", () => {
  it("cuenta lunes a viernes inclusive", () => {
    expect(businessDays({ start_date: "2026-10-05", end_date: "2026-10-09" })).toBe(5);
  });

  it("excluye fines de semana", () => {
    expect(businessDays({ start_date: "2026-10-09", end_date: "2026-10-12" })).toBe(2);
    expect(businessDays({ start_date: "2026-10-10", end_date: "2026-10-11" })).toBe(0);
  });

  it("rango invertido = 0", () => {
    expect(businessDays({ start_date: "2026-10-09", end_date: "2026-10-05" })).toBe(0);
  });
});

describe("rangesOverlap", () => {
  it("detecta solapamiento incluyendo bordes", () => {
    const a = { start_date: "2026-10-05", end_date: "2026-10-09" };
    expect(rangesOverlap(a, { start_date: "2026-10-09", end_date: "2026-10-12" })).toBe(true);
    expect(rangesOverlap(a, { start_date: "2026-10-10", end_date: "2026-10-12" })).toBe(false);
  });
});

describe("vacationBalance", () => {
  it("separa usados, pendientes y disponibles del año", () => {
    const balance = vacationBalance(
      22,
      [
        req("2026-03-02", "2026-03-06"), // 5 aprobados
        req("2026-11-02", "2026-11-03", "pending"), // 2 pendientes
        req("2026-06-01", "2026-06-05", "rejected"), // no cuenta
        req("2025-12-01", "2025-12-05"), // otro año
      ],
      2026,
    );
    expect(balance).toEqual({ allowance: 22, used: 5, pending: 2, available: 15 });
  });
});

describe("validateNewRequest", () => {
  const balance = { allowance: 22, used: 20, pending: 0, available: 2 };
  const today = "2026-10-05";

  it("acepta una solicitud válida", () => {
    expect(
      validateNewRequest({ start_date: "2026-10-12", end_date: "2026-10-13" }, [], balance, today),
    ).toBeNull();
  });

  it("rechaza rangos inválidos o en el pasado", () => {
    expect(
      validateNewRequest({ start_date: "2026-10-13", end_date: "2026-10-12" }, [], balance, today),
    ).toBe("invalid_range");
    expect(
      validateNewRequest({ start_date: "2026-10-01", end_date: "2026-10-02" }, [], balance, today),
    ).toBe("starts_in_past");
  });

  it("rechaza fines de semana completos", () => {
    expect(
      validateNewRequest({ start_date: "2026-10-10", end_date: "2026-10-11" }, [], balance, today),
    ).toBe("no_business_days");
  });

  it("rechaza solapamiento con solicitudes activas, pero no con rechazadas", () => {
    const range = { start_date: "2026-10-12", end_date: "2026-10-13" };
    expect(
      validateNewRequest(range, [req("2026-10-13", "2026-10-14", "pending")], balance, today),
    ).toBe("overlaps_existing");
    expect(
      validateNewRequest(range, [req("2026-10-13", "2026-10-14", "rejected")], balance, today),
    ).toBeNull();
  });

  it("rechaza si no alcanza el saldo", () => {
    expect(
      validateNewRequest({ start_date: "2026-10-12", end_date: "2026-10-14" }, [], balance, today),
    ).toBe("insufficient_balance");
  });
});

describe("canDecide", () => {
  it("nadie aprueba su propia solicitud", () => {
    expect(canDecide(req("2026-10-12", "2026-10-13", "pending", "m1"), "m1")).toBe(false);
    expect(canDecide(req("2026-10-12", "2026-10-13", "pending", "m1"), "m2")).toBe(true);
  });

  it("solo se deciden solicitudes pendientes", () => {
    expect(canDecide(req("2026-10-12", "2026-10-13", "approved", "m1"), "m2")).toBe(false);
  });
});

describe("naturalApprovers", () => {
  const can = (role: string) => role !== "employee";
  const admin = (role: string) => role === "owner" || role === "admin";
  const org = [
    { id: "ceo", manager_id: null, role_id: "owner", status: "active" },
    { id: "hr", manager_id: "ceo", role_id: "admin", status: "active" },
    { id: "lead", manager_id: "ceo", role_id: "manager", status: "active" },
    { id: "senior", manager_id: "lead", role_id: "employee", status: "active" },
    { id: "junior", manager_id: "senior", role_id: "employee", status: "active" },
  ];

  it("sube por la línea de reporte hasta el primero que puede aprobar", () => {
    expect(naturalApprovers(org, "junior", can, admin)).toEqual(["lead"]);
    expect(naturalApprovers(org, "lead", can, admin)).toEqual(["ceo"]);
  });

  it("sin nadie por encima, aprueba administración (nunca uno mismo)", () => {
    expect(naturalApprovers(org, "ceo", can, admin)).toEqual(["hr"]);
  });

  it("salta responsables dados de baja", () => {
    const withInactive = org.map((n) => (n.id === "lead" ? { ...n, status: "inactive" } : n));
    expect(naturalApprovers(withInactive, "junior", can, admin)).toEqual(["ceo"]);
  });
});

describe("tipos de ausencia", () => {
  const r = (kind: "vacation" | "sick" | "personal" | "other" | undefined, status: "approved" | "pending" = "approved") => ({
    membership_id: "m",
    start_date: "2026-03-02",
    end_date: "2026-03-06",
    status,
    kind,
  });

  it("solo las vacaciones descuentan del saldo", () => {
    expect(vacationBalance(22, [r("vacation"), r("sick"), r("personal"), r(undefined, "pending")], 2026)).toEqual({
      allowance: 22,
      used: 5,
      pending: 5,
      available: 12,
    });
  });

  it("una baja médica se puede cargar con fecha pasada; las vacaciones no", () => {
    const balance = vacationBalance(22, [], 2026);
    const past = { start_date: "2026-10-01", end_date: "2026-10-02" };
    expect(validateNewRequest(past, [], balance, "2026-10-06")).toBe("starts_in_past");
    expect(validateNewRequest(past, [], balance, "2026-10-06", new Set(), "sick")).toBeNull();
  });

  it("sin saldo se pueden pedir asuntos propios, no vacaciones", () => {
    const empty = vacationBalance(0, [], 2026);
    const range = { start_date: "2026-11-02", end_date: "2026-11-02" };
    expect(validateNewRequest(range, [], empty, "2026-10-06")).toBe("insufficient_balance");
    expect(validateNewRequest(range, [], empty, "2026-10-06", new Set(), "personal")).toBeNull();
  });
});
