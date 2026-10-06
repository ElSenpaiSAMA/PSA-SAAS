import { describe, expect, it } from "vitest";
import { dayRow, daySegments, formatBalance, taskGrid, timelineWindow, weekDays, weekSummary, type Entry } from "./timesheet";

// Fechas locales: el registro se calcula en el navegador, con su zona horaria
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const monday = new Date(2026, 9, 5); // lunes 5 de octubre de 2026
const now = new Date(2026, 9, 7, 12, 0); // miércoles al mediodía

const entries: Entry[] = [
  // Lunes: 09:00–13:30, pausa, 14:15–18:00 → 8h15m trabajadas, 45m de pausa
  { id: "a", entry_type: "clock", started_at: at(5, 9), ended_at: at(5, 13, 30) },
  { id: "b", entry_type: "break", started_at: at(5, 13, 30), ended_at: at(5, 14, 15) },
  { id: "c", entry_type: "clock", started_at: at(5, 14, 15), ended_at: at(5, 18) },
  // Martes: solo 09:00–14:00 → incompleta
  { id: "d", entry_type: "clock", started_at: at(6, 9), ended_at: at(6, 14) },
  // Miércoles: en curso desde las 08:30
  { id: "e", entry_type: "clock", started_at: at(7, 8, 30), ended_at: null },
  // Horas imputadas a tareas
  { id: "t1", entry_type: "task", task_id: "pota", started_at: at(5, 9), ended_at: at(5, 13) },
  { id: "t2", entry_type: "task", task_id: "pota", started_at: at(6, 9), ended_at: at(6, 11) },
  { id: "t3", entry_type: "task", task_id: "gen", started_at: at(6, 11), ended_at: at(6, 14) },
];

const ctx = {
  now,
  expectedPerDayMin: 480,
  holidays: new Map([["2026-10-12", "Fiesta Nacional"]]),
  absences: new Map([["2026-10-09", "Vacaciones"]]),
};

describe("registro semanal", () => {
  const days = weekDays(monday);

  it("arma los 7 días de lunes a domingo", () => {
    expect(days.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("calcula tramos, trabajado, pausas y saldo de un día completo", () => {
    const r = dayRow(entries, days[0], ctx);
    expect(r.segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["work", 540, 810],
      ["break", 810, 855],
      ["work", 855, 1080],
    ]);
    expect(r).toMatchObject({ workedMin: 495, breakMin: 45, expectedMin: 480, balanceMin: 15, status: "complete" });
  });

  it("marca jornadas cortas, en curso, futuras y ausencias", () => {
    expect(dayRow(entries, days[1], ctx)).toMatchObject({ status: "short", balanceMin: -180 });
    expect(dayRow(entries, days[2], ctx)).toMatchObject({ status: "running", workedMin: 210, balanceMin: -270 });
    expect(dayRow(entries, days[3], ctx)).toMatchObject({ status: "future", balanceMin: null });
    expect(dayRow(entries, days[4], ctx)).toMatchObject({ status: "absence", note: "Vacaciones", expectedMin: 0 });
    expect(dayRow(entries, days[5], ctx)).toMatchObject({ status: "future", expectedMin: 0 });
  });

  it("un festivo no tiene horas previstas", () => {
    const next = weekDays(new Date(2026, 9, 12));
    expect(dayRow([], next[0], { ...ctx, now: new Date(2026, 9, 13) })).toMatchObject({ status: "holiday", note: "Fiesta Nacional", expectedMin: 0 });
  });

  it("un día laborable pasado sin fichajes queda como faltante", () => {
    expect(dayRow([], days[1], ctx)).toMatchObject({ status: "missing", balanceMin: -480 });
  });

  it("resume la semana con el saldo de los días transcurridos", () => {
    const rows = days.map((d) => dayRow(entries, d, ctx));
    expect(weekSummary(rows)).toEqual({ workedMin: 495 + 300 + 210, expectedMin: 480 * 4, balanceMin: 15 - 180 - 270, breakMin: 45, daysWorked: 3 });
  });

  it("la ventana del gráfico cubre de 7 a 20 h y se agranda si hace falta", () => {
    const rows = days.map((d) => dayRow(entries, d, ctx));
    expect(timelineWindow(rows)).toEqual({ from: 420, to: 1200 });
    const late = dayRow([{ id: "x", entry_type: "clock", started_at: at(5, 6, 30), ended_at: at(5, 21, 10) }], days[0], ctx);
    expect(timelineWindow([late])).toEqual({ from: 360, to: 1320 });
  });

  it("recorta un tramo que cruza la medianoche", () => {
    const night: Entry[] = [{ id: "n", entry_type: "clock", started_at: at(5, 22), ended_at: at(6, 2) }];
    expect(daySegments(night, days[0], now)[0]).toMatchObject({ start: 1320, end: 1440 });
    expect(daySegments(night, days[1], now)[0]).toMatchObject({ start: 0, end: 120 });
  });

  it("formatea el saldo con signo", () => {
    expect([formatBalance(90), formatBalance(-45), formatBalance(0), formatBalance(120)]).toEqual(["+1h 30m", "−45m", "0m", "+2h"]);
  });
});

describe("hoja de horas por tarea", () => {
  it("suma minutos por tarea y día, con totales", () => {
    const g = taskGrid(entries, weekDays(monday), now);
    expect(g.rows).toEqual([
      { taskId: "pota", perDay: [240, 120, 0, 0, 0, 0, 0], total: 360 },
      { taskId: "gen", perDay: [0, 180, 0, 0, 0, 0, 0], total: 180 },
    ]);
    expect(g.perDay).toEqual([240, 300, 0, 0, 0, 0, 0]);
    expect(g.total).toBe(540);
  });
});
