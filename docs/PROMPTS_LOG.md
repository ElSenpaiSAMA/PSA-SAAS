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

---

## 2026-10-05 Construcción autónoma del proyecto

**Prompt (resumen):** "Ya puedes empezar con la creación del proyecto, dale a todo que sí; si necesitas solicitar algo, tú trabaja."

**Por qué:** Con el alcance, el esquema, el diseño y el flujo de ramas ya definidos, se delegó la ejecución completa respetando las reglas acordadas (ramas `feat/*` desde `dev`, commits por capa, sin atribución de IA en el historial).

**Resultado:** Scaffold de Next.js 16 (`feat/nextjs-scaffold`), subagentes restantes + `CLAUDE.md` (`feat/dev-agents`), y el resto de capas en sus propias ramas.

---

## 2026-10-05 Revisión de seguridad del esquema → migración `0002`

**Prompt (resumen):** Antes de escribir código que dependa de la base, se aplicó el checklist del agente `security-audit` a `0001_init.sql`.

**Por qué:** Detectar fallos de RLS antes de que lleguen a un entorno es mucho más barato que después. La revisión encontró, entre otros, una recursión infinita en las policies de `memberships`, `organizations` sin RLS, autoaprobación de vacaciones y edición retroactiva de fichajes.

**Resultado:** `supabase/migrations/0002_security_hardening.sql` (no se edita `0001`, ya mergeada: se respeta la regla del agente `backend`), más el flujo de alta (crear organización, invitaciones) y un seed con dos empresas demo. Detalle en `docs/DATABASE_SCHEMA.md`.

---

## 2026-10-05 Validar SQL sin Docker local → CI con Supabase real + pgTAP

**Prompt (resumen):** El entorno de desarrollo no tenía Docker, así que no se podía levantar Supabase para probar migraciones ni RLS.

**Por qué:** Un esquema de seguridad que nunca se ejecutó es solo una hipótesis. En lugar de saltear la verificación, se movió a CI, donde los runners de GitHub sí tienen Docker.

**Resultado:** Job `database` en CI: `supabase start` (aplica migraciones + seed) y `supabase test db` con tests pgTAP que verifican aislamiento entre empresas, fichaje inmutable, no autoaprobación, no escalada de rol y no ciclos en el organigrama. Pasó en verde en la primera ejecución.

---

## 2026-10-05 Lo que CI detectó y cómo cambió el proceso

**Contexto:** Dos fallos llegaron a `dev` que localmente no se veían:
1. Un commit de la capa de datos omitió 5 módulos (`src/lib/data/*`). En el disco local existían (sin commitear), así que lint, tipos y build pasaban; CI, que clona el repo limpio, falló en el typecheck.
2. Al quitar los SVG de ejemplo del scaffold, `public/` quedó vacía; git no versiona carpetas vacías y el `COPY public` del Dockerfile falló en CI.

**Por qué importa:** Es exactamente el tipo de error que un pipeline de CI existe para atrapar ("en mi máquina funciona"). Se corrigió con ramas `fix/*` desde `dev`, como cualquier otro cambio.

**Cambio de proceso:**
- No se mergea a `dev` sin CI en verde sobre la rama (`feat/*` o `fix/*`).
- Antes de mergear, typecheck sobre un *git worktree* limpio del commit (lo que está commiteado, no lo que hay en disco).
- Recomendación: activar *branch protection* en `dev` y `main` exigiendo los checks de CI (configuración de GitHub del repositorio).

---

## 2026-10-05 QA visual con una ruta de preview local → bug de serialización

**Prompt (resumen):** Sin Supabase local, las pantallas internas no se podían ver. Se armó una ruta de preview **solo local** (excluida de git) que renderiza los componentes reales de la app con datos ficticios, y se capturaron con Playwright en modo claro, oscuro y mobile.

**Por qué:** "Compila" no es lo mismo que "funciona". Typecheck y build pasaban, pero nadie había renderizado esas pantallas.

**Resultado:** La preview encontró un bug que habría tirado error 500 en producción: `StatCard` era un Client Component y las páginas (Server Components) le pasaban el ícono como función, que React no puede serializar entre servidor y cliente. Se corrigió en `fix/stat-card-serialization` separando el componente: el ícono se renderiza en el servidor y solo el número animado vive en el cliente. Además se sumó una suite E2E autenticada contra Supabase real en CI, que cubre estas pantallas para que este tipo de error no vuelva a depender de una revisión manual.

---

## 2026-10-05 E2E autenticados contra Supabase real

**Prompt (resumen):** Los E2E iniciales solo cubrían páginas públicas (con credenciales ficticias). Se pasó a levantar Supabase en el job de E2E, con migraciones y seed, y probar flujos completos de punta a punta.

**Por qué:** Los riesgos reales del producto están detrás del login: permisos por rol, aislamiento entre empresas y los workflows de aprobación.

**Resultado:** `e2e/app.spec.ts` cubre: login inválido, selector multi-empresa, fichaje entrada/salida, solicitud de vacaciones, aprobación por el manager, empleado sin acceso a auditoría, empleado sin acceso a una empresa ajena, admin viendo la auditoría y aceptación de una invitación.

