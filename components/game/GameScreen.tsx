"use client";

import { useCallback, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { idealTime } from "@/lib/game/sim/bots";
import type { Outcome, Scenario } from "@/lib/game/sim/types";
import { playerControl } from "@/lib/game/ui/draw";
import { CONTROL_LABEL, TASK_LABEL, VIOLATION_LABEL } from "@/lib/game/ui/labels";
import { createRunner } from "@/lib/game/ui/runner";
import GameCanvas, { type HudState } from "./GameCanvas";
import PedalControls from "./PedalControls";
import { usePedals } from "./usePedals";

type Phase = "brief" | "play" | "over";

const LIGHT_COLOR: Record<string, string> = {
  red: "bg-red",
  yellow: "bg-yellow",
  green: "bg-green",
};

/** Jedan scenario od početnog ekrana do rezultata. */
export default function GameScreen({ scenario }: { scenario: Scenario }) {
  const { lang, t } = useApp();
  const pedals = usePedals();

  const [phase, setPhase] = useState<Phase>("brief");
  const [seed, setSeed] = useState(1);
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0 });
  const [outcome, setOutcome] = useState<Outcome>("running");

  // Novo sjeme znači i novi pokušaj: `createRunner` pravi svjež svijet, a
  // `GameCanvas` na promjenu pokretača ponovo pokreće petlju.
  const runner = useMemo(() => createRunner(scenario, seed), [scenario, seed]);

  const start = useCallback(() => {
    pedals.release();
    setHud({ speedKmh: 0, t: 0 });
    setOutcome("running");
    setPhase("play");
  }, [pedals]);

  const retry = useCallback(() => {
    pedals.release();
    setSeed((s) => s + 1);
    setHud({ speedKmh: 0, t: 0 });
    setOutcome("running");
    setPhase("play");
  }, [pedals]);

  const finish = useCallback(
    (result: Outcome) => {
      pedals.release();
      setOutcome(result);
      setPhase("over");
    },
    [pedals],
  );

  // Kvalitet prolaska = koliko je igrač bio sporiji od savršenog vozača.
  // Računa se tek kad scenario prođe, jer je to pun prolaz simulacije.
  const ideal = useMemo(
    () => (phase === "over" && outcome === "passed" ? idealTime(scenario, seed) : null),
    [phase, outcome, scenario, seed],
  );

  const control = playerControl(runner.world);
  const violations = runner.world.violations;
  const flagged = violations.find((v) => v.otherVehicleId)?.otherVehicleId ?? null;
  // Prevodi objašnjenja još nijesu urađeni — dok stoji „TODO", prikazuje se
  // crnogorski umjesto praznog polja.
  const translated = scenario.explanation[lang];
  const explanation =
    translated && translated !== "TODO" ? translated : (scenario.explanation.me ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold sm:text-2xl">{t.gameTitle}</h1>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {control.kind === "light" ? (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  LIGHT_COLOR[control.light ?? "red"] ?? "bg-red"
                }`}
                aria-hidden="true"
              />
              {t.simFamilyLights}
            </span>
          ) : (
            t[CONTROL_LABEL[control.kind] ?? "gameSignNone"]
          )}
        </span>
      </div>

      <p className="text-sm text-muted">{t[TASK_LABEL[scenario.player.intent]]}</p>

      {/* Platno je kvadrat, ali ne smije da bude više od ekrana: na 1440×900
          je puna širina od 768 px gurala pedale ispod prevoja, pa se do gasa
          moralo skrolovati. Visina je zato ograničena, a kvadrat centriran. */}
      <div className="relative mx-auto w-full max-w-[min(100%,58vh)]">
        <GameCanvas
          runner={runner}
          inputRef={pedals.inputRef}
          running={phase === "play"}
          onHud={setHud}
          onFinish={finish}
          flagVehicleId={phase === "over" ? flagged : null}
          label={`${t.gameTitle} — ${t[TASK_LABEL[scenario.player.intent]]}`}
        />

        {phase === "play" && (
          <div className="pointer-events-none absolute top-2 left-2 flex gap-2">
            <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
            <Hud label={t.gameTime} value={`${hud.t.toFixed(1)} s`} />
          </div>
        )}

      </div>

      {/* Kartica stoji ISPOD platna, ne preko njega: na prekršaj se vozilo
          kojem je oduzeta prednost oboji crveno, a to se ne vidi ako ga
          poklopi tekst. Na telefonu je preklop gutao cijelu scenu. */}
      {phase === "play" ? (
        <>
          <PedalControls
            pedals={pedals}
            disabled={false}
            throttleLabel={t.gameThrottle}
            brakeLabel={t.gameBrake}
          />
          <p className="text-xs text-muted">{t.gameKeyHint}</p>
        </>
      ) : (
        <div className="rounded border border-line bg-panel p-4">
          {phase === "brief" ? (
            <>
              <p className="text-sm text-muted">{t.gameLead}</p>
              <button
                type="button"
                onClick={start}
                className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
              >
                {t.gameStart}
              </button>
            </>
          ) : (
            <>
              <p
                className={`font-display text-lg font-bold uppercase ${
                  outcome === "passed" ? "text-green" : "text-red"
                }`}
              >
                {outcome === "passed" ? t.gamePassed : t.gameFailed}
              </p>

              {violations.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    {t.gameViolationsTitle}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {violations.map((v) => (
                      <li key={v.type} className="rounded bg-red-soft px-2 py-1 text-sm">
                        <span className="font-semibold">{t[VIOLATION_LABEL[v.type]]}</span>{" "}
                        <span className="text-muted">{v.details}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {explanation && (
                <>
                  <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">
                    {t.gameHowTo}
                  </p>
                  <p className="mt-1 text-sm">{explanation}</p>
                </>
              )}

              <p className="mt-3 text-sm text-muted">
                {t.gameTime}: {runner.world.t.toFixed(1)} s
                {ideal !== null && (
                  <>
                    {" · "}
                    {t.gameQuality}: {Math.max(0, runner.world.t - ideal).toFixed(1)} s
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={retry}
                className="font-display mt-3 w-full rounded border-2 border-blue bg-blue px-4 py-2.5 text-lg font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
              >
                {t.gameRetry}
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
