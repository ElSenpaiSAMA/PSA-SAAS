import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-foreground text-background hover:bg-foreground/90 shadow-[0_1px_0_0_rgb(255_255_255/0.1)_inset,0_1px_2px_0_rgb(0_0_0/0.2)]",
  accent: "bg-accent text-accent-foreground hover:brightness-110",
  secondary: "bg-card text-foreground border border-border hover:bg-muted hover:border-border-strong",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
} as const;

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
  icon: "size-9 rounded-xl",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const buttonClasses = (variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md") =>
  cn(
    "relative inline-flex select-none items-center justify-center font-medium whitespace-nowrap",
    "transition-[background-color,border-color,color,transform,filter,box-shadow] duration-200 ease-out",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonClasses(variant, size), className)} {...props} />
  ),
);
Button.displayName = "Button";
