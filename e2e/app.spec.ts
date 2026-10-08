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

test("al iniciar sesión se entra directo a la intranet de Diplonautic", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola, Carlos");
  await expect(page.getByText("Intranet · Responsable de departamento")).toBeVisible();
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
  await expect(page.getByText(/^Pausa \d/).first()).toBeVisible();

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

// Tabla de proyectos: el enlace de cada fila es el nombre del proyecto
const projectNames = (page: Page) => page.locator("table a[href*='/projects/']").allTextContents();

test("una empleada solo ve los proyectos donde es miembro", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("Climatización Princess V58")).toBeVisible();
  expect(await projectNames(page)).toEqual(["Climatización Princess V58"]);
  // Un proyecto ajeno no es accesible ni por URL
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("el responsable ve los proyectos de su departamento y suma miembros", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("Refit eléctrico Lagoon 46")).toBeVisible();
  expect((await projectNames(page)).sort()).toEqual(["Climatización Princess V58", "Refit eléctrico Lagoon 46"]);

  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await page.getByLabel("Persona a invitar").selectOption({ label: "Ana Torres" });
  await page.getByRole("button", { name: "Invitar al proyecto" }).click();
  await expect(page.getByText("Invitación hecha: ya está en el proyecto")).toBeVisible();
});

test("la empleada pasa a ver el proyecto al que la sumaron", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("Refit eléctrico Lagoon 46")).toBeVisible();
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
  await page.getByRole("link", { name: /^Princess V58 · / }).click();
  await expect(page.getByText("Ciclo completo")).toBeVisible();
  await page.getByRole("button", { name: "Repetir esta OT en otro período" }).click();
  await page.getByRole("link", { name: /^Ver la OT de / }).click();
  await expect(page).toHaveURL(/\/work-orders\/princess-v58-[a-z0-9-]+$/);
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
  await expect(page.getByRole("link", { name: /^Princess V58 · / })).toBeVisible();
});

