"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { shuffle } from "@/lib/questions";
import { isOrderCorrect, type DrawnScenario, type Family } from "@/lib/simRules";
import ProgressBar from "../ProgressBar";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import GlassPanel from "../ui/GlassPanel";
import IntersectionSvg from "./IntersectionSvg";
import RoundaboutSvg from "./RoundaboutSvg";
import { OZNAKA, SimDetalj, SimKraj, SimNiz, SimPoruka, SimPovratna, SimRedoslijed, SimSkor } from "./SimUi";

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

  if (scenarios.length === 0) return <SimPoruka>{t.simEmpty}</SimPoruka>;

  // Miješanje se dešava u efektu; do tada nema šta da se prikaže.
  if (order.length === 0) return <SimPoruka busy>{t.loading}</SimPoruka>;

  if (!scenario) return <SimKraj label={familyLabel} stats={stats} onRestart={restart} t={t} />;

  return (
    <div className="space-y-5">
      <SimSkor stats={stats} t={t} />

      <ProgressBar
        current={index + 1}
        total={order.length}
        label={`${t.simScene} ${index + 1} / ${order.length}`}
        ariaLabel={t.progress}
      />

      <GlassPanel as="article">
        <header className="mb-3">
          <Badge tone="accent">{familyLabel}</Badge>
        </header>

        <p className="mb-5 text-sm text-text-muted">{sceneNote(family, t)}</p>

        {/* Scena je crtana na svijetlom, pa ostaje na bijeloj podlozi. */}
        <div className="mb-5 flex justify-center overflow-hidden rounded-lg border border-glass-line bg-white p-2 sm:p-3">
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
            <p className="text-sm text-text-muted">
              {t.simDecisionTask}{" "}
              <span className="text-text">
                ({t.simVehicle} {scenario.decision?.vehicleId} — {t.simYourVehicle})
              </span>
            </p>
            {!checked && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => decide("go")} className="flex-1 sm:flex-none">
                  {t.simGo}
                </Button>
                <Button variant="secondary" onClick={() => decide("yield")} className="flex-1 sm:flex-none">
                  {t.simYield}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">{t.simTapInScene}</p>
            <SimRedoslijed
              picked={picked}
              canClear={!checked && picked.length > 0}
              onClear={() => setPicked([])}
              t={t}
            />
            {!checked && (
              <Button onClick={check} disabled={picked.length === 0} arrow={false} className="mt-4 w-full sm:w-auto">
                {t.check}
              </Button>
            )}
          </>
        )}

        {checked && (
          <SimPovratna correct={correct} t={t}>
            {!correct && scenario.answer && (
              <SimDetalj label={t.simCorrectOrder}>
                <SimNiz>{scenario.answer.join("-")}</SimNiz>
              </SimDetalj>
            )}
            {!correct && scenario.decision && (
              <SimDetalj label={t.correctAnswerLabel}>
                <strong className="text-text">{scenario.decision.answer === "go" ? t.simGo : t.simYield}</strong>
                {choice && (
                  <span className="text-text-muted">
                    ({t.yourAnswerLabel}: {choice === "go" ? t.simGo : t.simYield})
                  </span>
                )}
              </SimDetalj>
            )}
            <div className="mt-4 border-t border-glass-line pt-3">
              <p className={`mb-1.5 ${OZNAKA} text-accent-2`}>{t.ruleTitle}</p>
              <ul className="space-y-1 text-sm leading-relaxed text-text">
                {scenario.rules.map((key) => (
                  <li key={key}>{t[key]}</li>
                ))}
              </ul>
            </div>
          </SimPovratna>
        )}
      </GlassPanel>

      {checked && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={next} className="w-full sm:w-auto">
            {index + 1 < order.length ? t.simNextScene : t.simFinished}
          </Button>
          {!correct && !isDecision && (
            <Button variant="secondary" onClick={reset} className="w-full sm:w-auto">
              {t.simClear}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
