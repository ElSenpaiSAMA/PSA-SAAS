# Flujo de la aplicación

## Recorrido del usuario

1. **Landing pública** (`/`) — página de marketing sin autenticación: qué es el producto, features, CTA a login/registro. Es la pantalla más libre para el nivel de diseño definido en `docs/DESIGN_SYSTEM.md` (hero, scroll reveals, etc.).
2. **Login / Registro** (`/login`, `/signup`) — autenticación vía Supabase Auth.
3. **Selector de organización** (`/select-organization`) — un usuario puede tener más de una `membership` (pertenecer a varias empresas que usan el SaaS de forma independiente). Si tiene más de una, elige con cuál entrar. Si tiene una sola, se salta este paso automáticamente.
4. **Dashboard del SaaS**, scopeado por organización — todas las funciones (empleados, fichaje, horas por proyecto, vacaciones, tareas) viven dentro del contexto de la organización elegida. Los datos de una empresa nunca se mezclan con los de otra (reforzado por RLS en `memberships`/`org_id`).

## Estructura de rutas (Next.js App Router)

```
src/
  proxy.ts                     # refresca la sesión y redirige rutas protegidas (Next 16: ex-middleware)
  app/
    (marketing)/page.tsx       # landing pública
    (auth)/                    # login y registro + Server Actions de auth
    auth/callback/route.ts     # confirmación de email (PKCE)
    select-organization/       # selector multi-empresa, invitaciones, crear org
    app/[orgId]/               # todo el SaaS, scopeado a una organización
      layout.tsx               # valida membership en servidor (404 si no pertenece) + shell
      dashboard/               # resumen personal y del equipo
      time-tracking/           # fichaje, imputación de horas, carga del equipo
      vacations/               # saldo, solicitudes y aprobaciones
      projects/[projectId]/    # proyectos: sus órdenes de trabajo y miembros
      work-orders/[workOrderId]/ # OT por mes: tareas con fechas, estados, copiar al mes siguiente, facturación
      inbox/                   # bandeja: pendientes de acción (OT, tareas, fichaje) + notificaciones
      calendar/                # calendario general: tareas, OT, ausencias y festivos (mes/semana)
      planning/                # carga de trabajo persona × semana vs. capacidad
      staff/                   # empleados: listado y perfil (/staff/[membershipId]) con ficha versionada
      employees/               # personas: directorio, departamentos, organigrama, invitaciones
      automations/             # automatizaciones: activar, parámetros, ejecutar ahora, historial (automations.manage)
      settings/                # ajustes de la empresa (employees.manage)
      audit/                   # auditoría (requiere employees.manage)
```

`[orgId]` ancla el contexto de organización en toda request del SaaS: el layout de `app/[orgId]/` valida que el usuario tenga una `membership` activa en esa org antes de renderizar nada (y RLS en Supabase hace de segunda barrera a nivel de datos).

## Capas del código

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Dominio | `src/lib/domain/` | Lógica pura y testeada: horas, carga, saldo de vacaciones, jerarquía, permisos, auditoría |
| Validación | `src/lib/validation/` | Esquemas Zod de toda entrada del usuario |
| Datos | `src/lib/data/` | Consultas tipadas a Supabase (`server-only`, cacheadas por request) |
| Acciones | `src/app/**/actions.ts` | Server Actions: validan, verifican permisos y escriben |
| UI | `src/components/`, `src/app/**` | Server Components para datos, Client Components solo donde hay interacción |

## Visibilidad por rol

"Responsable" es quien encabeza un departamento (sube automáticamente a rol manager).

| Función | Empleado | Responsable de depto. | Admin | Owner |
|---|:-:|:-:|:-:|:-:|
| Fichar e imputar horas propias | ✓ (en sus proyectos) | ✓ | ✓ | ✓ |
| Solicitar vacaciones | ✓ | ✓ | ✓ | ✓ |
| Ver proyectos | donde es miembro | su departamento | todos | todos |
| Crear proyectos, tareas y gestionar miembros | | su departamento | ✓ | ✓ |
| Mover sus propias tareas | ✓ | ✓ | ✓ | ✓ |
| Ver horas y carga de su equipo | | su línea | toda la org | toda la org |
| Aprobar vacaciones | | su línea | toda la org | toda la org |
| Crear departamentos y asignar responsables | | | ✓ | ✓ |
| Invitar personas y editar rol/departamento | | | rangos inferiores | ✓ |
| Crear OT, duplicarlas y copiarlas de mes | | su departamento | ✓ | ✓ |
| Facturar OT y definir tarifas | | | ✓ | ✓ |
| Ver planificación | la propia | su línea | toda la org | toda la org |
| Ver auditoría de la organización | | | ✓ | ✓ |
