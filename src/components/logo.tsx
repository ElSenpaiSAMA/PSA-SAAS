import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Logo oficial de Diplonautic (public/logo). Hay dos versiones: la original, con el
// círculo y el texto blancos, para fondos oscuros; y una invertida, en azul marino,
// para fondos claros. Las genera scripts/logo-variants.mjs a partir de logo.png.

/** Solo el círculo con el copo de nieve (espacios chicos: barra móvil, avatar de marca). */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Image
      src={inverted ? "/logo/icono-claro.png" : "/logo/icono-oscuro.png"}
      alt=""
      aria-hidden
      width={128}
      height={128}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

/** Logo completo con la palabra DIPLONAUTIC. `inverted`: para usar sobre fondos oscuros. */
export function Logo({ href = "/", className, inverted = false }: { href?: string; className?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label={`${brand.name}, ir al inicio`}>
      <Image
        src={inverted ? "/logo/diplonautic-claro.png" : "/logo/diplonautic-oscuro.png"}
        alt={brand.name}
        width={566}
        height={96}
        className="h-7 w-auto"
      />
    </Link>
  );
}
