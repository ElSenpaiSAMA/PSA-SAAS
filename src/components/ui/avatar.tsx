import { initials } from "@/lib/domain/hierarchy";
import { cn } from "@/lib/utils";

// Tono estable por nombre: mismo usuario, mismo color, sin depender de la base.
function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const h = hue(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-tight text-white ring-2 ring-background",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `linear-gradient(135deg, oklch(0.62 0.13 ${h}), oklch(0.48 0.13 ${(h + 40) % 360}))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
