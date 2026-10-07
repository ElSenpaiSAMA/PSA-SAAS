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

## Órdenes de trabajo y planificación (`0005_work_orders.sql`)

**Proyecto → Orden de trabajo (OT) → Tareas.** El proyecto es el cliente/contrato; cada OT es el trabajo de un período (típicamente un mes) con su presupuesto de horas y tarifa; las tareas viven dentro de una OT y tienen fecha de inicio y vencimiento.

### `public.work_orders`
`project_id`, `number` (correlativo por organización → `OT-0001`), `title`, `period_start` / `period_end`, `budgeted_hours`, `hourly_rate` (si no se indica, hereda la del proyecto), `status` (`draft → approved → in_progress → closed`), `billing_status` (`unbilled` / `invoiced`), `invoiced_at`.

Reglas en la base (triggers):

| Regla | Dónde |
|---|---|
| Solo se imputan horas a tareas de OT **aprobadas o en curso** | `open_work_order_for_task` en insert/update/delete de `time_entries` |
| La primera imputación pasa una OT aprobada a **en curso** | ídem |
| Solo se factura una OT **cerrada**; una OT facturada queda **bloqueada** (ni ella ni sus tareas cambian) | `guard_work_order_changes`, `guard_task_changes` |
| Facturar y cambiar tarifas requiere `billing.manage` (owner/admin) | `guard_work_order_changes` |
| Visibilidad igual que su proyecto (`can_view_project` / `can_manage_project`) | RLS |

### Duplicar ("copiar del mes anterior")
`duplicate_work_order(id, título, desde, hasta)` crea la OT nueva en **borrador** y copia todas las tareas reiniciadas a "por hacer", corriendo sus fechas lo mismo que el período (y acotándolas al nuevo período). La UI ofrece "Copiar al mes siguiente" (un clic) y "Duplicar a otro período".

### Planificación
`workload_items(org, desde, hasta)` devuelve las tareas abiertas con horas estimadas y fechas de las personas que el usuario puede ver (él mismo o su línea de reporte / toda la org si es admin), **sin títulos**. La app reparte las horas de cada tarea entre sus días hábiles (`src/lib/domain/planning.ts`) y las compara con la capacidad semanal (`weekly_hours`), descontando las vacaciones aprobadas.

Cubierto por `supabase/tests/work_orders.test.sql` (17 tests).

## Festivos y calendario (`0006_holidays_and_calendar.sql`)

### `public.holidays`
Festivos por organización (`date`, `name`). Los gestiona quien tiene `holidays.manage` (owner/admin); todos los miembros los ven.

- `business_days(desde, hasta, org)`: lunes a viernes **menos los festivos** de la organización. La vista `vacation_balances` la usa, así un festivo dentro de unas vacaciones no descuenta saldo.
- En la app, los mismos festivos excluyen días en el contador de vacaciones, en la validación de solicitudes y en la planificación (no se planifica trabajo ni hay capacidad en un festivo).

### `org_absences(org, desde, hasta)`
Ausencias para el calendario, **sin el motivo**:
- vacaciones **aprobadas** de cualquier miembro activo de la organización (es información de equipo: quién está fuera);
- vacaciones **pendientes** solo para el solicitante y para quien puede aprobarlas.

Cubierto por `supabase/tests/calendar.test.sql` (9 tests).

## Pausas en el fichaje (`0007_clock_breaks.sql`)

`time_entries.entry_type` admite ahora `break`. Una jornada es una secuencia de tramos:

| Tramo | Significado |
|---|---|
| `clock` | trabajando |
| `break` | en pausa (almuerzo, descanso) |

- `clock_pause(org)`: cierra el tramo `clock` abierto y abre un `break` en la misma transacción.
- `clock_resume(org)`: cierra el `break` y abre un `clock` nuevo.
- Ambas corren como el usuario (`security invoker`), así que aplican RLS y los mismos guards que un fichaje manual.
- Guards: la hora de inicio de una pausa la pone la base (`now()`) y no se puede reescribir. Solo puede haber una pausa abierta por persona, y no se puede tener un `clock` y un `break` abiertos a la vez.
- El tiempo trabajado sigue siendo la suma de tramos `clock`, así que los cálculos existentes (semana, carga, dashboard) no cambian. Fichar salida estando en pausa cierra la pausa.
- En la auditoría, el cierre/apertura técnica de tramos que acompaña a una pausa se pliega (`foldClockSegments`) y el historial muestra "pausó la jornada" / "reanudó la jornada".

Cubierto por `supabase/tests/breaks.test.sql` (9 tests).

## Ficha de empleado (`0008_employee_records.sql`)

