import type { ReactNode } from "react";

/**
 * Mala oznaka stanja ili kategorije: „Tekstualno pitanje", „3 boda", „Položeno".
 * Ton nosi značenje; `neutral` je za sve što nije ni tačno ni netačno.
 */
type Ton = "neutral" | "accent" | "ok" | "err";

const TONOVI: Record<Ton, string> = {
  neutral: "border-glass-line text-text-muted",
  accent: "border-accent-line bg-accent-soft text-accent-2",
  ok: "border-ok-line bg-ok-soft text-ok",
  err: "border-err-line bg-err-soft text-err",
};

export default function Badge({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: Ton;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-display text-[0.6875rem] leading-none font-semibold tracking-[var(--tracking-caps)] uppercase ${TONOVI[tone]} ${className}`}
    >
      {icon && <span className="flex-none [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {children}
    </span>
  );
}
