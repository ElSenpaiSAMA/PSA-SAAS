import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Creá tu cuenta</h1>
      <p className="mt-2 text-[14.5px] text-muted-foreground">
        Después creás tu organización o aceptás una invitación.
      </p>

      <SignupForm />

      <p className="mt-8 text-center text-[13.5px] text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </div>
  );
}
