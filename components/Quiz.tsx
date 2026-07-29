"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterByCategory, type Category } from "@/lib/categories";
import {
  EXAM_MINUTES,
  EXAM_PASS_POINTS,
  EXAM_TOTAL_POINTS,
  EXAM_TIMER_ENABLED,
  PRACTICE_QUESTION_LIMIT,
} from "@/lib/config";
import { LANG_LABELS, LANGS } from "@/lib/i18n";
import {
  buildExam,
  byIds,
  isAnswerCorrect,
  loadQuestions,
  questionPoints,
  sample,
  shuffle,
} from "@/lib/questions";
import {
  clearPractice,
  loadBestExam,
  loadPractice,
  saveBestExam,
  savePractice,
  type BestExam,
  type PracticeState,
} from "@/lib/storage";
import type {
  Answer,
  AnswerRecord,
  Mode,
  OptionKey,
  Question,
  Screen,
} from "@/lib/types";
import { buildScenarios, type SimScenario } from "@/lib/simulator";
import { useApp } from "./AppProvider";
import Controls from "./Controls";
import SimulatorRunner from "./sim/SimulatorRunner";
import Landing from "./Landing";
import LiteratureModal from "./LiteratureModal";
import ProgressBar from "./ProgressBar";
import QuestionCard from "./QuestionCard";
import QuestionNav from "./QuestionNav";
import ResultCard from "./ResultCard";

interface QuizProps {
  /** Ugrađena verzija drži razmake manjim. */
  compact?: boolean;
}