### `public.employee_records`
Datos personales y sensibles **versionados**. Cada fila es una versión vigente desde `effective_from`: DNI/NIE, nacimiento, contacto, domicilio, contacto de emergencia, alta, tipo de contrato, salario bruto anual, IBAN y notas (motivo del cambio).

- "La ficha a una fecha" es la última versión con `effective_from <= fecha`. Así se registran cambios con efecto pasado o futuro (una subida desde el 1 de diciembre) y el perfil puede navegar por meses.
- `unique (membership_id, effective_from)`: guardar dos veces la misma fecha corrige esa versión.
- Un guard deduce `org_id` de la membresía (no se confía en el cliente) y no deja reasignar una versión a otra persona.
- Auditada con `audit.log_change()`. En el historial solo se describe la acción, nunca los valores.

| Quién | Acceso |
|---|---|
| Owner / Admin (`people.sensitive`) | Ver y editar todas las fichas |
| La propia persona | Ver su ficha (solo lectura) |
| Manager y resto | Sin acceso. Ven datos laborales (horas, vacaciones de su línea), no sensibles |

Cubierto por `supabase/tests/employee_records.test.sql` (10 tests).

## Notificaciones (`0009_notifications.sql`)

### `public.notifications`
Avisos dentro de la app, privados de cada destinatario (`recipient_id` es una membresía). Guarda tipo (`kind`), título, detalle, enlace, entidad relacionada, quién lo provocó (`actor_id`) y `read_at`.

- **El cliente no las crea**: no hay política de insert y `notify()` no se puede ejecutar desde la app. Las generan triggers, así ningún flujo se olvida de avisar y no se pueden fabricar avisos.
- **Solo se marcan como leídas**: un guard impide cambiar cualquier otro campo. Cada persona puede borrar las suyas.
- Nadie recibe aviso de algo que hizo él mismo.

| Evento | Quién recibe el aviso |
|---|---|
| Solicitud de vacaciones | Su aprobador natural |
| Vacaciones aprobadas o rechazadas | Quien las pidió |
| Solicitud cancelada | Su aprobador natural |
| Tarea asignada o reasignada | La persona asignada |
| Alta como miembro de un proyecto | Esa persona |
| OT cerrada sin facturar | Quienes tienen `billing.manage` |

### `vacation_approvers(membresía)`
El **aprobador natural**: el primer responsable hacia arriba en la línea de reporte con `vacations.approve`. Si no hay ninguno, administración (`employees.manage` + `vacations.approve`). La app usa la misma regla (`naturalApprovers` en el dominio) para mostrar "La aprueba X" y armar la bandeja. Administración puede decidir igual sobre cualquier solicitud, pero en su bandeja solo ve las que le tocan.

Cubierto por `supabase/tests/notifications.test.sql` (13 tests).

## Automatizaciones (`0010_automations.sql`)

Reglas "cuando pasa X → si se cumple Y → hacer Z" que trabajan solas.

| Tabla | Para qué |
|---|---|
| `automation_templates` | Catálogo de reglas: tipo (`event` o `schedule`), si viene activa y parámetros por defecto |
| `automation_rules` | Configuración de cada empresa: activa o no, y parámetros que pisan los del catálogo. Requiere `automations.manage` (owner/admin) y se audita |
| `automation_runs` | Historial de cada acción. Su clave de deduplicación hace que correr una regla dos veces no repita avisos ni cambios |

**Cómo corren:**
- **De evento** (triggers): aprobación automática de ausencias cortas (al crearse la solicitud) y aviso de consumo del presupuesto de una OT (al imputar horas).
- **Programadas**: `run_automations()` recorre todas las empresas cada 15 minutos con `pg_cron`. Si `pg_cron` no está disponible, la migración lo avisa y las reglas igual se pueden correr con `run_automation_now()` ("Ejecutar ahora"), que exige `automations.manage` e ignora la ventana horaria. Si una regla falla, no frena a las demás: el error queda en el historial.

**Flag `app.automation`:** mientras actúa una automatización, los guards lo reconocen (por ejemplo, puede aprobar vacaciones sin ser el aprobador; nunca a nombre del solicitante, por eso `decided_by` queda vacío). Las notificaciones salen sin actor, así también le llegan a quien originó el evento.

| Regla | Tipo | Por defecto | Qué hace |
|---|---|---|---|
| `vacations.auto_approve_short` | evento | inactiva | Aprueba solas las ausencias de hasta N días, con aviso mínimo y sin nadie más del departamento ausente |
| `vacations.escalate_stale` | programada | activa | Pendiente hace N días → avisa al responsable del aprobador y a administración |
| `time.auto_close_clock` | programada | activa | Fichaje o pausa abierto más de N h → lo cierra en el límite y avisa |
| `time.clock_out_reminder` | programada | activa | Desde cierta hora local, recuerda fichar la salida (una vez por jornada) |
| `work_orders.budget_alert` | evento | activa | Al cruzar el 80 % o el 100 % del presupuesto de horas, avisa a quienes gestionan el proyecto |
| `work_orders.auto_close` | programada | inactiva | Cierra las OT N días después del fin del período (facturación recibe su aviso) |
| `work_orders.recurring` | programada | inactiva | Al empezar el mes, copia en borrador las OT del mes anterior sin continuación |
| `tasks.due_reminder` | programada | activa | Avisa de tareas que vencen pronto o ya vencieron |
| `team.weekly_summary` | programada | activa | Los lunes, cada responsable recibe el resumen de su equipo |

