import { expect, test, type Page } from "@playwright/test";

// Flujos autenticados contra Supabase real con el seed demo (supabase/seed.sql).
// Solo corren cuando CI levanta la base: E2E_SUPABASE=1.
test.skip(!process.env.E2E_SUPABASE, "Requiere Supabase local con datos demo");
// Serial y sin reintentos: los tests modifican datos y dependen del orden
test.describe.configure({ mode: "serial", retries: 0 });

const NEBULA = "aaaaaaaa-0000-0000-0000-000000000001";
const ORBITAL = "aaaaaaaa-0000-0000-0000-000000000002";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("Demo1234!");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page).toHaveURL(/\/(select-organization|app\/)/);
}

test("credenciales inválidas muestran un error genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ana@demo.com");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
});

test("un usuario en dos empresas elige con cuál trabajar", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await expect(page).toHaveURL(/\/select-organization/);
  await expect(page.getByRole("link", { name: /Nébula Studio/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Orbital Labs/ })).toBeVisible();
  await page.getByRole("link", { name: /Orbital Labs/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${ORBITAL}/dashboard`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola, Carlos");
});

test("empleada ficha entrada y salida", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  await page.getByRole("button", { name: "Fichar entrada" }).click();
  await expect(page.getByText("Entrada registrada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fichar salida" })).toBeVisible();
  await page.getByRole("button", { name: "Fichar salida" }).click();
  await expect(page.getByText("Salida registrada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fichar entrada" })).toBeVisible();
});

test("empleada solicita vacaciones y quedan pendientes", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/vacations`);
  const start = new Date();
  start.setDate(start.getDate() + 70);
  while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
  const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  await page.getByLabel("Desde").fill(iso);
  await page.getByLabel("Hasta").fill(iso);
  await expect(page.getByText("1 día hábil")).toBeVisible();
  await page.getByRole("button", { name: "Solicitar vacaciones" }).click();
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible();
});

test("el manager aprueba vacaciones de su equipo", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/vacations`);
  await expect(page.getByText(/Por aprobar/)).toBeVisible();
  await page.getByRole("button", { name: "Aprobar" }).first().click();
  await expect(page.getByText("Vacaciones aprobadas")).toBeVisible();
});

test("un empleado no accede a la auditoría", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/audit`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByRole("link", { name: "Auditoría" })).toHaveCount(0);
});

test("un empleado no puede entrar a una empresa ajena", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${ORBITAL}/dashboard`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("una admin ve la auditoría con la actividad reciente", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/audit`);
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  await expect(page.getByText("aprobó una solicitud de vacaciones").first()).toBeVisible();
});

const projectNames = (page: Page) => page.locator("a[href*='/projects/'] p.font-semibold").allTextContents();

test("una empleada solo ve los proyectos donde es miembro", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("Rediseño portal clientes")).toBeVisible();
  expect(await projectNames(page)).toEqual(["Rediseño portal clientes"]);
  // Un proyecto ajeno no es accesible ni por URL
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("el responsable ve los proyectos de su departamento y suma miembros", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("API de pagos v2")).toBeVisible();
  expect((await projectNames(page)).sort()).toEqual(["API de pagos v2", "Rediseño portal clientes"]);

  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await page.getByLabel("Persona a sumar").selectOption({ label: "Ana Torres" });
  await page.getByRole("button", { name: "Sumar al proyecto" }).click();
  await expect(page.getByText("Miembro agregado")).toBeVisible();
});

test("la empleada pasa a ver el proyecto al que la sumaron", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("API de pagos v2")).toBeVisible();
});

test("una admin crea un departamento con responsable", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/employees`);
  await page.getByRole("tab", { name: "Departamentos" }).click();
  await page.getByRole("button", { name: "Nuevo departamento" }).click();
  await page.getByLabel("Nombre").fill("Ventas");
  await page.getByLabel("Responsable").selectOption({ label: "Diego Fernández" });
  await page.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByText('Departamento "Ventas" creado')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ventas" })).toBeVisible();
});

test("una invitación pendiente se acepta desde el selector", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto("/select-organization?new=1");
  await expect(page.getByText(/Te invitaron como empleado/)).toBeVisible();
  await page.getByRole("button", { name: "Aceptar" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${ORBITAL}/dashboard`));
});
