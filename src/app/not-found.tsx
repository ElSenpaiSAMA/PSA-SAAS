import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <p className="font-serif text-[clamp(7rem,22vw,14rem)] leading-none tracking-[-0.04em] text-foreground/10 italic select-none">
        404
      </p>
      <h1 className="-mt-6 text-[26px] font-semibold tracking-[-0.03em] sm:text-[32px]">Página no encontrada</h1>
      <p className="mt-3 max-w-sm text-[15px] text-muted-foreground">
        No existe, se movió, o no tenés acceso a esta sección con tu rol actual.
      </p>
      <Link href="/select-organization" className={`${buttonClasses("primary", "lg")} group mt-8`}>
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Volver a mis organizaciones
      </Link>
    </main>
  );
}