**Funciones redefinidas en esta migración:**
- `duplicate_work_order` ahora delega en `copy_work_order`, que las automatizaciones usan sin chequeo de permisos.
- Al copiar una OT en bloque no se avisa "te asignaron una tarea" por cada tarea copiada.

Cubierto por `supabase/tests/automations.test.sql` (14 tests).

## Enlaces de vacaciones (`0011_vacation_links.sql`)

Las solicitudes de vacaciones se deciden en **Vacaciones → Equipo**, no en la bandeja. Esta migración redefine `notify_vacation_change` y `automation_vacations_escalate` para que los avisos de solicitud, cancelación y escalado enlacen a `/vacations?tab=equipo`, y corrige el enlace de los avisos ya enviados. Suspende el guard de notificaciones solo durante ese `update`.

## Tipos de ausencia y motivo de la decisión (`0012_absence_types.sql`)

`vacation_requests` suma dos columnas:

| Columna | Valores | Detalle |
|---|---|---|
| `kind` | `vacation`, `personal`, `sick`, `other` | Vacaciones, asuntos propios, baja médica, otra. **Solo las vacaciones descuentan saldo**: la vista `vacation_balances` se recrea filtrando por tipo |
| `decision_note` | texto | Motivo de la decisión |

**Reglas del guard:**
- El tipo no cambia después de pedirse.
- **Rechazar exige motivo.**
- Solo quien decide puede escribir el motivo.

**Avisos:** dicen el tipo ("Ana pidió una baja médica") y, si hay rechazo, el motivo.

**Aprobación automática:** de las ausencias cortas aplica solo a vacaciones y asuntos propios. Una baja o "otra" siempre la revisa una persona.

**Privacidad:** `org_absences` (el calendario de toda la empresa) sigue sin exponer el tipo, porque una baja médica es un dato de salud. El tipo solo lo ven la persona y quien aprueba.

Cubierto por `supabase/tests/absence_types.test.sql` (9 tests).

## Correcciones de fichaje (`0013_time_corrections.sql`)

El fichaje no se edita a mano: la hora de entrada la pone la base. Para corregirlo se pide una **corrección**: `time_corrections` guarda el tramo a corregir (`entry_id`, o nulo si es un fichaje olvidado), el horario propuesto, el motivo y el estado (pendiente, aprobada, rechazada o cancelada).

- **Al pedirla**, la base valida:
  - que no termine en el futuro y dure como mucho 16 h;
  - que el tramo sea propio y esté cerrado;
  - que no se superponga con otro fichaje ni con otra corrección pendiente.
- **Decide** quien supervisa (`time.view_team` en su línea de reporte, o administración). Rechazar exige motivo. El solicitante solo puede cancelar.
- **Al aprobarse se aplica sola**: actualiza el tramo o inserta el olvidado, con el flag de sistema para que los guards de `time_entries` lo permitan. Queda en `audit_log`.
- **Avisos**: al aprobador natural cuando se pide; a la persona cuando se decide (con el motivo si se rechaza).

Cubierto por `supabase/tests/time_corrections.test.sql` (12 tests).

## Borrado de tareas (`0014_task_delete_guard.sql`)

Una tarea con horas imputadas no se puede borrar: esas horas pueden estar ya facturadas en una OT, y borrarla las dejaría huérfanas. Se marca como hecha. Las tareas sin horas se borran normalmente (`can_manage_project`). Cubierto por `supabase/tests/task_delete.test.sql`.

## Ajustes de la empresa (`0015_org_settings.sql`)

`organizations` suma `default_annual_vacation_days`, `default_weekly_hours` y `timezone`. Los edita quien tiene `employees.manage`, con validación de nombre y zona horaria y auditoría de los cambios.

- **Valores para quien se suma:** quien entra sin jornada ni días explícitos (por ejemplo, al aceptar una invitación) recibe los de la empresa, mediante un trigger `before insert` en `memberships`.
- **Zona horaria en las automatizaciones:** `automation_config` pasa a tomar la zona horaria de la empresa para las reglas con horario, salvo que la regla indique otra.

Cubierto por `supabase/tests/org_settings.test.sql` (7 tests).

