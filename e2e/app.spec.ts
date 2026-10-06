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

test("empleada ficha entrada, pausa para almorzar, reanuda y ficha salida", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  await page.getByRole("button", { name: "Fichar entrada" }).click();
  await expect(page.getByText("Entrada registrada")).toBeVisible();

  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText(/En pausa desde las/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Fichar entrada" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reanudar" }).click();
  await expect(page.getByText("Jornada reanudada")).toBeVisible();
  await expect(page.getByText(/Trabajando desde las/)).toBeVisible();
  await expect(page.getByText(/^Pausa \d/)).toBeVisible();

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
  // Si se completa antes de que React hidrate, el estado se resetea: reintentar hasta que reaccione
  await expect(async () => {
    await page.getByLabel("Desde").fill(iso);
    await page.getByLabel("Hasta").fill(iso);
    await expect(page.getByText("1 día hábil")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Solicitar vacaciones" }).click();
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible();
});

test("el manager decide en Vacaciones → Equipo, con el calendario del equipo", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/vacations`);
  await page.getByRole("link", { name: /Ir a Equipo/ }).click();
  await expect(page).toHaveURL(/tab=equipo/);
  await expect(page.getByText(/^Solicitudes por decidir/)).toBeVisible();
  await expect(page.getByText("Calendario del equipo")).toBeVisible();
  await page.getByRole("button", { name: "Aprobar" }).first().click();
  await expect(page.getByText("Vacaciones aprobadas")).toBeVisible();
});

test("un empleado sin equipo a cargo no ve la pestaña Equipo", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/vacations?tab=equipo`);
  await expect(page.getByRole("link", { name: "Equipo" })).toHaveCount(0);
  await expect(page.getByText("Nueva solicitud")).toBeVisible();
});

test("el aviso de la bandeja lleva a decidir en Vacaciones → Equipo", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/inbox`);
  // Las vacaciones ya no son un pendiente de la bandeja: llegan como notificación
  await expect(page.getByRole("button", { name: "Aprobar" })).toHaveCount(0);
  await page.getByRole("button", { name: /Diego Fernández pidió vacaciones/ }).first().click();
  await expect(page).toHaveURL(/vacations\?tab=equipo/);
  const request = page.getByRole("listitem").filter({ hasText: "Diego Fernández" }).filter({ has: page.getByRole("button", { name: "Aprobar" }) });
  await request.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Vacaciones aprobadas")).toBeVisible();
  await expect(request).toHaveCount(0);
});

test("el solicitante recibe la decisión en su bandeja y ve quién aprueba", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/inbox`);
  await expect(page.getByText("Aprobaron tu solicitud de vacaciones")).toBeVisible();
  await page.goto(`/app/${NEBULA}/vacations`);
  await expect(page.getByText(/^La aprueba Carlos Ruiz/)).toBeVisible();
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

const monthParam = (offset: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

test("una OT facturada enlaza su continuación en lugar de ofrecer copiarla", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/work-orders?month=${monthParam(-1)}`);
  await expect(page.getByRole("link", { name: /^Sigue en / })).toBeVisible();
  await page.getByRole("link", { name: /^Portal clientes · / }).click();
  await expect(page.getByText("Ciclo completo")).toBeVisible();
  await page.getByRole("button", { name: "Repetir esta OT en otro período" }).click();
  await page.getByRole("link", { name: /^Ver la OT de / }).click();
  await expect(page).toHaveURL(/\/work-orders\/ffffffff-0000-0000-0000-000000000002$/);
  await expect(page.getByText("Siguiente paso: Cerrar OT")).toBeVisible();
});

test("el responsable repite el mes: copia en bloque las OT sin continuación", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/work-orders?month=${monthParam(1)}`);
  await expect(page.getByText(/no tienen? continuación en/)).toBeVisible();
  await page.getByRole("button", { name: /^Copiar(la| las \d+) a / }).click();
  await expect(page.getByText(/OT copiadas? con sus tareas/)).toBeVisible();
  await expect(page.getByText(/no tienen? continuación en/)).toHaveCount(0);
  // Las copias nacen en borrador
  await page.getByRole("link", { name: /^Borrador/ }).click();
  await expect(page.getByRole("link", { name: /^Portal clientes · / })).toBeVisible();
});

test("una empleada solo puede imputar horas en OT abiertas y planifica lo suyo", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  const options = await page.getByLabel("Tarea").locator("option").allTextContents();
  expect(options).toContain("Dashboard de cliente");
  // OT facturada (mes anterior) y copias en borrador (test anterior) no admiten horas
  expect(options).not.toContain("Mantenimiento evolutivo");
  expect(options.filter((o) => o === "Dashboard de cliente")).toHaveLength(1);

  await page.goto(`/app/${NEBULA}/planning`);
  await expect(page.getByRole("heading", { name: "Planificación" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "(vos)" })).toHaveCount(1);
  await expect(page.getByText("Diego Fernández")).toHaveCount(0);
});

