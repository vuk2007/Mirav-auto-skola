"use client";

import type { Category } from "@/lib/categories";
import { EXAM_WARNING_SECONDS } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import type { Mode } from "@/lib/types";
import CategoryChips from "./CategoryChips";
import GlassPanel from "./ui/GlassPanel";
import Timer from "./ui/Timer";

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

/**
 * Traka iznad pitanja: u vježbi izbor kategorije i rezultat, na ispitu broj
 * odgovorenih i tajmer (crven u zadnjim minutima).
 */
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
  const oznaka = "font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase";

  return (
    <GlassPanel as="section" padding="sm" className="sm:p-5" aria-label={t.categoryLabel}>
      {/* Filter kategorija — samo u vježbi; ispit uvijek vuče iz cijele baze. */}
      {isPractice && (
        <div className="mb-4 border-b border-glass-line pb-4">
          <p className={`mb-3 ${oznaka}`}>{t.categoryLabel}</p>
          <CategoryChips category={category} onChange={onCategoryChange} t={t} />
        </div>
      )}

      {/* Na ispitu i uskom ekranu oznake idu iznad brojeva, da broj i tajmer stanu u jedan red. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:items-center">
        <p className={`flex ${isPractice ? "items-baseline gap-3" : "flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3"}`}>
          <span className={oznaka}>{isPractice ? t.correctLabel : t.answeredLabel}</span>
          <span className="tabular font-display text-xl font-bold">
            {isPractice ? (
              <>
                <span className="text-ok">{correctCount}</span>
                <span className="mx-1 text-text-muted">/</span>
                <span>{answeredCount}</span>
              </>
            ) : (
              <>
                <span>{answeredCount}</span>
                <span className="mx-1 text-text-muted">/</span>
                <span>{poolSize}</span>
              </>
            )}
          </span>
          {isPractice && (
            <span className="text-sm text-text-muted">
              {poolSize} {t.inPool}
            </span>
          )}
        </p>

        {secondsLeft !== null && <Timer seconds={secondsLeft} label={t.remaining} warning={warning} stacked={!isPractice} className="ml-auto" />}
      </div>
    </GlassPanel>
  );
}