---

## 2026-10-06 Departamentos y proyectos por membresía

**Prompt (resumen):** "Faltan más funciones de una PSA: poder añadir gente a la empresa y subdividirla en departamentos con alguien a cargo; no todo el mundo debe ver todos los proyectos, solo los que le pertenecen, y el encargado del departamento todos los de su departamento."

**Decisiones (consultadas):** alta por invitación con departamento (no alta directa con contraseña, para no usar la clave de servicio); miembros de proyecto explícitos; el responsable del departamento es el manager natural de su gente (aprueba vacaciones y ve horas).

**Por qué en la base y no solo en la UI:** la visibilidad es una regla de seguridad. Si solo se filtrara en pantalla, cualquiera podría pedir los datos a la API directamente. `can_view_project` se aplica en RLS a proyectos, tareas, miembros, imputación de horas y horas agregadas.

**Resultado:** migración `0004`, "Equipo" pasa a ser **Personas** (directorio, departamentos, organigrama), panel de miembros en cada proyecto, 16 tests pgTAP nuevos y 4 E2E nuevos (31 en total). Verificado con datos reales: Ana ve 1 proyecto, Carlos los 2 de Ingeniería, Sofía los 3.

---

## 2026-10-06 La app como PSA: órdenes de trabajo, períodos y planificación

**Prompt (resumen):** Se propusieron automatizaciones con IA y se descartaron: "No tiene sentido, me refería más a duplicar tarea, copiar tarea del mes anterior. La idea es que la app funcione como una PSA y tenga una función en el tiempo; actualmente estamos trabajando sin meses, tareas, cargas de trabajo, órdenes de trabajo."

**Decisiones (consultadas):** estructura Proyecto → OT → Tareas; facturación básica (tarifa por hora, importe, facturada/no facturada); la IA queda para después, sobre esta base.

**Por qué:** una PSA organiza el trabajo en el tiempo. Sin períodos no hay presupuesto mensual, ni planificación de capacidad, ni facturación por período. Las tareas recurrentes de cada mes se resuelven duplicando la OT, no recreándolas a mano.

**Resultado:**
- Migración `0005`: OT con período, presupuesto, tarifa, estados y facturación, más reglas en la base (horas solo en OT abiertas, facturar solo cerradas, bloqueo tras facturar) y duplicado con fechas corridas.
- Nuevas secciones **Órdenes de trabajo** (por mes, con importes y pendiente de facturar) y **Planificación** (persona × semana, horas planificadas contra capacidad, descontando vacaciones).
- Duplicar tarea, copiar OT al mes siguiente y duplicar a cualquier período.
- 17 tests pgTAP y 3 E2E nuevos.

**Verificado con datos reales:** desde la OT de septiembre (cerrada y facturada) "Copiar al mes siguiente" generó la de octubre con sus tareas. La planificación detectó una sobrecarga real: Ana tenía tareas planificadas la semana de sus vacaciones aprobadas.

**Aprendizaje de QA:** dos E2E fallaron por el test y no por la app. Uno porque completaba un formulario antes de que React hidratara, otro por un selector ambiguo. Se corrigieron haciendo los tests más robustos, no relajándolos.

---

## 2026-10-06 Calendario general

**Prompt (resumen):** "Estaría también que haya un calendario y funcione a nivel general en la app." Contenido elegido: todo (tareas, ausencias, órdenes de trabajo y festivos), con acciones rápidas.

**Por qué "a nivel general":** el calendario no es una pantalla aislada. Los festivos que se cargan ahí cambian cálculos en otras secciones: no cuentan como días de vacaciones (también en el saldo calculado en la base) y descuentan capacidad en Planificación. Además, el dashboard muestra una agenda de los próximos 7 días.

**Resultado:**
- Migración `0006`: festivos por organización y `org_absences`, que muestra las vacaciones aprobadas de todo el equipo sin el motivo; las pendientes solo las ve quien aprueba.
- Calendario mes/semana con filtros por tipo y "solo lo mío". **Arrastrar una tarea** la reprograma conservando su duración, si el usuario gestiona el proyecto. **Seleccionar días** abre la solicitud de vacaciones con el conteo de días hábiles.
- 9 tests pgTAP y 2 E2E nuevos.

**Ajuste por revisión visual:** en la vista mes, las franjas de OT (que duran todo el mes) tapaban las tareas. Se priorizó el orden de los carriles (ausencias y tareas arriba, OT abajo), y el test nuevo de esa prioridad destapó un bug del algoritmo de carriles, que se corrigió.

**Verificado con datos reales:** arrastrar "Accesibilidad AA" la movió un día y se guardó en la base (después se restauró la fecha original).

---

## 2026-10-06 Órdenes de trabajo más claras

**Prompt (resumen):** "Puedes mejorar lo de las órdenes de trabajo, parece confuso."

**Diagnóstico:** el estado se repartía en dos badges (estado + facturación), las transiciones aparecían como una fila de botones sin contexto ("Aprobar", "Reabrir", "Marcar facturada"…), la recurrencia mensual estaba escondida en un icono sin texto y había dos listados de OT casi iguales (órdenes y detalle de proyecto), con un botón anidado dentro de un enlace.

