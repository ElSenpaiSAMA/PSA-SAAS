import { expect, test } from "@playwright/test";

test.describe("web pública", () => {
  test("la home presenta la empresa y sus servicios", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("para zarpar");
    for (const id of ["servicios", "empresa", "proceso"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.getByRole("heading", { name: "Potabilizadoras" })).toBeVisible();
  });

  test("el CTA principal lleva al contacto", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: /pedir presupuesto/i }).first().click();
    await expect(page).toHaveURL(/\/contacto$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("le pasa a tu barco");
  });

  test("la banda ElectroMotor lleva a su página y el presupuesto llega con el servicio elegido", async ({ page }) => {
    await page.goto("/");
    await page.locator("#servicios").getByRole("link", { name: /ElectroMotor/ }).click();
    await expect(page).toHaveURL(/\/electromotor$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("por dentro");

    await page.getByRole("tab", { name: "Motores de arranque" }).click();
    await expect(page.getByText("Cuando el motor hace clic y no gira")).toBeVisible();

    await page.getByRole("main").getByRole("link", { name: /pedir presupuesto/i }).first().click();
    await expect(page).toHaveURL(/\/contacto\?servicio=electromotor$/);
    await expect(page.getByLabel("Servicio")).toHaveValue("ElectroMotor: arranque, alternador o dinamo");
  });

  test("el acceso de empleados lleva al login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: /acceso/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("el formulario de contacto valida y confirma el envío", async ({ page }) => {
    await page.goto("/contacto");
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page.getByText("Contanos tu nombre")).toBeVisible();
    await expect(page.getByText("Necesitamos tu conformidad para responderte")).toBeVisible();

    await page.getByLabel("Nombre y apellido").fill("Marta Soler");
    // Email único por corrida: la base limita a 3 consultas por hora por email
    await page.getByLabel("Email").fill(`marta+${Date.now()}@correo.com`);
    await page.getByLabel("Tipo de barco").selectOption("Velero");
    await page.getByLabel("Servicio").selectOption("Generadores");
    await page.getByLabel("Mensaje").fill("El generador no arranca desde la última salida.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page.getByRole("status")).toContainText("Gracias, Marta");
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

  test("sin sesión, el foro interno redirige a login", async ({ page }) => {
    await page.goto("/app/aaaaaaaa-0000-0000-0000-000000000001/forum");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2F.*forum/);
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
