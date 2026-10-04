"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterByCategory, type Category } from "@/lib/categories";
import {
  EXAM_MINUTES,
  EXAM_TIMER_ENABLED,
  EXAM_PAGE_COUNT,
  examPassPoints,
  PENALTIES_ENABLED,
  PRACTICE_QUESTION_LIMIT,
} from "@/lib/config";
import { LANG_LABELS, LANGS } from "@/lib/i18n";
import {
  buildExam,
  byIds,
  examCards,
  isHelperLang,
  ExamBuildError,
  type ExamSlot,
  isAnswerCorrect,
  loadQuestions,
  questionPoints,
  sample,
  shuffle,
  totalPoints,
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
import { LinkKazne } from "./PenaltyLoader";
import ExamBriefing from "./ExamBriefing";
import ExamPage, { examQuestionAnchor } from "./ExamPage";
import { ExamLanguageModal, ExamLanguageStrip } from "./ExamLanguageNotice";
import SimulatorShell from "./sim/SimulatorShell";
import { GamePage } from "./game/GameLoader";
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
  /**
   * Sastav ispita — po jedan unos za svako pitanje, sa segmentom i oznakom da
   * li je podpitanje. `pool` ostaje ravan niz pitanja da vježba i simulator ne
   * moraju znati ništa o segmentima.
   */
  const [examSlots, setExamSlots] = useState<ExamSlot[]>([]);
  const [scenarios, setScenarios] = useState<SimScenario[]>([]);
  const [index, setIndex] = useState(0);
  /** Otvorena stranica simulacije ispita (1-bazirana); vježba koristi `index`. */
  const [examPage, setExamPage] = useState(1);
  /**
   * Broj pitanja do kojeg treba skrolovati kad se stranica iscrta (skok iz
   * „Pregleda pitanja"); 0 = na vrh stranice testa.
   */
  const [scrollTarget, setScrollTarget] = useState<{ number: number } | null>(null);
  const examTopRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
  const isGame = mode === "igra";

  // ── Upozorenje o jeziku ispita (EN/RU) ─────────────────────────────────────
  /**
   * Otvoreno upozorenje i šta se radi poslije potvrde. Na EN/RU vježba i ispit
   * kreću tek kad kandidat potvrdi; usred sesije potvrda samo zatvara modal.
   * Ništa se ne pamti — upozorenje ide pri svakom pokretanju.
   */
  const [languageNotice, setLanguageNotice] = useState<{ then: () => void } | null>(null);

  const withLanguageNotice = useCallback(
    (start: () => void) => {
      if (isHelperLang(lang)) setLanguageNotice({ then: start });
      else start();
    },
    [lang],
  );

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
    setExamPage(1);
    setScrollTarget(null);
    setExamSlots([]);
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

  /**
   * Igra ne treba bazu pitanja — raskrsnice i scenariji su u kodu, pa se ekran
   * mijenja odmah, bez učitavanja i bez `starting`.
   */
  const startGame = useCallback(() => {
    setLoadError(null);
    resetSession();
    setMode("igra");
    setSecondsLeft(null);
    setDeadline(null);
    setScreen("kviz");
  }, [resetSession]);

  /**
   * Sastavlja ispit i vodi na uputstvo. Test se izvlači **prije** uputstva da bi
   * uputstvo moglo pisati stvaran broj bodova ovog testa — bodovi dolaze iz
   * baze pa ukupan zbir nije isti na svakom testu.
   */
  const prepareExam = useCallback(async () => {
    setStarting(true);
    setLoadError(null);
    try {
      const qs = await ensureQuestions();
      resetSession();
      const slots = buildExam(qs);
      setExamSlots(slots);
      setPool(slots.map((slot) => slot.question));
      setMode("simulacija");
      setSecondsLeft(null);
      setDeadline(null);
      setScreen("uputstvo");
    } catch (err) {
      setLoadError(
        err instanceof ExamBuildError
          ? `Ispit nije moguće sastaviti: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Nepoznata greška.",
      );
    } finally {
      setStarting(false);
    }
  }, [ensureQuestions, resetSession]);

  /** Pokreće već sastavljen ispit — zove se sa uputstva, poslije potvrde. */
  const startExam = useCallback(() => {
    if (EXAM_TIMER_ENABLED) {
      setDeadline(Date.now() + EXAM_MINUTES * 60 * 1000);
      setSecondsLeft(EXAM_MINUTES * 60);
    } else {
      setDeadline(null);
      setSecondsLeft(null);
    }
    setScreen("kviz");
  }, []);

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
      saveBestExam({ percent, scored, max, passed: scored >= examPassPoints(max) });
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

  /** Izbor odgovora u vježbi — odmah se otkriva tačan odgovor. */
  const handleSelectOption = useCallback(
    (key: OptionKey) => {
      if (!current || revealed) return;
      recordAnswer(current, { kind: "choice", value: key });
    },
    [current, revealed, recordAnswer],
  );

  /** Odgovor na ispitu — može se mijenjati sve do predaje. */
  const handleExamAnswer = useCallback(
    (question: Question, answer: Answer) => recordAnswer(question, answer),
    [recordAnswer],
  );

  /**
   * Unos redoslijeda na ispitu se pamti u hodu, bez potvrde. Obrisan unos
   * vraća pitanje u „bez odgovora", da pregled pitanja ne laže.
   */
  const handleExamOrdering = useCallback(
    (question: Question, value: string) => {
      setDrafts((prev) => new Map(prev).set(question.id, value));
      if (value.trim() === "") {
        setAnswers((prev) => {
          const next = new Map(prev);
          next.delete(question.id);
          return next;
        });
      } else {
        recordAnswer(question, { kind: "ordering", value });
      }
    },
    [recordAnswer],
  );

  /** Otvara stranicu testa i skroluje na njen vrh ili do traženog pitanja. */
  const openExamPage = useCallback((page: number, number = 0) => {
    setExamPage(Math.min(Math.max(page, 1), EXAM_PAGE_COUNT));
    setScrollTarget({ number });
  }, []);

  // Skrol tek kad je nova stranica iscrtana — prije toga cilj ne postoji u DOM-u.
  useEffect(() => {
    if (!scrollTarget) return;
    const el =
      scrollTarget.number > 0
        ? document.getElementById(examQuestionAnchor(scrollTarget.number))
        : examTopRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTarget(null);
  }, [scrollTarget, examPage]);

  /**
   * Prelazak na EN/RU usred vježbe ili ispita: upozorenje jednom, kao
   * obavještenje. Tajmer teče dalje i odgovori ostaju — modal samo prekrije
   * ekran dok se ne potvrdi.
   */
  const prevLang = useRef(lang);
  useEffect(() => {
    if (prevLang.current === lang) return;
    prevLang.current = lang;
    const inSession = screen === "kviz" && (mode === "vjezba" || mode === "simulacija");
    if (inSession && isHelperLang(lang)) setLanguageNotice({ then: () => {} });
  }, [lang, screen, mode]);

  // Predaja se dešava na dnu duge stranice testa — rezultat mora krenuti od vrha.
  useEffect(() => {
    if (screen === "rezultat") rootRef.current?.scrollIntoView({ block: "start" });
  }, [screen]);

  /** Unos redoslijeda u vježbi — odgovor je tek potvrda (`handleOrderingSubmit`). */
  const handleOrderingChange = useCallback(
    (value: string) => {
      if (!current || revealed) return;
      setDrafts((prev) => new Map(prev).set(current.id, value));
    },
    [current, revealed],
  );

  const handleOrderingSubmit = useCallback(() => {
    if (!current || revealed) return;
    const value = drafts.get(current.id) ?? "";
    if (value.trim() === "") return;
    recordAnswer(current, { kind: "ordering", value });
  }, [current, revealed, drafts, recordAnswer]);

  /** Vježba je neograničena: kad se krug završi, pitanja se premiješaju iz početka. */
  const handleNext = useCallback(() => {
    if (index + 1 < pool.length) {
      setIndex(index + 1);
      return;
    }
    setPool((prev) => shuffle(prev));
    setIndex(0);
    setAnswers(new Map());
    setDrafts(new Map());
  }, [index, pool.length]);

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
    <div ref={rootRef} className={compact ? "space-y-4" : "space-y-5"}>
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

        {/* Spisak kazni; link izostaje kad je prikaz isključen ili kad nema
            nijedne potvrđene kazne. */}
        <div className="ml-auto flex items-center gap-4">
          {PENALTIES_ENABLED && <LinkKazne t={t} />}
          <button
            type="button"
            onClick={() => setLiteratureOpen(true)}
            className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
          >
            {t.literature}
          </button>
        </div>

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
          onStartPractice={() => withLanguageNotice(() => void startPractice(null))}
          onResumePractice={() => withLanguageNotice(() => void startPractice(saved))}
          onStartExam={() => void prepareExam()}
          onStartSimulator={() => void startSimulator()}
          onStartGame={startGame}
          saved={saved}
          best={best}
          starting={starting}
        />
      )}

      {/* Uputstvo se čita prije svake simulacije — i prve i svake sljedeće. */}
      {screen === "uputstvo" && (
        <ExamBriefing
          t={t}
          lang={lang}
          onStart={() => withLanguageNotice(startExam)}
          starting={starting}
          totalPoints={totalPoints(pool)}
        />
      )}

      {screen === "kviz" && isSimulator && (
        <SimulatorShell photoScenarios={scenarios} t={t} lang={lang} />
      )}

      {screen === "kviz" && isGame && <GamePage showLanguage={false} />}

      {screen === "kviz" && !isSimulator && !isGame && (
        <div className={`${compact ? "space-y-4" : "space-y-5"} ${isPractice ? "" : "exam-wide"}`}>
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

          {isPractice ? (
            pool.length === 0 ? (
              <div className="panel p-5">
                <p className="text-sm text-muted">{t.noQuestions}</p>
              </div>
            ) : current ? (
              <>
                <ProgressBar
                  current={index + 1}
                  total={pool.length}
                  label={`${t.question} ${index + 1} / ${pool.length}`}
                  ariaLabel={t.progress}
                />

                <ExamLanguageStrip lang={lang} />

                <QuestionCard
                  key={current.id}
                  question={current}
                  selected={currentAnswer?.kind === "choice" ? currentAnswer.value : null}
                  orderingValue={drafts.get(current.id) ?? ""}
                  revealed={revealed}
                  correct={currentCorrect}
                  showOrderingSubmit
                  onSelectOption={handleSelectOption}
                  onOrderingChange={handleOrderingChange}
                  onOrderingSubmit={handleOrderingSubmit}
                  t={t}
                  lang={lang}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!revealed}
                    className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue"
                  >
                    {index + 1 < pool.length ? t.next : t.newRound}
                  </button>

                  {revealed && (
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
              </>
            ) : null
          ) : (
            <>
              {/* Simulacija ispita: stranica po stranica, kao pravi test. */}
              <div ref={examTopRef} className="scroll-mt-4">
                <ProgressBar
                  current={examPage}
                  total={EXAM_PAGE_COUNT}
                  label={`${t.pageLabel} ${examPage} / ${EXAM_PAGE_COUNT}`}
                  ariaLabel={t.progress}
                />
              </div>

              <ExamLanguageStrip lang={lang} />

              <ExamPage
                key={examPage}
                cards={examCards(examSlots, examPage)}
                answers={answers}
                drafts={drafts}
                onAnswer={handleExamAnswer}
                onOrderingChange={handleExamOrdering}
                t={t}
                lang={lang}
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openExamPage(examPage - 1)}
                  disabled={examPage === 1}
                  className="font-display rounded border-2 border-line px-5 py-2.5 text-base font-semibold tracking-wide uppercase transition-colors hover:border-blue hover:text-blue disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
                >
                  {t.prevPage}
                </button>

                {examPage < EXAM_PAGE_COUNT && (
                  <button
                    type="button"
                    onClick={() => openExamPage(examPage + 1)}
                    className="font-display rounded bg-blue px-6 py-2.5 text-base font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
                  >
                    {t.nextPage}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => finishExam(false)}
                  className="font-display ml-auto rounded border-2 border-blue px-5 py-2.5 text-base font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue hover:text-white"
                >
                  {t.finishExam}
                </button>
              </div>

              <QuestionNav
                slots={examSlots}
                answeredIds={answeredIds}
                currentPage={examPage}
                onJump={(slot) => openExamPage(slot.page, slot.number)}
                t={t}
              />
            </>
          )}
        </div>
      )}

      {screen === "rezultat" && (
        <ResultCard
          questions={pool}
          slots={examSlots}
          records={records}
          timedOut={timedOut}
          onRestart={() => void prepareExam()}
          onBackToLanding={backToLanding}
          onOpenLiterature={() => setLiteratureOpen(true)}
          t={t}
          lang={lang}
        />
      )}

      <LiteratureModal open={literatureOpen} onClose={() => setLiteratureOpen(false)} t={t} />

      {languageNotice && (
        <ExamLanguageModal
          lang={lang}
          onConfirm={() => {
            const { then } = languageNotice;
            setLanguageNotice(null);
            then();
          }}
        />
      )}
    </div>
  );
}