**Resultado:**
- **Ciclo de vida visible:** Borrador → Aprobada → En curso → Cerrada → Facturada, como stepper en el detalle y en versión compacta en los listados.
- **"Siguiente paso":** una sola acción principal con una explicación de qué pasa al darla. Los retrocesos (volver a borrador, reabrir, revertir facturación) quedan como acciones secundarias.
- **Recurrencia explícita:** un aviso "N OT de <mes anterior> no tienen continuación en <mes>" copia todas en bloque. Cada fila dice "Copiar a <mes>", y si ese mes ya existe muestra "Sigue en <mes> →" en lugar de ofrecer un duplicado.
- **Una sola fila de OT** reutilizada en ambos listados, que se adapta al ancho de su contenedor con container queries. Filtros por estado (Todas, Borrador, En curso, Por facturar, Facturadas) y una explicación plegable de cómo funciona una OT.
- Lógica nueva en el dominio, con tests: `nextStep`, `secondarySteps`, `lifecycleIndex`, `matchesFilter`, `missingContinuations` y `findContinuation`.

---

## 2026-10-06 Pausas en el fichaje

**Prompt (resumen):** "Al momento de fichar estaría bueno que el usuario pueda parar el tiempo para almorzar y después reanudar."

**Decisión:** modelar la pausa como un tramo más (`break`) en lugar de un campo "minutos de pausa". Así queda registrado cuándo empezó y terminó cada pausa, es auditable, y el tiempo trabajado sigue siendo la suma de tramos `clock`, sin tocar los cálculos existentes. Pausar y reanudar son funciones atómicas en la base.

**Detalle encontrado al hacerlo:** `weekTotals` contaba como "horas de tarea" todo lo que no fuera `clock`, así que una pausa habría inflado las horas imputadas. Se corrigió y se cubrió con un test.

**Verificado con datos reales:** entrada → pausa → reanudar → salida como empleado, en el navegador. Después se borraron los registros de prueba.

---

## 2026-10-06 Empleados: perfil con ficha versionada

**Prompt (resumen):** "Falta la parte de empleados donde estén todas las personas; al hacer click se abre su perfil y se puede editar su información personal y sensible (DNI, cuándo se unió, sueldo…), con calendario para avanzar o retroceder en el tiempo y ver si hubo cambios. Que se vean sus proyectos y tareas, a qué equipo pertenece, si tiene gente a cargo, cuántas horas dedicó, las vacaciones que pidió, y una sección de auditoría."

**Decisiones:**
- **Sección nueva "Empleados"** (`/staff`), separada de "Personas", que sigue siendo la estructura del equipo (departamentos, organigrama, invitaciones). Los nombres del directorio enlazan al perfil.
- **Ficha versionada con fecha de vigencia** en lugar de un registro que se sobrescribe. Es lo que hace posible "avanzar o retroceder en el tiempo": cada mes muestra la ficha como estaba entonces, resalta lo que cambió ese mes y lista las versiones con qué cambió en cada una. Los cambios futuros aparecen como "Programado".
- **Privacidad por defecto:** permiso nuevo `people.sensitive` (owner/admin) para ver y editar. Cada persona ve su propia ficha. Los managers ven horas y vacaciones de su línea de reporte, no los datos sensibles. El IBAN se muestra enmascarado. Todo lo aplica la base (RLS), no solo la UI.
- **Actividad del mes:** horas fichadas contra capacidad (días hábiles × jornada, sin festivos), pausas, horas por tarea, vacaciones del año y una auditoría de lo que hizo y lo que cambió sobre la persona. Los eventos repetidos se agrupan (×N).

**Verificado con datos reales:** como admin se registró una subida con vigencia futura (apareció como programada) y se validó un IBAN inválido. Como empleado, se comprobó que no ve la ficha de otra persona. Los datos de prueba se borraron.

---

## 2026-10-06 Fondo del hero: exploración (se mantiene el original)

**Prompt (resumen):** "En la pantalla de bienvenida me gusta todo, menos el fondo. ¿Alguna otra idea?" Después: "dame más ideas, enfocate en las de tiempo y planificación".

**Proceso:** se prototiparon 13 fondos en una ruta de preview local, comparados en claro, oscuro y móvil: aurora, esfera de reloj, Gantt, puntos, arco de la jornada, regla de horas, calendario, pulso, engranajes, jornadas en vivo, reloj gigante, carga de trabajo y meridianos. Se eligió el globo de meridianos y se implementó.

**Resultado final:** al verlo integrado, el usuario prefirió volver al fondo original (cuadrícula con brillo de acento). Se revirtió antes de mergear. Los prototipos no se versionaron; queda este registro de lo explorado.

**Arreglo que sí quedó:** con "reducir movimiento" activado, `AnimatedNumber` provocaba un error de hidratación (el servidor pintaba 0 y el cliente el valor final). Ahora arranca en 0 en ambos y salta al valor al montar.

---

## 2026-10-06 Fondo del hero: collage de producto