export default function Quiz({ compact = false }: QuizProps) {
  // Jezik i „nazad na početak" dolaze iz konteksta — dijeli ih zaglavlje sa logom.
  const { lang, setLang, t, homeNonce } = useApp();

  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<Mode>("vjezba");
  const [category, setCategory] = useState<Category>("sve");

  /** Baza se učitava tek kad korisnik pokrene režim — landing je odmah vidljiv. */
  const [allQuestions, setAllQuestions] = useState<Question[] | null>(null);
  const pendingLoad = useRef<Promise<Question[]> | null>(null);
  /** Sprječava dvostruko bodovanje ako tajmer okine dok se ekran već mijenja. */
  const finishedOnce = useRef(false);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pool, setPool] = useState<Question[]>([]);
  const [scenarios, setScenarios] = useState<SimScenario[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  /** Apsolutni trenutak isteka ispita (epoch ms) — vidi efekat tajmera niže. */
  const [deadline, setDeadline] = useState<number | null>(null);

  /** Kumulativni skor vježbe — preživljava premješavanje kad se krug završi. */
  const [practiceStats, setPracticeStats] = useState({ correct: 0, answered: 0 });

  const [best, setBest] = useState<BestExam | null>(null);
  const [saved, setSaved] = useState<PracticeState | null>(null);
  const [literatureOpen, setLiteratureOpen] = useState(false);

  const isPractice = mode === "vjezba";
  const isSimulator = mode === "simulator";

  // ── Učitavanje zapamćenog stanja (samo na klijentu) ───────────────────────
  // Jezik čita LangProvider; ovdje se vraćaju rezultat i sačuvana vježba.
  useEffect(() => {
    setBest(loadBestExam());
    setSaved(loadPractice());
  }, []);

  /** Učitava bazu najviše jednom, bez obzira koliko puta se pozove. */
  const ensureQuestions = useCallback(async (): Promise<Question[]> => {
    if (allQuestions) return allQuestions;
    pendingLoad.current ??= loadQuestions();
    const qs = await pendingLoad.current;
    setAllQuestions(qs);
    return qs;
  }, [allQuestions]);

  const resetSession = useCallback(() => {
    setIndex(0);
    setAnswers(new Map());
    setDrafts(new Map());
    setTimedOut(false);
    setPracticeStats({ correct: 0, answered: 0 });
    finishedOnce.current = false;
  }, []);

  // ── Pokretanje režima ─────────────────────────────────────────────────────
  const startPractice = useCallback(
    async (resume: PracticeState | null) => {
      setStarting(true);
      setLoadError(null);
      try {
        const qs = await ensureQuestions();
        resetSession();

        if (resume) {
          const restored = byIds(qs, resume.ids);
          // Ako se baza u međuvremenu promijenila, kreni iz početka.
          if (restored.length === resume.ids.length) {
            setCategory(resume.category);
            setPool(restored);
            setIndex(Math.min(resume.index, restored.length - 1));
            setPracticeStats({ correct: resume.correct, answered: resume.answered });
            setMode("vjezba");
            setSecondsLeft(null);
            setDeadline(null);
            setScreen("kviz");
            return;
          }
          clearPractice();
          setSaved(null);
        }

        setPool(sample(filterByCategory(qs, category), PRACTICE_QUESTION_LIMIT));
        setMode("vjezba");
        setSecondsLeft(null);
        setDeadline(null);
        setScreen("kviz");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Nepoznata greška.");
      } finally {
        setStarting(false);
      }
    },
    [ensureQuestions, resetSession, category],
  );

  const startSimulator = useCallback(async () => {
    setStarting(true);
    setLoadError(null);
    try {
      const qs = await ensureQuestions();
      resetSession();
      setScenarios(buildScenarios(qs));
      setMode("simulator");
      setSecondsLeft(null);
      setDeadline(null);
      setScreen("kviz");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Nepoznata greška.");
    } finally {
      setStarting(false);
    }
  }, [ensureQuestions, resetSession]);

  const startExam = useCallback(async () => {
    setStarting(true);
    setLoadError(null);
    try {
      const qs = await ensureQuestions();
      resetSession();
      setPool(buildExam(qs, EXAM_TOTAL_POINTS));
      setMode("simulacija");
      if (EXAM_TIMER_ENABLED) {
        setDeadline(Date.now() + EXAM_MINUTES * 60 * 1000);
        setSecondsLeft(EXAM_MINUTES * 60);
      } else {
        setDeadline(null);
        setSecondsLeft(null);
      }
      setScreen("kviz");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Nepoznata greška.");
    } finally {
      setStarting(false);
    }
  }, [ensureQuestions, resetSession]);

  // ── Promjena kategorije u toku vježbe ─────────────────────────────────────
  const changeCategory = useCallback(
    (next: Category) => {
      setCategory(next);
      if (screen === "kviz" && isPractice && allQuestions) {
        resetSession();
        setPool(sample(filterByCategory(allQuestions, next), PRACTICE_QUESTION_LIMIT));
      }
    },
    [screen, isPractice, allQuestions, resetSession],
  );

  // ── Bodovani zapisi ───────────────────────────────────────────────────────
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

  /** Zaključuje ispit, boduje i pamti najbolji rezultat. */
  const finishExam = useCallback(
    (viaTimeout: boolean) => {
      if (finishedOnce.current) return;
      finishedOnce.current = true;

      const max = pool.reduce((s, q) => s + questionPoints(q), 0);
      const scored = pool.reduce((s, q) => s + (records.get(q.id)?.points ?? 0), 0);
      const percent = max > 0 ? Math.round((scored / max) * 100) : 0;
      saveBestExam({ percent, scored, max, passed: scored >= EXAM_PASS_POINTS });
      setBest(loadBestExam());
      if (viaTimeout) setTimedOut(true);
      setSecondsLeft(null);
      setDeadline(null);
      setScreen("rezultat");
    },
    [pool, records],
  );

  // ── Tajmer ispita ─────────────────────────────────────────────────────────
  const finishRef = useRef(finishExam);
  finishRef.current = finishExam;

  /**
   * Preostalo vrijeme se računa iz apsolutnog roka, a NE oduzimanjem po otkucaju
   * intervala: browseri prigušuju setInterval u pozadinskim tabovima (i do jednom
   * u minutu), pa bi brojanje otkucaja dalo kandidatu znatno više od 45 minuta.
   * Ovako sat ostaje tačan i sam se ispravi kad se tab vrati u prvi plan.
   */
  useEffect(() => {
    if (screen !== "kviz" || mode !== "simulacija" || deadline === null) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) finishRef.current(true);
    };

    tick();
    const id = window.setInterval(tick, 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [screen, mode, deadline]);

  // ── Pamćenje vježbe ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "kviz" || !isPractice || pool.length === 0) return;
    savePractice({
      category,
      ids: pool.map((q) => q.id),
      index,
      correct: practiceStats.correct,
      answered: practiceStats.answered,
    });
  }, [screen, isPractice, pool, index, category, practiceStats]);

  // ── Odgovaranje ───────────────────────────────────────────────────────────
  const current = pool[index];
  const currentAnswer = current ? answers.get(current.id) : undefined;
  const revealed = isPractice && currentAnswer !== undefined;
  const currentCorrect =
    current && currentAnswer ? isAnswerCorrect(current, currentAnswer) : false;

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
      if (!isPractice) recordAnswer(current, { kind: "ordering", value });
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
    (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(pool.length - 1, 0))),
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

  // ── Povratak na landing ───────────────────────────────────────────────────
  const backToLanding = useCallback(() => {
    // Potvrda samo za ispit u toku — vježba i simulator se ne gube.
    if (screen === "kviz" && mode === "simulacija" && answers.size > 0) {
      if (!window.confirm(t.confirmLeaveExam)) return;
    }
    setSecondsLeft(null);
    setDeadline(null);
    setScreen("landing");
    setSaved(loadPractice());
    setBest(loadBestExam());
  }, [screen, mode, answers.size, t.confirmLeaveExam]);

  // Klik na logo u zaglavlju vraća na landing, uz istu potvrdu kao dugme Nazad.
  const backRef = useRef(backToLanding);
  backRef.current = backToLanding;
  useEffect(() => {
    if (homeNonce === 0) return; // početna vrijednost, ne reaguj na montiranje
    backRef.current();
  }, [homeNonce]);

  // ── Prikaz ────────────────────────────────────────────────────────────────
  const answeredIds = useMemo(
    () => new Set([...answers.keys()]),
    [answers],
  );
  const answeredInPool = pool.filter((q) => answers.has(q.id)).length;

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {/* Gornja traka — radi i u /embed verziji, gdje nema zaglavlja stranice. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {screen !== "landing" && (
          <button
            type="button"
            onClick={backToLanding}
            className="font-display rounded border-2 border-line px-3.5 py-1.5 text-base font-semibold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
          >
            ← {t.back}
          </button>
        )}

        <button
          type="button"
          onClick={() => setLiteratureOpen(true)}
          className="ml-auto text-sm font-semibold text-blue underline-offset-4 hover:underline"
        >
          {t.literature}
        </button>

        <div
          className="flex overflow-hidden rounded border border-line"
          role="group"
          aria-label={t.langLabel}
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`font-display px-2.5 py-1 text-sm font-bold uppercase transition-colors ${
                lang === l ? "bg-blue text-white" : "bg-panel text-muted hover:text-blue"
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="panel border-t-4 border-t-red p-5">
          <h2 className="mb-1 text-lg font-bold text-red">{t.loadErrorTitle}</h2>
          <p className="text-sm text-muted">{loadError}</p>
        </div>
      )}

      {screen === "landing" && (
        <Landing
          t={t}
          lang={lang}
          category={category}
          onCategoryChange={setCategory}
          onStartPractice={() => void startPractice(null)}
          onResumePractice={() => void startPractice(saved)}
          onStartExam={() => void startExam()}
          onStartSimulator={() => void startSimulator()}
          saved={saved}
          best={best}
          starting={starting}
        />
      )}

      {screen === "kviz" && isSimulator && (
        <SimulatorRunner scenarios={scenarios} t={t} lang={lang} />
      )}

      {screen === "kviz" && !isSimulator && (
        <>
          <Controls
            mode={mode}
            category={category}
            onCategoryChange={changeCategory}
            poolSize={pool.length}
            correctCount={practiceStats.correct}
            answeredCount={isPractice ? practiceStats.answered : answeredInPool}
            secondsLeft={secondsLeft}
            t={t}
          />

          {pool.length === 0 ? (
            <div className="panel p-5">
              <p className="text-sm text-muted">{t.noQuestions}</p>
            </div>
          ) : current ? (
            <>
              <ProgressBar
                current={index + 1}
                total={pool.length}
                label={`${isPractice ? t.question : t.examQuestion} ${index + 1} / ${pool.length}`}
                ariaLabel={t.progress}
              />

              <QuestionCard
                key={current.id}
                question={current}
                selected={currentAnswer?.kind === "choice" ? currentAnswer.value : null}
                orderingValue={drafts.get(current.id) ?? ""}
                revealed={revealed}
                correct={currentCorrect}
                showOrderingSubmit={isPractice}
                onSelectOption={handleSelectOption}
                onOrderingChange={handleOrderingChange}
                onOrderingSubmit={handleOrderingSubmit}
                t={t}
                lang={lang}
              />

              <div className="flex flex-wrap items-center gap-3">
                {!isPractice && (
                  <button
                    type="button"
                    onClick={() => goTo(index - 1)}
                    disabled={index === 0}
                    className="font-display rounded border-2 border-line px-5 py-2.5 text-base font-semibold tracking-wide uppercase transition-colors hover:border-blue hover:text-blue disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
                  >
                    {t.prev}
                  </button>
                )}

                {isPractice ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!revealed}
                    className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue"
                  >
                    {index + 1 < pool.length ? t.next : t.newRound}
                  </button>
                ) : index + 1 < pool.length ? (
                  <button
                    type="button"
                    onClick={() => goTo(index + 1)}
                    className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
                  >
                    {t.next}
                  </button>
                ) : null}

                {!isPractice && (
                  <button
                    type="button"
                    onClick={() => finishExam(false)}
                    className="font-display ml-auto rounded border-2 border-blue px-5 py-2.5 text-base font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue hover:text-white"
                  >
                    {t.finishExam}
                  </button>
                )}

                {isPractice && revealed && (
                  <p
                    className={`font-display ml-auto text-lg font-bold ${
                      currentCorrect ? "text-green" : "text-red"
                    }`}
                    role="status"
                  >
                    {currentCorrect ? t.correctFeedback : t.wrongFeedback}
                  </p>
                )}
              </div>

              {/* Mreža brojeva — samo na ispitu, gdje se smije skakati po pitanjima. */}
              {!isPractice && (
                <QuestionNav
                  questions={pool}
                  answeredIds={answeredIds}
                  currentIndex={index}
                  onJump={goTo}
                  t={t}
                />
              )}
            </>
          ) : null}
        </>
      )}

      {screen === "rezultat" && (
        <ResultCard
          questions={pool}
          records={records}
          timedOut={timedOut}
          onRestart={() => void startExam()}
          onBackToLanding={backToLanding}
          onOpenLiterature={() => setLiteratureOpen(true)}
          t={t}
          lang={lang}
        />
      )}

      <LiteratureModal open={literatureOpen} onClose={() => setLiteratureOpen(false)} t={t} />
    </div>
  );
}
