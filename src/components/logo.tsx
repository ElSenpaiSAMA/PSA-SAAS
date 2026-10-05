import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <circle cx="16" cy="16" r="8.5" fill="none" strokeWidth="2" className="stroke-background/30" />
      <path d="M16 16 L16 9.5" strokeWidth="2.2" strokeLinecap="round" className="stroke-background" />
      <path d="M16 16 L20.5 18.5" strokeWidth="2.2" strokeLinecap="round" className="stroke-accent" />
      <circle cx="16" cy="16" r="1.6" className="fill-background" />
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