**Prompt (resumen):** "El fondo necesito que esté un poco más cargado, no hace falta lo minimalista." Se prototiparon 6 fondos más densos: collage de producto, malla de color, mapa de calor, red del equipo, Gantt en perspectiva y marquesinas de actividad. El usuario eligió el **collage de producto**.

**Resultado:** tarjetas reales de la app flotando a los costados del titular, sobre la cuadrícula original: reloj de fichaje en marcha, vacaciones aprobadas, OT con su barra de horas, gráfico de horas de la semana, equipo de hoy y OT facturada.

**Por qué funciona:** llena el espacio vacío y, además, explica el producto de un vistazo.

**Detalles:**
- Solo se muestran desde 1280 px, porque en pantallas más chicas no hay lugar a los costados sin pisar el titular.
- Las posiciones están ancladas al centro, así se reparten bien hasta 1920 px.
- Un velo suave detrás del texto mantiene la legibilidad.
- El contenido es fijo (sin hora real ni aleatorios) para no romper la hidratación. Con "reducir movimiento" las tarjetas no flotan.
- Es decorativo: `aria-hidden` y sin eventos de puntero.
## 2026-10-06 Bandeja de pendientes y notificaciones

**Prompt (resumen):** "¿Le falta algo al PSA? Siento que cada apartado está incompleto: por ejemplo, vacaciones se puede solicitar, ¿pero quién las aprueba y dónde?" Y: "Necesito más workflows que permitan realizar acciones automáticamente."

**Diagnóstico:** casi todas las secciones tenían la acción principal, pero no el circuito: quién decide, cómo se entera y qué pasa después. Las vacaciones sí se aprobaban (lista "Por aprobar" en Vacaciones), pero nadie avisaba al aprobador y el empleado no sabía quién era. Se acordó este orden: (1) notificaciones + bandeja, (2) motor de automatizaciones, (3) completar secciones. Las notificaciones son solo dentro de la app; el email queda para más adelante.

**Fase 1 (esta entrega):**
- **Notificaciones generadas por la base** (triggers): vacaciones pedidas, decididas y canceladas; tarea asignada; alta en un proyecto; OT cerrada pendiente de facturar.
- **Aprobador natural** (`vacation_approvers`): el primer responsable hacia arriba con permiso; si no hay, administración.
- **Bandeja** (`/inbox`) con dos partes:
  - **Pendientes**, calculados en el momento, con acción directa: aprobar o rechazar vacaciones ahí mismo; cerrar OT vencidas, aprobar borradores que ya empezaron, facturar OT cerradas, tareas propias vencidas y fichajes olvidados de días anteriores. Lo urgente va primero.
  - **Notificaciones**, con leído/no leído y "marcar todo como leído".
- **Contador en el menú** y campanita en móvil. Los avisos que ya figuran como pendiente no se cuentan dos veces.
- En Vacaciones, el empleado ve "La aprueba Carlos Ruiz. Le llega un aviso a su bandeja."

**Verificado con datos reales:** Diego pidió un día, a Carlos le apareció el contador, el pendiente y el aviso; lo aprobó desde la bandeja y a Diego le llegó la decisión. Los datos de prueba se borraron.

---

## 2026-10-06 Motor de automatizaciones

**Prompt (resumen):** "Necesito que generes más workflows de trabajo que permitan realizar acciones automáticamente." Es la fase 2 del plan acordado, después de notificaciones y bandeja.

**Decisión de arquitectura:** el motor vive **en la base**: triggers para los eventos y `pg_cron` cada 15 minutos para lo programado.
- No depende de servidores ni crons externos.
- Respeta RLS y los guards.
- Cada acción queda auditada y con deduplicación: correr una regla dos veces no repite nada.

La app solo configura (activar y parámetros) y muestra el historial. Un botón "Ejecutar ahora" permite probar cada regla sin esperar al próximo ciclo.

**Reglas:**
- Vacaciones: aprobar solas las ausencias cortas; escalar las que no tienen respuesta.
- Fichaje: cerrar fichajes olvidados; recordar la salida.
- OT: aviso al 80 % y al 100 % del presupuesto; cierre al terminar el período; creación de las OT del mes.
- Tareas: recordatorio de vencimientos.
- Equipo: resumen semanal para cada responsable.

Las que cambian datos por su cuenta (cerrar o crear OT, aprobar vacaciones) vienen **desactivadas**. Las que solo avisan vienen activadas.

**Detalles encontrados al probar:**
- Al aprobar sola una solicitud, el aviso "pidió vacaciones" ya no le llega al aprobador. El trigger de avisos revisa el estado real de la fila, porque la automatización corre antes.
- Copiar una OT avisaba "te asignaron una tarea" por cada tarea copiada en borrador. Ahora la copia en bloque es silenciosa.
- Los títulos de las OT creadas solas usan los meses en español (Postgres los pone en inglés por defecto).

**Verificado:** 14 tests pgTAP y una corrida forzada de todas las reglas sobre los datos reales (en una transacción revertida). En el navegador, una admin activó una regla, cambió un parámetro (con validación) y ejecutó el resumen semanal: 2 avisos. Un empleado no ve la sección. La configuración de prueba se volvió a los valores por defecto.

---

