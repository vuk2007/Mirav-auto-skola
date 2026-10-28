"use client";

import { Calculator, Check, ClipboardList, TriangleAlert, type LucideIcon } from "lucide-react";
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
import Button from "./ui/Button";
import GlassPanel from "./ui/GlassPanel";
import IconCircle from "./ui/IconCircle";
import SectionLabel from "./ui/SectionLabel";

interface ExamBriefingProps {
  t: Dict;
  lang: Lang;
  /** Pokreće ispit; poziva se tek kad kandidat potvrdi da je pročitao. */
  onStart: () => void;
  /** Učitavanje pitanja je u toku — dugme se zaključava da se ne pokrene dvaput. */
  starting: boolean;
}

/** Ikonica uz svaku sekciju uputstva; nepoznat id dobija listu. */
const IKONE: Record<string, LucideIcon> = {
  vazno: TriangleAlert,
  kako: ClipboardList,
  poeni: Calculator,
};

/**
 * Uputstvo prije simulacije ispita.
 *
 * Dugme je namjerno zaključano dok se ne označi polje: cilj ekrana nije da bude
 * još jedan klik na putu do testa, nego da kandidat zaista pročita šta mu treba
 * da izađe na ispit. Sadržaj je u lib/examBriefing.ts.
 *
 * Tri sekcije stoje u jednom panelu, odvojene linijama, a ne kao tri kartice.
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
    <section className="space-y-6">
      <div>
        <SectionLabel className="mb-4">{t.examTitle}</SectionLabel>
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
          {t.briefingTitle}
        </h1>
        <p className="mt-3 max-w-xl text-text-muted">{t.briefingLead}</p>
      </div>

      <GlassPanel
        padding="none"
        className="grid divide-y divide-glass-line md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        {EXAM_BRIEFING.map((section) => {
          const upozorenje = section.tone === "warn";
          return (
            <article key={section.id} className="p-5 sm:p-6">
              <h2
                className={`mb-4 flex items-center gap-3 font-display text-xs font-semibold tracking-[var(--tracking-label)] uppercase ${
                  upozorenje ? "text-err" : "text-accent-2"
                }`}
              >
                <IconCircle icon={IKONE[section.id] ?? ClipboardList} size="sm" tone={upozorenje ? "err" : "accent"} />
                {section.title[lang]}
              </h2>
              <ul className="space-y-3 text-[0.9375rem] leading-relaxed">
                {section.items[lang].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[0.7em] h-1 w-1 flex-none rounded-full bg-text-muted" />
                    <span className="min-w-0">{fillBriefing(item, values)}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </GlassPanel>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="group flex cursor-pointer items-start gap-3">
          {/* Pravi checkbox, samo bez sistemskog izgleda; kvačica leži preko njega. */}
          <span className="relative mt-px flex h-6 w-6 flex-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-6 w-6 cursor-pointer appearance-none rounded-sm border border-glass-line-strong bg-glass transition-colors duration-150 group-hover:border-accent-2 checked:border-accent checked:bg-accent"
            />
            {confirmed && (
              <Check
                aria-hidden="true"
                strokeWidth={2.5}
                className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-white"
              />
            )}
          </span>
          <span className="font-semibold">{t.briefingConfirm}</span>
        </label>

        <Button onClick={onStart} disabled={!confirmed || starting} className="w-full sm:w-auto">
          {starting ? t.loading : t.briefingStart}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">{t.briefingDisclaimer}</p>
    </section>
  );
}
