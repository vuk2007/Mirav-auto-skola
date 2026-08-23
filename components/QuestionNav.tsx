"use client";

import type { Dict } from "@/lib/i18n";
import { slotLabel, type ExamSlot } from "@/lib/questions";
import type { Question } from "@/lib/types";

interface QuestionNavProps {
  questions: Question[];
  /**
   * Sastav ispita. Ako je prazno (npr. simulator), mreža se crta ravno i
   * numeriše 1..n — grupisanje po segmentima ima smisla samo na ispitu.
   */
  slots?: readonly ExamSlot[];
  /** ID-evi pitanja na koja je odgovoreno. */
  answeredIds: Set<number>;
  currentIndex: number;
  onJump: (index: number) => void;
  t: Dict;
}

/**
 * Mreža brojeva pitanja — skok na bilo koje, uz oznaku odgovoreno/neodgovoreno.
 *
 * Na ispitu je mreža podijeljena na segmente (znakovi, teorija, policajac,
 * kosnik, situacije) tankom linijom, a podpitanje nosi slovo uz broj svog
 * glavnog pitanja („15" i „15a"). Bez toga kandidat ne bi imao načina da vidi
 * da dva uzastopna pitanja dijele istu sliku i idu u paru.
 */
export default function QuestionNav({
  questions,
  slots,
  answeredIds,
  currentIndex,
  onJump,
  t,
}: QuestionNavProps) {
  const answeredCount = questions.filter((q) => answeredIds.has(q.id)).length;
  const grouped = Boolean(slots && slots.length === questions.length);

  // Indeksi pitanja razvrstani po segmentu, uz očuvan redoslijed testa.
  const groups: number[][] = [];
  questions.forEach((_, i) => {
    const segment = grouped ? (slots![i]!.segment ?? 0) : 0;
    (groups[segment] ??= []).push(i);
  });

  const cell = (i: number) => {
    const q = questions[i]!;
    const answered = answeredIds.has(q.id);
    const current = i === currentIndex;
    const isSub = grouped && slots![i]!.isSub;
    const label = grouped ? slotLabel(slots!, i) : String(i + 1);

    let tone = "border-line bg-panel text-muted hover:border-blue hover:text-blue";
    if (answered) tone = "border-blue bg-blue text-white hover:bg-blue-dark";
    if (current) {
      tone = answered
        ? "border-ink bg-blue text-white ring-2 ring-ink"
        : "border-ink bg-panel text-ink ring-2 ring-ink";
    }

    return (
      <li key={q.id} className={isSub ? "-ml-0.5" : undefined}>
        <button
          type="button"
          onClick={() => onJump(i)}
          aria-current={current ? "step" : undefined}
          aria-label={`${t.navJump} ${label} — ${answered ? t.navAnswered : t.navUnanswered}`}
          className={`font-display h-8 min-w-8 rounded border-2 px-1 text-sm font-bold transition-colors ${
            isSub ? "border-dashed" : ""
          } ${tone}`}
        >
          {label}
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
            {t.navUnanswered} ({questions.length - answeredCount})
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {groups.map((indices, segment) => (
          <div key={segment} className="flex items-center gap-3">
            {segment > 0 && <span className="h-6 w-px bg-line" aria-hidden="true" />}
            <ol className="flex flex-wrap gap-1.5">{indices.map(cell)}</ol>
          </div>
        ))}
      </div>
    </section>
  );
}