test("una empleada solo puede imputar horas en OT abiertas y no ve la planificación", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  // El formulario aparece con el registro semanal, que espera a hidratar (zona horaria del navegador)
  await expect(page.getByLabel("Tarea")).toBeVisible();
  const options = await page.getByLabel("Tarea").locator("option").allTextContents();
  expect(options).toContain("Instalación de unidades de 16.000 BTU");
  // OT facturada (mes anterior) y copias en borrador (test anterior) no admiten horas
  expect(options).not.toContain("Revisión del aire acondicionado");
  expect(options.filter((o) => o === "Instalación de unidades de 16.000 BTU")).toHaveLength(1);

  // La planificación es de quien organiza el trabajo de otros
  await expect(page.getByRole("link", { name: "Planificación" })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/planning`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
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
  // Carlos es el responsable del Taller: ve las vacaciones de su departamento (Diego ya encabeza otro)
  await login(page, "carlos@demo.com");
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

test("sin invitación no se puede activar una cuenta", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Nombre completo").fill("Persona Externa");
  await page.getByLabel("Email de trabajo").fill("externa@correo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Externa1234");
  await page.getByRole("button", { name: /activar cuenta/i }).click();
  await expect(page.getByText(/no tiene una invitación de Diplonautic/)).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("un técnico invitado activa su cuenta y entra directo a Diplonautic", async ({ page }) => {
  // El seed deja una invitación pendiente para marc.vidal@demo.com (técnico, a cargo de Carlos)
  await page.goto("/signup?email=marc.vidal@demo.com");
  await expect(page.getByLabel("Email de trabajo")).toHaveValue("marc.vidal@demo.com");
  await page.getByLabel("Nombre completo").fill("Marc Vidal");
  await page.getByLabel("Contraseña", { exact: true }).fill("Marc12345");
  await page.getByRole("button", { name: /activar cuenta/i }).click();

  // En CI la confirmación por email está desactivada y entra directo; en un proyecto
  // con confirmación, la cuenta queda creada y se pide confirmar el email
  const confirm = page.getByText("Te enviamos un email para confirmar tu cuenta.");
  await expect(page.getByRole("heading", { name: /Hola, Marc/ }).or(confirm)).toBeVisible();
  if (await confirm.isVisible()) return;
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByText("Intranet · Empleado")).toBeVisible();
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

test("un empleado ve su propia ficha, pero no el perfil de otros", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/staff/bbbbbbbb-0000-0000-0000-000000000004`);
  await expect(page.getByText("Ficha personal", { exact: true })).toBeVisible();
  await expect(page.getByText("45678901G")).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar un cambio" })).toHaveCount(0);

  // Diego no supervisa a Ana: en el directorio la ve, pero no puede abrir su perfil
  await page.goto(`/app/${NEBULA}/staff`);
  await expect(page.getByRole("cell", { name: /Ana Torres/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver perfil de Ana Torres" })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/staff/bbbbbbbb-0000-0000-0000-000000000003`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await expect(page.getByText("34567890V")).toHaveCount(0);
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
  // Los fichajes de días anteriores están en el registro semanal: semana pasada, detalle del lunes
  await page.goto(`/app/${NEBULA}/time-tracking`);
  await page.getByRole("link", { name: "Semana anterior" }).click();
  await expect(page).toHaveURL(/semana=/);
  await page.getByRole("button", { name: /Ver el detalle del lunes/ }).click();
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
  await expect(card.getByText("Entré a las 8 y fiché tarde").first()).toBeVisible();
  await card.getByRole("button", { name: "Aprobar" }).first().click();
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

test("la owner ve los tres informes y exporta la facturación a CSV", async ({ page }) => {
  await login(page, "laura@demo.com");
  await page.goto(`/app/${NEBULA}/reports`);
  const tabs = page.getByRole("navigation", { name: "Informes" });
  await expect(tabs.getByRole("link")).toHaveText(["Facturación", "Horas por persona", "Ausencias"]);
  await expect(page.getByRole("cell", { name: /Náutica Costa Brava/ }).first()).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Exportar a Excel/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^facturacion-\d{4}-\d{2}-diplonautic\.csv$/);
});

test("un empleado no ve los informes ni puede exportarlos", async ({ page }) => {
  // Ana: Diego ya no sirve acá, porque un test anterior lo hace responsable de departamento (y eso lo asciende a manager)
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByRole("link", { name: "Informes" })).toHaveCount(0);
  const res = await page.request.get(`/app/${NEBULA}/reports/export?type=horas`);
  expect(res.status()).toBe(403);
});

test("sin clave de IA, la app explica cómo activarla y no rompe nada", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByText("Con la IA activada, acá vas a tener un resumen redactado de tu equipo en un click.")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscá una página o acción…").fill("¿quién está de vacaciones?");
  await expect(page.getByText("El asistente IA no está activado (falta OPENROUTER_API_KEY)")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`/app/${NEBULA}/time-tracking`);
  await expect(page.getByText(/Con la IA activada, el asistente te propone cómo repartir/)).toBeVisible();
});

// ── Foro interno ─────────────────────────────────────────────
const FORUM_TITLE = "E2E: la bomba de achique no arranca";

test("una empleada abre una incidencia técnica en el foro", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/forum`);
  await expect(page.getByRole("link", { name: /Nuevo protocolo de seguridad en el varadero/ })).toBeVisible();
  await page.getByRole("link", { name: "Nuevo hilo" }).click();
  await page.getByLabel("Incidencia técnica").check();
  await page.getByLabel("Título").fill(FORUM_TITLE);
  await page.getByLabel("Mensaje").fill("En el Beneteau 40 la bomba no arranca con el flotador. Revisé el fusible.");
  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page).toHaveURL(/\/forum\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORUM_TITLE);
  // Sin moderación: no puede fijar ni cerrar
  await expect(page.getByRole("button", { name: "Fijar arriba" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cerrar hilo" })).toHaveCount(0);
});

test("un compañero responde el hilo", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/forum`);
  await page.getByPlaceholder(/Buscar/).fill("bomba achique");
  await page.getByRole("link", { name: new RegExp(FORUM_TITLE) }).click();
  await page.getByLabel("Tu respuesta").fill("Probá puentear el flotador: si arranca, es el interruptor.");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Respuesta publicada")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 respuesta" })).toBeVisible();
});

test("la administración cierra el hilo", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/forum`);
  await page.getByRole("link", { name: new RegExp(FORUM_TITLE) }).click();
  await page.getByRole("button", { name: "Cerrar hilo" }).click();
  await expect(page.getByText("Hilo cerrado: ya no admite respuestas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reabrir" })).toBeVisible();
});

test("la autora recibe el aviso de la respuesta y ya no puede responder", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/inbox`);
  await page.getByRole("button", { name: new RegExp(`respondió en «${FORUM_TITLE}»`) }).first().click();
  await expect(page).toHaveURL(/\/forum\/[0-9a-f-]{36}$/);
  await expect(page.getByText("La administración cerró este hilo: ya no admite respuestas.")).toBeVisible();
  await expect(page.getByLabel("Tu respuesta")).toHaveCount(0);
});

