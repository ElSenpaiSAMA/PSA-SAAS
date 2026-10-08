import { describe, expect, it } from "vitest";
import { isPublicSitePath } from "./public-site";

describe("web pública", () => {
  it("la home, el contacto y la entrada a la intranet son públicas (con o sin barra final)", () => {
    expect(isPublicSitePath("/")).toBe(true);
    expect(isPublicSitePath("/login")).toBe(true);
    expect(isPublicSitePath("/signup")).toBe(true);
    expect(isPublicSitePath("/contacto")).toBe(true);
    expect(isPublicSitePath("/contacto/")).toBe(true);
    expect(isPublicSitePath("/electromotor")).toBe(true);
    expect(isPublicSitePath("/diplonautic")).toBe(true);
  });

  it("la intranet no lo es", () => {
    expect(isPublicSitePath("/app/x/dashboard")).toBe(false);
    expect(isPublicSitePath("/contactos")).toBe(false);
    expect(isPublicSitePath(null)).toBe(false);
  });
});
