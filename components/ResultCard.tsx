"use client";

import { BookOpen, Check, CircleCheck, CircleX, Lightbulb, X } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { PenaltyForQuestion } from "./PenaltyLoader";
import { badgeKey } from "@/lib/categories";
import { EXAM_PASS_POINTS, PENALTIES_ENABLED } from "@/lib/config";
import { imageSize } from "@/lib/imageSizes";
import { pointsLabel, type Dict, type Lang } from "@/lib/i18n";
import {
  formatSequence,
  bilingualOption,
  bilingualText,
  examPoints,
  type ExamSlot,
} from "@/lib/questions";
import { OPTION_KEYS, type AnswerRecord, type Question } from "@/lib/types";
import BilingualText from "./BilingualText";
import PrijavaGreske from "./PrijavaGreske";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import GlassPanel from "./ui/GlassPanel";
import HexBadge from "./ui/HexBadge";
import SectionLabel from "./ui/SectionLabel";

interface ResultCardProps {
  questions: Question[];
  /** Sastav ispita — redni brojevi 1–40 i stranice za pregled po pitanjima. */
  slots: readonly ExamSlot[];
  records: Map<number, AnswerRecord>;
  /** Ispit je prekinut istekom vremena. */
  timedOut: boolean;
  onRestart: () => void;
  onBackToLanding: () => void;
  onOpenLiterature: () => void;
  t: Dict;
  lang: Lang;
}

const OZNAKA = "font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] uppercase";

/**
 * Rezultat simulacije: bodovi u šestougaonom bedžu (jedini glow na ekranu uz
 * primarno dugme), presuda položeno/nije, brojke, pregled po pitanjima i
 * pregled grešaka kao lista sa razdjelnicima.
 */
