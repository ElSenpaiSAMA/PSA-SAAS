import type { Metadata } from "next";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activar cuenta" };

/** Destino del email de invitación: la persona elige su nombre y contraseña y entra a la intranet. */
export default function ActivateAccountPage() {
  return (
    <div className="animate-fade-up">
      <p className="text-[12.5px] font-medium tracking-[0.18em] text-blue-700 uppercase">Intranet de Diplonautic</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">Bienvenido al equipo</h1>
      <p className="mt-2 text-[14.5px] text-slate-600">Completá tu nombre y elegí una contraseña para entrar.</p>
      <ActivateForm />
    </div>
  );
}
