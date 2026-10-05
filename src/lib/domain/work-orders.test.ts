import { describe, expect, it } from "vitest";
import {
  acceptsTimeEntries,
  canInvoice,
  formatMoney,
  nextStatuses,
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

  it("formatea importes en euros", () => {
    expect(formatMoney(5100)).toMatch(/5\.?100\s?€/);
    expect(formatMoney(null)).toBe("—");
  });
});
