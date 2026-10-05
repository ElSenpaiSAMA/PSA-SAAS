# PSA SAAS

Mini SaaS multi-tenant de gestión de personas y proyectos (tipo Factorial): organizaciones, empleados con jerarquía de roles, fichaje, horas por proyecto, vacaciones y tareas.

## Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [Supabase](https://supabase.com/) (Auth, Postgres, RLS)
- [Vitest](https://vitest.dev/) + Playwright (tests)
- Docker
- GitHub Actions (CI/CD) + Vercel (deploy)

## Documentación

- [docs/APP_FLOW.md](docs/APP_FLOW.md) — recorrido del usuario y estructura de rutas
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — esquema de base de datos
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — principios y stack de diseño
- [docs/PROMPTS_LOG.md](docs/PROMPTS_LOG.md) — registro de decisiones de diseño/arquitectura

## Flujo de ramas

- `main` → producción
- `dev` → integración/staging
- `feat/...` → una rama por tarea, creada desde `dev`
