import type { ReactNode } from "react";

/**
 * Mala uppercase oznaka sa širokim razmakom slova i tankom plavom linijom
 * ispred, kao „— SIGURNA VOŽNJA" u referenci. Drugi red (`second`) stoji
 * ispod prvog, poravnat sa njim.
 *
 * `as` bira semantiku: oznaka iznad naslova je obično `p`, a oznaka sekcije
 * koja sama nosi naslov može biti `h2`.
 */
export default function SectionLabel({
  children,
  second,
  line = true,
  as: Oznaka = "p",
  className = "",
  id,
}: {
  children: ReactNode;
  second?: ReactNode;
  line?: boolean;
  as?: "p" | "h2" | "h3" | "span";
  className?: string;
  id?: string;
}) {
  return (
    <Oznaka
      id={id}
      className={`flex items-start gap-4 font-display text-[0.6875rem] leading-[1.7] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase sm:text-xs ${className}`}
    >
      {line && <span aria-hidden="true" className="mt-[0.8em] h-px w-8 flex-none bg-accent-2" />}
      <span className="min-w-0">
        <span className="block">{children}</span>
        {second && <span className="block">{second}</span>}
      </span>
    </Oznaka>
  );
}
