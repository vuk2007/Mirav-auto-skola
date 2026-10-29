"use client";

import { CircleCheck, CircleX, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { idealTime } from "@/lib/game/sim/bots";
import { bezKrakova } from "@/lib/game/sim/types";
import type { Outcome, Scenario } from "@/lib/game/sim/types";
import { compile, templateById } from "@/lib/game/sim/intersection";
import { createSound } from "@/lib/game/ui/sound";
import { playerControl } from "@/lib/game/ui/draw";
import { CONTROL_LABEL, taskTextFor, zonesForLevel } from "@/lib/game/ui/labels";
import { createPlayback, createRunner, type Playback } from "@/lib/game/ui/runner";
import Button from "@/components/ui/Button";
import GameCanvas, { type HudState } from "./GameCanvas";
import IgraOkvir from "./IgraOkvir";
import PedalControls from "./PedalControls";
import { usePedals } from "./usePedals";
import IndicatorTimeline from "./IndicatorTimeline";
import ViolationCard from "./ViolationCard";
import { NazadDugme, ZvukDugme } from "./IgraDugmad";

type Phase = "brief" | "play" | "over";

const LIGHT_COLOR: Record<string, string> = {
  red: "bg-signal-red",
  yellow: "bg-signal-yellow",
  green: "bg-signal-green",
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
  const [hud, setHud] = useState<HudState>({ speedKmh: 0, t: 0, s: 0 });
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
    setHud({ speedKmh: 0, t: 0, s: 0 });
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

  // Zone pokazivača na putanji — skala je u `zonesForLevel`, ista za scenario
  // i za smjenu.
  const zones = useMemo(() => zonesForLevel(scenario.difficulty, t), [scenario.difficulty, t]);

  const player = runner.world.vehicles.find((v) => v.kind === "player");
  const playerPath = player ? compile(templateById(runner.world.templateId)!).paths.get(player.pathId) : undefined;

  const tpl = templateById(runner.world.templateId)!;
  const zadatak = taskTextFor(
    scenario.player.intent,
    t,
    bezKrakova(tpl) ? 0 : tpl.arms.length,
    scenario.taskKey,
  );

  // Autoput se vozi u praćenju: dionica je 800 m i u fiksni kadar ne staje.
  const autoput = tpl.kind === "highway";

  const control = playerControl(runner.world, scenario.officer);
  const violations = runner.world.violations;
  const flagged = violations.find((v) => v.otherVehicleId)?.otherVehicleId ?? null;
  const explanation = scenario.explanation[lang] ?? scenario.explanation.me ?? "";
  const title = scenario.title[lang] ?? scenario.title.me ?? "";
  const replaying = playback !== null && !replayDone;

  const oznakaKontrole = (
    <span className="inline-block rounded-md border border-glass-line bg-surface/85 px-2 py-1 font-display text-[0.6875rem] leading-snug font-semibold tracking-[var(--tracking-caps)] uppercase backdrop-blur-md sm:text-xs">
          {control.kind === "officer" ? (
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  control.officerAllows ? "bg-signal-green" : "bg-signal-red"
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
                  LIGHT_COLOR[control.light ?? "red"] ?? "bg-signal-red"
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
  );

  // Vožnja (redizajn za telefon): preko cijelog ekrana, dolje samo pedale.
  // Uvod i rezultat ostaju na stranici — kartica rezultata stoji ispod
  // platna, da se vidi vozilo kojem je oduzeta prednost.
  if (phase === "play") {
    return (
      <IgraOkvir
        izlaz={{ label: t.gameBack, onClick: onBack }}
        naslov={title}
        podesavanja={
          <>
            <p>{zadatak}</p>
            <ZvukDugme muted={muted} onToggle={() => setMuted((m) => !m)} t={t} />
            <p className="text-xs text-text-muted">
              {t.gameKeyHint} {t.gameKeyHintIndicator}
              {autoput ? ` ${t.gameKeyHintLane}` : ""}
            </p>
          </>
        }
        kontrole={
          <PedalControls
            pedals={pedals}
            disabled={false}
            throttleLabel={t.gameThrottle}
            brakeLabel={t.gameBrake}
            indicatorLabel={t.gameIndicator}
            leftLabel={t.gameIndicatorLeft}
            rightLabel={t.gameIndicatorRight}
            lanes={autoput ? { leftLabel: t.gameLaneLeft, rightLabel: t.gameLaneRight } : null}
          />
        }
      >
        <div className="absolute inset-0">
          <GameCanvas
            runner={runner}
            inputRef={pedals.inputRef}
            running
            onHud={setHud}
            onFinish={finish}
            flagVehicleId={null}
            officer={scenario.officer ?? null}
            indicatorZones={zones}
            level={scenario.difficulty}
            sound={sound}
            camera={autoput ? { follow: true, half: tpl.viewHalf } : undefined}
            label={`${title} — ${zadatak}`}
            ispuni
          />
          {/* Lijevo brzina i zadatak, desno kontrola raskrsnice: na uskom ekranu
              svaka strana ima svoju polovinu, da se ne preklapaju. */}
          <div className="pointer-events-none absolute top-2 left-2 flex max-w-[50%] flex-col items-start gap-2">
            <div className="flex gap-2">
              <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
              <Hud label={t.gameTime} value={`${hud.t.toFixed(1)} s`} />
            </div>
            <p className="rounded-md border border-glass-line bg-surface/85 backdrop-blur-md px-2 py-1 text-xs font-semibold">{zadatak}</p>
          </div>
          <div className="pointer-events-none absolute top-2 right-2 max-w-[calc(50%-1rem)] text-right">{oznakaKontrole}</div>
        </div>
      </IgraOkvir>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <NazadDugme onClick={onBack}>{t.gameBack}</NazadDugme>
        <ZvukDugme muted={muted} onToggle={() => setMuted((m) => !m)} t={t} samoIkona className="ml-auto" />
        {oznakaKontrole}
      </div>

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">{zadatak}</p>
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
          running={playback !== null}
          onHud={setHud}
          onFinish={finish}
          flagVehicleId={phase === "over" ? flagged : null}
          officer={scenario.officer ?? null}
          indicatorZones={zones}
          level={scenario.difficulty}
          sound={sound}
          camera={autoput ? { follow: true, half: tpl.viewHalf } : undefined}
          label={`${title} — ${zadatak}`}
        />

        {playback && (
          <div className="pointer-events-none absolute top-2 left-2 flex gap-2">
            <Hud label={t.gameSpeed} value={`${Math.round(hud.speedKmh)} km/h`} />
            <Hud label={t.gameTime} value={`${hud.t.toFixed(1)} s`} />
          </div>
        )}

        {replaying && (
          <div className="font-display pointer-events-none absolute top-2 right-2 rounded bg-bg/80 px-2 py-1 text-xs font-bold tracking-[var(--tracking-caps)] text-white uppercase">
            {t.gameReplaying}
          </div>
        )}
      </div>

      {/* Kartica stoji ISPOD platna, ne preko njega: na prekršaj se vozilo
          kojem je oduzeta prednost oboji crveno, a to se ne vidi ako ga
          poklopi tekst. Na telefonu je preklop gutao cijelu scenu. */}
      {(
        <div className="rounded-xl border border-glass-line bg-glass p-5 sm:p-6">
          {phase === "brief" ? (
            <>
              <p className="text-sm text-text-muted">{t.gameLead}</p>
              <Button onClick={begin} fullWidth className="mt-4">
                {t.gameStart}
              </Button>
            </>
          ) : (
            <>
              <p
                className={`flex items-center gap-2.5 font-display text-xl font-extrabold uppercase ${
                  outcome === "passed" ? "text-ok" : "text-err"
                }`}
              >
                {outcome === "passed" ? (
                  <CircleCheck aria-hidden="true" strokeWidth={1.75} className="h-6 w-6" />
                ) : (
                  <CircleX aria-hidden="true" strokeWidth={1.75} className="h-6 w-6" />
                )}
                {outcome === "passed" ? t.gamePassed : t.gameFailed}
              </p>

              <p className="mt-1 text-sm text-text-muted">
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
                  <p className="mt-5 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
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
                <div className="mt-4 rounded-lg border border-glass-line bg-glass p-4">
                  <p className="flex items-center gap-2 font-display text-xs font-semibold tracking-[var(--tracking-label)] text-accent-2 uppercase">
                    <TriangleAlert aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
                    {t.gameHazardTitle}
                  </p>
                  <p className="mt-1 text-sm">
                    {outcome === "passed" ? t.gameHazardYielded : t.gameHazardCollision}
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    {t.gameReaction}:{" "}
                    {runner.world.reaction
                      .map((r) =>
                        r.brakedAt === null ? "—" : `${(r.brakedAt - r.at).toFixed(2)} s`,
                      )
                      .join(" · ")}
                  </p>
                </div>
              )}

              {playerPath && !autoput && (
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
                  <p className="mt-5 font-display text-[0.6875rem] font-semibold tracking-[var(--tracking-label)] text-text-muted uppercase">
                    {t.gameHowTo}
                  </p>
                  <p className="mt-1 text-sm">{explanation}</p>
                </>
              )}

              {/* Jedno primarno dugme: sljedeća situacija kad je prođeno, inače ponovo. */}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  arrow={false}
                  icon={<Play aria-hidden="true" strokeWidth={1.75} />}
                  onClick={replay}
                  disabled={replaying}
                  className="flex-1"
                >
                  {t.gameReplay}
                </Button>
                <Button
                  variant={outcome === "passed" && onNext ? "secondary" : "primary"}
                  size="md"
                  arrow={false}
                  icon={<RotateCcw aria-hidden="true" strokeWidth={1.75} />}
                  onClick={retry}
                  className="flex-1"
                >
                  {t.gameRetry}
                </Button>
              </div>

              {outcome === "passed" && onNext && (
                <Button size="md" onClick={onNext} fullWidth className="mt-3">
                  {t.gameNextScenario}
                </Button>
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
    <div className="rounded-md border border-glass-line bg-surface/85 backdrop-blur-md px-2 py-1 text-center">
      <div className="font-display text-[0.625rem] font-semibold tracking-[var(--tracking-caps)] text-text-muted uppercase">{label}</div>
      <div className="tabular font-display text-lg leading-none font-bold">{value}</div>
    </div>
  );
}
