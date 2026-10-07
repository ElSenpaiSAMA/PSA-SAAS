import { describe, expect, it } from "vitest";
import {
  clockState,
  closedMinutes,
  entryMinutes,
  findOpenEntry,
  formatMinutes,
  isSameDay,
  periodActivity,
  startOfWeek,
  totalMinutes,
  weekTotals,
  workloadLevel,
  workloadPercent,
} from "./time";

const now = new Date("2026-10-05T18:00:00Z");

describe("entryMinutes", () => {
  it("calcula la duración de una entrada cerrada", () => {
    expect(
      entryMinutes({ started_at: "2026-10-05T09:00:00Z", ended_at: "2026-10-05T13:30:00Z" }, now),
    ).toBe(270);
  });

  it("usa `now` para una entrada abierta (fichaje en curso)", () => {
    expect(entryMinutes({ started_at: "2026-10-05T17:15:00Z", ended_at: null }, now)).toBe(45);
  });

  it("nunca devuelve negativos", () => {
    expect(
      entryMinutes({ started_at: "2026-10-05T19:00:00Z", ended_at: "2026-10-05T18:00:00Z" }, now),
    ).toBe(0);
  });
});

describe("totalMinutes", () => {
  it("suma varias entradas", () => {
    const entries = [
      { started_at: "2026-10-05T09:00:00Z", ended_at: "2026-10-05T13:00:00Z" },
      { started_at: "2026-10-05T14:00:00Z", ended_at: null },
    ];
    expect(totalMinutes(entries, now)).toBe(240 + 240);
  });
});

describe("formatMinutes", () => {
  it.each([
    [0, "0m"],
    [45, "45m"],
    [60, "1h"],
    [485, "8h 05m"],
  ])("%i → %s", (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });
});

describe("workload", () => {
  it("calcula porcentaje sobre capacidad semanal", () => {
    expect(workloadPercent(20 * 60, 40)).toBe(50);
    expect(workloadPercent(44 * 60, 40)).toBe(110);
    expect(workloadPercent(100, 0)).toBe(0);
  });

  it("clasifica el nivel de carga", () => {
    expect(workloadLevel(10)).toBe("low");
    expect(workloadLevel(60)).toBe("healthy");
    expect(workloadLevel(90)).toBe("high");
    expect(workloadLevel(120)).toBe("overloaded");
  });
});

describe("startOfWeek", () => {
  it("devuelve el lunes a las 00:00", () => {
    const monday = startOfWeek(new Date(2026, 9, 8, 15, 30)); // jueves 8/10/2026
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(5);
    expect(monday.getHours()).toBe(0);
  });

  it("si es domingo, vuelve al lunes anterior", () => {
    expect(startOfWeek(new Date(2026, 9, 11)).getDate()).toBe(5);
  });
});

describe("weekTotals", () => {
  it("agrupa fichaje y horas de tarea por día de la semana", () => {
    const monday = new Date(2026, 9, 5);
    const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
    const totals = weekTotals(
      [
        { entry_type: "clock", started_at: at(5, 9), ended_at: at(5, 17) },
        { entry_type: "task", started_at: at(5, 10), ended_at: at(5, 12, 30) },
        { entry_type: "clock", started_at: at(7, 9), ended_at: at(7, 13) },
        { entry_type: "clock", started_at: at(12, 9), ended_at: at(12, 10) }, // semana siguiente
      ],
      monday,
    );
    expect(totals).toHaveLength(7);
    expect(totals[0]).toMatchObject({ clockMinutes: 480, taskMinutes: 150 });
    expect(totals[2]).toMatchObject({ clockMinutes: 240, taskMinutes: 0 });
    expect(totals.reduce((s, d) => s + d.clockMinutes, 0)).toBe(720);
  });
});

describe("pausas", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m).toISOString();

  it("una jornada con almuerzo: el trabajo y la pausa se suman aparte", () => {
    const day = [
      { entry_type: "clock" as const, started_at: at(9), ended_at: at(13) },
      { entry_type: "break" as const, started_at: at(13), ended_at: at(14) },
      { entry_type: "clock" as const, started_at: at(14), ended_at: at(18) },
    ];
    const [monday] = weekTotals(day, new Date(2026, 9, 5));
    expect(monday).toMatchObject({ clockMinutes: 480, breakMinutes: 60, taskMinutes: 0 });
    expect(closedMinutes(day, "clock")).toBe(480);
  });

  it("deduce el estado del fichaje del tramo abierto", () => {
    expect(clockState([{ entry_type: "clock", started_at: at(9), ended_at: at(13) }])).toEqual({ status: "off" });
    expect(clockState([{ entry_type: "break", started_at: at(13), ended_at: null }])).toEqual({ status: "paused", since: at(13) });
    expect(
      clockState([
        { entry_type: "task", started_at: at(10), ended_at: null },
        { entry_type: "clock", started_at: at(14), ended_at: null },
      ]),
    ).toEqual({ status: "working", since: at(14) });
  });
});

describe("isSameDay", () => {
  it("compara fecha local ignorando la hora", () => {
    expect(isSameDay(new Date(2026, 9, 5, 1), new Date(2026, 9, 5, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 5), new Date(2026, 9, 6))).toBe(false);
  });
});

describe("findOpenEntry", () => {
  it("encuentra el fichaje abierto", () => {
    const open = { started_at: "x", ended_at: null };
    expect(findOpenEntry([{ started_at: "x", ended_at: "y" }, open])).toBe(open);
    expect(findOpenEntry([{ started_at: "x", ended_at: "y" }])).toBeUndefined();
  });
});

describe("periodActivity", () => {
  it("resume fichaje, pausas, días trabajados y horas por tarea", () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
    const a = periodActivity([
      { entry_type: "clock", task_id: null, started_at: at(5, 9), ended_at: at(5, 13) },
      { entry_type: "break", task_id: null, started_at: at(5, 13), ended_at: at(5, 14) },
      { entry_type: "clock", task_id: null, started_at: at(5, 14), ended_at: at(5, 18) },
      { entry_type: "clock", task_id: null, started_at: at(6, 9), ended_at: at(6, 11) },
      { entry_type: "task", task_id: "t1", started_at: at(5, 12), ended_at: at(5, 15) },
      { entry_type: "task", task_id: "t1", started_at: at(6, 12), ended_at: at(6, 13) },
    ]);
    expect(a).toMatchObject({ clockMinutes: 600, breakMinutes: 60, taskMinutes: 240, daysWorked: 2 });
    expect(a.byTask.get("t1")).toBe(240);
  });
});
