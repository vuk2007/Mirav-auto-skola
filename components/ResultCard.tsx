"use client";

import Image from "next/image";
import { PenaltyForQuestion } from "./PenaltyLoader";
import { badgeKey } from "@/lib/categories";
import { examPassPoints, PENALTIES_ENABLED } from "@/lib/config";
import { imageSize } from "@/lib/imageSizes";
import { pointsLabel, type Dict, type Lang } from "@/lib/i18n";
import {
  formatSequence,
  localizedOption,
  localizedText,
  questionPoints,
} from "@/lib/questions";
import { OPTION_KEYS, type AnswerRecord, type Question } from "@/lib/types";

interface ResultCardProps {
  questions: Question[];
  records: Map<number, AnswerRecord>;
  /** Ispit je prekinut istekom vremena. */
  timedOut: boolean;
  onRestart: () => void;
  onBackToLanding: () => void;
  onOpenLiterature: () => void;
  t: Dict;
  lang: Lang;
}

export default function ResultCard({
  questions,
  records,
  timedOut,
  onRestart,
  onBackToLanding,
  onOpenLiterature,
  t,
  lang,
}: ResultCardProps) {
  const maxPoints = questions.reduce((sum, q) => sum + questionPoints(q), 0);
  const scored = questions.reduce((sum, q) => sum + (records.get(q.id)?.points ?? 0), 0);
  const percent = maxPoints > 0 ? Math.round((scored / maxPoints) * 100) : 0;
  // Prolaz se odlucuje po BODOVIMA, ne po procentu — procenat je samo prikaz.
  // Prag je procenat ukupnih bodova OVOG testa: bodovi dolaze iz baze, pa
  // ukupan zbir nije isti na svakom izvlačenju.
  const passPoints = examPassPoints(maxPoints);
  const passed = scored >= passPoints;

  const correctCount = questions.filter((q) => records.get(q.id)?.correct).length;
  const answeredCount = questions.filter((q) => records.has(q.id)).length;
  const wrong = questions.filter((q) => records.has(q.id) && !records.get(q.id)?.correct);
  const unanswered = questions.filter((q) => !records.has(q.id));
  const toReview = [...wrong, ...unanswered];


  return (
    <div className="space-y-5">
      <section
        className={`panel border-t-4 p-5 sm:p-6 ${passed ? "border-t-green" : "border-t-red"}`}
        aria-live="polite"
      >
        <p className="tag mb-2 text-muted">{t.resultTitle}</p>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p
            className={`font-display text-6xl leading-none font-bold ${
              passed ? "text-green" : "text-red"
            }`}
          >
            {percent}%
          </p>
          <p className="font-display pb-1 text-2xl font-bold text-ink">
            {scored}{" "}
            <span className="text-muted">
              / {maxPoints} {pointsLabel(maxPoints, lang)}
            </span>
          </p>
        </div>

        <p
          className={`font-display mt-4 inline-block rounded px-4 py-2 text-2xl font-bold tracking-wide uppercase ${
            passed ? "bg-green text-white" : "bg-red text-white"
          }`}
        >
          {passed ? t.passed : t.failed}
        </p>

        <p className="mt-3 text-sm text-muted">
          {t.passThreshold
            .replace("{n}", String(passPoints))
            .replace("{max}", String(maxPoints))}
          {timedOut && ` ${t.timedOutNote}`}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="tag text-muted">{t.statCorrect}</dt>
            <dd className="font-display text-2xl font-bold text-green">{correctCount}</dd>
          </div>
          <div>
            <dt className="tag text-muted">{t.statWrong}</dt>
            <dd className="font-display text-2xl font-bold text-red">{wrong.length}</dd>
          </div>
          <div>
            <dt className="tag text-muted">{t.statUnanswered}</dt>
            <dd className="font-display text-2xl font-bold text-muted">{unanswered.length}</dd>
          </div>
          <div>
            <dt className="tag text-muted">{t.statAnswered}</dt>
            <dd className="font-display text-2xl font-bold text-ink">
              {answeredCount}/{questions.length}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="font-display rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
          >
            {t.newExam}
          </button>
          <button
            type="button"
            onClick={onBackToLanding}
            className="font-display rounded border-2 border-line px-5 py-3 text-base font-bold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
          >
            {t.backToStart}
          </button>
          <button
            type="button"
            onClick={onOpenLiterature}
            className="font-display ml-auto rounded px-3 py-3 text-base font-semibold text-blue underline-offset-4 hover:underline"
          >
            {t.literature}
          </button>
        </div>
      </section>

      {/* ── Pregled grešaka ─────────────────────────────────────────── */}
      <section className="panel p-5 sm:p-6">
        <h3 className="mb-1 text-xl font-bold">{t.reviewTitle}</h3>

        {toReview.length === 0 ? (
          <p className="text-sm text-green">{t.reviewPerfect}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{t.reviewLead}</p>

            <ol className="space-y-5">
              {toReview.map((q) => {
                const rec = records.get(q.id);
                const [w, h] = q.image ? imageSize(q.image) : [0, 0];
                const given = rec?.answer;

                return (
                  <li key={q.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tag text-blue">{t[badgeKey(q)]}</span>
                      <span className={`tag ${rec ? "text-red" : "text-muted"}`}>
                        {rec ? t.reviewWrong : t.reviewNoAnswer}
                      </span>
                      <span className="tag ml-auto text-muted">
                        {questionPoints(q)} {pointsLabel(questionPoints(q), lang)}
                      </span>
                    </div>

                    <p className="mb-3 font-semibold">{localizedText(q, lang)}</p>

                    {q.image && (
                      <div className="mb-3 flex justify-center rounded border border-line bg-white p-2">
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
                      <dl className="space-y-1.5 text-sm">
                        {given?.kind === "ordering" && given.value.trim() !== "" && (
                          <div className="flex gap-2">
                            <dt className="tag flex-none pt-0.5 text-red">{t.yourAnswerLabel}</dt>
                            <dd className="font-display tracking-[0.2em]">{given.value}</dd>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <dt className="tag flex-none pt-0.5 text-green">
                            {t.correctAnswerLabel}
                          </dt>
                          <dd className="font-display tracking-[0.2em]">
                            {formatSequence(q.answer_sequence)}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <ul className="space-y-1.5">
                        {OPTION_KEYS.map((key) => {
                          const isCorrect = q.correct === key;
                          const isGiven = given?.kind === "choice" && given.value === key;
                          if (!isCorrect && !isGiven) return null;
                          return (
                            <li
                              key={key}
                              className={`flex items-start gap-2 rounded border-l-4 px-3 py-2 text-sm ${
                                isCorrect
                                  ? "border-green bg-green-soft"
                                  : "border-red bg-red-soft"
                              }`}
                            >
                              <span className="tag flex-none pt-0.5 uppercase">
                                {isCorrect ? t.correctAnswerLabel : t.yourAnswerLabel}
                              </span>
                              <span>
                                <strong className="mr-1 uppercase">{key})</strong>
                                {localizedOption(q, key, lang)}
                              </span>
                            </li>
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
                      <div className="mt-3 rounded border-l-4 border-blue bg-blue-soft p-3">
                        <p className="tag mb-1 text-blue">{t.explanationTitle}</p>
                        <p className="text-sm leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
