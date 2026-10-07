# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-10-08

Primera versión publicada para **Diplonautic**: la web corporativa y la intranet **Diplonautic OS**, construidas sobre la base multi-tenant de la 0.1.0.

### Web corporativa
- Home con hero de fotos, yate 3D interactivo sobre la carta náutica, servicios, empresa, galería y forma de trabajar.
- Página **ElectroMotor** (`/electromotor`): los cinco equipos del taller en 3D, que se desmontan pieza por pieza, con la foto real de cada uno y lo que se revisa. Se llega desde la banda de la home, el header y el footer.
- Contacto con formulario validado en el servidor y tarjeta de tamaño fijo. La consulta se guarda en la bandeja **Mensajes web** y quien escribe recibe una confirmación por email (SMTP).
- Desde ElectroMotor, "Pedir presupuesto" abre el contacto con el servicio ya elegido.

### Diplonautic OS (intranet)
- Una sola empresa: alta solo por invitación, con email de activación y enlace copiable.
- **Roles y jerarquía:** dos estructuras (niveles y ramas), 8 niveles desde aprendiz hasta CEO, rol por proyecto, permisos por rama y por departamento, y superadmin de plataforma con acceso a todo.
- **Fichaje** estilo Factorial con pausas y correcciones aprobadas, y **horas por tarea** estilo Productive.
- **Vacaciones y ausencias** por tipo, con motivo obligatorio al rechazar, festivos de empresa y calendario del equipo.
- **Órdenes de trabajo** por período, con facturación, planificación de carga y ciclo de vida. Se copian a otro mes con un botón y se renuevan solas cada mes con el interruptor del proyecto.
- **Proyectos** por departamento, con miembros, invitación desde el proyecto o la OT y tablero de tareas.
- **Foro interno** con hilos, respuestas anidadas, menciones, moderación y el panel "Sobre este hilo".
- **Personas:** directorio, fichas versionadas con datos sensibles protegidos y departamentos con responsable. Administración puede eliminar a una persona junto con su cuenta.
- **Mi perfil** con foto. El nombre, el puesto y los avisos los gestiona administración.
- Avisos y acciones pendientes, informes con exportación CSV, automatizaciones programadas y asistente con IA.
- **Registro de errores** propio (servidor, acciones y navegador) y la pantalla **Estructura** para el superadmin.

### Calidad e infraestructura
- 230 tests unitarios (Vitest), 264 aserciones pgTAP en 22 archivos y 83 E2E (Playwright) contra Supabase real.
- CI en GitHub Actions: lint, typecheck, tests, build, imagen Docker, base de datos y E2E. `dev` y `main` solo se promueven en verde.
- Producción en Vercel (`main`) con 26 migraciones de Supabase.

## [0.1.0] — 2026-10-05

Base del producto: mini SaaS multi-tenant de gestión de personas y proyectos (entonces **Kairos**).

### Producto
- Landing pública con hero animado, bento de features, scroll storytelling y sección de seguridad.
- Registro, login y confirmación por email (PKCE) con Supabase Auth; sesión refrescada en `proxy.ts`.
- Selector multi-empresa, creación de organización e invitaciones por email.
- Fichaje de entrada/salida, imputación de horas a tareas, gráfico semanal y carga del equipo.
- Vacaciones con saldo en días hábiles, validación en vivo y aprobación por línea de reporte.
- Proyectos con presupuesto vs. horas reales y tablero kanban con actualizaciones optimistas.
- Equipo: directorio, organigrama y edición de rol/manager respetando rangos.
- Auditoría inmutable con detalle de cambios campo por campo.
- Paleta de comandos ⌘K, modo claro/oscuro y diseño responsive.

### Seguridad
- RLS por organización en todas las tablas; permisos por rango en catálogo editable.
- Triggers que impiden autoaprobación de vacaciones, escalada de rol, ciclos en el organigrama y edición retroactiva de fichajes.
- Horas por tarea expuestas solo como agregados (`task_logged_minutes`).
- Cabeceras de seguridad HTTP y protección contra *open redirects*.

### Calidad e infraestructura
- 72 tests unitarios y de componentes (Vitest), 18 tests de RLS (pgTAP) y 27 E2E (Playwright) contra Supabase real.
- CI en GitHub Actions: lint, typecheck, tests, build, E2E, RLS y build de imagen Docker.
- Deploy: `dev` → staging, `main` → producción (Vercel + migraciones de Supabase).
- Imagen Docker multi-stage `standalone` con usuario no-root.

### Corregido durante el desarrollo (detectado por CI y QA visual)
- Módulos de datos que faltaban en un commit (detectado por CI sobre repo limpio).
- Carpeta `public/` vacía que rompía el build de Docker.
- Íconos pasados como función de Server a Client Components (error 500 en runtime).
- Desajustes de hidratación por zona horaria del servidor (UTC) vs. navegador.

[1.0.0]: https://github.com/ElSenpaiSAMA/PSA-SAAS/releases/tag/v1.0.0
