"use client";

import type { Dict } from "@/lib/i18n";
import type { Question } from "@/lib/types";

interface QuestionNavProps {
  questions: Question[];
  /** ID-evi pitanja na koja je odgovoreno. */
  answeredIds: Set<number>;
  currentIndex: number;
  onJump: (index: number) => void;
  t: Dict;
}

/** Mreža brojeva pitanja — skok na bilo koje, uz oznaku odgovoreno/neodgovoreno. */
export default function QuestionNav({
  questions,
  answeredIds,
  currentIndex,
  onJump,
  t,
}: QuestionNavProps) {
  const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;

  return (
    <section className="panel p-4" aria-label={t.navTitle}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="tag text-muted">{t.navTitle}</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-blue bg-blue" aria-hidden="true" />
            {t.navAnswered} ({answeredCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-line bg-panel" aria-hidden="true" />
            {t.navUnanswered} ({questions.length - answeredCount})
          </span>
        </span>
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const answered = answeredIds.has(q.id);
          const current = i === currentIndex;
          let tone = "border-line bg-panel text-muted hover:border-blue hover:text-blue";
          if (answered) tone = "border-blue bg-blue text-white hover:bg-blue-dark";
          if (current) {
            tone = answered
              ? "border-ink bg-blue text-white ring-2 ring-ink"
              : "border-ink bg-panel text-ink ring-2 ring-ink";
          }
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`${t.navJump} ${i + 1} — ${answered ? t.navAnswered : t.navUnanswered}`}
                className={`font-display h-8 w-8 rounded border-2 text-sm font-bold transition-colors ${tone}`}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
