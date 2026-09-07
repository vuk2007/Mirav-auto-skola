"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { idealTime } from "@/lib/game/sim/bots";
import type { Outcome, Scenario } from "@/lib/game/sim/types";
import { compile, TEMPLATES } from "@/lib/game/sim/intersection";
import { createSound } from "@/lib/game/ui/sound";
import { playerControl } from "@/lib/game/ui/draw";
import { CONTROL_LABEL, taskTextFor } from "@/lib/game/ui/labels";
import { createPlayback, createRunner, type Playback } from "@/lib/game/ui/runner";
import GameCanvas, { type HudState } from "./GameCanvas";
import PedalControls from "./PedalControls";
import { usePedals } from "./usePedals";
import IndicatorTimeline from "./IndicatorTimeline";
import ViolationCard from "./ViolationCard";

type Phase = "brief" | "play" | "over";

const LIGHT_COLOR: Record<string, string> = {
  red: "bg-red",
  yellow: "bg-yellow",
  green: "bg-green",
};

const LIGHT_LABEL: Record<string, "gameLightRed" | "gameLightYellow" | "gameLightGreen"> = {
  red: "gameLightRed",
  yellow: "gameLightYellow",
  green: "gameLightGreen",
};

interface GameScreenProps {
  scenario: Scenario;
  /** Nazad na spisak situacija. */
  onBack: () => void;
  /** Sljedeća situacija, ako je ima. */
  onNext: (() => void) | null;
  /** Javlja ishod pokušaja da bi se upisao u napredak. */
  onResult: (passed: boolean, time: number) => void;
}