## Foro interno (`0016_forum.sql`)

Espacio para dudas, avisos e incidencias técnicas del equipo. Lo ven y lo escriben solo las personas de la empresa.

### `public.forum_threads`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid FK → organizations | lo fija la base desde la membresía del autor |
| `author_id` | uuid FK → memberships | `on delete set null`: si la persona se va, el hilo queda |
| `category` | text | `question` (duda), `incident` (incidencia técnica), `notice` (aviso) |
| `title` / `body` | text | 5–140 / 1–5000 caracteres |
| `pinned` / `locked` | boolean | fijar arriba / cerrar: solo moderación |
| `resolved` | boolean | dudas e incidencias: autor o moderación |
| `reply_count` / `last_activity_at` | int / timestamptz | los mantiene un trigger, no el cliente |
| `created_at` / `edited_at` | timestamptz | |

### `public.forum_posts`

Respuestas de un hilo (`thread_id` con `on delete cascade`), con `org_id` copiado del hilo, `author_id`, `body` y fechas.

**Permisos:** nuevo permiso `forum.moderate` (owner y admin).

- **Leer:** cualquier persona activa de la empresa (`is_org_member`). Sin sesión u otra empresa: nada.
- **Escribir:** siempre a nombre propio (`is_own_membership`).
- **Editar:** el contenido solo su autor; fijar y cerrar, solo moderación (lo controla un trigger `guard_*`, que además vuelve inmutables la empresa, el autor, la fecha y los contadores).
- **Responder:** no se puede en un hilo cerrado, salvo moderación.
- **Borrar:** el autor o moderación.

**Avisos:** una respuesta notifica (`forum.reply`) al autor del hilo y a quienes ya participaron; un hilo de categoría *aviso* notifica (`forum.notice`) a toda la empresa. Todo queda en la auditoría.

Cubierto por `supabase/tests/forum.test.sql` (14 tests).

## Una sola empresa (`0017_single_company.sql`)

La plataforma sigue siendo multi-tenant por dentro (todas las tablas llevan `org_id` y RLS), pero esta instalación es la intranet de una sola empresa, Diplonautic:

- **Sin organizaciones nuevas:** se revoca `execute` de `create_organization()` para `anon` y `authenticated`.
- **Alta solo con invitación:** `signup_allowed(email)` dice si hay una invitación pendiente para ese email, sin importar mayúsculas. Un trigger `before insert` en `auth.users` rechaza el alta sin invitación (`signup requires an invitation`) cuando el alta llega desde Auth (GoTrue). Las cargas del sistema (seed, tests), que corren como `postgres`, no pasan por la regla.
- **Aceptación automática:** un trigger `after insert` en `auth.users` crea la membresía con el rol, el puesto, el responsable y el departamento de la invitación, y la marca como aceptada.

En el seed, la segunda organización no tiene miembros de demo: solo existe para que los tests comprueben el aislamiento entre empresas. Hay una invitación pendiente para `marc.vidal@demo.com` (técnico), para probar el alta.

Cubierto por `supabase/tests/single_company.test.sql` (8 tests).

## Menciones y novedades del foro (`0018_forum_mentions.sql`)

- `forum_threads.mentions` / `forum_posts.mentions` (`uuid[]`): personas mencionadas con @. Un trigger las filtra a personas activas de la misma empresa, sin el autor ni repetidos, y avisa a cada una (`forum.mention`). Al editar no cambian. Quien está mencionado no recibe además el aviso de respuesta ni el de aviso general.
- `forum_threads.last_author_id`: quién movió el hilo por última vez (lo mantiene el contador de respuestas).
- `forum_reads (membership_id, org_id, seen_at)`: última visita de cada persona al foro (RLS: cada uno ve y escribe solo la suya).
- `forum_unread_count(org)`: hilos con actividad **de otra persona** desde la última visita (o desde que la persona entró a la empresa). Alimenta el aviso del menú.

Cubierto por `supabase/tests/forum_mentions.test.sql` (10 tests).

## Desarrollo local

```bash
npx supabase start      # Postgres + Auth + Studio en Docker
npx supabase db reset   # aplica migraciones + supabase/seed.sql
```

El seed crea dos organizaciones demo (*Nébula Studio* y *Orbital Labs*) con jerarquía owner → manager → empleados, proyectos, fichajes de dos semanas, vacaciones pendientes de aprobar y una invitación. Usuarios: `laura@`, `carlos@`, `ana@`, `diego@`, `sofia@demo.com`, contraseña `Demo1234!`. Laura y Carlos pertenecen a ambas orgs con roles distintos, para probar el selector de organización.

## Migraciones

SQL versionado en `supabase/migrations/`, aplicado igual en dev/staging/prod vía CI (`supabase db push`).