## 2026-10-06 Vacaciones: las aprobaciones viven en la pestaña Equipo

**Prompt (resumen):** "Lo de aprobar vacaciones no tiene que estar en la bandeja. Que llegue la notificación de que tal pidió vacaciones y, si hace click, que lo lleve a donde se aprueban. Eso debería estar en Vacaciones: la gente que se encarga de aprobar debería ver una pestaña donde reciben las solicitudes, ven las vacaciones de todo su equipo, un calendario, y deciden."

**Por qué tiene sentido:** decidir unas vacaciones requiere contexto (quién más está fuera esos días, cuántos días le quedan). Un botón "Aprobar" suelto en la bandeja invitaba a decidir sin mirar.

**Resultado:**
- La **bandeja** ya no muestra las vacaciones como pendiente. Llega solo la notificación, que enlaza a `/vacations?tab=equipo` (migración `0011`, que también corrige los avisos ya enviados).
- **Vacaciones** tiene dos pestañas. "Mis vacaciones" es para todos. **"Equipo"** solo la ven quienes pueden aprobar y tienen gente a cargo, con un contador de solicitudes por decidir. Incluye:
  - Resumen: por decidir, quién está fuera hoy y personas a cargo.
  - Solicitudes por decidir, con aviso de coincidencias ("Coincide con Ana" o "Sin coincidencias en el equipo"), el saldo restante y, si le corresponde a otra persona, "Le toca a X". Primero van las propias.
  - **Calendario del equipo**: grilla persona × día del mes, con aprobadas (verde), pendientes (ámbar rayado), fines de semana y festivos sombreados y la columna de hoy resaltada. Se navega por meses.
  - Próximas ausencias.
- En "Mis vacaciones", quien tiene solicitudes por decidir ve un acceso directo a la pestaña Equipo.
- Lógica nueva en el dominio, con tests: `absenceGrid` y `overlappingPeople`.

**Verificado:** Diego pidió dos días. A Carlos le llegó la notificación (sin botón de aprobar en la bandeja); el click lo llevó a la pestaña Equipo, vio la solicitud en el calendario y la aprobó. Diego no ve la pestaña.

---

## 2026-10-06 Fase 3a: tipos de ausencia y motivo de rechazo

**Contexto:** la fase 3 del plan completa cada sección. Esta parte cubre lo que faltaba en Vacaciones.

**Resultado:**
- **Tipos de ausencia**: vacaciones, asuntos propios, baja médica y otra (esta última con motivo obligatorio). Solo las vacaciones descuentan saldo; el formulario lo explica según el tipo elegido. Una baja médica se puede cargar con fecha pasada, porque se suele avisar después.
- **Rechazar exige motivo**, tanto en la base como en la UI: al tocar "Rechazar" aparece un campo y "Confirmar rechazo" no se habilita hasta escribirlo. La persona ve el motivo en su lista y en la notificación.
- El calendario del equipo colorea por tipo y mantiene el rayado para las pendientes.
- **Privacidad:** el calendario de toda la empresa sigue mostrando solo "ausente"; el tipo (dato de salud en una baja) solo lo ven la persona y quien aprueba.

**Verificado en el navegador:** Diego registró una baja de ayer y pidió un día de vacaciones. Carlos aprobó la baja y rechazó las vacaciones con motivo. El saldo de Diego no se movió por la baja y el motivo le llegó.

---

## 2026-10-06 Fase 3b: correcciones de fichaje

**Problema:** el fichaje es inmodificable a mano, a propósito, porque la hora de entrada la pone la base. Pero no había forma de arreglar un olvido ("no fiché la salida", "entré a las 8 y fiché tarde", "estuve en un cliente"), y el cierre automático de fichajes olvidados le pedía a la persona "revisarlo" sin darle cómo.

**Resultado:**
- En el historial de fichajes, cada jornada cerrada tiene **"Corregir"**: un formulario con las horas precargadas y un motivo. Además, hay un botón **"Agregar un fichaje olvidado"**. Hasta que se apruebe, el fichaje no cambia y se ve como "Corrección pendiente".
- Quien supervisa recibe el aviso. Al hacer click, llega a **Fichaje y horas**, donde arriba ve "Correcciones por decidir" con el antes y el después (por ejemplo "11:10–20:03 → 08:00–20:03") y el motivo. Al aprobar, la corrección **se aplica sola**; rechazar exige motivo.
- La persona ve sus correcciones con estado y respuesta.
- Igual que con las vacaciones, las decisiones viven en su sección y llegan como notificación, no como pendiente de la bandeja.

**Lección de CI (de la fase 3a):** un test pgTAP pasaba contra la base de desarrollo, que tenía datos de pruebas anteriores, y fallaba en CI, sobre una base limpia. Se agregó a `CLAUDE.md` la regla de tests independientes de los datos, y la de un login por test E2E.

---

## 2026-10-06 Fase 3c: editar y borrar tareas

**Problema:** las tareas solo se podían crear y mover de columna. No se podía corregir un título, cambiar el responsable o las fechas, ni borrar una tarea creada por error.

