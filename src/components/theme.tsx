"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";
import { Toaster } from "sonner";
import { isPublicSitePath } from "@/lib/public-site";
import { cn } from "@/lib/utils";

export function Providers({ children }: { children: ReactNode }) {
  // La web pública de la empresa es siempre clara; la intranet respeta la preferencia
  const forced = isPublicSitePath(usePathname()) ? "light" : undefined;
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange forcedTheme={forced}>
      {children}
      <ThemedToaster />
    </NextThemes>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-border !bg-card !text-foreground !shadow-lg",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // Evita mismatch de hidratación: el tema real solo se conoce en el cliente
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "relative inline-flex size-9 items-center justify-center overflow-hidden rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute size-[18px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isDark ? "translate-y-0 rotate-0 opacity-100" : "translate-y-6 rotate-90 opacity-0",
        )}
        strokeWidth={1.75}
      />
      <Moon
        className={cn(
          "absolute size-[18px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isDark ? "-translate-y-6 -rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100",
        )}
        strokeWidth={1.75}
      />
    </button>
  );
}
