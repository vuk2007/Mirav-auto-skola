"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterByCategory, type Category } from "@/lib/categories";
import {
  EXAM_MINUTES,
  EXAM_QUESTION_COUNT,
  EXAM_TIMER_ENABLED,
  PRACTICE_QUESTION_LIMIT,
} from "@/lib/config";
import {
  isAnswerCorrect,
  loadQuestions,
  questionPoints,
  sample,
  shuffle,
} from "@/lib/questions";
import type { Answer, AnswerRecord, Mode, OptionKey, Question } from "@/lib/types";
import Controls from "./Controls";
import ProgressBar from "./ProgressBar";
import QuestionCard from "./QuestionCard";
import ResultCard from "./ResultCard";

interface QuizProps {
  /** Ugrađena verzija izostavlja uvodni tekst i drži razmake manjim. */
  compact?: boolean;
}

export default function Quiz({ compact = false }: QuizProps) {
  const [allQuestions, setAllQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("vjezba");
  const [category, setCategory] = useState<Category>("sve");

  /** Pitanja tekuće sesije (vježba: izmiješana kategorija, ispit: nasumičan uzorak). */
  const [pool, setPool] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());
  const [finished, setFinished] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  /** Kumulativni skor vježbe — preživljava premješavanje kad se krug završi. */
  const [practiceStats, setPracticeStats] = useState({ correct: 0, answered: 0 });

  /** Povećava se na „Počni ispočetka" da bi se sesija ponovo izgradila. */
  const [sessionNonce, setSessionNonce] = useState(0);

  // ── Učitavanje baze ───────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    loadQuestions(controller.signal)
      .then(setAllQuestions)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "Nepoznata greška.");
      });
    return () => controller.abort();
  }, []);

  // ── Izgradnja sesije pri promjeni režima / kategorije / restarta ──────────
  useEffect(() => {
    if (!allQuestions) return;

    const next =
      mode === "simulacija"
        ? sample(allQuestions, EXAM_QUESTION_COUNT)
        : sample(filterByCategory(allQuestions, category), PRACTICE_QUESTION_LIMIT);

    setPool(next);
    setIndex(0);
    setAnswers(new Map());
    setDrafts(new Map());
    setFinished(false);
    setTimedOut(false);
    setPracticeStats({ correct: 0, answered: 0 });
    setSecondsLeft(
      mode === "simulacija" && EXAM_TIMER_ENABLED ? EXAM_MINUTES * 60 : null,
    );
  }, [allQuestions, mode, category, sessionNonce]);

  // ── Tajmer ispita ─────────────────────────────────────────────────────────
  const finishedRef = useRef(finished);
  finishedRef.current = finished;

  useEffect(() => {
    if (mode !== "simulacija" || !EXAM_TIMER_ENABLED || finished || pool.length === 0) return;

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(id);
          if (!finishedRef.current) {
            setTimedOut(true);
            setFinished(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [mode, finished, pool.length, sessionNonce]);

  const current = pool[index];
  const isPractice = mode === "vjezba";
  const currentAnswer = current ? answers.get(current.id) : undefined;
  const revealed = isPractice && currentAnswer !== undefined;
  const currentCorrect =
    current && currentAnswer ? isAnswerCorrect(current, currentAnswer) : false;

  /** Upisuje odgovor i, u vježbi, uvećava kumulativni skor (samo prvi put). */
  const recordAnswer = useCallback(
    (question: Question, answer: Answer) => {
      const isFirstAnswer = !answers.has(question.id);

      setAnswers((prev) => new Map(prev).set(question.id, answer));

      if (isPractice && isFirstAnswer) {
        const correct = isAnswerCorrect(question, answer);
        setPracticeStats((prev) => ({
          correct: prev.correct + (correct ? 1 : 0),
          answered: prev.answered + 1,
        }));
      }
    },
    [answers, isPractice],
  );

  const handleSelectOption = useCallback(
    (key: OptionKey) => {
      if (!current || revealed) return;
      recordAnswer(current, { kind: "choice", value: key });
    },
    [current, revealed, recordAnswer],
  );

  const handleOrderingChange = useCallback(
    (value: string) => {
      if (!current || revealed) return;
      setDrafts((prev) => new Map(prev).set(current.id, value));
      // Na ispitu nema potvrde — unos se pamti odmah kao odgovor.
      if (!isPractice) {
        recordAnswer(current, { kind: "ordering", value });
      }
    },
    [current, revealed, isPractice, recordAnswer],
  );

  const handleOrderingSubmit = useCallback(() => {
    if (!current || revealed) return;
    const value = drafts.get(current.id) ?? "";
    if (value.trim() === "") return;
    recordAnswer(current, { kind: "ordering", value });
  }, [current, revealed, drafts, recordAnswer]);

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex(Math.min(Math.max(nextIndex, 0), Math.max(pool.length - 1, 0)));
    },
    [pool.length],
  );

  /** Vježba je neograničena: kad se krug završi, pitanja se premiješaju iz početka. */
  const handleNext = useCallback(() => {
    if (index + 1 < pool.length) {
      setIndex(index + 1);
      return;
    }
    if (isPractice) {
      setPool((prev) => shuffle(prev));
      setIndex(0);
      setAnswers(new Map());
      setDrafts(new Map());
    }
  }, [index, pool.length, isPractice]);

  const handleRestart = useCallback(() => setSessionNonce((n) => n + 1), []);

  const handleModeChange = useCallback((next: Mode) => setMode(next), []);

  const handleCategoryChange = useCallback((next: Category) => setCategory(next), []);

  /** Bodovani zapisi — grade se tek na kraju ispita. */
  const records = useMemo(() => {
    const map = new Map<number, AnswerRecord>();
    for (const q of pool) {
      const answer = answers.get(q.id);
      if (!answer) continue;
      const correct = isAnswerCorrect(q, answer);
      map.set(q.id, {
        questionId: q.id,
        answer,
        correct,
        points: correct ? questionPoints(q) : 0,
      });
    }
    return map;
  }, [pool, answers]);

  // ── Stanja učitavanja ─────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="panel border-t-4 border-t-red p-5">
        <h2 className="mb-1 text-lg font-bold text-red">Greška pri učitavanju pitanja</h2>
        <p className="text-sm text-muted">{loadError}</p>
      </div>
    );
  }

  if (!allQuestions) {
    return (
      <div className="panel p-5" aria-busy="true">
        <p className="tag text-muted">Učitavanje pitanja…</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue" />
        </div>
      </div>
    );
  }

  const answeredInExam = pool.filter((q) => answers.has(q.id)).length;

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <Controls
        mode={mode}
        onModeChange={handleModeChange}
        category={category}
        onCategoryChange={handleCategoryChange}
        poolSize={pool.length}
        correctCount={practiceStats.correct}
        answeredCount={isPractice ? practiceStats.answered : answeredInExam}
        secondsLeft={finished ? null : secondsLeft}
        onRestart={handleRestart}
      />

      {finished ? (
        <ResultCard
          questions={pool}
          records={records}
          timedOut={timedOut}
          onRestart={handleRestart}
        />
      ) : pool.length === 0 ? (
        <div className="panel p-5">
          <p className="text-sm text-muted">
            Nema pitanja u izabranoj kategoriji. Izaberite drugu kategoriju.
          </p>
        </div>
      ) : current ? (
        <>
          <ProgressBar
            current={index + 1}
            total={pool.length}
            label={
              isPractice
                ? `Pitanje ${index + 1} / ${pool.length}`
                : `Ispitno pitanje ${index + 1} / ${pool.length}`
            }
          />

          <QuestionCard
            key={current.id}
            question={current}
            selected={
              currentAnswer?.kind === "choice" ? currentAnswer.value : null
            }
            orderingValue={drafts.get(current.id) ?? ""}
            revealed={revealed}
            correct={currentCorrect}
            showOrderingSubmit={isPractice}
            onSelectOption={handleSelectOption}
            onOrderingChange={handleOrderingChange}
            onOrderingSubmit={handleOrderingSubmit}
          />

          {/* Navigacija */}
          <div className="flex flex-wrap items-center gap-3">
            {!isPractice && (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="font-display rounded border-2 border-line px-5 py-2.5 text-base font-semibold tracking-wide uppercase transition-colors hover:border-blue hover:text-blue disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
              >
                Nazad
              </button>
            )}

            {isPractice ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!revealed}
                className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue"
              >
                {index + 1 < pool.length ? "Sljedeće pitanje" : "Novi krug"}
              </button>
            ) : index + 1 < pool.length ? (
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
              >
                Sljedeće pitanje
              </button>
            ) : null}

            {!isPractice && (
              <button
                type="button"
                onClick={() => setFinished(true)}
                className="font-display ml-auto rounded border-2 border-blue px-5 py-2.5 text-base font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue hover:text-white"
              >
                Završi ispit
              </button>
            )}

            {isPractice && revealed && (
              <p
                className={`font-display ml-auto text-lg font-bold ${
                  currentCorrect ? "text-green" : "text-red"
                }`}
                role="status"
              >
                {currentCorrect ? "Tačan odgovor" : "Netačan odgovor"}
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
