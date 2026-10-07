import { describe, expect, it } from "vitest";
import { isNoise, normalizeError } from "./normalize";

describe("normalizeError", () => {
  it("toma mensaje, stack y nombre de un Error", () => {
    const r = normalizeError(new TypeError("x is undefined"), { donde: "foro" });
    expect(r.message).toBe("x is undefined");
    expect(r.stack).toContain("TypeError");
    expect(r.context).toEqual({ donde: "foro", name: "TypeError" });
  });

  it("guarda el digest de los errores de Server Components", () => {
    const err = Object.assign(new Error("An error occurred in the Server Components render"), { digest: "123456" });
    expect(normalizeError(err).digest).toBe("123456");
  });

  it("de un error de la base guarda code, details y hint", () => {
    const r = normalizeError({ message: "column x does not exist", code: "42703", hint: "Perhaps you meant y" });
    expect(r.message).toBe("column x does not exist");
    expect(r.context).toEqual({ code: "42703", hint: "Perhaps you meant y" });
  });

  it("acepta cualquier cosa lanzada y recorta los textos largos", () => {
    expect(normalizeError("falló").message).toBe("falló");
    expect(normalizeError({ raro: true }).message).toBe('{"raro":true}');
    expect(normalizeError("a".repeat(5000)).message).toHaveLength(1000);
  });
});

describe("isNoise", () => {
  it("descarta lo que no es un fallo de la app", () => {
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isNoise("Script error.")).toBe(true);
    expect(isNoise("NEXT_REDIRECT")).toBe(true);
  });

  it("deja pasar los errores reales", () => {
    expect(isNoise("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
});
