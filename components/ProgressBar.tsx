interface ProgressBarProps {
  current: number;
  total: number;
  /** Tekst lijevo od trake; podrazumijevano „Pitanje X / Y". */
  label?: string;
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((current / safeTotal) * 100));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="tag text-muted">{label ?? `Pitanje ${current} / ${total}`}</span>
        <span className="tag text-muted">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label="Napredak kroz pitanja"
      >
        <div
          className="h-full rounded-full bg-blue transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
