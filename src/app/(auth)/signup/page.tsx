import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Activar cuenta" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { email } = await searchParams;

  return (
    <div className="animate-fade-up">
      <p className="text-[12.5px] font-medium tracking-[0.18em] text-blue-700 uppercase">Intranet de Diplonautic</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-slate-950">Activá tu cuenta</h1>
      <p className="mt-2 text-[14.5px] text-slate-600">
        Solo para personas invitadas por la empresa. Usá el email con el que te invitaron y elegí tu contraseña.
      </p>

      <SignupForm defaultEmail={typeof email === "string" ? email : undefined} />

      <p className="mt-8 text-center text-[13.5px] text-slate-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-blue-700 underline-offset-4 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
