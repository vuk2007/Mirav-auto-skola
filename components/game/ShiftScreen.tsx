"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SHIFT_VIEW_HALF } from "@/lib/game/sim/config";
import { templateById } from "@/lib/game/sim/intersection";
import type { Scenario } from "@/lib/game/sim/types";
import { generateSegment } from "@/lib/game/shift/generate";
import {
  applySegment,
  averageReaction,
  LIVES,
  startShift,
  type ShiftState,
} from "@/lib/game/shift/session";
import { taskTextFor, VIOLATION_LABEL, zonesForLevel } from "@/lib/game/ui/labels";
import { createRunner } from "@/lib/game/ui/runner";
import { createSound } from "@/lib/game/ui/sound";
import { loadBestShift, saveBestShift, type BestShift } from "@/lib/storage";
import GameCanvas, { type HudState } from "./GameCanvas";
import PedalControls from "./PedalControls";
import { usePedals } from "./usePedals";

type Phase = "brief" | "play" | "freeze" | "over";

/** Koliko traje zamrzavanje poslije prekršaja [ms]; može se preskočiti. */
const FREEZE_MS = 2000;

/**
 * Beskonačni mod: raskrsnica za raskrsnicom.
 *
 * Segmenti se generišu jedan po jedan i voze redom, bez povratka na spisak.
 * Kamera prati igrača, pa se vozi kroz niz raskrsnica umjesto da se svaka
 * gleda iz fiksnog kadra.
 */
