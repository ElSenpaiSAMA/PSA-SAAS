# Flujo de la aplicación

## Recorrido del usuario

1. **Landing pública** (`/`) — página de marketing sin autenticación: qué es el producto, features, CTA a login/registro. Es la pantalla más libre para el nivel de diseño definido en `docs/DESIGN_SYSTEM.md` (hero, scroll reveals, etc.).
2. **Login / Registro** (`/login`, `/signup`) — autenticación vía Supabase Auth.
3. **Selector de organización** (`/select-organization`) — un usuario puede tener más de una `membership` (pertenecer a varias empresas que usan el SaaS de forma independiente). Si tiene más de una, elige con cuál entrar. Si tiene una sola, se salta este paso automáticamente.
4. **Dashboard del SaaS**, scopeado por organización — todas las funciones (empleados, fichaje, horas por proyecto, vacaciones, tareas) viven dentro del contexto de la organización elegida. Los datos de una empresa nunca se mezclan con los de otra (reforzado por RLS en `memberships`/`org_id`).

## Estructura de rutas (Next.js App Router)

```
app/
  (marketing)/          # público, sin auth
    page.tsx             # landing
  (auth)/                # login/registro, sin sesión activa
    login/page.tsx
    signup/page.tsx
  select-organization/   # tras login, antes de entrar a una org (si aplica)
    page.tsx
  app/
    [orgId]/             # todo lo del SaaS, scopeado a una organización
      dashboard/
      employees/
      time-tracking/
      vacations/
      projects/
```

`[orgId]` ancla el contexto de organización en toda request del SaaS: el middleware/layout de `app/[orgId]/` valida que el usuario tenga una `membership` activa en esa org antes de renderizar nada (y RLS en Supabase hace de segunda barrera a nivel de datos).
