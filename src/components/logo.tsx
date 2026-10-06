import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      {/* Vela mayor y foque sobre una ola */}
      <path d="M15 7 L15 20 L8.5 20 Z" className="fill-background" />
      <path d="M17 10 L22.5 20 L17 20 Z" className="fill-accent" />
      <path
        d="M6.5 23.5 C9 21.8 11 21.8 13.5 23.5 S18 25.2 20.5 23.5 S23.5 21.8 25.5 23.2"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="stroke-background/70"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[-8deg]" />
      <span className="text-[17px] font-semibold tracking-tight">{brand.name}</span>
    </Link>
  );
}
