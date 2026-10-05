import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  /** Parte del título en serif itálica */
  accent?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] sm:text-[34px]">
          {title}
          {accent ? (
            <>
              {" "}
              <span className="font-serif font-normal tracking-[-0.01em] italic">{accent}</span>
            </>
          ) : null}
        </h1>
        {description ? <p className="mt-2 max-w-xl text-[14.5px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-medium text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}