**Resultado:**
- En el tablero, quien gestiona el proyecto tiene **"Editar"** en cada tarjeta (si la OT no está facturada). Abre un formulario dentro de la tarjeta para título, responsable, estimación y fechas.
- **Borrar** pide confirmación en dos pasos.
- **Una tarea con horas imputadas no se borra**: lo garantiza la base (`0014`) y en la UI el botón aparece deshabilitado con la explicación ("márcala como hecha").
- Quien solo tiene la tarea asignada sigue pudiendo moverla de columna, pero no editar sus datos (guard existente).

**Verificado en el navegador:** se editó la estimación de una tarea con horas (se pudo editar, no borrar) y se creó y borró una tarea temporal.

---

## 2026-10-06 Fase 3d: ajustes de la empresa

**Problema:** no había dónde configurar la empresa. Toda persona nueva entraba con 22 días y 40 h, y las automatizaciones usaban siempre la hora de Madrid.

**Resultado:** página **Ajustes** (owner y admin) con:
- Nombre y **zona horaria** de la empresa. Esta última la usan los recordatorios y resúmenes automáticos.
- **Valores por defecto** de días de vacaciones y jornada semanal para quien se sume a partir de ahora (la base los aplica al aceptar una invitación).
- **Qué puede hacer cada rol**: tabla leída de la base (`role_permissions`), así nunca queda desactualizada respecto de lo que realmente permite RLS.
- Accesos directos a festivos, departamentos y personas, automatizaciones y auditoría.

Con esto se completa la fase 3 del plan: tipos de ausencia y motivo de rechazo, correcciones de fichaje, edición y borrado de tareas, y ajustes.

---

## 2026-10-06 Informes y exportación

**Prompt (resumen):** "Ve haciendo lo de la IA y los informes y exportación." Los informes van primero porque no dependen de servicios externos (la IA necesita la clave de OpenRouter).

**Resultado:** sección **Informes**, por mes. Cada persona ve solo los informes que le corresponden:

| Informe | Quién lo ve | Qué muestra |
|---|---|---|
| **Facturación** | `billing.manage` | Cliente, proyecto y OT con horas, tarifa e importe. Separa facturado, por facturar (cerradas) y en curso, con totales |
| **Horas por persona** | `time.view_team`, sobre su línea de reporte (administración, toda la empresa) | Fichadas, imputadas, desglose por proyecto y **dedicación** contra la capacidad |
| **Ausencias** | `vacations.approve` | Días del mes por tipo y saldo anual de vacaciones |

**Decisiones:**
- **Lo que se ve es lo que se exporta.** La página y `/reports/export` usan las mismas funciones de datos y el mismo control de permisos. Sin permiso, la exportación devuelve 403.
- **CSV pensado para Excel en español:** separador `;`, coma decimal y BOM UTF-8, para que se abra con doble click sin problemas de tildes ni de columnas. Se evitó una librería de .xlsx.
- **Dedicación honesta:** en el mes en curso se mide contra la capacidad **hasta hoy**. Contra el mes completo, el 6 de octubre daba un 4 % engañoso.

**Verificado en el navegador:** la owner vio los tres informes y descargó los tres CSV (revisados por dentro). Un manager no ve Facturación (403 al forzar la descarga) y un empleado no ve la sección.

---

## 2026-10-06 Kairos IA (OpenRouter)

**Prompt (resumen):** retomar la IA con OpenRouter que había quedado pendiente: asistente con ⌘K, reparto de horas al fichar y resumen semanal.

**Arquitectura:**
- **Cliente de OpenRouter solo en el servidor** (`src/lib/ai/openrouter.ts`): la clave nunca llega al navegador. El modelo se configura con `OPENROUTER_MODEL` y `OPENROUTER_BASE_URL` permite apuntar a un proxy o a un servidor de prueba. Los errores se traducen a mensajes claros (clave inválida, sin saldo, límite de uso, modelo inexistente).
- **Sin clave, todo funciona igual**: cada función de IA explica cómo activarse. CI corre sin clave.
- **Asistente con herramientas de solo lectura** (ausencias, órdenes de trabajo, mis tareas, horas del equipo, pendientes, personas). Cada herramienta usa las funciones de datos de la app **con la sesión de quien pregunta**, así que RLS decide qué ve la IA. No hay herramientas sobre fichas personales ni sueldos. Hace hasta 4 rondas de consultas por pregunta.
- **Nunca se confía en la salida del modelo**: `src/lib/domain/ai.ts` extrae el JSON aunque venga con texto alrededor y valida el reparto (solo tareas reales y abiertas, cuartos de hora, sin superar lo fichado). La persona **revisa antes de imputar**.

**Funciones:**
1. **⌘K → "Preguntarle a Kairos"**: conversación dentro de la paleta.
2. **Fichaje → "Repartir lo fichado hoy con IA"**: propuesta editable (casillas y horas) y luego "Imputar".
3. **Inicio (responsables) → "Resumen del equipo"**: cómo viene el mes, quién estará fuera y qué atender. Se genera bajo demanda, para no gastar créditos.

