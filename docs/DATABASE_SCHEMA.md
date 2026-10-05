# Esquema de base de datos (Supabase/Postgres)

Mini SaaS multi-tenant tipo "Factorial": organizaciones, empleados con jerarquía de roles, fichaje, horas por proyecto, vacaciones y tareas. Diseño pensado para ser lean (tablas con una sola responsabilidad) y reutilizable (auditoría y permisos genéricos, sin tocar código al agregar funciones nuevas).

## Entidades

### `auth.users` (nativa de Supabase)
Email, password hash, sesión. Gestionada por Supabase Auth.

### `public.profiles`
Datos personales 1:1 con `auth.users` (nombre, avatar). Sin rol ni lógica de organización — eso vive en `memberships`, porque un mismo usuario puede pertenecer a varias organizaciones con roles distintos.

### `public.organizations`
Los tenants (empresas). Todo lo demás cuelga de una organización.

### `public.roles` / `public.permissions` / `public.role_permissions`
Catálogo **global y reutilizable** de jerarquía y permisos:
- `roles`: `owner(4) > admin(3) > manager(2) > employee(1)` — el `level` sirve para comparaciones rápidas.
- `permissions`: claves de función (`employees.manage`, `projects.manage`, `tasks.manage_all`, `time.view_team`, `vacations.approve`).
- `role_permissions`: qué rol tiene qué permiso. Agregar una función nueva en la app = agregar una fila en `permissions` + `role_permissions`, **sin migraciones de código** en el resto del sistema.

### `public.memberships`
La tabla central: une `user_id` + `org_id` + `role_id`, y además:
- `manager_id` → auto-referencia a otra membership, arma el organigrama (quién reporta a quién).
- `weekly_hours` → capacidad semanal contratada, para calcular carga de trabajo (horas asignadas vs. capacidad).
- `annual_vacation_days` → días de vacaciones asignados por año.

Dos funciones `security definer` dan soporte a todo el control de acceso:
- `has_permission(org_id, key)` — ¿el usuario autenticado tiene este permiso en esta org?
- `is_in_reporting_line(manager_membership_id, target_membership_id)` — recorre la jerarquía (CTE recursiva) para saber si alguien es manager directo o indirecto de otro.

### `public.projects` / `public.tasks`
Proyectos con `budgeted_hours` (horas presupuestadas) y tareas con `estimated_hours` + `assigned_to` (membership). La comparación `estimated_hours` (tareas) vs `budgeted_hours` (proyecto) vs horas reales (`time_entries`) es lo que permite medir carga de trabajo.

### `public.time_entries` (reutilizable: fichaje Y horas de proyecto)
Una sola tabla para dos casos de uso, distinguidos por `entry_type`:
- `entry_type = 'clock'`, `task_id = null` → fichaje general (entrada/salida del día).
- `entry_type = 'task'`, `task_id` seteado → horas dedicadas a una tarea/proyecto concreto.

Evita duplicar el concepto de "registro de tiempo" en dos tablas distintas.

### `public.vacation_requests` + vista `vacation_balances`
Workflow de aprobación: el empleado crea la solicitud (`pending`), su manager (o quien tenga `vacations.approve`) la aprueba/rechaza. El saldo de días (`vacation_balances`) se **calcula** sumando solicitudes aprobadas del año — no se guarda un contador separado que se pueda desincronizar.

### `public.invitations`
Alta de empleados por email: `org_id`, `email`, `role_id` (nunca `owner`), `manager_id`, `position`. Se acepta vía `accept_invitation()`, que crea la membership.

### `public.audit_log`
Igual que antes: tabla genérica enganchada vía un único trigger reutilizable (`audit.log_change()`) a `memberships`, `vacation_requests`, `time_entries` y `tasks` (los cambios que realmente importa rastrear). Para auditar una tabla nueva, un solo `create trigger ... execute function audit.log_change()`, sin escribir lógica nueva.

## Workflow funcional (flujo real de uso)

1. **Alta de organización y empleados**: un `owner`/`admin` crea la organización, invita empleados (`memberships`), define su `manager_id` (organigrama) y su rol.
2. **Fichaje diario**: el empleado abre/cierra un `time_entry` tipo `clock` al entrar/salir.
3. **Carga de horas a proyecto**: el empleado registra `time_entries` tipo `task` contra las tareas asignadas; esto se compara contra `estimated_hours` de la tarea y `weekly_hours` del empleado para ver sobrecarga.
4. **Vacaciones**: el empleado solicita (`vacation_requests` → `pending`); su manager (vía jerarquía) o un admin con `vacations.approve` aprueba o rechaza; el saldo se refleja automáticamente en `vacation_balances`.
5. **Visibilidad por jerarquía**: un manager ve el fichaje/horas/vacaciones de su equipo (directo e indirecto) gracias a `is_in_reporting_line`; un empleado normal solo ve lo propio.
6. **Auditoría**: cualquier alta/baja/cambio en membresías, vacaciones, fichajes y tareas queda registrado automáticamente en `audit_log`, consultable por el propio usuario.

