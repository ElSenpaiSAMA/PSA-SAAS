import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthShowcase } from "./showcase";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1.1fr]">
      <div className="relative flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="size-3.5" /> Volver a la web
          </Link>
        </div>
        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="text-[12px] text-slate-400">Acceso exclusivo para el personal de Diplonautic.</p>
      </div>
      <AuthShowcase />
    </div>
  );
}
