"use client";

import { EXAM_PAGE_COUNT } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import type { ExamSlot } from "@/lib/questions";

interface QuestionNavProps {
  /** Sastav ispita — brojevi 1–40 sa stranicom svakog pitanja. */
  slots: readonly ExamSlot[];
  /** ID-evi pitanja na koja je odgovoreno. */
  answeredIds: ReadonlySet<number>;
  /** Stranica koja je trenutno otvorena (1-bazirana). */
  currentPage: number;
  /** Skok na pitanje: otvara njegovu stranicu i skroluje do njega. */
  onJump: (slot: ExamSlot) => void;
  t: Dict;
}

/**
 * Mreža brojeva pitanja 1–40, grupisana po stranicama testa, uz oznaku
 * odgovoreno/bez odgovora. Brojevi otvorene stranice su uokvireni.
 */
export default function QuestionNav({ slots, answeredIds, currentPage, onJump, t }: QuestionNavProps) {
  const answeredCount = slots.filter((s) => answeredIds.has(s.question.id)).length;
  const pages = Array.from({ length: EXAM_PAGE_COUNT }, (_, i) =>
    slots.filter((s) => s.page === i + 1),
  );

  const cell = (slot: ExamSlot) => {
    const answered = answeredIds.has(slot.question.id);
    const current = slot.page === currentPage;

    let tone = "border-line bg-panel text-muted hover:border-blue hover:text-blue";
    if (answered) tone = "border-blue bg-blue text-white hover:bg-blue-dark";
    if (current) tone += " ring-2 ring-ink ring-offset-1";

    return (
      <li key={slot.question.id}>
        <button
          type="button"
          onClick={() => onJump(slot)}
          aria-label={`${t.navJump} ${slot.number} — ${answered ? t.navAnswered : t.navUnanswered}`}
          className={`font-display h-8 min-w-8 rounded border-2 px-1 text-sm font-bold transition-colors ${tone}`}
        >
          {slot.number}
        </button>
      </li>
    );
  };

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
            {t.navUnanswered} ({slots.length - answeredCount})
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {pages.map((pageSlots, i) => (
          <div key={i} className="flex items-center gap-4">
            {i > 0 && <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />}
            <ol className="flex flex-wrap gap-1.5" aria-label={`${t.pageLabel} ${i + 1}`}>
              {pageSlots.map(cell)}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