**Cómo se probó sin clave real:** un servidor local compatible con OpenRouter que responde con llamadas a herramientas y JSON. Se ejercitó el circuito completo: el asistente pidió la herramienta "personas", recibió los datos y respondió; el reparto propuso horas (una de ellas inválida, que se corrigió sola) y se imputó; el resumen salió con los datos del equipo. Aparecieron y se corrigieron dos bugs: un efecto de React que devolvía un valor, y `Escape` que no cerraba el asistente.

**Lección de CI (Informes):** un E2E asumía que Diego seguía siendo empleado, pero un test anterior lo hace responsable de departamento y eso lo asciende a manager. Quedó anotado en `CLAUDE.md`.

---

## 2026-10-06 Prueba técnica Diplonautic: foro interno

**Prompt (resumen):** la prueba técnica pide una web corporativa demo para una empresa de reparación náutica: home pública, contacto, login de empleados con roles (empleado y admin) y un **foro interno** donde solo las personas autenticadas leen y escriben (lista de hilos con título, autor y fecha, crear hilo y responder). Se decidió **reutilizar la app** como intranet de la empresa en lugar de empezar de cero, y entregar cada parte por Pull Request.

**Decisiones del foro:**
- **Categorías propias del taller:** duda, incidencia técnica y aviso. Un *aviso* le llega como notificación a toda la empresa; las dudas e incidencias se marcan como **resueltas**, para que el foro sirva de base de conocimiento ("¿cómo se arregló el plotter del Lagoon?").
- **La seguridad está en la base, no en la pantalla:** RLS para leer (solo la empresa) y escribir (solo a nombre propio), y triggers que impiden a un empleado fijar o cerrar hilos, editar lo ajeno, responder en un hilo cerrado o tocar los contadores. La UI solo esconde los botones que no corresponden.
- **Moderación** con un permiso nuevo, `forum.moderate` (owner y admin): fijar arriba, cerrar y borrar.
- **Texto plano** con saltos de línea: sin HTML ni Markdown, así no hay riesgo de inyectar código.
- **Si alguien deja la empresa**, sus mensajes quedan (autor "Ex miembro"): el historial técnico no se pierde.
- **Datos de prueba náuticos** en el seed: protocolo de varadero (fijado), plotter Garmin que se reinicia (resuelto), sellador para pasacascos, alternador Volvo Penta, procedimiento de repuestos urgentes (cerrado).

**Pruebas:** 14 pgTAP (aislamiento entre empresas, sin sesión, autoría, cerrado, moderación, contadores, avisos), unitarios de dominio (orden, filtros, permisos) y E2E del recorrido completo: una empleada abre una incidencia, un compañero responde, la admin cierra el hilo y a la autora le llega el aviso, pero ya no puede responder.

---

## 2026-10-07 Prueba técnica Diplonautic: web pública

**Prompt (resumen):** segunda parte del plan de la prueba: una web corporativa demo para la empresa de reparación náutica, con una home que presente la empresa y sus servicios y una página de contacto con un formulario visual.

**Decisiones:**
- **Una sola marca:** el PSA genérico ("Kairos") pasa a ser la intranet de **Diplonautic**. La marca y los datos de contacto viven en `src/lib/brand.ts`, y el acento cambia de índigo a azul marino. El asistente de IA pasa a llamarse "Asistente IA".
- **La home le habla al cliente, no al empleado:** servicios (mecánica, electricidad, electrónica, pintura, jarcia, varadero), la empresa con sus cifras y valores, el proceso en cuatro pasos y una llamada a pedir presupuesto. El acceso de empleados queda visible en la cabecera y en el pie, pero en segundo plano.
- **Se conserva el fondo "collage"** que se había elegido, ahora con escenas del taller: diagnóstico, antifouling, varadero, presupuesto, avance de la reparación y próxima revisión.
- **Formulario de contacto "visual" pero serio:** validación con Zod en una Server Action (igual que uno real), un campo trampa para bots, errores accesibles y una confirmación que aclara que es una demo y que el mensaje no se envía. No se guarda nada: la prueba no lo pide, y guardar datos personales de visitantes sin necesidad suma riesgo.
- **Contenido alineado con la empresa real** (diplonautic.com): primero se armó con servicios genéricos de taller náutico, pero Diplonautic se especializa en **equipos eléctricos y de confort** (aire acondicionado, refrigeración, generadores, potabilizadoras, sistemas eléctricos y hélices de proa) y tiene una segunda línea, **ElectroMotor** (motores de arranque, alternadores y dinamos). Se reescribieron los servicios, la historia (más de 30 años), las tarjetas del hero y las opciones del formulario. Se usan sus datos de contacto públicos, y el pie aclara que es un sitio demostrativo hecho para una prueba técnica. Las cifras inventadas se quitaron.

**Pruebas:** unitarios del esquema de contacto y del de hilos del foro, y E2E en escritorio y móvil: home, CTA al contacto, acceso de empleados al login, validación y envío del formulario, y redirección al login cuando se entra al foro sin sesión.

---

## 2026-10-07 Web pública: diseño definitivo (foto, barco 3D y azules)

