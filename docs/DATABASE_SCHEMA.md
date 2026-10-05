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

## Migraciones

SQL versionado en `supabase/migrations/0001_init.sql`, aplicado igual en dev/staging/prod vía CI.
