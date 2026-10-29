/**
 * Tanka plava traka napretka sa oznakom lijevo i procentom desno.
 * Zadržava `role="progressbar"` i aria vrijednosti; QA skriptovi je traže po ulozi.
 */
interface ProgressBarProps {
  current: number;
  total: number;
  /** Tekst lijevo od trake. */
  label: string;
  /** Pristupačan naziv trake napretka. */
  ariaLabel: string;
}

export default function ProgressBar({ current, total, label, ariaLabel }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
        <span>{label}</span>
        <span className="tabular tracking-normal">{percent}%</span>
      </div>
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-glass-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300 ease-[var(--ease-izlaz)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