/** Jedan scenario od početnog ekrana do rezultata. */
export default function GameScreen({ scenario, onBack, onNext, onResult }: GameScreenProps) {
  const { lang, t } = useApp();
  const pedals = usePedals();

  const [phase, setPhase] = useState<Phase>("brief");
  const [seed, setSeed] = useState(1);
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0 });
  const [outcome, setOutcome] = useState<Outcome>("running");
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [replayDone, setReplayDone] = useState(false);
  /** Rezultat se upisuje jednom po pokušaju, i to iz efekta, ne iz crtanja. */
  const reported = useRef<string | null>(null);
  const [muted, setMuted] = useState(false);
  // Zvuk se pravi jednom po ekranu; `AudioContext` se otvara tek na prvi ton.
  const sound = useMemo(() => createSound(), []);
  useEffect(() => sound.setMuted(muted), [sound, muted]);
  useEffect(() => () => sound.close(), [sound]);

  // Novo sjeme znači i novi pokušaj: `createRunner` pravi svjež svijet, a
  // `GameCanvas` na promjenu pokretača ponovo pokreće petlju.
  const runner = useMemo(() => createRunner(scenario, seed), [scenario, seed]);

  const begin = useCallback(() => {
    pedals.release();
    setPlayback(null);
    setReplayDone(false);
    setHud({ speedKmh: 0, t: 0 });
    setOutcome("running");
    setPhase("play");
  }, [pedals]);

  const retry = useCallback(() => {
    setSeed((s) => s + 1);
    begin();
  }, [begin]);

  const finish = useCallback(
    (result: Outcome) => {
      // Isto se javlja i sa ponavljanja snimka kad ono stigne do prekršaja;
      // tada nema novog rezultata, samo se dugme opet otključa.
      if (playback) {
        setReplayDone(true);
        return;
      }
      pedals.release();
      setOutcome(result);
      setPhase("over");
    },
    [pedals, playback],
  );

  // Upis u napredak: efekat, da se ne bi desio usred crtanja kadra.
  useEffect(() => {
    if (phase !== "over" || outcome === "running") return;
    const key = `${scenario.id}:${seed}`;
    if (reported.current === key) return;
    reported.current = key;
    onResult(outcome === "passed", runner.world.t);
  }, [phase, outcome, scenario.id, seed, runner, onResult]);

  const replay = useCallback(() => {
    setReplayDone(false);
    setPlayback(createPlayback(runner));
  }, [runner]);

  // Kvalitet prolaska = koliko je igrač bio sporiji od savršenog vozača.
  // Računa se tek kad scenario prođe, jer je to pun prolaz simulacije.
  const ideal = useMemo(
    () => (phase === "over" && outcome === "passed" ? idealTime(scenario, seed) : null),
    [phase, outcome, scenario, seed],
  );

  /**
   * Zone pokazivača na putanji.
   *
   * Na lakšim nivoima se vide sa slovom strane, na težem samo kao segmenti, a
   * na najtežem se ne prikazuju — tada polaznik mora sam da zna gdje se šta
   * traži. Skala težine je za sada 1–3; kad dođe 1–5, mijenja se samo ovdje.
   */
  const zones = useMemo(() => {
    if (scenario.difficulty >= 3) return null;
    return scenario.difficulty <= 1
      ? { labels: { left: t.gameIndicatorShortLeft, right: t.gameIndicatorShortRight } }
      : {};
  }, [scenario.difficulty, t.gameIndicatorShortLeft, t.gameIndicatorShortRight]);

  const player = runner.world.vehicles.find((v) => v.kind === "player");
  const playerPath = player ? compile(TEMPLATES[runner.world.templateId]!).paths.get(player.pathId) : undefined;

  const tpl = TEMPLATES[runner.world.templateId]!;
  const zadatak = taskTextFor(scenario.player.intent, t, tpl.arms.length);

  const control = playerControl(runner.world, scenario.officer);
  const violations = runner.world.violations;
  const flagged = violations.find((v) => v.otherVehicleId)?.otherVehicleId ?? null;
  const explanation = scenario.explanation[lang] ?? scenario.explanation.me ?? "";
  const title = scenario.title[lang] ?? scenario.title.me ?? "";
  const replaying = playback !== null && !replayDone;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
        >
          ← {t.gameBack}
        </button>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? t.gameSoundOff : t.gameSoundOn}
          className="ml-auto rounded border border-line bg-panel px-2 py-0.5 text-sm text-muted hover:text-blue"
        >
          <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        </button>
        <span className="font-display rounded border border-line bg-panel px-2 py-0.5 text-sm font-semibold tracking-wide uppercase">
          {control.kind === "officer" ? (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  control.officerAllows ? "bg-green" : "bg-red"
                }`}
                aria-hidden="true"
              />
              {t.gameSignOfficer}
              <span className="font-body text-xs font-normal normal-case opacity-70">
                {control.officerAllows ? t.gameOfficerGo : t.gameOfficerStop}
              </span>
            </span>
          ) : control.kind === "light" ? (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  LIGHT_COLOR[control.light ?? "red"] ?? "bg-red"
                }`}
                aria-hidden="true"
              />
              {t[LIGHT_LABEL[control.light ?? "red"] ?? "gameLightRed"]}
              {/* Odbrojava se SAMO crveno. Koliko se još čeka nije dio zadatka
                  i bespotrebno je pogađati; koliko još traje zeleno jeste dio
                  zadatka, pa bi odbrojavanje ukinulo odluku na žuto. */}
              {control.light === "red" && control.countdown !== null && (
                <span className="font-body text-xs font-normal normal-case opacity-70">
                  {Math.ceil(control.countdown)} s
                </span>
              )}
            </span>
          ) : (
            t[CONTROL_LABEL[control.kind] ?? "gameSignNone"]
          )}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-sm text-muted">{zadatak}</p>
      </div>

      {/* Platno je kvadrat, ali ne smije da bude više od ekrana: na 1440×900
          je puna širina od 768 px gurala pedale ispod prevoja, pa se do gasa
          moralo skrolovati. Visina je zato ograničena, a kvadrat centriran.
          Na ekranu rezultata se dodatno smanjuje, da kartica sa prekršajem
          stane bez skrolovanja — scena je tada zamrznuta pa ništa ne gubi. */}
      <div
        className={`relative mx-auto w-full ${
          phase === "over" ? "max-w-[min(100%,42vh)]" : "max-w-[min(100%,58vh)]"
        }`}
      >
        <GameCanvas
          runner={playback ?? runner}
          inputRef={pedals.inputRef}
          running={phase === "play" || playback !== null}
          onHud={setHud}
          onFinish={finish}
          flagVehicleId={phase === "over" ? flagged : null}
          officer={scenario.officer ?? null}
          indicatorZones={zones}
          level={scenario.difficulty}
          sound={sound}
          label={`${title} — ${zadatak}`}
        />

        {(phase === "play" || playback) && (
          <div className="pointer-events-none absolute top-2 left-2 flex gap-2">
            <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
            <Hud label={t.gameTime} value={`${hud.t.toFixed(1)} s`} />
          </div>
        )}

        {replaying && (
          <div className="font-display pointer-events-none absolute top-2 right-2 rounded bg-ink/80 px-2 py-1 text-xs font-bold tracking-wide text-white uppercase">
            {t.gameReplaying}
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
            indicatorLabel={t.gameIndicator}
            leftLabel={t.gameIndicatorLeft}
            rightLabel={t.gameIndicatorRight}
          />
          <p className="text-xs text-muted">
            {t.gameKeyHint} {t.gameKeyHintIndicator}
          </p>
        </>
      ) : (
        <div className="rounded border border-line bg-panel p-4">
          {phase === "brief" ? (
            <>
              <p className="text-sm text-muted">{t.gameLead}</p>
              <button
                type="button"
                onClick={begin}
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

              <p className="mt-1 text-sm text-muted">
                {t.gameTime}: {runner.world.t.toFixed(1)} s
                {ideal !== null && (
                  <>
                    {" · "}
                    {t.gameQuality}: {Math.max(0, runner.world.t - ideal).toFixed(1)} s
                  </>
                )}
              </p>

              {violations.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">
                    {t.gameViolationsTitle}
                  </p>
                  <ul className="mt-1 space-y-2">
                    {violations.map((v) => (
                      <ViolationCard
                        key={v.type}
                        violation={v}
                        world={runner.world}
                        control={control.light ?? control.kind}
                        officerActive={Boolean(scenario.officer)}
                        t={t}
                        lang={lang}
                      />
                    ))}
                  </ul>
                </>
              )}

              {runner.world.reaction.length > 0 && (
                <div className="mt-3 rounded border-l-4 border-yellow bg-panel p-3">
                  <p className="font-display text-sm font-bold tracking-wide uppercase">
                    {t.gameHazardTitle}
                  </p>
                  <p className="mt-1 text-sm">
                    {outcome === "passed" ? t.gameHazardYielded : t.gameHazardCollision}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {t.gameReaction}:{" "}
                    {runner.world.reaction
                      .map((r) =>
                        r.brakedAt === null ? "—" : `${(r.brakedAt - r.at).toFixed(2)} s`,
                      )
                      .join(" · ")}
                  </p>
                </div>
              )}

              {playerPath && (
                <IndicatorTimeline
                  path={playerPath}
                  intent={scenario.player.intent}
                  log={runner.world.indicatorLog}
                  maxS={player?.s ?? 0}
                  rules={scenario.indicatorRules}
                  t={t}
                />
              )}

              {explanation && (
                <>
                  <p className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">
                    {t.gameHowTo}
                  </p>
                  <p className="mt-1 text-sm">{explanation}</p>
                </>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={replay}
                  disabled={replaying}
                  className="font-display flex-1 rounded border-2 border-line bg-panel px-3 py-2.5 text-base font-bold tracking-wide uppercase hover:border-blue disabled:opacity-50"
                >
                  {t.gameReplay}
                </button>
                <button
                  type="button"
                  onClick={retry}
                  className="font-display flex-1 rounded border-2 border-blue bg-blue px-3 py-2.5 text-base font-bold tracking-wide text-white uppercase hover:bg-blue-dark"
                >
                  {t.gameRetry}
                </button>
              </div>

              {outcome === "passed" && onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="font-display mt-2 w-full rounded border-2 border-green bg-green px-3 py-2.5 text-base font-bold tracking-wide text-white uppercase"
                >
                  {t.gameNextScenario} →
                </button>
              )}
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
