"use client";

import { BookOpen, ClipboardCheck, Gamepad2, Signpost } from "lucide-react";
import type { Category } from "@/lib/categories";
import { EXAM_MINUTES, EXAM_PASS_POINTS, EXAM_QUESTION_COUNT, EXAM_TOTAL_POINTS } from "@/lib/config";
import { pointsLabel, type Dict, type Lang } from "@/lib/i18n";
import type { BestExam, PracticeState } from "@/lib/storage";
import CategoryChips from "./CategoryChips";
import HeroFoto from "./HeroFoto";
import Button from "./ui/Button";
import HexBadge from "./ui/HexBadge";
import IconCircle from "./ui/IconCircle";
import ListRow, { DividedList } from "./ui/ListRow";
import SectionLabel from "./ui/SectionLabel";

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

/**
 * Početna po referenci: oznaka u dva reda, dvobojni naslov, uvod, izbor
 * kategorije i dva dugmeta (vježba, ispit), pa šestougaoni bedž sa ključnim
 * brojem ispita i lista režima sa tankim razdjelnicima.
 *
 * Raspored prati širinu samog bloka (container queries), ne prozora: u
 * ugrađenoj verziji na mirav.me blok je uži od prozora, i tada ostaje u
 * jednoj koloni. Od @4xl (56 rem) hero se dijeli na tekst i fotografiju.
 *
 * Brojevi dolaze iz lib/config.ts, da tekst ne odluta od stvarnih
 * parametara ispita.
 */
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
  const ispitMeta = `${EXAM_QUESTION_COUNT} ${t.metaQuestions} · ${EXAM_MINUTES} ${t.metaMinutes} · ${t.metaPass} ${EXAM_PASS_POINTS}/${EXAM_TOTAL_POINTS}`;

  return (
    <div className="@container">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-10 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:items-center @4xl:gap-14">
        <div>
          <SectionLabel second={t.heroLabel2}>{t.heroLabel1}</SectionLabel>

          <h1 className="mt-6 font-display text-[2.125rem] leading-[1.05] font-extrabold tracking-[var(--tracking-tight-display)] @md:text-[2.75rem] @5xl:text-[3.25rem]">
            <span className="block text-text">{t.heroTitle1}</span>
            <span className="block text-accent-2">{t.heroTitle2}</span>
          </h1>

          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-text-muted">{t.heroLead}</p>

          <div className="mt-8">
            <p className="mb-3 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
              {t.categoryLabel}
            </p>
            <CategoryChips category={category} onChange={onCategoryChange} t={t} />
          </div>

          <div className="mt-8 flex flex-col gap-3 @md:flex-row @md:flex-wrap">
            <Button onClick={onStartPractice} disabled={starting} className="@md:min-w-64">
              {t.practiceStart}
            </Button>
            <Button variant="secondary" onClick={onStartExam} disabled={starting} arrow={false}>
              {t.examStart}
            </Button>
          </div>

          {saved && (
            <Button variant="ghost" onClick={onResumePractice} disabled={starting} arrow className="mt-3 -ml-2">
              {t.practiceResume}{" "}
              <span className="tabular font-body text-xs font-normal tracking-normal normal-case">
                ({saved.index + 1}/{saved.ids.length})
              </span>
            </Button>
          )}

          {starting && (
            <p className="mt-4 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase" aria-live="polite">
              {t.loading}
            </p>
          )}
        </div>

        <HeroFoto words={t.heroWords} />
      </section>

      {/* ── Ključni broj i režimi ──────────────────────────────────────── */}
      <section className="mt-16 grid gap-10 @3xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] @3xl:gap-14">
        <div>
          <SectionLabel>{t.examTitle}</SectionLabel>
          <div className="mt-6">
            {best ? (
              <HexBadge size="lg" tone={best.passed ? "ok" : "err"} caption={`${t.bestResult} · ${pointsLabel(best.max, lang)}`}>
                {best.scored}/{best.max}
              </HexBadge>
            ) : (
              <HexBadge size="lg" caption={`${t.metaPoints} · ${t.metaPass} ${EXAM_PASS_POINTS}`}>{EXAM_TOTAL_POINTS}</HexBadge>
            )}
          </div>
          <p className="mt-6 max-w-xs text-xs leading-relaxed text-text-muted">{t.examLimitationNote}</p>
        </div>

        <DividedList className="border-t border-glass-line">
          <ListRow leading={<IconCircle icon={BookOpen} />} title={t.practiceTitle} subtitle={t.practiceMeta}>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">{t.practiceDesc}</p>
          </ListRow>
          <ListRow leading={<IconCircle icon={ClipboardCheck} />} title={t.examTitle} subtitle={ispitMeta}>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">{t.examDesc}</p>
          </ListRow>
          <ListRow leading={<IconCircle icon={Signpost} />} title={t.simTitle} subtitle={t.simMeta}>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">{t.simDesc}</p>
            <Button variant="secondary" size="md" onClick={onStartSimulator} disabled={starting} arrow className="mt-4">
              {t.simStart}
            </Button>
          </ListRow>
          <ListRow leading={<IconCircle icon={Gamepad2} />} title={t.gameTitle} subtitle={t.gameMeta}>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">{t.gameDesc}</p>
            <Button variant="secondary" size="md" onClick={onStartGame} disabled={starting} arrow className="mt-4">
              {t.gameOpen}
            </Button>
          </ListRow>
        </DividedList>
      </section>
    </div>
  );
}
