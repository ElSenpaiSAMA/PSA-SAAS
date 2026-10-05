# Kairos — PSA SaaS

> El tiempo de tu equipo, en orden.

Mini SaaS multi-tenant de gestión de personas y proyectos (en la línea de Factorial): fichaje, horas por proyecto, vacaciones con aprobación jerárquica, organigrama con permisos por rango y auditoría completa. Cada empresa es un tenant aislado; un mismo usuario puede pertenecer a varias con roles distintos.

## Qué incluye

| Módulo | Qué hace |
|---|---|
| **Landing** | Página pública con hero animado, bento de features, scroll storytelling y sección de seguridad |
| **Auth** | Registro, login, confirmación por email (PKCE), sesión refrescada en `proxy.ts` |
| **Organizaciones** | Selector multi-empresa, creación de organización, invitaciones por email |
| **Fichaje y horas** | Entrada/salida en un clic, imputación de horas a tareas, gráfico semanal, carga del equipo |
| **Vacaciones** | Saldo en días hábiles, solicitud con validación en vivo, aprobación por la línea de reporte |
| **Proyectos** | Presupuesto vs. horas reales, tablero kanban con actualizaciones optimistas |
| **Equipo** | Directorio, organigrama, edición de rol/manager respetando rangos, invitaciones |
| **Auditoría** | Registro inmutable de toda acción sensible, con detalle del cambio campo por campo |
| **⌘K** | Paleta de comandos para navegar y ejecutar acciones sin mouse |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`) + **TypeScript**
- **Supabase**: Auth + Postgres con **Row Level Security**, triggers y funciones `security definer`
- **Tailwind CSS v4** + componentes propios + **Motion** (animaciones) + **Lenis** (smooth scroll) + **cmdk**
- **Zod** para validar toda entrada en el servidor
- **Vitest** + Testing Library (unit/componentes), **Playwright** (E2E), **pgTAP** (tests de RLS)
- **Docker** (imagen multi-stage `standalone`), **GitHub Actions** (CI/CD), **Vercel** (deploy)

## Seguridad por diseño

Las reglas de negocio críticas viven en la base de datos, no solo en la interfaz:

- **Aislamiento multi-tenant**: RLS filtra toda tabla por organización.
- **Permisos por rango**: catálogo `roles` / `permissions` / `role_permissions`; nadie gestiona ni invita a alguien de rango igual o superior.
- **Jerarquía**: un manager ve y aprueba solo a su línea de reporte (CTE recursiva); no se permiten ciclos en el organigrama.
- **Registros inmutables**: el fichaje se abre siempre con la hora del servidor y solo se puede cerrar; nadie aprueba sus propias vacaciones.
- **Auditoría**: un único trigger genérico (`audit.log_change`) registra cambios de cualquier tabla.

Todo esto está cubierto por tests pgTAP que corren en CI contra un Supabase real (`supabase/tests/rls.test.sql`). Detalle en [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## Desarrollo local

Requisitos: Node 22, Docker (para Supabase local).

```bash
npm install
npx supabase start          # Postgres + Auth locales, aplica migraciones y seed
cp .env.example .env.local  # completar con la URL y anon key que imprime el comando anterior
npm run dev
```

Usuarios demo (contraseña `Demo1234!`):

| Usuario | Rol |
|---|---|
| `laura@demo.com` | Owner de *Nébula Studio* · empleada en *Orbital Labs* |
| `carlos@demo.com` | Manager en *Nébula Studio* · owner de *Orbital Labs* |
| `sofia@demo.com` | Admin en *Nébula Studio* |
| `ana@demo.com`, `diego@demo.com` | Empleados en *Nébula Studio* (reportan a Carlos) |

Con Docker Compose: `docker compose up --build`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | Tipos de rutas + TypeScript |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npx supabase test db` | Tests de RLS (pgTAP) |

## Entornos y CI/CD

| Entorno | Rama | App | Base de datos |
|---|---|---|---|
| Desarrollo | `feat/*`, `fix/*` | local / Docker | Supabase local |
| Staging | `dev` | Vercel Preview | Supabase staging |
| Producción | `main` | Vercel Production | Supabase prod |

- **CI** (`.github/workflows/ci.yml`) en cada push a `feat/*`/`fix/*` y en PRs: lint → typecheck → tests → build → E2E (contra Supabase real con datos demo) → tests RLS → imagen Docker.
- **Deploy** (`.github/workflows/deploy.yml`): `dev` → staging, `main` → producción. Aplica migraciones con `supabase db push` y despliega en Vercel. Los pasos se saltan con un aviso si faltan los secretos del entorno.

Secretos por entorno (GitHub → Settings → Environments `staging` y `production`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Flujo de trabajo

- `main` = producción · `dev` = integración · cada tarea en `feat/<nombre>` o `fix/<nombre>` desde `dev`.
- Commits pequeños por capa (Conventional Commits). Hooks de Husky: ESLint sobre lo staged + Vitest.
- Merge a `dev` con CI en verde; `dev` → `main` solo con el visto bueno de QA.

### Desarrollo asistido por agentes

El proyecto se construyó con subagentes especializados definidos en [`.claude/agents/`](.claude/agents) (backend, frontend-design, qa, devops-cicd, security-audit), coordinados según [CLAUDE.md](CLAUDE.md). Las decisiones relevantes y su porqué están en [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md).

## Documentación

- [docs/APP_FLOW.md](docs/APP_FLOW.md) — recorrido del usuario y rutas
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — esquema, RLS y revisión de seguridad
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — principios y stack de diseño
- [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md) — registro de decisiones
