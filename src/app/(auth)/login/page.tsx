import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <div className="animate-fade-up">
      <p className="text-[12.5px] font-medium tracking-[0.18em] text-blue-700 uppercase">Intranet de Diplonautic</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">Iniciá sesión</h1>
      <p className="mt-2 text-[14.5px] text-slate-600">Entrá con tu cuenta de empleado.</p>

      {error === "link" ? (
        <p className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">
          El enlace expiró o no es válido. Iniciá sesión de nuevo.
        </p>
      ) : null}

      <LoginForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-8 text-center text-[13.5px] text-slate-500">
        ¿Te sumaste al equipo?{" "}
        <Link href="/signup" className="font-medium text-blue-700 underline-offset-4 hover:underline">
          Activá tu cuenta con tu invitación
        </Link>
      </p>
    </div>
  );
}
