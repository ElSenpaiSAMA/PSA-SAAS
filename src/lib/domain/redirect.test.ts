import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("acepta rutas internas", () => {
    expect(safeNextPath("/app/123/dashboard")).toBe("/app/123/dashboard");
    expect(safeNextPath("/app?tab=1")).toBe("/app?tab=1");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "/app\n/evil",
    "",
    null,
    undefined,
  ])("rechaza %s", (value) => {
    expect(safeNextPath(value)).toBe("/select-organization");
  });
});
