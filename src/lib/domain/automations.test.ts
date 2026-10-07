import { describe, expect, it } from "vitest";
import { AUTOMATIONS, effectiveConfig, fillText, parseParams } from "./automations";

describe("automatizaciones", () => {
  it("el catálogo de la app coincide con las 9 reglas de la base", () => {
    expect(AUTOMATIONS.map((a) => a.key).sort()).toEqual(
      [
        "tasks.due_reminder",
        "team.weekly_summary",
        "time.auto_close_clock",
        "time.clock_out_reminder",
        "vacations.auto_approve_short",
        "vacations.escalate_stale",
        "work_orders.auto_close",
        "work_orders.budget_alert",
        "work_orders.recurring",
      ].sort(),
    );
  });

  it("completa los textos con los parámetros configurados", () => {
    expect(fillText("Lleva más de {max_hours} horas abierto", { max_hours: 10 })).toBe("Lleva más de 10 horas abierto");
    expect(fillText("Sin {x}", {})).toBe("Sin {x}");
  });

  it("la configuración de la empresa pisa los valores por defecto, campo por campo", () => {
    const template = { default_enabled: false, default_params: { max_days: 1, min_notice_days: 2 } };
    expect(effectiveConfig(template, undefined)).toEqual({ enabled: false, params: { max_days: 1, min_notice_days: 2 } });
    expect(effectiveConfig(template, { enabled: true, params: { max_days: 2 } })).toEqual({
      enabled: true,
      params: { max_days: 2, min_notice_days: 2 },
    });
  });

  it("valida los parámetros editables contra sus límites", () => {
    expect(parseParams("time.auto_close_clock", { max_hours: "10" })).toEqual({ ok: true, params: { max_hours: 10 } });
    expect(parseParams("time.auto_close_clock", { max_hours: "2" })).toEqual({ ok: false, errors: { max_hours: "Entre 4 y 24" } });
    expect(parseParams("time.auto_close_clock", { max_hours: "1.5" })).toEqual({ ok: false, errors: { max_hours: "Ingresá un número entero" } });
    expect(parseParams("nope", {})).toEqual({ ok: false, errors: { _: "Automatización desconocida" } });
  });
});
