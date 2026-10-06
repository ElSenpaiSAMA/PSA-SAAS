import { describe, expect, it } from "vitest";
import { absencesReport, billingReport, countWorkingDays, hoursReport, toCsv } from "./reports";

describe("informe de facturación", () => {
  const projects = [
    { id: "p1", name: "Portal", client_name: "Acme" },
    { id: "p2", name: "Onboarding", client_name: null },
  ];
  const wo = (id: string, project_id: string, status: string, billing: "unbilled" | "invoiced", rate: number | null, budget: number | null) => ({
    id,
    number: Number(id.slice(1)),
    title: `OT ${id}`,
    project_id,
    status,
    billing_status: billing,
    budgeted_hours: budget,
    hourly_rate: rate,
  });

  it("calcula importes por OT y separa facturado, por facturar y en curso", () => {
    const { rows, totals } = billingReport({
      projects,
      workOrders: [
        wo("w1", "p1", "closed", "invoiced", 85, 60),
        wo("w2", "p1", "closed", "unbilled", 85, 90),
        wo("w3", "p1", "in_progress", "unbilled", 85, 90),
        wo("w4", "p2", "in_progress", "unbilled", null, 20),
      ],
      minutesByWorkOrder: new Map([
        ["w1", 55 * 60],
        ["w2", 10 * 60],
        ["w3", 45 * 60],
        ["w4", 20 * 60],
      ]),
    });
    expect(rows.map((r) => [r.client, r.code, r.amount])).toEqual([
      ["Acme", "OT-0001", 4675],
      ["Acme", "OT-0002", 850],
      ["Acme", "OT-0003", 3825],
      ["Interno", "OT-0004", 0],
    ]);
    expect(totals).toEqual({ hours: 130, amount: 9350, invoiced: 4675, toInvoice: 850, inProgress: 3825 });
  });
});

describe("informe de horas", () => {
  it("suma fichado e imputado por persona y proyecto contra su capacidad", () => {
    const at = (d: number, h: number) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
    const { rows, projectIds } = hoursReport({
      members: [
        { id: "ana", name: "Ana", weeklyHours: 40 },
        { id: "diego", name: "Diego", weeklyHours: 32 },
      ],
      entries: [
        { membership_id: "ana", entry_type: "clock", task_id: null, started_at: at(5, 9), ended_at: at(5, 17) },
        { membership_id: "ana", entry_type: "task", task_id: "t1", started_at: at(5, 9), ended_at: at(5, 13) },
        { membership_id: "ana", entry_type: "task", task_id: "t2", started_at: at(5, 13), ended_at: at(5, 15) },
        { membership_id: "ana", entry_type: "clock", task_id: null, started_at: at(6, 9), ended_at: null },
      ],
      taskProject: new Map([
        ["t1", "portal"],
        ["t2", "api"],
      ]),
      workingDays: 20,
    });
    expect(rows[0]).toMatchObject({ name: "Ana", clockHours: 8, taskHours: 6, capacityHours: 160, utilization: 4, byProject: { portal: 4, api: 2 } });
    expect(rows[1]).toMatchObject({ name: "Diego", clockHours: 0, taskHours: 0, capacityHours: 128, utilization: 0 });
    expect(projectIds.sort()).toEqual(["api", "portal"]);
  });

  it("cuenta días hábiles sin fines de semana ni festivos", () => {
    expect(countWorkingDays("2026-10-01", "2026-10-31", new Set(["2026-10-12"]))).toBe(21);
  });
});

describe("informe de ausencias", () => {
  it("cuenta solo lo aprobado dentro del período, por tipo, y el saldo anual de vacaciones", () => {
    const rows = absencesReport({
      members: [{ id: "ana", name: "Ana", annualDays: 22 }],
      requests: [
        { membership_id: "ana", start_date: "2026-09-28", end_date: "2026-10-02", status: "approved", kind: "vacation" },
        { membership_id: "ana", start_date: "2026-10-05", end_date: "2026-10-05", status: "approved", kind: "sick" },
        { membership_id: "ana", start_date: "2026-10-20", end_date: "2026-10-21", status: "pending", kind: "vacation" },
        { membership_id: "ana", start_date: "2026-03-02", end_date: "2026-03-06", status: "approved", kind: "vacation" },
      ],
      from: "2026-10-01",
      to: "2026-10-31",
      year: 2026,
      holidays: new Set(),
    });
    expect(rows[0].days).toEqual({ vacation: 2, personal: 0, sick: 1, other: 0 });
    expect(rows[0]).toMatchObject({ total: 3, usedThisYear: 10, available: 12 });
  });
});

describe("CSV para Excel", () => {
  it("usa ; y coma decimal, escapa comillas y separadores, y empieza con BOM", () => {
    const csv = toCsv(
      [
        { name: "Portal; fase 2", hours: 12.5, note: 'Dijo "ok"' },
        { name: "Ana", hours: null, note: undefined },
      ],
      [
        { header: "Proyecto", value: (r) => r.name },
        { header: "Horas", value: (r) => r.hours },
        { header: "Nota", value: (r) => r.note },
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Proyecto;Horas;Nota\r\n"Portal; fase 2";12,5;"Dijo ""ok"""\r\nAna;;\r\n');
  });
});
