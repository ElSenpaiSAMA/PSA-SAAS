import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <div className="animate-fade-up">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Bienvenido de nuevo</h1>
      <p className="mt-2 text-[14.5px] text-muted-foreground">Ingresá para continuar con tu equipo.</p>

      {error === "link" ? (
        <p className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger">
          El enlace expiró o no es válido. Iniciá sesión de nuevo.
        </p>
      ) : null}

      <LoginForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-8 text-center text-[13.5px] text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Creá una gratis
        </Link>
      </p>
    </div>
  );
}