export default function ShiftScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  const pedals = usePedals();
  const sound = useMemo(() => createSound(), []);
  // Smjena do sada nije imala prekidač za zvuk jer su se čuli samo truba i
  // sudar — kratki i rijetki. Motor svira neprekidno, pa mora da može da se
  // ugasi i ovdje, kao na ekranu scenarija.
  const [muted, setMuted] = useState(false);
  useEffect(() => sound.setMuted(muted), [sound, muted]);
  useEffect(() => () => sound.close(), [sound]);

  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const [state, setState] = useState<ShiftState>(() => startShift(seed));
  const [phase, setPhase] = useState<Phase>("brief");
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0 });
  const [best, setBest] = useState<BestShift | null>(null);
  const [lastFail, setLastFail] = useState<string | null>(null);
  const reported = useRef(-1);

  useEffect(() => setBest(loadBestShift()), []);

  // Segment se pravi iz sjemena i rednog broja — isti par uvijek daje isto.
  const scenario: Scenario = useMemo(
    () => generateSegment(state.seed, state.level, state.index),
    [state.seed, state.level, state.index],
  );
  const runner = useMemo(
    () => createRunner(scenario, state.seed + state.index),
    [scenario, state.seed, state.index],
  );

  // Dionica autoputa se vozi drukčije nego raskrsnica: širi kadar, dugmad za
  // traku, i rečenica o tome šta se traži — na autoputu se zadatak ne vidi iz
  // same slike, kao što se na raskrsnici vidi iz znaka.
  const tpl = scenario.template ?? templateById(scenario.intersection);
  const autoput = tpl?.kind === "highway";
  const zadatak = autoput ? taskTextFor(scenario.player.intent, t, 0, scenario.taskKey) : null;

  const start = useCallback(() => {
    pedals.release();
    setPhase("play");
  }, [pedals]);

  const finish = useCallback(
    () => {
      if (reported.current === state.index) return;
      reported.current = state.index;
      // Namjerno NE `release()`: igrač koji drži gas mora da ga zadrži i u
      // sljedećoj raskrsnici. Gasi se samo pokazivač.
      pedals.resetIndicator();

      const sljedece = applySegment(state, runner.world);
      const pao = runner.world.violations.some((v) => v.severity === "fail");
      const prvi = runner.world.violations.find((v) => v.severity === "fail");
      setLastFail(prvi ? t[VIOLATION_LABEL[prvi.type]] : null);
      setState(sljedece);

      if (sljedece.over) {
        setBest(saveBestShift({ segments: sljedece.segments, bestStreak: sljedece.bestStreak }));
        setPhase("over");
      } else {
        setPhase(pao ? "freeze" : "play");
      }
    },
    [state, runner, pedals, t],
  );

  // Zamrzavanje poslije prekršaja: kratko, sa objašnjenjem, i može se preskočiti.
  useEffect(() => {
    if (phase !== "freeze") return;
    const id = window.setTimeout(() => setPhase("play"), FREEZE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const restart = useCallback(() => {
    reported.current = -1;
    setLastFail(null);
    setState(startShift(Math.floor(Math.random() * 1e9)));
    setPhase("play");
  }, []);

  const prosjek = averageReaction(state);
  const prekrsaji = Object.entries(state.violations) as [keyof typeof state.violations, number][];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onExit}
          className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
        >
          ← {t.shiftBack}
        </button>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? t.gameSoundOff : t.gameSoundOn}
          className="rounded border border-line bg-panel px-2 py-0.5 text-sm text-muted hover:text-blue"
        >
          <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        </button>
        <span className="font-display ml-auto text-sm font-semibold tracking-wide uppercase">
          {t.shiftLives}{" "}
          <span aria-label={`${state.lives}/${LIVES}`}>
            {"●".repeat(state.lives)}
            <span className="opacity-25">{"●".repeat(LIVES - state.lives)}</span>
          </span>
        </span>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.shiftLevel} {state.level}
        </span>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {t.shiftSegments} {state.segments}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[min(100%,58vh)]">
        <GameCanvas
          runner={runner}
          inputRef={pedals.inputRef}
          running={phase === "play"}
          onHud={setHud}
          onFinish={finish}
          flagVehicleId={null}
          officer={scenario.officer ?? null}
          indicatorZones={zonesForLevel(state.level, t)}
          level={state.level}
          sound={sound}
          camera={{ follow: true, half: autoput ? tpl.viewHalf : SHIFT_VIEW_HALF }}
          label={t.shiftTitle}
        />

        {phase === "play" && (
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
            <div className="flex gap-2">
              <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
              <Hud label={t.gameTime} value={`${hud.t.toFixed(1)} s`} />
            </div>
            {zadatak && (
              <p className="max-w-[15rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
                {zadatak}
              </p>
            )}
          </div>
        )}

        {phase === "freeze" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/55 p-4">
            <div className="w-full max-w-sm rounded border border-line bg-panel p-4 text-center">
              <p className="font-display text-lg font-bold text-red uppercase">{t.shiftLostLife}</p>
              {lastFail && <p className="mt-1 text-sm">{lastFail}</p>}
              <button
                type="button"
                onClick={() => setPhase("play")}
                className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2 font-bold tracking-wide text-white uppercase"
              >
                {t.shiftSkip}
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === "play" || phase === "freeze" ? (
        <PedalControls
          pedals={pedals}
          disabled={phase !== "play"}
          throttleLabel={t.gameThrottle}
          brakeLabel={t.gameBrake}
          indicatorLabel={t.gameIndicator}
          leftLabel={t.gameIndicatorLeft}
          rightLabel={t.gameIndicatorRight}
          lanes={autoput ? { leftLabel: t.gameLaneLeft, rightLabel: t.gameLaneRight } : null}
        />
      ) : (
        <div className="rounded border border-line bg-panel p-4">
          {phase === "brief" ? (
            <>
              <h1 className="text-xl font-bold">{t.shiftTitle}</h1>
              <p className="mt-1 text-sm text-muted">{t.shiftDesc}</p>
              {best && (
                <p className="mt-2 text-sm">
                  {t.shiftBest}: <strong>{best.segments}</strong> · {t.shiftStreak}{" "}
                  {best.bestStreak}
                </p>
              )}
              <button
                type="button"
                onClick={start}
                className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
              >
                {t.shiftStart}
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-red uppercase">{t.shiftOver}</p>
              <p className="mt-2 text-sm">
                {t.shiftSegments}: <strong>{state.segments}</strong> · {t.shiftStreak}:{" "}
                <strong>{state.bestStreak}</strong>
              </p>
              <p className="mt-1 text-sm text-muted">
                {t.gameReaction}:{" "}
                {prosjek === null ? t.shiftNoReaction : `${prosjek.toFixed(2)} s`}
              </p>
              {prekrsaji.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {prekrsaji.map(([tip, broj]) => (
                    <li key={tip}>
                      {t[VIOLATION_LABEL[tip]]} — <strong>{broj}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {best && (
                <p className="mt-2 text-sm text-muted">
                  {t.shiftBest}: {best.segments}
                </p>
              )}
              <button
                type="button"
                onClick={restart}
                className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
              >
                {t.shiftAgain}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel/90 px-2 py-1 text-center">
      <div className="text-[10px] font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="font-display text-lg leading-none font-bold">{value}</div>
    </div>
  );
}
