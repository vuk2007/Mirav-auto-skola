"use client";

import { EXAM_PAGE_COUNT } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import type { ExamSlot } from "@/lib/questions";
import GlassPanel from "./ui/GlassPanel";

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
 * odgovoreno/bez odgovora. Odgovorena su puna plava, a brojevi otvorene
 * stranice imaju svijetli prsten.
 */
export default function QuestionNav({ slots, answeredIds, currentPage, onJump, t }: QuestionNavProps) {
  const answeredCount = slots.filter((s) => answeredIds.has(s.question.id)).length;
  const pages = Array.from({ length: EXAM_PAGE_COUNT }, (_, i) =>
    slots.filter((s) => s.page === i + 1),
  );

  /** `kraj`: zadnje pitanje stranice — od `sm` naviše dobija razmak do sljedeće. */
  const cell = (slot: ExamSlot, kraj: boolean) => {
    const answered = answeredIds.has(slot.question.id);
    const current = slot.page === currentPage;

    let tone = "border-glass-line text-text-muted hover:border-glass-line-strong hover:text-text";
    if (answered) tone = "border-accent bg-accent text-white hover:bg-accent-deep";
    if (current) tone += " ring-1 ring-accent-2 ring-offset-2 ring-offset-bg";

    return (
      <li key={slot.question.id} className={kraj ? "sm:mr-3.5" : ""}>
        <button
          type="button"
          onClick={() => onJump(slot)}
          aria-label={`${t.navJump} ${slot.number} — ${answered ? t.navAnswered : t.navUnanswered}`}
          className={`tabular h-9 min-w-9 rounded-sm border px-1 font-display text-[0.8125rem] font-semibold transition-colors duration-150 ${tone}`}
        >
          {slot.number}
        </button>
      </li>
    );
  };

  return (
    <GlassPanel as="section" padding="sm" className="sm:p-5" aria-label={t.navTitle}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
          {t.navTitle}
        </span>
        <span className="flex items-center gap-4 text-xs text-text-muted sm:ml-auto">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px] border border-accent bg-accent" aria-hidden="true" />
            {t.navAnswered} <span className="tabular">({answeredCount})</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px] border border-glass-line-strong" aria-hidden="true" />
            {t.navUnanswered} <span className="tabular">({slots.length - answeredCount})</span>
          </span>
        </span>
      </div>

      {/*
        Jedna lista koja teče redom. Stranice razdvaja veći razmak (samo od sm
        naviše), ne linija ni zasebna lista: na uskom ekranu bi se svaka
        stranica lomila za sebe i ostavljala redove sa po dva broja.
      */}
      <ol className="flex flex-wrap gap-1.5">
        {pages.flatMap((pageSlots, i) =>
          pageSlots.map((slot, j) => cell(slot, j === pageSlots.length - 1 && i < pages.length - 1)),
        )}
      </ol>
    </GlassPanel>
  );
}
