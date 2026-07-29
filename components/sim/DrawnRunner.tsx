"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { shuffle } from "@/lib/questions";
import { isDrawnOrderCorrect, type DrawnScenario } from "@/lib/simScenarios";
import ProgressBar from "../ProgressBar";
import IntersectionSvg from "./IntersectionSvg";

interface DrawnRunnerProps {
  scenarios: readonly DrawnScenario[];
  t: Dict;
}

const STEP_MS = 750;

/** Familija „pravilo desne strane" — scena se crta, tačan odgovor se animira. */
export default function DrawnRunner({ scenarios, t }: DrawnRunnerProps) {
  const [order, setOrder] = useState(() => shuffle(scenarios));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
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

  const toggle = useCallback(
    (id: number) => {
      if (checked) return;
      setPicked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    },
    [checked],
  );

  const check = useCallback(() => {
    if (!scenario || checked || picked.length === 0) return;
    const ok = isDrawnOrderCorrect(scenario, picked);
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

    if (!ok) return;

    // Tačno → vozila se provezu tačnim redoslijedom. Uz „smanji kretanje"
    // se preskače animacija i odmah se prikaže ishod.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPassed(new Set(scenario.answer));
      return;
    }
    scenario.answer.forEach((id, i) => {
      const timer = window.setTimeout(
        () => setPassed((prev) => new Set(prev).add(id)),
        i * STEP_MS + 250,
      );
      timers.current.push(timer);
    });
  }, [scenario, checked, picked]);

  const next = useCallback(() => {
    clearTimers();
    setPicked([]);
    setChecked(false);
    setCorrect(false);
    setPassed(new Set());
    setIndex((i) => i + 1);
  }, [clearTimers]);

  const retry = useCallback(() => {
    clearTimers();
    setPicked([]);
    setChecked(false);
    setCorrect(false);
    setPassed(new Set());
  }, [clearTimers]);

  const restart = useCallback(() => {
    clearTimers();
    setOrder(shuffle(scenarios));
    setIndex(0);
    setPicked([]);
    setChecked(false);
    setCorrect(false);
    setPassed(new Set());
    setStats({ correct: 0, answered: 0, streak: 0, bestStreak: 0 });
  }, [scenarios, clearTimers]);

  if (!scenario) {
    return (
      <div className="panel border-t-4 border-t-green p-5 sm:p-6" aria-live="polite">
        <p className="tag mb-2 text-muted">{t.simFamilyRule}</p>
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
          <span className="tag text-blue">{t.simFamilyRule}</span>
        </header>

        <p className="mb-4 text-sm text-muted">{t.simUncontrolled}</p>

        <div className="mb-4 flex justify-center rounded border border-line bg-white p-2 sm:p-3">
          <IntersectionSvg
            vehicles={scenario.vehicles}
            picked={picked}
            passed={passed}
            disabled={checked}
            onPick={toggle}
            conflict={checked && !correct}
            vehicleLabel={t.simVehicle}
          />
        </div>

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

        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={picked.length === 0}
            className="font-display mt-4 w-full rounded bg-blue px-6 py-3 text-lg font-bold tracking-wide text-white uppercase transition-colors hover:bg-blue-dark disabled:opacity-40 disabled:hover:bg-blue sm:w-auto"
          >
            {t.check}
          </button>
        ) : (
          <div
            className={`mt-4 rounded border-l-4 p-3 ${
              correct ? "border-green bg-green-soft" : "border-red bg-red-soft"
            }`}
            role="status"
          >
            <p className={`font-display text-lg font-bold ${correct ? "text-green" : "text-red"}`}>
              {correct ? t.correctFeedback : t.wrongFeedback}
            </p>
            {!correct && (
              <p className="mt-1 text-sm">
                <span className="tag text-muted">{t.simCorrectOrder}</span>{" "}
                <span className="font-display text-lg tracking-[0.2em]">
                  {scenario.answer.join("-")}
                </span>
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
          {!correct && (
            <button
              type="button"
              onClick={retry}
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