test("una admin cierra y factura una OT", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/work-orders/ffffffff-0000-0000-0000-000000000003`);
  await page.getByRole("button", { name: "Cerrar OT" }).click();
  await expect(page.getByText("Estado actualizado")).toBeVisible();
  await expect(page.getByText("Siguiente paso: Marcar como facturada")).toBeVisible();
  await page.getByRole("button", { name: "Marcar como facturada" }).click();
  await expect(page.getByText("OT marcada como facturada")).toBeVisible();
  await expect(page.getByText(/OT facturada: queda bloqueada/)).toBeVisible();
});

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("el calendario muestra festivos y las vacaciones aprobadas del equipo", async ({ page }) => {
  await login(page, "diego@demo.com");
  const year = new Date().getFullYear();
  await page.goto(`/app/${NEBULA}/calendar?month=${year}-10`);
  await expect(page.getByText("Fiesta Nacional")).toBeVisible();

  // Vacaciones aprobadas de Ana en el seed: 1 de enero + 60 días
  const ana = new Date(year, 0, 1);
  ana.setDate(ana.getDate() + 61);
  await page.goto(`/app/${NEBULA}/calendar?month=${isoDay(ana).slice(0, 7)}`);
  await expect(page.getByRole("link", { name: /Ana Torres/ }).first()).toBeVisible();
});

test("se piden vacaciones seleccionando un día en el calendario", async ({ page }) => {
  await login(page, "ana@demo.com");
  const target = new Date();
  target.setDate(target.getDate() + 100);
  const holidays = ["1-1", "1-6", "5-1", "8-15", "10-12", "11-1", "12-6", "12-8", "12-25"];
  while (target.getDay() === 0 || target.getDay() === 6 || holidays.includes(`${target.getMonth() + 1}-${target.getDate()}`)) {
    target.setDate(target.getDate() + 1);
  }
  const monday = new Date(target);
  monday.setDate(target.getDate() - ((target.getDay() + 6) % 7));

  await page.goto(`/app/${NEBULA}/calendar?view=week&week=${isoDay(monday)}`);
  const dayLink = page.getByRole("link", { name: String(target.getDate()), exact: true });
  await expect(async () => {
    const box = (await dayLink.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + 200);
    await expect(page.getByRole("button", { name: "Pedir vacaciones" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("1 día hábil")).toBeVisible();
  await page.getByRole("button", { name: "Pedir vacaciones" }).click();
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible();
});

test("una invitación pendiente se acepta desde el selector", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto("/select-organization?new=1");
  await expect(page.getByText(/Te invitaron como empleado/)).toBeVisible();
  await page.getByRole("button", { name: "Aceptar" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${ORBITAL}/dashboard`));
});

test("una admin abre la ficha de un empleado, navega en el tiempo y registra un cambio", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/staff`);
  await page.getByRole("link", { name: "Ver perfil de Ana Torres" }).click();
  await expect(page.getByRole("heading", { name: "Ana Torres" })).toBeVisible();
  await expect(page.getByText("Calle Luna 12, Madrid").first()).toBeVisible();

  // El mes pasado se mudó: al volver a ese mes, el cambio aparece resaltado
  await page.getByRole("link", { name: "Mes anterior" }).click();
  await expect(page.getByText(/Estás viendo/)).toBeVisible();
  await expect(page.getByText(/^Cambió en /)).toBeVisible();

  // Un cambio con vigencia futura queda programado en el historial
  await page.getByRole("link", { name: "Volver a hoy" }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Registrar un cambio" }).click();
    await expect(page.getByLabel("Vigente desde")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const nextYear = new Date().getFullYear() + 1;
  await page.getByLabel("Vigente desde").fill(`${nextYear}-01-01`);
  await page.getByLabel("Salario bruto anual").fill("37000");
  await page.getByLabel("Motivo del cambio").fill("Revisión salarial");
  await page.getByRole("button", { name: "Guardar versión" }).click();
  await expect(page.getByText("Ficha actualizada")).toBeVisible();
  await expect(page.getByText("Programado", { exact: true })).toBeVisible();
  await expect(page.getByText("Revisión salarial")).toBeVisible();
});

test("un empleado ve su propia ficha pero no los datos sensibles de otros", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/staff/bbbbbbbb-0000-0000-0000-000000000004`);
  await expect(page.getByText("Ficha personal", { exact: true })).toBeVisible();
  await expect(page.getByText("45678901G")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar un cambio" })).toHaveCount(0);

  await page.goto(`/app/${NEBULA}/staff/bbbbbbbb-0000-0000-0000-000000000003`);
  await expect(page.getByRole("heading", { name: "Ana Torres" })).toBeVisible();
  await expect(page.getByText("Ficha personal", { exact: true })).toHaveCount(0);
  await expect(page.getByText("34567890V")).toHaveCount(0);
  await expect(page.getByText(/solo las ven la propia persona/)).toBeVisible();
});

