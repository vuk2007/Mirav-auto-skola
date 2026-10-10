"use client";

import { useState } from "react";

import {
  EXAM_MINUTES,
  EXAM_PAGE_COUNT,
  EXAM_PASS_POINTS,
  EXAM_QUESTION_COUNT,
  EXAM_TOTAL_POINTS,
} from "@/lib/config";
import { EXAM_BRIEFING, fillBriefing } from "@/lib/examBriefing";
import type { Dict, Lang } from "@/lib/i18n";

interface ExamBriefingProps {
  t: Dict;
  lang: Lang;
  /** Pokreće ispit; poziva se tek kad kandidat potvrdi da je pročitao. */
  onStart: () => void;
  /** Učitavanje pitanja je u toku — dugme se zaključava da se ne pokrene dvaput. */
  starting: boolean;
}

/**
 * Uputstvo prije simulacije ispita.
 *
 * Dugme je namjerno zaključano dok se ne označi polje: cilj ekrana nije da bude
 * još jedan klik na putu do testa, nego da kandidat zaista pročita šta mu treba
 * da izađe na ispit. Sadržaj je u lib/examBriefing.ts.
 */
export default function ExamBriefing({
  t,
  lang,
  onStart,
  starting,
}: ExamBriefingProps) {
  const [confirmed, setConfirmed] = useState(false);
  const values = {
    count: EXAM_QUESTION_COUNT,
    pages: EXAM_PAGE_COUNT,
    minutes: EXAM_MINUTES,
    points: EXAM_TOTAL_POINTS,
    pass: EXAM_PASS_POINTS,
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl">{t.briefingTitle}</h1>
        <p className="text-muted">{t.briefingLead}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {EXAM_BRIEFING.map((section) => (
          <article key={section.id} className="panel flex flex-col p-4">
            <h2
              className={`font-display mb-3 self-start rounded px-3 py-1.5 text-sm font-bold tracking-wide text-white uppercase ${
                section.tone === "warn" ? "bg-red" : "bg-blue"
              }`}
            >
              {section.title[lang]}
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-snug">
              {section.items[lang].map((item) => (
                <li key={item}>{fillBriefing(item, values)}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="panel p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-blue"
          />
          <span className="font-semibold">{t.briefingConfirm}</span>
        </label>

        <button
          type="button"
          onClick={onStart}
          disabled={!confirmed || starting}
          className="font-display mt-4 w-full rounded bg-ink px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue disabled:opacity-40 disabled:hover:bg-ink sm:w-auto"
        >
          {starting ? t.loading : t.briefingStart}
        </button>

        <p className="mt-3 text-xs text-muted">{t.briefingDisclaimer}</p>
      </div>
    </section>
  );
}
