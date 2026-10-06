@AGENTS.md

# PSA SAAS — guía de trabajo

Mini SaaS multi-tenant tipo Factorial. Contexto de producto en `docs/APP_FLOW.md`, datos en `docs/DATABASE_SCHEMA.md`, diseño en `docs/DESIGN_SYSTEM.md`.

## Flujo de ramas

- `main` = producción, `dev` = integración/staging.
- Toda tarea nace en `feat/<nombre>` creada desde `dev`.
- Commits pequeños por capa terminada (no un commit monolítico). Mensajes en formato Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `ci:`).
- Merge `feat/*` → `dev`. Solo con el visto bueno del agente `qa` se promueve `dev` → `main`.
- Sin líneas de atribución de herramientas de IA en commits ni PRs.

## Agentes (`.claude/agents/`)

| Agente | Responsabilidad |
|---|---|
| `backend` | Supabase (migraciones, RLS), Server Actions, validación Zod, tipos de datos |
| `frontend-design` | UI/UX, componentes, animaciones, estándar de `docs/DESIGN_SYSTEM.md` |
| `qa` | Vitest + Playwright, checklist de promoción `dev` → `main` |
| `devops-cicd` | GitHub Actions, Docker, entornos, variables de entorno |
| `security-audit` | Revisión de RLS, auth, secretos y auditoría (solo reporta) |

### Workflow de una feature

1. `backend` define/ajusta datos y publica los tipos.
2. `frontend-design` construye la UI sobre esos tipos.
3. `qa` agrega tests y valida criterios de aceptación.
4. `security-audit` revisa si la feature toca datos, auth o permisos.
5. Merge a `dev` → CI → deploy a staging → validación `qa` → merge a `main` → deploy a prod.

## Reglas aprendidas (no repetir)

- **CI en verde antes de mergear** a `dev`. Lo que hay en disco no es lo que está commiteado: verificar `git status` (archivos `??` que el código importa) o correr typecheck en un `git worktree` limpio.
- **Server → Client Components**: nunca pasar funciones como props (p. ej. un ícono de `lucide-react`). Renderizar el ícono en el servidor y pasar solo datos serializables.
- **Hora y zona horaria**: el servidor corre en UTC. Un Client Component que formatee horas, agrupe por día o use `Date.now()` en el render debe esperar a hidratar (`useHydrated` / `useNow` de `src/lib/use-now.ts`).
- **Carpetas vacías** no se versionan: si algo (Dockerfile, scripts) depende de una carpeta, garantizar que exista.
- **Migraciones**: nunca editar una ya mergeada; crear `000N_*.sql` nueva + test pgTAP.
- **Tests pgTAP independientes de los datos**: cada test arma lo que necesita o elige filas por condición, nunca por suposición sobre el estado del seed ni sobre fechas relativas a "hoy". Un test que pasa contra una base con datos de prueba previos puede fallar en CI, sobre una base limpia.
- **E2E: los roles cambian a lo largo de la suite**: Diego pasa a ser responsable de departamento (y eso lo asciende a manager). Para comprobar "un empleado no ve X", usar a Ana, que es empleada en toda la suite.
- **E2E: un login por test**: con sesión iniciada, `/login` redirige. Si un flujo involucra a dos personas, se parte en tests seriales consecutivos.

## Comandos

```bash
npm run dev         # servidor local
npm run lint        # ESLint
npm run typecheck   # TypeScript sin emitir
npm run test        # Vitest
npm run test:e2e    # Playwright
npm run build       # build de producción
```

## Registro de decisiones

Cada decisión relevante de arquitectura, producto o proceso se anota en `docs/PROMPTS_LOG.md` (qué se pidió, por qué, resultado).
