import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatMonth,
  formatRange,
  monthEnd,
  monthStart,
  nextPeriod,
  parseMonthParam,
  weeksOfMonth,
} from "./periods";

describe("meses", () => {
  it("calcula inicio, fin y suma de meses (incluso bisiestos y cambio de año)", () => {
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
    expect(monthEnd("2026-10-17")).toBe("2026-10-31");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("formatea en español", () => {
    expect(formatMonth("2026-10-05")).toBe("Octubre 2026");
    expect(formatRange("2026-10-03", "2026-10-14")).toBe("3 – 14 oct");
    expect(formatRange("2026-09-28", "2026-10-02")).toBe("28 sep – 2 oct");
  });

  it("valida el parámetro de mes de la URL", () => {
    expect(parseMonthParam("2026-10")).toBe("2026-10-01");
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("octubre")).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
  });
});

describe("nextPeriod", () => {
  it("un mes completo pasa al mes siguiente completo", () => {
    expect(nextPeriod("2026-01-01", "2026-01-31")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("un rango parcial conserva su duración", () => {
    expect(nextPeriod("2026-10-05", "2026-10-16")).toEqual({ start: "2026-11-01", end: "2026-11-12" });
  });
});

describe("weeksOfMonth", () => {
  it("devuelve semanas lunes a domingo que tocan el mes", () => {
    const weeks = weeksOfMonth("2026-10-01"); // 1/10/2026 es jueves
    expect(weeks[0]).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(weeks.at(-1)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(weeks).toHaveLength(5);
  });
});
