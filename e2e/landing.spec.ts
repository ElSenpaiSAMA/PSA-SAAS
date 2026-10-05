import { expect, test } from "@playwright/test";

test.describe("landing pública", () => {
  test("muestra el hero y los CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("en orden");
    await expect(page.getByRole("link", { name: /crear mi organización/i })).toBeVisible();
  });

  test("el CTA principal lleva al registro", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /crear mi organización/i }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: /creá tu cuenta/i })).toBeVisible();
  });

  test("las secciones del producto están presentes", async ({ page }) => {
    await page.goto("/");
    for (const id of ["producto", "como-funciona", "seguridad"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });
});

test.describe("rutas protegidas", () => {
  test("sin sesión, /app redirige a login conservando el destino", async ({ page }) => {
    await page.goto("/app/aaaaaaaa-0000-0000-0000-000000000001/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2F/);
  });

  test("sin sesión, el selector de organización redirige a login", async ({ page }) => {
    await page.goto("/select-organization");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("formularios de auth", () => {
  test("login valida campos en el servidor", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /ingresar/i }).click();
    await expect(page.getByText("Revisá los campos marcados.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });

  test("registro muestra los requisitos de contraseña en vivo", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Contraseña", { exact: true }).fill("abc12345");
    const rules = page.getByRole("list", { name: /requisitos de contraseña/i });
    await expect(rules.getByText("8+ caracteres")).toHaveClass(/text-success/);
    await expect(rules.getByText("Un número")).toHaveClass(/text-success/);
  });
});
