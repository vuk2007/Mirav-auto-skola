"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { shuffle } from "@/lib/questions";
import { isOrderCorrect, type DrawnScenario, type Family } from "@/lib/simRules";
import ProgressBar from "../ProgressBar";
import IntersectionSvg from "./IntersectionSvg";
import RoundaboutSvg from "./RoundaboutSvg";

interface DrawnRunnerProps {
  scenarios: readonly DrawnScenario[];
  family: Family;
  familyLabel: string;
  t: Dict;
}

const STEP_MS = 750;

/** Kratak opis scene, zavisi od familije. */
function sceneNote(family: Family, t: Dict): string {
  switch (family) {
    case "znaci":
      return t.simSceneSigns;
    case "semafor":
      return t.simSceneLights;
    case "kruzni":
      return t.simSceneRoundabout;
    case "pjesaci":
      return t.simScenePedestrian;
    default:
      return t.simUncontrolled;
  }
}

/**
 * Crtane scene simulatora. Dva tipa scenarija:
 *  - **redoslijed** (`answer`) — kandidat tapne vozila redom kojim prolaze,
 *  - **odluka** (`decision`) — kandidat bira „Prolazim" ili „Propuštam" za
 *    svoje vozilo; koristi se gdje redoslijed nije poenta (kružni tok, pješaci).
 */