// ── Menciones y novedades del foro ───────────────────────────
const MENTION_TITLE = "E2E: revisión del generador con mención";

test("una empleada abre un hilo mencionando a un compañero", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/forum/new`);
  await page.getByLabel("Título").fill(MENTION_TITLE);
  const body = page.getByLabel("Mensaje");
  await body.click();
  await body.pressSequentially("Hola @Die");
  await page.getByRole("option", { name: "Diego Fernández" }).click();
  await body.pressSequentially("¿podés revisar el generador?");
  await page.getByRole("button", { name: "Publicar hilo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MENTION_TITLE);
  await expect(page.locator("article").getByText("@Diego Fernández")).toBeVisible();
});

test("al mencionado le llega el aviso y ve la novedad en el foro", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  const forumLink = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: /^Foro/ });
  await expect(forumLink).toHaveText(/Foro\s*\d+/);

  await page.goto(`/app/${NEBULA}/inbox`);
  await expect(page.getByRole("button", { name: new RegExp(`te mencionó en «${MENTION_TITLE}»`) })).toBeVisible();

  await page.goto(`/app/${NEBULA}/forum`);
  const item = page.getByRole("list", { name: "Hilos del foro" }).getByRole("listitem").filter({ hasText: MENTION_TITLE });
  await expect(item.getByText("Nuevo", { exact: true })).toBeVisible();
  // Al ver el foro, el aviso del menú vuelve a cero
  await expect(forumLink).toHaveText(/^Foro$/);
});

test("un técnico contesta una respuesta y la conversación se puede plegar", async ({ page }) => {
  await login(page, "ana@demo.com");
  // Hilo del seed: Carlos respondió sugiriendo un filtro de ruido
  await page.goto(`/app/${NEBULA}/forum/99999999-0000-0000-0000-000000000002`);
  await page.getByRole("button", { name: "Responder a Carlos Ruiz" }).first().click();
  await page.getByLabel("Respuesta a Carlos Ruiz").fill("E2E: a mí me pasó igual en un Lagoon 40, gracias.");
  // El botón del formulario anidado (la caja principal del hilo también dice "Responder")
  await page
    .locator("form", { has: page.getByLabel("Respuesta a Carlos Ruiz") })
    .getByRole("button", { name: "Responder", exact: true })
    .click();
  await expect(page.getByText("Respuesta publicada")).toBeVisible();
  await expect(page.getByText("E2E: a mí me pasó igual en un Lagoon 40, gracias.")).toBeVisible();

  await page.getByRole("button", { name: "Ocultar respuestas" }).first().click();
  await expect(page.getByText("E2E: a mí me pasó igual en un Lagoon 40, gracias.")).toHaveCount(0);
  await page.getByRole("button", { name: /Ver \d+ respuesta/ }).first().click();
  await expect(page.getByText("E2E: a mí me pasó igual en un Lagoon 40, gracias.")).toBeVisible();
});

test("una consulta de la web llega a Mensajes web y la administración la toma", async ({ page }) => {
  const name = `Capitán E2E ${Date.now()}`;
  await page.goto("/contacto");
  await page.getByLabel("Nombre y apellido").fill(name);
  await page.getByLabel("Email").fill(`capitan+${Date.now()}@correo.com`);
  await page.getByLabel("Tipo de barco").selectOption("Catamarán");
  await page.getByLabel("Servicio").selectOption("Potabilizadoras");
  await page.getByLabel("Mensaje").fill("E2E: quiero instalar una potabilizadora antes del verano.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(page.getByRole("status")).toContainText("Gracias, Capitán");

  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await page.getByRole("link", { name: /Mensajes web/ }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("E2E: quiero instalar una potabilizadora antes del verano.").last()).toBeVisible();
  await page.getByRole("button", { name: "Me ocupo yo" }).click();
  await expect(page.getByText("Consulta en curso")).toBeVisible();
  await expect(page.getByText(/La gestiona Sofía/)).toBeVisible();
});

test("una empleada no ve los mensajes de la web", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await expect(page.getByRole("link", { name: /Mensajes web/ })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/contact`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

// PNG de 8×8 px: alcanza para probar el recorte y la subida de la foto
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAJUlEQVR4nGPglrfilvfjlk/ili/jlu/ilp/HLb+JW/4Yw9CSAAAvuCqBc4oJSwAAAABJRU5ErkJggg==",
  "base64",
);

