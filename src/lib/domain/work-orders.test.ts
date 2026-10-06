import { describe, expect, it } from "vitest";
import {
  acceptsTimeEntries,
  canInvoice,
  formatMoney,
  lifecycleIndex,
  matchesFilter,
  missingContinuations,
  nextStep,
  secondarySteps,
  nextStatuses,
  titleForPeriod,
  workOrderAmounts,
  workOrderCode,
} from "./work-orders";

describe("órdenes de trabajo", () => {
  it("formatea el código", () => {
    expect(workOrderCode(7)).toBe("OT-0007");
    expect(workOrderCode(12345)).toBe("OT-12345");
  });

  it("ofrece las transiciones válidas y ninguna si está facturada", () => {
    expect(nextStatuses("draft", "unbilled")).toEqual(["approved"]);
    expect(nextStatuses("in_progress", "unbilled")).toEqual(["closed"]);
    expect(nextStatuses("closed", "unbilled")).toEqual(["in_progress"]);
    expect(nextStatuses("closed", "invoiced")).toEqual([]);
  });

  it("solo acepta horas aprobada o en curso, y solo factura cerradas", () => {
    expect(acceptsTimeEntries("draft")).toBe(false);
    expect(acceptsTimeEntries("approved")).toBe(true);
    expect(acceptsTimeEntries("closed")).toBe(false);
    expect(canInvoice("closed", "unbilled")).toBe(true);
    expect(canInvoice("in_progress", "unbilled")).toBe(false);
    expect(canInvoice("closed", "invoiced")).toBe(false);
  });

  it("calcula importes y consumo", () => {
    expect(workOrderAmounts({ budgetedHours: 80, loggedHours: 60, hourlyRate: 85 })).toEqual({
      consumption: 75,
      remainingHours: 20,
      budgetAmount: 6800,
      actualAmount: 5100,
    });
  });

  it("sin tarifa no hay importes; sin presupuesto no hay consumo", () => {
    expect(workOrderAmounts({ budgetedHours: null, loggedHours: 5, hourlyRate: null })).toEqual({
      consumption: null,
      remainingHours: null,
      budgetAmount: null,
      actualAmount: null,
    });
  });

  it("guía el ciclo de vida con un único siguiente paso", () => {
    const all = { manage: true, bill: true };
    expect(nextStep("draft", "unbilled", all)?.target).toBe("approved");
    expect(nextStep("in_progress", "unbilled", all)?.target).toBe("closed");
    expect(nextStep("closed", "unbilled", all)).toMatchObject({ target: "invoiced", allowed: true });
    expect(nextStep("closed", "unbilled", { manage: true, bill: false })?.allowed).toBe(false);
    expect(nextStep("closed", "invoiced", all)).toBeNull();
  });

  it("ubica el estado en el ciclo y ofrece retrocesos", () => {
    expect(lifecycleIndex("draft", "unbilled")).toBe(0);
    expect(lifecycleIndex("closed", "invoiced")).toBe(4);
    expect(secondarySteps("closed", "unbilled", { manage: true, bill: false })).toEqual([{ target: "in_progress", label: "Reabrir" }]);
    expect(secondarySteps("closed", "invoiced", { manage: true, bill: false })).toEqual([]);
  });

  it("filtra por estado como lo entiende la persona usuaria", () => {
    expect(matchesFilter("active", "approved", "unbilled")).toBe(true);
    expect(matchesFilter("to_invoice", "closed", "unbilled")).toBe(true);
    expect(matchesFilter("to_invoice", "closed", "invoiced")).toBe(false);
    expect(matchesFilter("invoiced", "closed", "invoiced")).toBe(true);
  });

  it("detecta OT del mes anterior sin continuación", () => {
    const prev = [
      { id: "a", project_id: "p1", period_start: "2026-09-01" },
      { id: "b", project_id: "p2", period_start: "2026-09-01" },
    ];
    const current = [{ project_id: "p1", period_start: "2026-10-01" }, { project_id: "p2", period_start: "2026-09-01" }];
    expect(missingContinuations(prev, current, "2026-10-01").map((w) => w.id)).toEqual(["b"]);
  });

  it("renombra el título para el nuevo período", () => {
    expect(titleForPeriod("Portal · Septiembre 2026", "2026-09-01", "2026-10-01")).toBe("Portal · Octubre 2026");
    expect(titleForPeriod("Soporte mensual", "2026-09-01", "2026-10-01")).toBe("Soporte mensual · Octubre 2026");
  });

  it("formatea importes en euros", () => {
    expect(formatMoney(5100)).toMatch(/5\.?100\s?€/);
    expect(formatMoney(null)).toBe("—");
  });
});