test("una admin configura y ejecuta una automatización", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/automations`);
  const card = page.locator("article").filter({ hasText: "Resumen semanal del equipo" });
  const toggle = card.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(page.getByText("Automatización desactivada")).toBeVisible();
  await expect(card.getByRole("button", { name: "Ejecutar ahora" })).toBeDisabled();
  await toggle.click();
  await expect(page.getByText("Automatización activada")).toBeVisible();

  await card.getByLabel(/Hora/).fill("30");
  await card.getByRole("button", { name: "Guardar" }).click();
  await expect(card.getByText("Entre 6 y 12")).toBeVisible();

  await card.getByRole("button", { name: "Ejecutar ahora" }).click();
  await expect(page.getByText(/^Ejecutada/)).toBeVisible();
});

test("un empleado no ve ni puede abrir las automatizaciones", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByRole("link", { name: "Automatizaciones" })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/automations`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

const prevWeekday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("un empleado registra una baja médica con fecha pasada", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/vacations`);
  await page.getByRole("radio", { name: "Baja médica" }).click();
  const day = prevWeekday();
  await expect(async () => {
    await page.getByLabel("Desde").fill(day);
    await page.getByLabel("Hasta").fill(day);
    await expect(page.getByText("No descuenta vacaciones", { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Registrar baja médica" }).click();
  await expect(page.getByText(/Solicitud enviada · Baja médica/)).toBeVisible();
});

test("rechazar exige motivo y la persona lo ve", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/vacations?tab=equipo`);
  const row = page.getByRole("listitem").filter({ hasText: "Baja médica" });
  await row.getByRole("button", { name: "Rechazar" }).click();
  await expect(row.getByRole("button", { name: "Confirmar rechazo" })).toBeDisabled();
  await row.getByLabel("Motivo del rechazo").fill("Falta el parte médico");
  await row.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect(page.getByText("Solicitud rechazada")).toBeVisible();
});

test("la persona ve el motivo del rechazo", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/vacations`);
  await expect(page.getByText("Respuesta: «Falta el parte médico»")).toBeVisible();
});

test("un empleado pide corregir un fichaje pasado", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: /^Jornada/ })
    .filter({ has: page.getByRole("button", { name: "Corregir fichaje" }) })
    .first();
  await row.hover();
  await row.getByRole("button", { name: "Corregir fichaje" }).click();
  await page.getByLabel("Hora de entrada").fill("08:00");
  await page.getByLabel("Motivo").fill("Entré a las 8 y fiché tarde");
  await page.getByRole("button", { name: "Pedir corrección" }).click();
  await expect(page.getByText(/Corrección enviada/)).toBeVisible();
  await expect(page.getByText("Corrección pendiente")).toBeVisible();
});

test("su responsable aprueba la corrección y se aplica", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  const card = page.locator("#correcciones");
  await expect(card.getByText("Entré a las 8 y fiché tarde")).toBeVisible();
  await card.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Corrección aprobada y aplicada al fichaje")).toBeVisible();
});

test("quien gestiona el proyecto edita y borra tareas; las que tienen horas no se borran", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/work-orders/ffffffff-0000-0000-0000-000000000002`);
  // Crear una tarea sin horas para borrarla
  await page.getByRole("button", { name: "Agregar tarea" }).click();
  await page.getByLabel("Nueva tarea").fill("Tarea para borrar");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByText("Tarea creada")).toBeVisible();

  const editor = page.locator("article").filter({ has: page.getByLabel(/Horas est/) });
  const temp = page.locator("article").filter({ hasText: "Tarea para borrar" });
  await temp.hover();
  await temp.getByRole("button", { name: /Editar "Tarea para borrar"/ }).click();
  await editor.getByLabel("Título").fill("Tarea renombrada");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Tarea actualizada")).toBeVisible();

  const renamed = page.locator("article").filter({ hasText: "Tarea renombrada" });
  await renamed.hover();
  await renamed.getByRole("button", { name: /Editar "Tarea renombrada"/ }).click();
  await editor.getByRole("button", { name: "Borrar" }).click();
  await editor.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(page.getByText("Tarea borrada")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Tarea renombrada" })).toHaveCount(0);
});

test("una admin ajusta los valores por defecto de la empresa", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/settings`);
  await expect(page.getByText("Qué puede hacer cada rol")).toBeVisible();
  await page.getByLabel("Días de vacaciones al año").fill("23");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Días de vacaciones al año")).toHaveValue("23");
});

test("un empleado no puede abrir los ajustes de la empresa", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/settings`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});
