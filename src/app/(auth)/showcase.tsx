import Image from "next/image";
import { CalendarCheck2, Clock3, ClipboardList, MessagesSquare } from "lucide-react";

const FEATURES = [
  { icon: Clock3, text: "Fichaje y horas por orden de trabajo" },
  { icon: ClipboardList, text: "Órdenes de trabajo de cada barco" },
  { icon: CalendarCheck2, text: "Vacaciones y ausencias del equipo" },
  { icon: MessagesSquare, text: "Foro de dudas, avisos e incidencias" },
];

/** Panel de la derecha en login y registro: la foto de la web con el velo azul marino. */
export function AuthShowcase() {
  return (
    <aside className="relative isolate hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-end">
      <Image src="/barcos/yate-mar-abierto.jpg" alt="" fill preload sizes="55vw" className="-z-20 object-cover object-[45%_60%]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,31,58,.55)_0%,rgba(11,31,58,.72)_50%,rgba(11,31,58,.94)_100%)]" />
      <div className="p-14">
        <p className="text-[12.5px] font-medium tracking-[0.22em] text-sky-300 uppercase">Intranet</p>
        <h2 className="mt-4 max-w-md text-[40px] leading-[1.05] font-semibold tracking-[-0.04em]">
          El trabajo del equipo, <span className="font-serif font-normal text-sky-300 italic">en un solo lugar.</span>
        </h2>
        <ul className="mt-8 grid max-w-md gap-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[14.5px] text-white/80">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur">
                <Icon className="size-4 text-sky-300" strokeWidth={1.75} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
