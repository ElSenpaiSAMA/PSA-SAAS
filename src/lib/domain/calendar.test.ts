import { describe, expect, it } from "vitest";
import { daysOfWeek, layoutWeek, orderedRange, shiftRange, type CalendarEvent } from "./calendar";
import { businessDays, validateNewRequest } from "./vacations";
import { weeklyLoad } from "./planning";
import { weeksOfMonth } from "./periods";

const week = { start: "2026-10-05", end: "2026-10-11" };
const ev = (id: string, start: string, end: string): CalendarEvent => ({ id, kind: "task", title: id, start, end });

describe("layoutWeek", () => {
  it("ubica eventos superpuestos en carriles distintos", () => {
    const { slots, lanes } = layoutWeek([ev("a", "2026-10-05", "2026-10-07"), ev("b", "2026-10-06", "2026-10-06"), ev("c", "2026-10-08", "2026-10-09")], week);
    const lane = (id: string) => slots.find((s) => s.event.id === id)!.lane;
    expect(lanes).toBe(2);
    expect(lane("a")).toBe(0);
    expect(lane("b")).toBe(1);
    expect(lane("c")).toBe(0); // reutiliza el carril libre
  });

  it("recorta eventos que cruzan la semana y lo indica", () => {
    const { slots } = layoutWeek([ev("x", "2026-10-01", "2026-10-20")], week);
    expect(slots[0]).toMatchObject({ col: 0, span: 7, continuesBefore: true, continuesAfter: true });
  });

  it("ignora eventos fuera de la semana", () => {
    expect(layoutWeek([ev("z", "2026-10-12", "2026-10-13")], week).slots).toHaveLength(0);
  });
});

describe("utilidades del calendario", () => {
  it("lista los 7 días de la semana", () => {
    expect(daysOfWeek(week)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });

  it("mueve conservando la duración y ordena selecciones", () => {
    expect(shiftRange("2026-10-05", "2026-10-07", 3)).toEqual({ start: "2026-10-08", end: "2026-10-10" });
    expect(orderedRange("2026-10-09", "2026-10-06")).toEqual({ start: "2026-10-06", end: "2026-10-09" });
  });
});

describe("festivos", () => {
  const holidays = new Set(["2026-10-12"]);

  it("no cuentan como días de vacaciones", () => {
    expect(businessDays({ start_date: "2026-10-12", end_date: "2026-10-16" }, holidays)).toBe(4);
    expect(
      validateNewRequest(
        { start_date: "2026-10-12", end_date: "2026-10-12" },
        [],
        { allowance: 22, used: 0, pending: 0, available: 22 },
        "2026-10-01",
        holidays,
      ),
    ).toBe("no_business_days");
  });

  it("no se planifica trabajo en un festivo", () => {
    const load = weeklyLoad(
      [{ membership_id: "ana", estimated_hours: 8, start_date: "2026-10-12", due_date: "2026-10-13" }],
      weeksOfMonth("2026-10-01"),
      holidays,
    );
    expect(load.get("ana")![2]).toBe(8); // semana del 12: todo el 13
  });
});
