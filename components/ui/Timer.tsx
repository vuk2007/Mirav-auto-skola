/**
 * Prikaz preostalog vremena mm:ss. Tabular-nums da cifre ne „plešu";
 * `warning` boji vrijeme u crveno (zadnji minuti ispita).
 * `stacked`: na uskom ekranu oznaka stoji iznad vremena, poravnata desno.
 */
export default function Timer({
  seconds,
  label,
  warning = false,
  stacked = false,
  className = "",
}: {
  seconds: number;
  label?: string;
  warning?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div
      className={`flex ${stacked ? "flex-col items-end gap-1.5 sm:flex-row sm:items-baseline sm:gap-3" : "items-baseline gap-3"} ${className}`}
    >
      {label && (
        <span className="font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
          {label}
        </span>
      )}
      <span
        className={`tabular font-display text-2xl leading-none font-bold tracking-tight ${warning ? "text-err" : "text-text"}`}
        role="timer"
        aria-live="off"
      >
        {mm}:{ss}
      </span>
    </div>
  );
}
