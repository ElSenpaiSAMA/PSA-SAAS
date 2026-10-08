// Diplonautic: instalación y mantenimiento de los equipos de a bordo, en barcos de
// 6 a 50 metros. Contenido de diplonautic.com/diplonautic, en castellano.

export type BoatServiceId = "aire" | "refrigeracion" | "generadores" | "potabilizadoras" | "electricos" | "helices";

export interface BoatService {
  id: BoatServiceId;
  title: string;
  summary: string;
  checks: string[];
  brands: string[];
  photo: string;
}

export const BOAT_SERVICES: BoatService[] = [
  {
    id: "aire",
    title: "Aire acondicionado",
    summary: "Climatización marina para barcos de 6 a 50 metros, dimensionada para cada camarote y el salón.",
    checks: ["Equipos compactos", "Equipos split", "Enfriadoras (chillers)", "Instalación, conductos y mantenimiento"],
    brands: ["Clion Marine", "Cruisair", "MarineAir", "Climma", "Frigomar", "Condaria"],
    photo: "/diplonautic/aire-acondicionado.jpg",
  },
  {
    id: "refrigeracion",
    title: "Refrigeración",
    summary: "Neveras, congeladores y muebles refrigerados, para 220 Vac o corriente continua.",
    checks: ["Neveras y congeladores", "Muebles refrigerados", "Sistemas a 220 Vac o DC", "Reparación y puesta a punto"],
    brands: ["Frigoboat", "Frigomar", "VF", "U-Line"],
    photo: "/diplonautic/refrigeracion.jpg",
  },
  {
    id: "generadores",
    title: "Generadores",
    summary: "Energía a bordo sin depender del puerto, de 3 a 150 kVA.",
    checks: ["Grupos monofásicos", "Grupos trifásicos", "Sistemas en paralelo", "Revisiones por horas y reparación"],
    brands: ["Stamegna", "Paguro", "Northern Lights", "Solé Diesel"],
    photo: "/diplonautic/generadores.jpg",
  },
  {
    id: "potabilizadoras",
    title: "Potabilizadoras",
    summary: "Agua dulce del mar por ósmosis inversa, con todo lo que la rodea.",
    checks: ["Equipos de ósmosis inversa", "Bombas de agua de mar", "Calentadores", "Membranas y filtros"],
    brands: [],
    photo: "/diplonautic/potabilizadora.jpg",
  },
  {
    id: "electricos",
    title: "Sistemas eléctricos",
    summary: "Baterías, cargadores e inversores, con o sin recuperación de energía, y cuadros a medida.",
    checks: ["Baterías", "Cargadores", "Inversores DC/AC", "Cuadros eléctricos a medida"],
    brands: ["Victron Energy", "Mastervolt", "CZone"],
    photo: "/diplonautic/sistemas-electricos.jpg",
  },
  {
    id: "helices",
    title: "Hélices de proa",
    summary: "Propulsores de proa y popa para maniobrar con precisión en el amarre.",
    checks: ["Fijos o retráctiles", "Hidráulicos o eléctricos", "De proa y de popa", "Instalación y mantenimiento"],
    brands: ["Max Power", "Wesmar", "Side-Power", "Quick"],
    photo: "/diplonautic/helice-de-proa.jpg",
  },
];

export const BOAT_STEPS = [
  { title: "Nos contás qué pasa", text: "Por el formulario o por teléfono. Con el modelo del barco y del equipo ya podemos orientarte." },
  { title: "Diagnóstico y presupuesto", text: "Revisamos la instalación en tu amarre y te enviamos un presupuesto detallado antes de empezar." },
  { title: "Instalación o reparación", text: "Un técnico especializado se encarga del trabajo y te mantiene al tanto del avance." },
  { title: "Prueba y entrega", text: "Probamos los equipos en funcionamiento y te entregamos el detalle de lo que se hizo." },
];
