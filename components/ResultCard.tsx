"use client";

import { PASS_PERCENT } from "@/lib/config";
import { questionPoints } from "@/lib/questions";
import type { AnswerRecord, Question } from "@/lib/types";

interface ResultCardProps {
  questions: Question[];
  records: Map<number, AnswerRecord>;
  /** Ispit je prekinut istekom vremena. */
  timedOut: boolean;
  onRestart: () => void;
}

export default function ResultCard({
  questions,
  records,
  timedOut,
  onRestart,
}: ResultCardProps) {
  const maxPoints = questions.reduce((sum, q) => sum + questionPoints(q), 0);
  const scored = questions.reduce((sum, q) => sum + (records.get(q.id)?.points ?? 0), 0);
  const percent = maxPoints > 0 ? Math.round((scored / maxPoints) * 100) : 0;
  const passed = percent >= PASS_PERCENT;

  const correctCount = questions.filter((q) => records.get(q.id)?.correct).length;
  const answeredCount = questions.filter((q) => records.has(q.id)).length;
  const wrong = questions.filter((q) => records.has(q.id) && !records.get(q.id)?.correct);
  const unanswered = questions.filter((q) => !records.has(q.id));

  return (
    <div className="space-y-5">
      <section
        className={`panel border-t-4 p-5 sm:p-6 ${passed ? "border-t-green" : "border-t-red"}`}
        aria-live="polite"
      >
        <p className="tag mb-2 text-muted">Rezultat simulacije</p>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p
            className={`font-display text-6xl leading-none font-bold ${
              passed ? "text-green" : "text-red"
            }`}
          >
            {percent}%
          </p>
          <p className="font-display pb-1 text-2xl font-bold text-ink">
            {scored} <span className="text-muted">/ {maxPoints} bodova</span>
          </p>
        </div>

        <p
          className={`font-display mt-4 inline-block rounded px-4 py-2 text-2xl font-bold tracking-wide uppercase ${
            passed ? "bg-green text-white" : "bg-red text-white"
          }`}
        >
          {passed ? "Položeno" : "Nije položeno"}
        </p>

        <p className="mt-3 text-sm text-muted">
          Prag za prolaz je {PASS_PERCENT}% osvojenih bodova.
          {timedOut && " Ispit je zaustavljen jer je isteklo vrijeme."}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="tag text-muted">Tačno</dt>
            <dd className="font-display text-2xl font-bold text-green">{correctCount}</dd>
          </div>
          <div>
            <dt className="tag text-muted">Netačno</dt>
            <dd className="font-display text-2xl font-bold text-red">{wrong.length}</dd>
          </div>
          <div>
            <dt className="tag text-muted">Bez odgovora</dt>
            <dd className="font-display text-2xl font-bold text-muted">{unanswered.length}</dd>
          </div>
          <div>
            <dt className="tag text-muted">Odgovoreno</dt>
            <dd className="font-display text-2xl font-bold text-ink">
              {answeredCount}/{questions.length}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onRestart}
          className="font-display mt-5 w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark sm:w-auto"
        >
          Novi ispit
        </button>
      </section>

      {(wrong.length > 0 || unanswered.length > 0) && (
        <section className="panel p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold">Pitanja za ponavljanje</h3>
          <ol className="space-y-2.5">
            {[...wrong, ...unanswered].map((q) => (
              <li key={q.id} className="flex gap-3 border-b border-line pb-2.5 last:border-b-0">
                <span
                  className={`tag mt-1 flex-none ${records.has(q.id) ? "text-red" : "text-muted"}`}
                >
                  {records.has(q.id) ? "Netačno" : "Bez odg."}
                </span>
                <span className="text-sm leading-snug">{q.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">
            Za objašnjenja i tačne odgovore pređite u režim <strong>Vježba</strong> — tamo se
            poslije svakog odgovora odmah prikazuje tačno rješenje.
          </p>
        </section>
      )}
    </div>
  );
}