export default function DrawnRunner({
  scenarios,
  family,
  familyLabel,
  t,
}: DrawnRunnerProps) {
  /**
   * NE miješati tokom rendera: `/simulator` se renderuje i na serveru, pa bi
   * server i klijent dobili različit poredak i hidratacija bi pukla
   * (React error #418).
   *
   * Zato se počinje od praznog niza i miješa u efektu — scena se pojavi već
   * promiješana, bez vidljive zamjene poslije montiranja.
   */
  const [order, setOrder] = useState<readonly DrawnScenario[]>([]);
  useEffect(() => setOrder(shuffle(scenarios)), [scenarios]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [choice, setChoice] = useState<"go" | "yield" | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [passed, setPassed] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState({ correct: 0, answered: 0, streak: 0, bestStreak: 0 });

  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const scenario = order[index];
  const isDecision = scenario?.decision !== undefined;

  const reset = useCallback(() => {
    clearTimers();
    setPicked([]);
    setChoice(null);
    setChecked(false);
    setCorrect(false);
    setPassed(new Set());
  }, [clearTimers]);

  const score = useCallback((ok: boolean) => {
    setChecked(true);
    setCorrect(ok);
    setStats((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return {
        correct: s.correct + (ok ? 1 : 0),
        answered: s.answered + 1,
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
  }, []);

  const toggle = useCallback(
    (id: number) => {
      if (checked || isDecision) return;
      setPicked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    },
    [checked, isDecision],
  );

  const animate = useCallback((ids: readonly number[]) => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPassed(new Set(ids));
      return;
    }
    ids.forEach((id, i) => {
      const timer = window.setTimeout(
        () => setPassed((prev) => new Set(prev).add(id)),
        i * STEP_MS + 250,
      );
      timers.current.push(timer);
    });
  }, []);

  const check = useCallback(() => {
    if (!scenario || checked || picked.length === 0) return;
    const ok = isOrderCorrect(scenario, picked);
    score(ok);
    if (ok && scenario.answer) animate(scenario.answer);
  }, [scenario, checked, picked, score, animate]);

  const decide = useCallback(
    (value: "go" | "yield") => {
      if (!scenario?.decision || checked) return;
      setChoice(value);
      const ok = value === scenario.decision.answer;
      score(ok);
      // Ako smije da prođe, provezi njegovo vozilo.
      if (ok && value === "go") animate([scenario.decision.vehicleId]);
    },
    [scenario, checked, score, animate],
  );

  const next = useCallback(() => {
    reset();
    setIndex((i) => i + 1);
  }, [reset]);

  const restart = useCallback(() => {
    reset();
    setOrder(shuffle(scenarios));
    setIndex(0);
    setStats({ correct: 0, answered: 0, streak: 0, bestStreak: 0 });
  }, [scenarios, reset]);

  if (scenarios.length === 0) {
    return (
      <div className="panel p-5">
        <p className="text-sm text-muted">{t.simEmpty}</p>
      </div>
    );
  }

  // Miješanje se dešava u efektu; do tada nema šta da se prikaže.
  if (order.length === 0) {
    return (
      <div className="panel p-5" aria-busy="true">
        <p className="tag text-muted">{t.loading}</p>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="panel border-t-4 border-t-green p-5 sm:p-6" aria-live="polite">
        <p className="tag mb-2 text-muted">{familyLabel}</p>
        <p className="mb-3 text-lg font-bold">{t.simFinished}</p>
        <p className="mb-4">
          <span className="tag text-muted">{t.correctLabel}</span>{" "}
          <strong className="font-display text-2xl text-green">{stats.correct}</strong>
          <span className="mx-1 text-muted">/</span>
          <strong className="font-display text-2xl">{stats.answered}</strong>
          <span className="tag ml-3 text-muted">{t.simStreak}</span>{" "}
          <strong className="font-display text-2xl">{stats.bestStreak}</strong>
        </p>
        <button
          type="button"
          onClick={restart}
          className="font-display rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
        >
          {t.simRestart}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
        <p className="text-sm text-muted">
          {t.correctLabel}:{" "}
          <strong className="font-display text-lg text-green">{stats.correct}</strong>
          <span className="mx-1">/</span>
          <strong className="font-display text-lg text-ink">{stats.answered}</strong>
        </p>
        <p className="text-sm text-muted">
          {t.simStreak}: <strong className="font-display text-lg text-blue">{stats.streak}</strong>
        </p>
      </section>

      <ProgressBar
        current={index + 1}
        total={order.length}
        label={`${t.simScene} ${index + 1} / ${order.length}`}
        ariaLabel={t.progress}
      />

      <article className="panel p-4 sm:p-6">
        <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="diamond h-2.5 w-2.5" aria-hidden="true" />
          <span className="tag text-blue">{familyLabel}</span>
        </header>

        <p className="mb-4 text-sm text-muted">{sceneNote(family, t)}</p>

        <div className="mb-4 flex justify-center rounded border border-line bg-white p-2 sm:p-3">
          {/* Kružni tok ima svoju geometriju — ne crta se kao krstasta raskrsnica. */}
          {scenario.layout === "roundabout" ? (
            <RoundaboutSvg
              scenario={scenario}
              picked={picked}
              passed={passed}
              disabled={checked}
              onPick={toggle}
              conflict={checked && !correct}
              vehicleLabel={t.simVehicle}
              myVehicleId={scenario.decision?.vehicleId}
            />
          ) : (
            <IntersectionSvg
              scenario={scenario}
              picked={picked}
              passed={passed}
              disabled={checked}
              onPick={toggle}
              conflict={checked && !correct}
              vehicleLabel={t.simVehicle}
              myVehicleId={scenario.decision?.vehicleId}
            />
          )}
        </div>

        {isDecision ? (
          <>
            <p className="text-sm text-muted">
              {t.simDecisionTask}{" "}
              <span className="text-ink">
                ({t.simVehicle} {scenario.decision?.vehicleId} — {t.simYourVehicle})
              </span>
            </p>
            {!checked && (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => decide("go")}
                  className="font-display flex-1 rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark sm:flex-none"
                >
                  {t.simGo}
                </button>
                <button
                  type="button"
                  onClick={() => decide("yield")}
                  className="font-display flex-1 rounded border-2 border-blue px-6 py-3 text-lg font-bold tracking-wide text-blue uppercase transition-colors hover:bg-blue hover:text-white sm:flex-none"
                >
                  {t.simYield}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t.simTapInScene}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <p className="text-sm">
                <span className="tag text-muted">{t.simYourOrder}</span>{" "}
                <span className="font-display text-xl tracking-[0.2em]">
                  {picked.length > 0 ? picked.join("-") : "—"}
                </span>
              </p>
              {!checked && picked.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPicked([])}
                  className="font-display rounded border-2 border-line px-3.5 py-1.5 text-base font-semibold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
                >
                  {t.simClear}
                </button>
              )}
            </div>
            {!checked && (
              <button
                type="button"
                onClick={check}
                disabled={picked.length === 0}
                className="font-display mt-4 w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue sm:w-auto"
              >
                {t.check}
              </button>
            )}
          </>
        )}

        {checked && (
          <div
            className={`mt-4 rounded border-l-4 p-3 ${
              correct ? "border-green bg-green-soft" : "border-red bg-red-soft"
            }`}
            role="status"
          >
            <p className={`font-display text-lg font-bold ${correct ? "text-green" : "text-red"}`}>
              {correct ? t.correctFeedback : t.wrongFeedback}
            </p>
            {!correct && scenario.answer && (
              <p className="mt-1 text-sm">
                <span className="tag text-muted">{t.simCorrectOrder}</span>{" "}
                <span className="font-display text-lg tracking-[0.2em]">
                  {scenario.answer.join("-")}
                </span>
              </p>
            )}
            {!correct && scenario.decision && (
              <p className="mt-1 text-sm">
                <span className="tag text-muted">{t.correctAnswerLabel}</span>{" "}
                <strong>{scenario.decision.answer === "go" ? t.simGo : t.simYield}</strong>
                {choice && (
                  <span className="text-muted">
                    {" "}
                    ({t.yourAnswerLabel}: {choice === "go" ? t.simGo : t.simYield})
                  </span>
                )}
              </p>
            )}
            <div className="mt-2 border-t border-line/60 pt-2">
              <p className="tag mb-1 text-blue">{t.ruleTitle}</p>
              <ul className="space-y-1 text-sm leading-relaxed">
                {scenario.rules.map((key) => (
                  <li key={key}>{t[key]}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </article>

      {checked && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={next}
            className="font-display rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark"
          >
            {index + 1 < order.length ? t.simNextScene : t.simFinished}
          </button>
          {!correct && !isDecision && (
            <button
              type="button"
              onClick={reset}
              className="font-display rounded border-2 border-line px-5 py-3 text-base font-bold tracking-wide text-muted uppercase transition-colors hover:border-blue hover:text-blue"
            >
              {t.simClear}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
