import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isGroupEnabled, MUTABLE_KINDS, NOTIFICATION_GROUPS } from "./notification-prefs";

const group = (key: string) => NOTIFICATION_GROUPS.find((g) => g.key === key)!;

describe("preferencias de avisos", () => {
  it("coincide con la lista que valida la base (migración 0021)", () => {
    const sql = readFileSync("supabase/migrations/0021_profile_preferences.sql", "utf8");
    const list = sql.match(/select array\[([\s\S]*?)\]::text\[\]/)?.[1] ?? "";
    const kinds = [...list.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]);
    expect([...kinds].sort()).toEqual([...MUTABLE_KINDS].sort());
  });

  it("lo que pide una acción nunca se puede silenciar", () => {
    for (const kind of ["vacation.requested", "vacation.escalated", "time.correction_requested", "vacation.decided"]) {
      expect(MUTABLE_KINDS).not.toContain(kind);
    }
  });

  it("un grupo está activo mientras no se silencie ninguno de sus avisos", () => {
    expect(isGroupEnabled(group("forum"), [])).toBe(true);
    expect(isGroupEnabled(group("forum"), ["forum.notice"])).toBe(false);
    expect(isGroupEnabled(group("mentions"), ["forum.reply"])).toBe(true);
  });
});
