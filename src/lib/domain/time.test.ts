import { describe, expect, it } from "vitest";
import {
  entryMinutes,
  findOpenEntry,
  formatMinutes,
  startOfWeek,
  totalMinutes,
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

describe("findOpenEntry", () => {
  it("encuentra el fichaje abierto", () => {
    const open = { started_at: "x", ended_at: null };
    expect(findOpenEntry([{ started_at: "x", ended_at: "y" }, open])).toBe(open);
    expect(findOpenEntry([{ started_at: "x", ended_at: "y" }])).toBeUndefined();
  });
});
