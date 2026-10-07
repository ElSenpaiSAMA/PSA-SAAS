// ElectroMotor: el taller de Diplonautic que repara la parte eléctrica que mueve el
// motor (alternadores, motores de arranque, dinamos…), de barcos y de vehículos.
// Contenido de diplonautic.com/electromotor, en castellano.

export type ElectroIcon = "starter" | "alternator" | "dynamo" | "motor" | "pump";

export interface ElectroService {
  id: string;
  icon: ElectroIcon;
  title: string;
  summary: string;
  checks: string[];
}

export const ELECTRO_SERVICES: ElectroService[] = [
  {
    id: "arranque",
    icon: "starter",
    title: "Motores de arranque",
    summary: "Cuando el motor hace clic y no gira, o arranca a veces sí y a veces no.",
    checks: [
      "Prueba en banco",
      "Desmontaje y limpieza general",
      "Limpieza de los anillos colectores",
      "Revisión de escobillas, regulador, estator y puente rectificador",
      "Pintura del motor de arranque",
    ],
  },
  {
    id: "alternadores",
    icon: "alternator",
    title: "Alternadores",
    summary: "Si las baterías no cargan o la carga baja con el motor en marcha.",
    checks: [
      "Desmontaje y limpieza general",
      "Limpieza de los anillos colectores",
      "Revisión de escobillas, regulador, estator y puente rectificador",
      "Pintura del alternador",
    ],
  },
  {
    id: "dinamos",
    icon: "dynamo",
    title: "Dinamos y reguladores",
    summary: "Equipos clásicos que siguen funcionando, con el cuidado que necesitan.",
    checks: [
      "Prueba en banco",
      "Desmontaje de la dinamo",
      "Limpieza general",
      "Revisión de escobillas (si hace falta)",
      "Limpieza del colector",
      "Engrase general",
    ],
  },
  {
    id: "motores",
    icon: "motor",
    title: "Motores eléctricos",
    summary: "Motores de molinetes, hélices de proa, bombas y equipos de a bordo.",
    checks: [
      "Revisión del estado de las bobinas",
      "Revisión del rotor",
      "Prueba de aislamiento",
      "Cambio de rodamientos",
      "Escobillas y colector (en motores de corriente continua)",
    ],
  },
  {
    id: "bombas",
    icon: "pump",
    title: "Bombas eléctricas",
    summary: "Achique, agua dulce, refrigeración: que vuelvan a bombear como el primer día.",
    checks: ["Cambio de juntas y cierres mecánicos", "Impulsores y juntas", "Prueba en banco"],
  },
];

export const ELECTRO_STEPS = [
  { title: "Recepción y diagnóstico", text: "Probamos el equipo en el banco para ver qué falla de verdad." },
  { title: "Desmontaje y limpieza", text: "Pieza por pieza, sin suciedad ni restos de óxido." },
  { title: "Revisión y reparación", text: "Escobillas, rodamientos, regulador, bobinas: lo que haga falta." },
  { title: "Pintura y montaje", text: "Vuelve protegido para el ambiente marino." },
  { title: "Prueba final en banco", text: "No sale del taller sin funcionar como tiene que funcionar." },
];
