# Dirección de diseño

Referencia de nivel: [jeremy-jaques.vercel.app](https://jeremy-jaques.vercel.app/) — no aplicamos su temática narrativa (es un portfolio cinematográfico), sino su estándar de ejecución: **premium por contención**, no por exceso. Mucho whitespace, tipografía como protagonista, movimiento con propósito (nunca decorativo porque sí), micro-interacciones cuidadas en cada detalle.

Esto es un SaaS de gestión (RRHH/proyectos), así que el reto es lograr ese nivel de pulido dentro de un dashboard funcional, no solo en una landing.

## Principios

1. **Minimalismo real**: paleta casi monocroma (negro/blanco/grises) + un único color de acento. Nada de gradientes genéricos de plantilla ni iconos de stock sin curar.
2. **Tipografía como jerarquía**: una fuente variable de calidad (ej. Geist, General Sans o Inter Display) con escala tipográfica definida, no tamaños arbitrarios.
3. **Movimiento con intención**: toda animación responde a una acción del usuario o guía su atención (entrada de elementos, feedback de hover, transición de página). Nada de animar por animar.
4. **Densidad controlada**: el dashboard de un SaaS tiende a saturarse de datos; se prioriza espacio en blanco y agrupación clara por encima de meter todo en pantalla.
5. **Dark mode de calidad real**, no solo invertir colores — pensar la paleta para ambos modos desde el inicio.

## Stack de diseño/UI

- **Tailwind CSS** + **shadcn/ui** (Radix primitives) como base de componentes accesibles.
- **Framer Motion** para micro-interacciones, entradas escalonadas (stagger) al hacer scroll, y transición entre páginas (App Router).
- **Lenis** (smooth scroll) en landing/marketing pages — no necesariamente dentro del dashboard de datos, donde el scroll nativo es más usable.
- **Comando rápido (cmd+k / command palette)** tipo Linear/Vercel — señal inmediata de producto "pro" para cualquier reclutador técnico que lo pruebe.
- **lucide-react** para iconografía consistente.
- Gráficos/stats del dashboard (carga de horas, vacaciones, etc.) con una librería liviana y estilizable (Recharts o Tremor), nunca el estilo por defecto sin personalizar.

## Momentos "wow" específicos de este producto

- **Landing/marketing page** (antes del login): la pieza más libre para lucirse — hero con animación de entrada, scroll reveals, sección de features con transiciones sutiles.
- **Login/auth**: fondo con gradiente animado sutil o mesh, transición suave al autenticar (no un simple redirect brusco).
- **Dashboard**: números animados (contadores) para KPIs (horas cargadas, días de vacaciones disponibles), skeletons de carga diseñados (no un spinner genérico), estados vacíos ilustrados con intención.
- **Fichaje**: micro-interacción clara al fichar entrada/salida (confirmación visual satisfactoria, no solo un toast de texto).
- **Command palette**: navegar la app entera sin mouse, con atajos.

## Decisiones tomadas en la implementación

- **Marca**: *Kairos* (en griego, "el momento justo"), centralizada en `src/lib/brand.ts`. Logo: un reloj minimal con la aguja de minutos en el color de acento.
- **Color**: grises neutros en OKLCH + un único acento índigo (`oklch(0.55 0.2 272)` claro / `oklch(0.68 0.17 272)` oscuro). Estados semánticos (`success`, `warning`, `danger`) solo para estado, nunca decoración. Tokens en `src/app/globals.css`.
- **Tipografía**: Geist (UI) + Geist Mono (números, relojes) + **Instrument Serif itálica** como acento editorial en titulares ("El tiempo de tu equipo, *en orden.*"). El contraste sans/serif es el gesto de marca.
- **Movimiento**: una sola curva (`cubic-bezier(0.16, 1, 0.3, 1)`) para todo; entradas con blur + desplazamiento corto; `prefers-reduced-motion` respetado globalmente.
- **Firmas visuales**: preview del producto en el hero que se "asienta" en perspectiva al hacer scroll, tarjetas con halo que sigue al cursor, contadores animados, tablero kanban con `layoutId` (las tarjetas viajan entre columnas), reloj de fichaje con pulso en vivo, paleta ⌘K.
- **Estados**: cada lista tiene estado vacío ilustrado; cada ruta tiene `loading.tsx` con skeleton; errores de formulario con micro-shake y foco accesible (`aria-invalid` + `aria-describedby`).

## Qué evitar

- Plantillas de admin dashboard genéricas "de curso online".
- Animaciones con rebote/easing juguetón (bounce) — el tono es serio/premium, easings tipo `ease-out` suaves, nunca spring agresivo.
- Sombras duras o bordes muy marcados — preferir bordes sutiles (1px, baja opacidad) y sombras muy suaves.
- Saturar el dashboard con color: el acento se reserva para acciones primarias y estados (éxito/alerta), no para decorar.