**Prompt (resumen):** iterar el diseño de la home con la referencia de la web real de Diplonautic (foto a pantalla completa con velo azul) y de una web con efectos 3D. Lo primero fue un fondo de carta náutica. Después, un barco 3D que se maneja con el mouse, sin secuestrar el scroll. Después se integraron las fotos que aportó el usuario en `public/barcos`. Por último, ajustes de tono: solo tema claro, más azul, sin grises cálidos y botones de acción en azul.

**Decisiones:**
- **Hero con foto y velo azul**, como la web actual de la empresa pero con parallax suave y una ola de transición. El texto largo se reemplazó por una frase corta y una píldora animada ("Especialistas en …") que rota las especialidades: se lee menos de golpe.
- **"Dentro de tu barco": yate de cristal en 3D** (three.js con React Three Fiber) sobre la carta náutica. Con mouse se puede girar (sin zoom, para que la rueda siga bajando la página) y, al pasar por un equipo, se ilumina y lo explica una ficha. En pantallas táctiles gira solo y no captura el scroll. Las etiquetas se proyectan a mano en HTML, en lugar de usar el `Html` de drei: el de drei dejaba una etiqueta sin mostrar y generaba avisos de React. El modelo está hecho con formas simples, sin archivos 3D externos. La librería solo se carga en esa sección (`next/dynamic`, sin SSR).
- **Nada de herramientas internas en la web pública:** se quitaron las tarjetas de presupuestos, avances y técnicos. La web le habla al cliente y la intranet queda detrás de "Acceso empleados".
- **Solo tema claro en la web pública** (`/` y `/contacto`): `next-themes` fuerza el tema claro según la ruta (`src/lib/public-site.ts`), y la intranet sigue respetando la preferencia de cada persona.
- **Más azul y sin "crema":** los grises neutros de la app, al lado de tanto azul, se leían cálidos. En la web pública se usan grises fríos (slate), celestes y azul marino. La cabecera sobre la foto va en blanco y, al bajar, en vidrio azul marino. Los botones de acción son azules.
- **Fotos optimizadas:** se convirtieron a JPG con nombres descriptivos (de 1,5 MB a 155 KB la más pesada) y se sirven con `next/image`. La galería es un carrusel que avanza solo hasta la última foto y se puede arrastrar, sin flechas, a pedido del usuario.
- **Contacto con el mismo lenguaje visual:** encabezado con foto, ola, carta náutica y el formulario en una tarjeta que sube sobre la foto.

**Pruebas:** unitarios de `isPublicSitePath` y E2E de la web en escritorio y móvil (home, CTA, acceso de empleados y formulario de contacto). Todo se revisó en el navegador: arrastre del barco y del carrusel, tema oscuro del sistema (la web pública queda clara) y móvil sin scroll horizontal.

---

## 2026-10-07 Intranet de una sola empresa y alta de empleados

**Prompt (resumen):** como la web es de Diplonautic, no tiene sentido que la app maneje varias organizaciones: al iniciar sesión hay que entrar directo a la intranet de Diplonautic. Además, la intranet tiene que tener que ver con la web, sin perder formalidad.

**Decisión de alta (la prueba pide justificarla): registro solo con invitación del administrador.**
- *Por qué no registro abierto:* es una intranet corporativa con datos de clientes y del personal. Cualquiera que se registre no puede ver el foro ni los fichajes del equipo.
- *Por qué no que el admin cree la cuenta con una contraseña:* el admin conocería la contraseña del empleado, y la app necesitaría la clave maestra de Supabase (`service_role`) en el servidor. Un secreto con acceso total es un riesgo innecesario.
- *Cómo funciona:* el admin invita desde Personas (email, rol, departamento, responsable y puesto) y copia el **enlace de activación**. La persona elige su contraseña y entra directo a la empresa con ese rol. **La base rechaza cualquier registro sin invitación**, aunque se llame directo a la API de Auth.

**Una sola empresa:**
- La arquitectura multi-tenant (RLS por `org_id`) se conserva y se sigue testeando. Lo que cambia es la instalación: nadie puede crear organizaciones (permiso revocado en la base), al iniciar sesión se entra directo al panel y el selector de organización desaparece de la barra lateral cuando hay una sola.
- La empresa de demo pasa a llamarse **Diplonautic**. La segunda organización queda sin miembros de demo, solo para los tests de aislamiento.
- **Bug encontrado:** el selector buscaba "invitaciones pendientes" sin filtrar por email. Como un admin ve por RLS todas las de su empresa, a Sofía le aparecía como propia la invitación de Marc y no la dejaba entrar. Ahora filtra por el email de quien inició sesión.

**Diseño de la intranet:** barra lateral en azul marino (el de la web), con el logo invertido y "Intranet · rol"; la sección activa con una línea celeste; los botones principales en azul marino; el login y la activación con el panel de foto de la web. El contenido sigue claro y sobrio, y el modo oscuro de la intranet se mantiene.

**Pruebas:** 8 pgTAP (sin organizaciones nuevas, alta con y sin invitación, aceptación automática con rol y puesto, cargas del sistema), E2E de entrada directa, de alta rechazada sin invitación y de alta de un técnico invitado (en un proyecto con confirmación por email, el test verifica el aviso de confirmación). También se probó contra el Supabase real: el registro sin invitación queda bloqueado por la base.

