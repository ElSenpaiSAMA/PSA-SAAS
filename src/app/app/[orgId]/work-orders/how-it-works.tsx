import { ChevronDown } from "lucide-react";
import { LIFECYCLE } from "@/lib/domain/work-orders";

/** Explicación breve y plegable del modelo Proyecto → OT → Tareas. */
export function HowItWorks() {
  return (
    <details className="group rounded-2xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[13.5px] font-medium">
        ¿Cómo funciona una orden de trabajo?
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-5 border-t border-border px-5 py-4 text-[13px] text-muted-foreground md:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-2">
          <p>
            Una <strong className="text-foreground">orden de trabajo (OT)</strong> es el trabajo de un proyecto en un período,
            normalmente un mes. Tiene sus tareas, un presupuesto de horas y una tarifa.
          </p>
          <p>
            <span className="text-foreground">Proyecto → OT del mes → Tareas.</span> Las horas se imputan a tareas, y solo
            mientras su OT está aprobada o en curso. Al terminar el mes, se cierra, se factura y se copia al mes siguiente.
          </p>
        </div>
        <ol className="grid gap-2">
          {LIFECYCLE.map((step, i) => (
            <li key={step.key} className="grid grid-cols-[1.25rem_5.5rem_1fr] gap-2">
              <span className="tabular text-muted-foreground">{i + 1}.</span>
              <span className="font-medium text-foreground">{step.label}</span>
              <span>{step.help}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
