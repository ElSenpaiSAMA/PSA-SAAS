# Registro de prompts

Este documento recoge los prompts más importantes utilizados durante el desarrollo del proyecto (con IA generativa) y el porqué de cada decisión. Sirve como evidencia del proceso de trabajo para el proceso de selección.

Formato de cada entrada:

```
## [fecha] Título breve
**Prompt (resumen):** qué se pidió
**Por qué:** motivo/decisión detrás del prompt
**Resultado:** rama/commit o archivo afectado
```

---

## 2026-10-05 Definición de alcance y stack

**Prompt (resumen):** Se solicitó crear una web con login y control de versiones (requisito base del proceso de selección), ampliando el alcance con CI/CD, tests (Vitest), auditoría por usuario, múltiples entornos, y agentes/workflows especializados por rol (QA, backend, diseño, etc.) usando Next.js, GitHub Actions, GitHub, Vercel, Docker y Supabase.

**Por qué:** Ir más allá del mínimo pedido para demostrar competencia real en IA generativa aplicada a un flujo de desarrollo profesional, no solo generación de código.

**Resultado:** Stack confirmado sin cambios; se sugirió añadir Playwright (E2E), Zod (validación) y Husky + lint-staged (pre-commit), aceptado en principio.

---

## 2026-10-05 Agentes de proceso vs. agentes de producto

**Prompt (resumen):** Se aclaró que los "agentes" (QA, backend, diseño) son subagentes de Claude Code que organizan el *proceso* de desarrollo, documentados en `.claude/agents/`, y no una funcionalidad de IA visible para el usuario final de la app.

**Por qué:** Evitar construir una feature de IA innecesaria dentro del producto cuando el objetivo real era demostrar un flujo de trabajo multi-agente durante la construcción.

**Resultado:** Define la arquitectura de `.claude/agents/` (backend, frontend-design, qa, devops-cicd, security-audit) en lugar de un asistente dentro de la app.

---

## 2026-10-05 Flujo de branching y disciplina de commits

**Prompt (resumen):** `main` = producción, `dev` = integración. Cada tarea nueva parte de una rama `feat/...` creada desde `dev`. Commit + push al terminar cada tarea de la capa. Merge a `dev`, y solo tras validación de QA se promueve `dev` → `main`.

**Por qué:** El repositorio debe mostrar progreso real a través de varios commits incrementales, no un único commit con todo aplicado de golpe — esto forma parte de lo evaluado en el proceso de selección.

**Resultado:** Se adopta como disciplina transversal para todo el desarrollo del proyecto.

---

## 2026-10-05 Registro de prompts (este documento)

**Prompt (resumen):** Se solicitó mantener, a medida que avanza el proyecto, un documento con los prompts más importantes utilizados y el porqué de cada uno.

**Por qué:** Dejar trazabilidad del razonamiento detrás de las decisiones tomadas con IA generativa, no solo el resultado final.

**Resultado:** Creación de `docs/PROMPTS_LOG.md`, actualizado en cada tarea relevante de ahí en adelante.

---

## 2026-10-05 Definición del producto: mini SaaS tipo "Factorial"

**Prompt (resumen):** Tras corregir que no se debía diseñar la BBDD sin saber qué tipo de página era, se definió el producto: un mini SaaS multi-tenant tipo Factorial con gestión de empleados, control de horario (fichaje), carga de horas a proyectos/tareas, sistema de vacaciones con aprobación, y jerarquía de roles (acceso a funciones según el rango del empleado, con organigrama de manager). CRM queda documentado como fase 2/roadmap, fuera del MVP.

**Por qué:** Sin facturación/Stripe (no era necesario para la demo). Se priorizó un dominio que luzca bien en una entrevista técnica y que justifique de forma natural roles, permisos, auditoría y RLS reales.

**Resultado:** Esquema completo en `supabase/migrations/0001_init.sql` y `docs/DATABASE_SCHEMA.md`: `organizations`, `roles`/`permissions`/`role_permissions` (catálogo reutilizable), `memberships` (con `manager_id` para jerarquía), `projects`/`tasks`, `time_entries` (una sola tabla reutilizada para fichaje y horas de proyecto), `vacation_requests` + vista `vacation_balances` calculada, y `audit_log` genérica enganchada a las tablas clave.

---

## 2026-10-05 Nivel de diseño: referencia jeremy-jaques.vercel.app

**Prompt (resumen):** Se pidió que el diseño fuera "muy pro", minimalista pero con efectos/animaciones cuidadas, tomando como referencia de nivel de ejecución (no de temática) el sitio jeremy-jaques.vercel.app — un portfolio cinematográfico con revelado progresivo por scroll y micro-interacciones muy pulidas.

**Por qué:** El agente de diseño necesitaba un estándar concreto y verificable contra el cual construir, en vez de "que quede lindo" sin criterio objetivo.

**Resultado:** Se creó `docs/DESIGN_SYSTEM.md` (principios, stack de UI: Tailwind + shadcn/ui + Framer Motion + Lenis + command palette, qué evitar) y `.claude/agents/frontend-design.md`, el subagente que debe seguir ese estándar en toda tarea de UI.

---

## 2026-10-05 Flujo de usuario: landing pública → login → selector de organización → SaaS

**Prompt (resumen):** Se aclaró el recorrido completo: al entrar a la página, primero se ve una landing pública (descripción de la app), luego login/registro, y tras loguearse el usuario elige a qué empresa/organización entrar (puede pertenecer a más de una, ya que el SaaS es multi-tenant y los datos de cada empresa no se comparten).

**Por qué:** Sin esto, la estructura de rutas de Next.js habría asumido una sola organización por usuario; el modelo real necesita un paso de selección de organización antes de entrar al dashboard.

**Resultado:** Se documentó en `docs/APP_FLOW.md`: landing pública → `(auth)` login/registro → `/select-organization` (si aplica) → `/app/[orgId]/...` con todo el SaaS scopeado por organización.
