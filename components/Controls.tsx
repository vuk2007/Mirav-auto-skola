"use client";

import { CATEGORIES, type Category } from "@/lib/categories";
import { EXAM_WARNING_SECONDS } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import { formatClock } from "@/lib/questions";
import type { Mode } from "@/lib/types";

interface ControlsProps {
  mode: Mode;
  category: Category;
  onCategoryChange: (category: Category) => void;
  /** Broj pitanja u tekućem skupu. */
  poolSize: number;
  correctCount: number;
  answeredCount: number;
  /** Preostalo vrijeme u sekundama; null ako tajmer ne radi. */
  secondsLeft: number | null;
  t: Dict;
}

export default function Controls({
  mode,
  category,
  onCategoryChange,
  poolSize,
  correctCount,
  answeredCount,
  secondsLeft,
  t,
}: ControlsProps) {
  const isPractice = mode === "vjezba";
  const warning = secondsLeft !== null && secondsLeft <= EXAM_WARNING_SECONDS;

  return (
    <section className="panel p-4 sm:p-5" aria-label={t.categoryLabel}>
      {/* Filter kategorija — samo u vježbi; ispit uvijek vuče iz cijele baze. */}
      {isPractice && (
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line pb-4">
          <span className="tag mr-1 text-muted">{t.categoryLabel}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.categoryLabel}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onCategoryChange(c.value)}
                aria-pressed={category === c.value}
                className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                  category === c.value
                    ? "border-blue bg-blue-soft font-semibold text-blue"
                    : "border-line bg-panel text-ink hover:border-blue"
                }`}
              >
                {t[c.key]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="text-sm text-muted">
          {isPractice ? (
            <>
              {t.correctLabel}:{" "}
              <strong className="font-display text-lg text-green">{correctCount}</strong>
              <span className="mx-1">/</span>
              <strong className="font-display text-lg text-ink">{answeredCount}</strong>
              <span className="ml-2">
                ({poolSize} {t.inPool})
              </span>
            </>
          ) : (
            <>
              {t.answeredLabel}:{" "}
              <strong className="font-display text-lg text-ink">{answeredCount}</strong>
              <span className="mx-1">/</span>
              <strong className="font-display text-lg text-ink">{poolSize}</strong>
            </>
          )}
        </p>

        {secondsLeft !== null && (
          <p
            className={`font-display ml-auto flex items-baseline gap-2 text-2xl font-bold tabular-nums ${
              warning ? "text-red" : "text-ink"
            }`}
          >
            <span className="tag text-muted">{t.remaining}</span>
            <span role="timer" aria-live="off">
              {formatClock(secondsLeft)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
