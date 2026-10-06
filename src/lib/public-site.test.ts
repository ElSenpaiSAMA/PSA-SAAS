import { describe, expect, it } from "vitest";
import { isPublicSitePath } from "./public-site";

describe("web pública", () => {
  it("la home y el contacto son públicas (con o sin barra final)", () => {
    expect(isPublicSitePath("/")).toBe(true);
    expect(isPublicSitePath("/contacto")).toBe(true);
    expect(isPublicSitePath("/contacto/")).toBe(true);
  });

  it("el login y la intranet no lo son", () => {
    expect(isPublicSitePath("/login")).toBe(false);
    expect(isPublicSitePath("/app/x/dashboard")).toBe(false);
    expect(isPublicSitePath("/contactos")).toBe(false);
    expect(isPublicSitePath(null)).toBe(false);
  });
});
