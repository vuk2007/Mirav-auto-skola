import type { ReactNode } from "react";

/**
 * Stavka liste sa tankim razdjelnikom ispod, umjesto zasebne kartice.
 * Lista je `<ul>` sa `divide-y`; ova komponenta je jedan `<li>`.
 *
 * `title` je uppercase sa razmakom slova (kao „MODERNA VOZILA"), `subtitle`
 * prigušen ispod. `aside` je sadržaj desno (dugme, broj, oznaka).
 */
export default function ListRow({
  leading,
  title,
  subtitle,
  aside,
  children,
  caps = true,
  className = "",
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  /** Slobodan sadržaj ispod naslova (opis, kontrole). */
  children?: ReactNode;
  /** Uppercase naslov; za duže naslove (nazivi scenarija) isključi. */
  caps?: boolean;
  className?: string;
}) {
  return (
    <li className={`flex items-start gap-4 py-4 ${className}`}>
      {leading}
      <div className="min-w-0 flex-1">
        <p
          className={
            caps
              ? "font-display text-[0.8125rem] leading-snug font-bold tracking-[var(--tracking-caps)] text-text uppercase"
              : "font-display text-base leading-snug font-semibold text-text"
          }
        >
          {title}
        </p>
        {subtitle && (
          <p
            className={
              caps
                ? "mt-1 font-display text-[0.6875rem] leading-snug font-medium tracking-[0.18em] text-text-muted uppercase"
                : "mt-1 text-sm text-text-muted"
            }
          >
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {aside && <div className="flex-none self-center">{aside}</div>}
    </li>
  );
}

/** Lista sa tankim razdjelnicima; `ListRow` su njene stavke. */
export function DividedList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`divide-y divide-glass-line ${className}`}>{children}</ul>;
}