export default function ResultCard({
  questions,
  slots,
  records,
  timedOut,
  onRestart,
  onBackToLanding,
  onOpenLiterature,
  t,
  lang,
}: ResultCardProps) {
  // Bodovi po mjestu na testu (ne iz kataloga): ukupno uvijek 80.
  const pointsOf = new Map(slots.map((s) => [s.question.id, s.points]));
  const maxPoints = examPoints(slots);
  const scored = questions.reduce((sum, q) => sum + (records.get(q.id)?.points ?? 0), 0);
  const percent = maxPoints > 0 ? Math.round((scored / maxPoints) * 100) : 0;
  // Prolaz se odlučuje po BODOVIMA (najmanje 68 od 80), ne po procentu —
  // procenat je samo prikaz.
  const passPoints = EXAM_PASS_POINTS;
  const passed = scored >= passPoints;

  const correctCount = questions.filter((q) => records.get(q.id)?.correct).length;
  const answeredCount = questions.filter((q) => records.has(q.id)).length;
  const wrong = questions.filter((q) => records.has(q.id) && !records.get(q.id)?.correct);
  const unanswered = questions.filter((q) => !records.has(q.id));
  // Redom kao na testu, da se broj pitanja poklapa sa pregledom iznad.
  const toReview = questions.filter((q) => !records.get(q.id)?.correct);
  const numberOf = new Map(slots.map((s) => [s.question.id, s.number]));
  const pages = [...new Set(slots.map((s) => s.page))].map((page) =>
    slots.filter((s) => s.page === page),
  );

  const Presuda = passed ? CircleCheck : CircleX;

  return (
    <div className="space-y-5">
      <GlassPanel as="section" padding="lg" aria-live="polite">
        <SectionLabel className="mb-6">{t.resultTitle}</SectionLabel>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <HexBadge tone={passed ? "ok" : "err"} size="lg" caption={pointsLabel(maxPoints, lang)}>
            {scored}
            <span className="text-2xl text-text-muted">/{maxPoints}</span>
          </HexBadge>

          <div className="min-w-0">
            <p
              className={`flex items-center gap-3 font-display text-3xl leading-tight font-extrabold tracking-tight uppercase sm:text-4xl ${
                passed ? "text-ok" : "text-err"
              }`}
            >
              <Presuda aria-hidden="true" strokeWidth={1.75} className="h-8 w-8 flex-none sm:h-9 sm:w-9" />
              {passed ? t.passed : t.failed}
            </p>
            <p className="tabular mt-2 font-display text-xl font-bold text-text">{percent}%</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
              {t.passThreshold
                .replace("{n}", String(passPoints))
                .replace("{max}", String(maxPoints))}
              {timedOut && ` ${t.timedOutNote}`}
            </p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-glass-line pt-6 sm:grid-cols-4">
          <div>
            <dt className={`${OZNAKA} text-text-muted`}>{t.statCorrect}</dt>
            <dd className="tabular mt-1.5 font-display text-2xl font-bold text-ok">{correctCount}</dd>
          </div>
          <div>
            <dt className={`${OZNAKA} text-text-muted`}>{t.statWrong}</dt>
            <dd className="tabular mt-1.5 font-display text-2xl font-bold text-err">{wrong.length}</dd>
          </div>
          <div>
            <dt className={`${OZNAKA} text-text-muted`}>{t.statUnanswered}</dt>
            <dd className="tabular mt-1.5 font-display text-2xl font-bold text-text-muted">{unanswered.length}</dd>
          </div>
          <div>
            <dt className={`${OZNAKA} text-text-muted`}>{t.statAnswered}</dt>
            <dd className="tabular mt-1.5 font-display text-2xl font-bold text-text">
              {answeredCount}
              <span className="mx-0.5 text-text-muted">/</span>
              {questions.length}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="md" onClick={onRestart} className="w-full sm:w-auto">
            {t.newExam}
          </Button>
          <Button variant="secondary" size="md" onClick={onBackToLanding} className="w-full sm:w-auto">
            {t.backToStart}
          </Button>
          <Button
            variant="ghost"
            icon={<BookOpen aria-hidden="true" strokeWidth={1.5} />}
            onClick={onOpenLiterature}
            className="sm:ml-auto"
          >
            {t.literature}
          </Button>
        </div>
      </GlassPanel>

      {/* ── Pregled po pitanjima: tačno/netačno i bodovi ─────────────── */}
      {slots.length > 0 && (
        <GlassPanel as="section" aria-label={t.resultSummaryTitle}>
          <h3 className={`mb-4 ${OZNAKA} text-text-muted`}>{t.resultSummaryTitle}</h3>
          {/* Jedna lista koja teče redom; stranice razdvaja razmak od sm naviše (kao u QuestionNav). */}
          <ol className="flex flex-wrap gap-1.5">
            {pages.flatMap((pageSlots, i) =>
              pageSlots.map((slot, j) => {
                const rec = records.get(slot.question.id);
                const max = slot.points;
                const tone = !rec
                  ? "border-glass-line text-text-muted"
                  : rec.correct
                    ? "border-ok-line bg-ok-soft text-ok"
                    : "border-err-line bg-err-soft text-err";
                const status = !rec ? t.reviewNoAnswer : rec.correct ? t.correctAnswerLabel : t.reviewWrong;
                const kraj = j === pageSlots.length - 1 && i < pages.length - 1;
                return (
                  <li
                    key={slot.question.id}
                    className={`flex min-w-10 flex-col items-center rounded-sm border px-1 py-1 ${tone} ${kraj ? "sm:mr-3.5" : ""}`}
                    title={`${slot.number}. ${status} — ${rec?.points ?? 0}/${max}`}
                  >
                    <span className="tabular font-display text-sm leading-tight font-bold">{slot.number}</span>
                    <span className="tabular text-[0.6875rem] leading-tight">
                      {rec?.points ?? 0}/{max}
                    </span>
                    <span className="sr-only">{status}</span>
                  </li>
                );
              }),
            )}
          </ol>
        </GlassPanel>
      )}

      {/* ── Pregled grešaka ─────────────────────────────────────────── */}
      <GlassPanel as="section">
        <h3 className="font-display text-xl font-bold">{t.reviewTitle}</h3>

        {toReview.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ok">
            <Check aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
            {t.reviewPerfect}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-muted">{t.reviewLead}</p>

            <ol className="mt-2 divide-y divide-glass-line">
              {toReview.map((q) => {
                const rec = records.get(q.id);
                const [w, h] = q.image ? imageSize(q.image) : [0, 0];
                const given = rec?.answer;
                const bodovi = pointsOf.get(q.id) ?? 0;

                return (
                  <li key={q.id} className="py-6 last:pb-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge tone="accent">{t[badgeKey(q)]}</Badge>
                      <Badge tone={rec ? "err" : "neutral"}>{rec ? t.reviewWrong : t.reviewNoAnswer}</Badge>
                      <Badge className="ml-auto">
                        {bodovi} {pointsLabel(bodovi, lang)}
                      </Badge>
                    </div>

                    <p className="mb-4 font-display leading-snug font-semibold">
                      {numberOf.has(q.id) && (
                        <span className="tabular mr-2 text-accent-2">{numberOf.get(q.id)}.</span>
                      )}
                      <BilingualText text={bilingualText(q, lang)} />
                    </p>

                    {q.image && (
                      <div className="mb-4 flex justify-center overflow-hidden rounded-lg border border-glass-line bg-white p-3">
                        <Image
                          src={`/web_images/${q.image}`}
                          alt=""
                          width={w}
                          height={h}
                          loading="lazy"
                          sizes={`(max-width: 640px) 100vw, ${w}px`}
                          style={{ maxWidth: w }}
                          className="h-auto w-full object-contain"
                        />
                      </div>
                    )}

                    {q.type === "ordering" ? (
                      <ul className="space-y-2">
                        {given?.kind === "ordering" && given.value.trim() !== "" && (
                          <OdgovorRed tacno={false} oznaka={t.yourAnswerLabel}>
                            <span className="tabular font-display text-lg font-bold tracking-[0.2em]">{given.value}</span>
                          </OdgovorRed>
                        )}
                        <OdgovorRed tacno oznaka={t.correctAnswerLabel}>
                          <span className="tabular font-display text-lg font-bold tracking-[0.2em]">
                            {formatSequence(q.answer_sequence)}
                          </span>
                        </OdgovorRed>
                      </ul>
                    ) : (
                      <ul className="space-y-2">
                        {OPTION_KEYS.map((key) => {
                          const isCorrect = q.correct === key;
                          const isGiven = given?.kind === "choice" && given.value === key;
                          if (!isCorrect && !isGiven) return null;
                          return (
                            <OdgovorRed
                              key={key}
                              tacno={isCorrect}
                              oznaka={isCorrect ? t.correctAnswerLabel : t.yourAnswerLabel}
                            >
                              <span className="text-[0.9375rem] leading-snug">
                                <span className="mr-1.5 font-display font-bold uppercase">{key})</span>
                                <BilingualText text={bilingualOption(q, key, lang)} />
                              </span>
                            </OdgovorRed>
                          );
                        })}
                      </ul>
                    )}

                    {/* Cijena ove greške; izostaje kad pitanju ne odgovara prekršaj. */}
                    {PENALTIES_ENABLED && (
                      <PenaltyForQuestion questionId={q.id} t={t} lang={lang} compact />
                    )}

                    {/* Objašnjenje se prikazuje samo ako postoji u bazi. */}
                    {q.explanation && (
                      <div className="mt-4 flex gap-3">
                        <Lightbulb aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-5 w-5 flex-none text-accent-2" />
                        <div>
                          <p className={`mb-1 ${OZNAKA} text-accent-2`}>{t.explanationTitle}</p>
                          <p className="text-sm leading-relaxed text-text">{q.explanation}</p>
                        </div>
                      </div>
                    )}

                    <PrijavaGreske t={t} lang={lang} pitanje={q} rezim="rezultat" className="mt-3" />
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </GlassPanel>
    </div>
  );
}

/**
 * Jedan red u pregledu greške: vaš ili tačan odgovor. Boja nije jedini nosilac
 * značenja — uz nju stoje ikonica i natpis.
 */
function OdgovorRed({ tacno, oznaka, children }: { tacno: boolean; oznaka: string; children: ReactNode }) {
  const Ikona = tacno ? Check : X;
  return (
    <li
      className={`flex items-start gap-3.5 rounded-lg border px-4 py-3 ${
        tacno ? "border-ok-line bg-ok-soft" : "border-err-line bg-err-soft"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-px flex h-7 w-7 flex-none items-center justify-center rounded-full text-bg ${tacno ? "bg-ok" : "bg-err"}`}
      >
        <Ikona strokeWidth={2.25} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`${OZNAKA} ${tacno ? "text-ok" : "text-err"}`}>{oznaka}</p>
        <div className="mt-1 text-text">{children}</div>
      </div>
    </li>
  );
}