test("una empleada entra a su perfil desde el avatar y sube su foto; nombre y avisos los gestiona administración", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByText("Técnica de climatización")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: TINY_PNG });
  await expect(page.getByText("Foto actualizada.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Menú de usuario" }).locator("img")).toBeVisible();

  // Nombre y avisos los gestiona administración: se ven, pero no se pueden cambiar
  await expect(page.getByRole("textbox", { name: "Nombre y apellido" })).toHaveCount(0);
  const reminders = page.getByRole("switch", { name: "Recordatorios" });
  await expect(reminders).toHaveAttribute("aria-disabled", "true");
  await reminders.click({ force: true });
  await expect(reminders).toHaveAttribute("aria-checked", "true");
  // Lo que pide una acción ni siquiera aparece: no se puede silenciar
  await expect(page.getByRole("switch", { name: /vacaciones/i })).toHaveCount(0);
});

// ── Estructura: niveles, ramas y rol en cada proyecto ─────────

test("un técnico solo ve su día, el trabajo donde está y el espacio común", async ({ page }) => {
  await login(page, "ana@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const visible of ["Inicio", "Bandeja", "Fichaje y horas", "Calendario", "Foro", "Proyectos", "Órdenes de trabajo", "Vacaciones"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${visible}`) })).toBeVisible();
  }
  for (const hidden of ["Planificación", "Personas", "Informes", "Automatizaciones", "Ajustes", "Auditoría", "Mensajes web"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${hidden}`) })).toHaveCount(0);
  }
  // "Empleados" es solo un directorio
  await nav.getByRole("link", { name: /^Empleados/ }).click();
  await expect(page.getByRole("heading", { name: "Directorio" })).toBeVisible();
});

test("un externo no ve el foro, el calendario ni el directorio", async ({ page }) => {
  await login(page, "gestoria@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const hidden of ["Foro", "Calendario", "Empleados"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${hidden}`) })).toHaveCount(0);
  }
  await page.goto(`/app/${NEBULA}/forum`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("el director técnico ve los proyectos de su rama y la planificación, pero no gestiona personas", async ({ page }) => {
  await login(page, "jorge@demo.com");
  await page.goto(`/app/${NEBULA}/projects`);
  await expect(page.getByText("Climatización Princess V58")).toBeVisible();
  await expect(page.getByText("Formación interna")).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: /^Planificación/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Personas/ })).toHaveCount(0);
});

test("la CEO asigna la dirección de una rama: elige exactamente cuál", async ({ page }) => {
  await login(page, "laura@demo.com");
  await page.goto(`/app/${NEBULA}/employees`);
  await page.getByRole("button", { name: "Editar a Toni Ferrer" }).click();
  // El formulario de edición (en la misma página está también el de invitar)
  const form = page.locator("form").filter({ has: page.locator('input[name="membershipId"]') });
  await form.getByLabel("Nivel").selectOption("director");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Elegí qué rama dirige")).toBeVisible();
  await form.getByLabel("Rama que dirige").selectOption({ label: "Técnica" });
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(page.getByText("Dirección · Técnica").first()).toBeVisible();
});

