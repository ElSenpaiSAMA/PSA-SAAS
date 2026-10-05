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
