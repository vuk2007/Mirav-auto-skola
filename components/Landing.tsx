"use client";

import { CATEGORIES, type Category } from "@/lib/categories";
import { EXAM_MINUTES, EXAM_PASS_PERCENT, EXAM_QUESTION_COUNT } from "@/lib/config";
import { pointsLabel, type Dict, type Lang } from "@/lib/i18n";
import type { BestExam, PracticeState } from "@/lib/storage";

interface LandingProps {
  t: Dict;
  lang: Lang;
  category: Category;
  onCategoryChange: (c: Category) => void;
  onStartPractice: () => void;
  onResumePractice: () => void;
  onStartExam: () => void;
  onStartSimulator: () => void;
  onStartGame: () => void;
  /** Sačuvana vježba, ako postoji — nudi „Nastavi gdje si stao". */
  saved: PracticeState | null;
  best: BestExam | null;
  /** Učitavanje baze poslije klika na „Počni". */
  starting: boolean;
}

export default function Landing({
  t,
  lang,
  category,
  onCategoryChange,
  onStartPractice,
  onResumePractice,
  onStartExam,
  onStartSimulator,
  onStartGame,
  saved,
  best,
  starting,
}: LandingProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="mb-2 text-2xl leading-tight font-bold sm:text-3xl">{t.landingTitle}</h1>
        <p className="max-w-prose text-[0.9375rem] text-muted">{t.landingLead}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── Vježba ─────────────────────────────────────────────── */}
        <section className="panel flex flex-col border-t-4 border-t-blue p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
            <h2 className="text-xl font-bold">{t.practiceTitle}</h2>
          </div>
          <p className="mb-4 text-sm text-muted">{t.practiceDesc}</p>

          <div className="mb-4">
            <p className="tag mb-2 text-muted">{t.categoryLabel}</p>
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

          <div className="mt-auto space-y-2">
            <button
              type="button"
              onClick={onStartPractice}
              disabled={starting}
              className="font-display w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              {t.practiceStart}
            </button>

            {saved && (
              <button
                type="button"
                onClick={onResumePractice}
                disabled={starting}
                className="font-display w-full rounded border-2 border-blue px-6 py-2.5 text-base font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue-soft disabled:opacity-50"
              >
                {t.practiceResume}
                <span className="ml-2 font-body text-xs font-normal normal-case">
                  ({saved.index + 1}/{saved.ids.length})
                </span>
              </button>
            )}
          </div>
        </section>

        {/* ── Simulacija ispita ──────────────────────────────────── */}
        <section className="panel flex flex-col border-t-4 border-t-yellow p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
            <h2 className="text-xl font-bold">{t.examTitle}</h2>
          </div>
          <p className="mb-3 text-sm text-muted">{t.examDesc}</p>

          {/*
            Brojevi dolaze iz lib/config.ts da tekst ne bi odlutao od stvarnih
            parametara. Prag je procenat, ne broj bodova: bodovi po pitanju
            dolaze iz baze, pa ukupan zbir zavisi od izvučenih pitanja.
          */}
          <p className="tag mb-3 text-blue">
            {EXAM_QUESTION_COUNT} {t.metaQuestions} · {EXAM_MINUTES} {t.metaMinutes} ·{" "}
            {t.metaPass} {EXAM_PASS_PERCENT}%
          </p>

          {best && (
            <p className="mb-3 rounded border border-line bg-paper px-3 py-2 text-sm">
              <span className="tag text-muted">{t.bestResult}</span>{" "}
              <strong className={`font-display text-lg ${best.passed ? "text-green" : "text-red"}`}>
                {best.scored} / {best.max}
              </strong>
              <span className="text-muted"> {pointsLabel(best.max, lang)}</span>
            </p>
          )}

          <p className="mb-4 border-l-2 border-yellow pl-3 text-xs leading-relaxed text-muted">
            {t.examLimitationNote}
          </p>

          <button
            type="button"
            onClick={onStartExam}
            disabled={starting}
            className="font-display mt-auto w-full rounded bg-ink px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue disabled:opacity-50"
          >
            {t.examStart}
          </button>
        </section>
      </div>

      {/* ── Simulator raskrsnica ─────────────────────────────────── */}
      <section className="panel flex flex-col gap-4 border-t-4 border-t-blue-accent p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
            <h2 className="text-xl font-bold">{t.simTitle}</h2>
            <span className="tag ml-1 text-muted">{t.simMeta}</span>
          </div>
          <p className="text-sm text-muted">{t.simDesc}</p>
        </div>
        <button
          type="button"
          onClick={onStartSimulator}
          disabled={starting}
          className="font-display rounded border-2 border-blue px-6 py-3 text-lg font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue hover:text-white disabled:opacity-50 sm:flex-none"
        >
          {t.simStart}
        </button>
      </section>

      {/* ── Igra „Prođi raskrsnicu" ──────────────────────────────── */}
      <section className="panel flex flex-col gap-4 border-t-4 border-t-green p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
            <h2 className="text-xl font-bold">{t.gameTitle}</h2>
            <span className="tag ml-1 text-muted">{t.gameMeta}</span>
          </div>
          <p className="text-sm text-muted">{t.gameDesc}</p>
        </div>
        <button
          type="button"
          onClick={onStartGame}
          disabled={starting}
          className="font-display rounded border-2 border-green px-6 py-3 text-lg font-bold tracking-wide text-green uppercase transition-colors hover:bg-green hover:text-white disabled:opacity-50 sm:flex-none"
        >
          {t.gameOpen}
        </button>
      </section>

      {starting && (
        <p className="tag text-center text-muted" aria-live="polite">
          {t.loading}
        </p>
      )}
    </div>
  );
}
