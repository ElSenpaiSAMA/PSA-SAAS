# Diplonautic — web corporativa e intranet

> Prueba técnica: web demo para una empresa de reparación e instalaciones náuticas, con acceso de empleados y foro interno.

**Diplonautic** es una empresa de Barcelona que instala, repara y mantiene los equipos eléctricos y de confort de yates y embarcaciones: aire acondicionado, refrigeración, generadores, potabilizadoras, sistemas eléctricos y hélices de proa. El proyecto tiene dos partes:

1. **Web pública:** la empresa, sus servicios y una página de contacto.
2. **Intranet para el equipo**, detrás de "Acceso empleados": login con roles, **foro interno** y, además, las herramientas del día a día de un taller (fichaje, órdenes de trabajo por barco, vacaciones…).

---

## Requisitos de la prueba → dónde están

| Requisito | Dónde | Cómo verlo |
|---|---|---|
| Home pública con la empresa y sus servicios | `src/app/(marketing)/page.tsx`, `src/components/marketing/` | Abrir `/` |
| Página de contacto con formulario | `src/app/(marketing)/contacto/`, migración `0020_contact_messages.sql` | `/contacto`: el mensaje se guarda y llega a la intranet (**Mensajes web**, como Sofía o Laura) |
| Login de empleados (registro **o** alta por el admin, justificado) | `src/app/(auth)/`, migración `0017_single_company.sql` | Ver [Alta de empleados](#alta-de-empleados-por-qué-por-invitación) |
| Login y logout | `src/app/(auth)/actions.ts` | Menú del avatar → "Cerrar sesión" |
| Roles: empleado y administrador | `roles` / `permissions` en la base, `src/lib/domain/permissions.ts` | `ana@demo.com` (empleada) vs `sofia@demo.com` (admin) |
| Foro: lista de hilos con título, autor y fecha | `src/app/app/[orgId]/forum/` | Intranet → Foro |
| Foro: crear hilo y responder | `forum/new`, `forum/[threadId]` | "Nuevo hilo", "Responder" |
| Foro solo para personas autenticadas | RLS en `0016_forum.sql` + `proxy.ts` | Sin sesión, `/app/.../forum` redirige al login; por API, la base no devuelve nada |
| Datos de prueba | `supabase/seed.sql` | Usuarios, barcos, órdenes de trabajo e hilos del foro de un taller náutico |
| Commits claros y ramas | historial de git | Conventional Commits, un commit por capa, ramas `feat/*` → `dev` → `main` |
| Al menos un Pull Request con descripción | GitHub → Pull requests | **#1** incorpora el foro (`feat/forum` → `dev`); hay más PRs, uno por funcionalidad |
| Uso de herramientas de IA | [Uso de IA](#uso-de-ia) y [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md) | Cada decisión registrada con qué se pidió, por qué y el resultado |

---

## Probarlo en 5 minutos

Contraseña de todos los usuarios de demo: **`Demo1234!`**

| Usuario | Rol en la intranet | Puesto |
|---|---|---|
| `laura@demo.com` | Owner (administración total) | Gerente |
| `sofia@demo.com` | **Administradora** | Administración y RRHH |
| `carlos@demo.com` | Manager, responsable del Taller | Jefe de taller |
| `ana@demo.com` | **Empleada** | Técnica de climatización |
| `diego@demo.com` | Empleado | Técnico electricista |
| `marc.vidal@demo.com` | *Invitación pendiente* (todavía sin cuenta) | Técnico electricista |

Recorrido sugerido:

1. **Web pública** (`/`): el hero, el **barco 3D** (se gira con el mouse; al pasar por un equipo se ilumina), los servicios y el contacto.
2. **Acceso empleados** → entrar como **Ana** (empleada). Se entra directo a la intranet de Diplonautic.
3. **Foro**: abrir un hilo y responder. Escribir `@Die` para **mencionar** a Diego, o contestar una respuesta concreta (las conversaciones se pliegan).
4. Cerrar sesión y entrar como **Sofía** (admin): en el foro aparecen **Fijar arriba** y **Cerrar hilo**, que una empleada no tiene. En **Personas**, invitar a alguien.
5. Volver como **Diego**: en la barra lateral, "Foro" muestra las **novedades** y la **Bandeja** el aviso de la mención.
6. **Alta por invitación**: abrir `/signup?email=marc.vidal@demo.com`, elegir una contraseña y entrar directo como técnico. Con otro email, el registro se rechaza. *(En local se entra directo; en un proyecto con confirmación de email activada, primero llega el email de confirmación.)*

---

## Alta de empleados: por qué por invitación

La prueba deja elegir entre registro abierto o alta por el administrador, y pide justificarlo. Elegimos **alta controlada por el administrador, mediante invitación**:

- **No hay registro abierto:** es una intranet con datos de clientes y del personal. Cualquiera que se registre no puede ver el foro ni los fichajes.
- **El admin no fija la contraseña de nadie:** invita desde *Personas* (email, rol, departamento y puesto), la persona recibe el email (o el enlace de activación) y **elige su propia contraseña**. Al activarla entra directo a la empresa con el rol asignado.
- **La regla vive en la base de datos:** un trigger en `auth.users` rechaza cualquier alta sin invitación pendiente, aunque se llame directo a la API de autenticación (`supabase/tests/single_company.test.sql`).
- **Email de invitación:** si se configura `SUPABASE_SERVICE_ROLE_KEY` (solo servidor), la app envía el email con Supabase Auth. Sin esa clave, el admin copia el enlace de activación desde la invitación pendiente.

---

## Más allá de lo pedido

La intranet es un PSA (*Professional Services Automation*) completo, pensado para un taller que trabaja por encargos en barcos de clientes:

| Módulo | Qué hace |
|---|---|
| **Foro** | Hilos por categoría (duda, incidencia técnica, aviso), menciones con `@`, respuestas anidadas que se pliegan, moderación (fijar, cerrar, borrar), "resuelto" y avisos de novedades |
| **Mensajes web** | Las consultas del formulario de contacto llegan a una bandeja para administración, con aviso en la campana, estados (nuevo, en curso, cerrado) y respuesta por email o teléfono |
| **Fichaje y horas** | Fichar entrada, pausa y salida; registro semanal tipo Factorial (barra de la jornada, trabajado contra previsto, saldo); hoja de horas por tarea tipo Productive; correcciones con aprobación |
| **Órdenes de trabajo** | El trabajo de cada barco por mes: presupuesto, tarifa, ciclo de vida (borrador → aprobada → en curso → cerrada → facturada), tareas en tablero y copia al mes siguiente |
| **Proyectos** | Barcos o encargos de cada cliente, con equipo, avance de horas y salud del presupuesto |
| **Vacaciones** | Saldo en días hábiles, tipos de ausencia y aprobación por el responsable, con calendario del equipo |
| **Planificación, calendario e informes** | Carga por persona y semana, calendario general, y facturación, horas y ausencias exportables a CSV |
| **Automatizaciones** | Reglas que trabajan solas: recordar el fichaje, cerrar fichajes olvidados, alertas de presupuesto, crear las OT del mes… |
| **Asistente IA** | En ⌘K: responde preguntas con datos reales y con los permisos de quien pregunta (OpenRouter, opcional) |
| **Auditoría** | Registro de cada cambio sensible, campo por campo |

---

## Seguridad por diseño

Las reglas críticas viven en **PostgreSQL**, no solo en la pantalla:

- **Row Level Security** en todas las tablas: cada persona ve solo lo de su empresa y lo que su rol permite.
- **Triggers de validación** (`guard_*`): por ejemplo, un empleado no puede fijar ni cerrar hilos del foro, ni editar lo ajeno, ni responder en un hilo cerrado; nadie aprueba sus propias vacaciones; un fichaje no se puede reescribir.
- **Alta solo con invitación** y **sin organizaciones nuevas** (ver arriba).
- **Secretos solo en el servidor:** la clave de IA y la de servicio de Supabase nunca llegan al navegador.
- **Auditoría** con un trigger genérico.

Detalle en [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## Tests

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Base de datos | **pgTAP** (~175 tests) | RLS, permisos, foro, menciones, respuestas anidadas, alta por invitación, aislamiento entre empresas |
| Unitarios | **Vitest** (~190 tests) | Reglas de dominio puras: fichaje, saldo, menciones, árbol del foro, informes, validación |
| End to end | **Playwright** | Recorridos completos: web pública en escritorio y móvil, login, foro (crear, mencionar, moderar, responder), fichaje, vacaciones, órdenes |

Todo corre en **GitHub Actions** en cada push y PR, con un Supabase real levantado en el CI.

## Stack

**Next.js 16** (App Router, Server Components, Server Actions) · **TypeScript** · **Supabase** (Auth + Postgres con RLS) · **Tailwind CSS v4** · **Motion** · **three.js / React Three Fiber** (barco 3D) · **Zod** · **Vitest**, **Playwright**, **pgTAP** · **Docker** · **GitHub Actions** · **Vercel**

## Levantarlo en local

Requisitos: Node 22 y Docker (para Supabase local).

```bash
npm install
npx supabase start          # Postgres + Auth locales: aplica migraciones y datos de prueba
cp .env.example .env.local  # completar con la URL y la anon key que imprime el comando anterior
npm run dev                 # http://localhost:3000
```

Variables opcionales en `.env.local`:

| Variable | Para qué |
|---|---|
| `OPENROUTER_API_KEY` | Activa el asistente IA |
| `SUPABASE_SERVICE_ROLE_KEY` | Envía el email de invitación de empleados (solo servidor) |

Con Docker Compose: `docker compose up --build`.

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npx supabase test db` | Tests de base de datos (pgTAP) |

## Flujo de trabajo y entornos

- `main` = producción · `dev` = integración · cada tarea en `feat/<nombre>` creada desde `dev`.
- **Commits pequeños por capa** (base de datos → dominio → datos y acciones → interfaz → tests → documentación), con Conventional Commits.
- **Pull Request a `dev`** por funcionalidad, con descripción, y merge con el CI en verde. `dev` → `main` cuando todo está validado.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → unitarios → build → E2E → pgTAP → imagen Docker. **Deploy** (`deploy.yml`): `dev` → staging y `main` → producción en Vercel, con las migraciones aplicadas en Supabase.

## Uso de IA

El proyecto se desarrolló con un **asistente de IA para programación**, organizado en agentes con responsabilidades separadas (backend, diseño, QA, DevOps y auditoría de seguridad), definidos en [`.claude/agents/`](.claude/agents) y coordinados según [CLAUDE.md](CLAUDE.md):

- **Yo decidía qué construir y cómo debía verse**: cada pedido, cambio de rumbo y decisión de producto está en [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md), con qué se pidió, por qué y el resultado.
- **La IA proponía e implementaba, y todo se verificaba**: tests en las tres capas, revisión en el navegador y CI en verde antes de cada merge. Los errores que aparecieron, y cómo se corrigieron, también quedaron registrados.
- **Reglas aprendidas** en [CLAUDE.md](CLAUDE.md), para no repetir errores: zona horaria del servidor, tests independientes de los datos, etc.
- **La IA también es una funcionalidad del producto**: el asistente de la intranet responde con los datos y los permisos de quien pregunta, sin acceso a datos sensibles.

## Documentación

- [docs/APP_FLOW.md](docs/APP_FLOW.md): recorrido del usuario y rutas
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md): esquema, RLS y cada migración
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): marca, web pública e intranet
- [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md): registro de decisiones
