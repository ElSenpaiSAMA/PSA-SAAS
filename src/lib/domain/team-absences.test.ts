import { describe, expect, it } from "vitest";
import { absenceGrid, overlappingPeople, type AbsenceRequest } from "./team-absences";

const req = (id: string, who: string, start: string, end: string, status = "approved"): AbsenceRequest => ({
  id,
  membership_id: who,
  start_date: start,
  end_date: end,
  status,
});

describe("calendario de ausencias del equipo", () => {
  it("arma un día por fecha del mes, marcando fines de semana y festivos", () => {
    const { days } = absenceGrid([], [], "2026-10-01", new Set(["2026-10-12"]));
    expect(days).toHaveLength(31);
    expect(days[0]).toMatchObject({ date: "2026-10-01", day: 1, weekday: 3, weekend: false });
    expect(days[3]).toMatchObject({ date: "2026-10-04", weekend: true });
    expect(days[11]).toMatchObject({ date: "2026-10-12", holiday: true });
  });

  it("pinta aprobadas y pendientes por persona; lo aprobado manda si se superponen", () => {
    const { rows } = absenceGrid(
      ["ana", "diego"],
      [
        req("1", "ana", "2026-10-05", "2026-10-07"),
        req("2", "ana", "2026-10-07", "2026-10-09", "pending"),
        req("3", "diego", "2026-09-28", "2026-10-02", "rejected"),
      ],
      "2026-10-01",
      new Set(),
    );
    const ana = rows[0].cells;
    expect(ana.slice(4, 9)).toEqual(["approved", "approved", "approved", "pending", "pending"]);
    expect(rows[0]).toMatchObject({ approvedDays: 3, pendingDays: 2 });
    expect(rows[1].cells.every((c) => c === null)).toBe(true);
  });

  it("no cuenta fines de semana ni festivos como días de ausencia", () => {
    const { rows } = absenceGrid(["ana"], [req("1", "ana", "2026-10-09", "2026-10-13")], "2026-10-01", new Set(["2026-10-12"]));
    // 9 (vie) y 13 (mar): 2 días hábiles; 10-11 fin de semana, 12 festivo
    expect(rows[0].approvedDays).toBe(2);
  });

  it("detecta quién más del equipo está ausente esos días", () => {
    const all = [
      req("p", "ana", "2026-10-20", "2026-10-22", "pending"),
      req("a", "diego", "2026-10-22", "2026-10-23"),
      req("b", "carlos", "2026-10-23", "2026-10-24", "pending"),
      req("c", "sofia", "2026-10-21", "2026-10-21", "rejected"),
      req("d", "ana", "2026-10-21", "2026-10-21"),
    ];
    expect(overlappingPeople(all[0], all)).toEqual(["diego"]);
  });
});