## RLS (resumen)

- Todo filtrado por organización: nadie ve datos de una org a la que no pertenece.
- Acceso a funciones de gestión (empleados, proyectos, tareas de otros, aprobar vacaciones, ver horas del equipo) gated por `role_permissions`, no hardcodeado por rol — así es fácil ajustar permisos sin tocar políticas RLS.
- Jerarquía (ver datos de "mi equipo") resuelta con `is_in_reporting_line`, soporta cualquier profundidad de organigrama.

## Revisión de seguridad (`0002_security_hardening.sql`)

La revisión del agente `security-audit` sobre `0001` encontró problemas que se corrigen en una migración nueva (nunca se edita una migración ya mergeada):

| Problema en 0001 | Corrección |
|---|---|
| La policy de `memberships` consultaba `memberships` → recursión infinita de RLS | Helpers `security definer` (`is_org_member`, `is_own_membership`, `membership_org`, `my_membership_id`) |
| `organizations` sin RLS | RLS: solo miembros (o invitados) ven la org |
| `= (select id from memberships where user_id = auth.uid())` falla si el usuario está en 2+ orgs | `is_own_membership(membership_id)` |
| Un manager podía aprobar sus propias vacaciones | Trigger `guard_vacation_changes`: el solicitante solo puede cancelar; `decided_by/at` se setean en servidor |
| Un admin podía ascenderse a owner o gestionar a alguien de igual rango | Trigger `guard_membership_changes` por nivel de rol |
| Un empleado podía reescribir la hora de entrada de su fichaje | Trigger `guard_time_entry_changes`: el fichaje se abre siempre "ahora" y solo se puede cerrar |
| Ciclos en el organigrama colgaban la CTE recursiva | `union` en lugar de `union all` + check anti-ciclo al asignar manager |
| `vacation_balances` saltaba RLS y contaba días corridos | Vista `security_invoker` + `business_days()` (lunes a viernes) |
| Un empleado asignado podía reasignar/reestimar su tarea | Trigger `guard_task_changes`: solo puede cambiar el estado |
| Admins no podían ver la auditoría de su org | `audit_log.org_id` (sin FK, para que el log sobreviva al borrado) + policy por `employees.manage` |

Además agrega el **flujo de alta**:
- `create_organization(name)`: crea la org y la membership `owner` de forma atómica.
- `invitations` + `accept_invitation(id)`: un admin invita por email (con rol, manager y puesto); al loguearse, el invitado ve la invitación en el selector de organización y la acepta. Nadie puede invitar con un rango igual o superior al propio.

## Departamentos y miembros de proyecto (`0004_departments_and_project_members.sql`)

### `public.departments`
`org_id`, `name`, `head_id` (responsable, una persona encabeza como mucho un departamento). `memberships`, `projects` e `invitations` tienen `department_id`.

- Al asignar a alguien a un departamento, **su manager pasa a ser el responsable** (trigger `membership_department_manager`), salvo que el responsable le reporte a esa persona (evita ciclos).
- Al nombrar un responsable: queda dentro del departamento, sube a rol `manager` si era `employee` (así puede aprobar vacaciones y ver horas) y pasa a ser el manager de todos los miembros (`department_head_sync`).
- Gestionar departamentos requiere el permiso nuevo `departments.manage` (owner y admin).

### `public.project_members`
Quién participa de cada proyecto. Asignar una tarea suma automáticamente a la persona como miembro.

### Visibilidad de proyectos
Resuelta en la base con `can_view_project` / `can_manage_project`, y aplicada a proyectos, tareas, miembros, imputación de horas y horas agregadas:

| Quién | Ve | Gestiona (miembros, tareas, archivar) |
|---|---|---|
| Owner / admin (`projects.manage`) | Todos los proyectos | Todos |
| Responsable de departamento | Los de su departamento + donde es miembro | Los de su departamento |
| Resto | Solo donde es miembro | — (solo mueve sus tareas) |

Un empleado no puede imputar horas a un proyecto del que no es miembro, ni ver sus horas agregadas. Cubierto por `supabase/tests/departments.test.sql` (16 tests).

## Desarrollo local

```bash
npx supabase start      # Postgres + Auth + Studio en Docker
npx supabase db reset   # aplica migraciones + supabase/seed.sql
```

El seed crea dos organizaciones demo (*Nébula Studio* y *Orbital Labs*) con jerarquía owner → manager → empleados, proyectos, fichajes de dos semanas, vacaciones pendientes de aprobar y una invitación. Usuarios: `laura@`, `carlos@`, `ana@`, `diego@`, `sofia@demo.com`, contraseña `Demo1234!`. Laura y Carlos pertenecen a ambas orgs con roles distintos, para probar el selector de organización.

## Migraciones

SQL versionado en `supabase/migrations/`, aplicado igual en dev/staging/prod vía CI (`supabase db push`).