test("el responsable de un proyecto invita a alguien; el equipo se ve también en sus OT", async ({ page }) => {
  await login(page, "diego@demo.com");
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await page.getByLabel("Persona a invitar").selectOption({ label: "Iván Soler" });
  // Quien solo lleva el proyecto no nombra responsables
  await expect(page.getByLabel("Rol en el proyecto").locator("option", { hasText: "Responsable" })).toHaveCount(0);
  await page.getByRole("button", { name: "Invitar al proyecto" }).click();
  await expect(page.getByText("Invitación hecha: ya está en el proyecto")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Iván Soler" })).toContainText("Miembro");

  // En las OT del proyecto aparece el mismo equipo (y, si la OT no está facturada, se invita desde ahí)
  await page.goto(`/app/${NEBULA}/work-orders`);
  await page.getByRole("link", { name: /^Lagoon 46 · / }).first().click();
  await expect(page.getByText(/^Equipo · /)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Iván Soler" })).toBeVisible();
});


test("el superadmin tiene acceso a todo, más errores y estructura", async ({ page }) => {
  await login(page, "dev@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  const nav = page.getByRole("navigation", { name: "Principal" });
  for (const visible of ["Inicio", "Foro", "Proyectos", "Personas", "Ajustes", "Auditoría", "Errores", "Estructura"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${visible}`) })).toBeVisible();
  }
  await nav.getByRole("link", { name: /^Errores/ }).click();
  await expect(page.getByRole("heading", { name: /Registro/ })).toBeVisible();

  await page.goto(`/app/${NEBULA}/structure`);
  await expect(page.getByRole("checkbox", { name: "Personas para Administración y RRHH" })).toBeChecked();

  // Elige sus propios avisos (al resto se los configura administración)
  await page.goto(`/app/${NEBULA}/profile`);
  const reminders = page.getByRole("switch", { name: "Recordatorios" });
  await expect(reminders).toHaveAttribute("aria-disabled", "false");
  await reminders.click();
  await expect(reminders).toHaveAttribute("aria-checked", "false");
});

test("el CEO no configura la plataforma", async ({ page }) => {
  await login(page, "laura@demo.com");
  await page.goto(`/app/${NEBULA}/dashboard`);
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: /^Auditoría/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Errores/ })).toHaveCount(0);
  await page.goto(`/app/${NEBULA}/structure`);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
});

test("RRHH elimina a una persona: confirma en dos pasos y desaparece de la empresa", async ({ page }) => {
  await login(page, "sofia@demo.com");
  await page.goto(`/app/${NEBULA}/employees`);
  await page.getByRole("button", { name: "Editar a Pol Serra" }).click();
  await page.getByRole("button", { name: "Eliminar persona" }).click();
  await expect(page.getByText(/Se borra la cuenta de Pol Serra/)).toBeVisible();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(page.getByText("Pol Serra fue eliminada.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar a Pol Serra" })).toHaveCount(0);
});

test("una persona eliminada ya no puede entrar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("pol@demo.com");
  await page.getByLabel("Contraseña").fill("Demo1234!");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
});

test("el responsable marca un proyecto como mensual: su OT se renueva sola", async ({ page }) => {
  await login(page, "carlos@demo.com");
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  const recurring = page.getByRole("switch", { name: "Renovar la OT cada mes" });
  await expect(recurring).toHaveAttribute("aria-checked", "false");
  await recurring.click();
  await expect(page.getByText("Listo: su OT se renueva sola cada mes")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Renovar la OT cada mes" })).toHaveAttribute("aria-checked", "true");
});

test("una OT se copia a otro mes desde su botón", async ({ page }) => {
  await login(page, "carlos@demo.com");
  // En el proyecto, la OT más reciente siempre se puede copiar (las del mes en curso ya
  // pueden tener su continuación por un test anterior)
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  // Si el click llega antes de hidratar, el menú no se abre: se reintenta
  const option = page.getByRole("menuitem").last();
  await expect(async () => {
    await page.getByRole("button", { name: "Copiar a otro mes" }).first().click();
    await expect(option).toBeVisible({ timeout: 2000 });
  }).toPass();
  const month = (await option.innerText()).trim();
  await option.click();
  // Se abre la OT nueva, con el mes elegido en el título
  await expect(page).toHaveURL(/\/work-orders\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(month.split(" ")[0]);
});

test("las URL de la intranet no llevan el id de la empresa; los enlaces viejos redirigen", async ({ page }) => {
  await login(page, "ana@demo.com");
  await expect(page).not.toHaveURL(new RegExp(NEBULA));
  await page.goto(`/app/${NEBULA}/inbox`);
  await expect(page).toHaveURL(/\/app\/inbox$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/app/time-tracking");
  await expect(page).toHaveURL(/\/app\/time-tracking$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("proyectos, OT y personas tienen URL legibles; un enlace con el id redirige", async ({ page }) => {
  await login(page, "laura@demo.com");
  await page.goto(`/app/${NEBULA}/projects/cccccccc-0000-0000-0000-000000000002`);
  await expect(page).toHaveURL(/\/app\/projects\/[a-z0-9]+(-[a-z0-9]+)*$/);
  await expect(page).not.toHaveURL(/cccccccc/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/app/staff");
  const first = page.locator("main a[href^='/app/staff/']").first();
  await expect(first).toHaveAttribute("href", /^\/app\/staff\/[a-z0-9]+(-[a-z0-9]+)*$/);
  await first.click();
  await expect(page).toHaveURL(/\/app\/staff\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
