import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string[] | string;
  hint?: ReactNode;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const message = Array.isArray(error) ? error[0] : error;
  const describedBy = message ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-foreground/80">
        {label}
      </label>
      {isValidElement(children)
        ? cloneElement(children, { id, "aria-invalid": !!message, "aria-describedby": describedBy })
        : children}
      {message ? (
        <p id={`${id}-error`} className="animate-fade-up text-[12.5px] text-danger">
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
