import { Fingerprint, KeyRound, ShieldCheck, ScrollText } from "lucide-react";
import { Reveal, RevealItem } from "@/components/ui/motion";

const items = [
  {
    icon: ShieldCheck,
    title: "Aislamiento por empresa",
    text: "Row Level Security en Postgres: cada consulta se filtra por organización en la propia base, no solo en la interfaz.",
  },
  {
    icon: KeyRound,
    title: "Permisos por rango",
    text: "Roles y permisos en un catálogo editable. Nadie puede asignarse un rango igual o superior al suyo.",
  },
  {
    icon: Fingerprint,
    title: "Registros inmutables",
    text: "Un fichaje cerrado no se edita. Nadie aprueba sus propias vacaciones. Las reglas viven en la base de datos.",
  },
  {
    icon: ScrollText,
    title: "Auditoría por usuario",
    text: "Toda acción sensible queda registrada con su autor y su estado anterior y posterior.",
  },
];

export function Security() {
  return (
    <section id="seguridad" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="relative overflow-hidden rounded-[32px] bg-foreground px-6 py-16 text-background sm:px-14 sm:py-20 dark:bg-card dark:text-foreground dark:ring-1 dark:ring-border">
          <div className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-accent/30 blur-[120px]" />
          <RevealItem>
            <p className="mb-4 text-[13px] font-medium text-accent">Seguridad</p>
          </RevealItem>
          <RevealItem>
            <h2 className="max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
              Seguro por diseño, <span className="font-serif font-normal italic">no por promesa.</span>
            </h2>
          </RevealItem>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ icon: Icon, title, text }) => (
              <RevealItem key={title}>
                <Icon className="mb-4 size-5 opacity-70" strokeWidth={1.75} />
                <h3 className="text-[15px] font-semibold">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed opacity-60">{text}</p>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
