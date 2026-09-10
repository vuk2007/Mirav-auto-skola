"use client";

import { useEffect, useRef } from "react";
import { DIFFICULTY, HORN_AT, HUD_HZ, type Level } from "@/lib/game/sim/config";
import type { Input, Outcome, ScenarioOfficer } from "@/lib/game/sim/types";
import { drawScene } from "@/lib/game/ui/draw";
import type { Sound } from "@/lib/game/ui/sound";
import type { Okolina } from "@/lib/game/world/okolina";
import type { Driver } from "@/lib/game/ui/runner";

export interface HudState {
  speedKmh: number;
  t: number;
  /**
   * Koliko je igrač prešao po svojoj putanji [m].
   *
   * Ruti treba da bi znala na kojoj je dionici i koliko je ostalo. Raskrsnici ne
   * znači ništa, pa ga tamo niko i ne čita.
   */
  s: number;
}

interface GameCanvasProps {
  runner: Driver;
  inputRef: React.RefObject<Input>;
  /** Dok je `false`, scena se crta ali se vrijeme ne pomjera. */
  running: boolean;
  onHud: (hud: HudState) => void;
  onFinish: (outcome: Outcome) => void;
  /** Vozilo koje treba istaći crveno kad se scenario prekine. */
  flagVehicleId: string | null;
  /** Policajac je dio scenarija, pa ga platno dobija spolja. */
  officer: ScenarioOfficer | null;
  /** Zone pokazivača na putanji; `null` ih ne crta. */
  indicatorZones: { labels?: { left: string; right: string } } | null;
  /** Nivo težine scenarija — po njemu se zna kad je rok zadržavanja na pola. */
  level: Level;
  sound: Sound;
  /**
   * Kamera koja prati igrača — koristi je beskonačni mod.
   *
   * `rotate` uz to okreće kadar tako da je vozačev pravac uvijek nagore; traži
   * ga ruta, gdje se smjer mijenja duž cijele vožnje.
   */
  camera?: { follow: boolean; half?: number; rotate?: boolean };
  /**
   * Okolina pored puta, preslikana u koordinate rute.
   *
   * Ide kroz `ref` jer se puni u toku vožnje — tile-ovi stižu jedan po jedan, a
   * svaka izmjena kroz `state` bi ponovo nacrtala cijelo stablo.
   */
  okolinaRef?: React.RefObject<Okolina | null>;
  label: string;
}

/**
 * Platno i petlja crtanja.
 *
 * Ovdje nema nimalo stanja igre — sve je u `runner.world`. React se osvježava
 * samo zbog HUD-a, i to `HUD_HZ` puta u sekundi; da se brzina drži u state-u,
 * cijelo stablo bi se ponovo crtalo šezdeset puta u sekundi bez ikakve koristi.
 */
export default function GameCanvas({
  runner,
  inputRef,
  running,
  onHud,
  onFinish,
  flagVehicleId,
  officer,
  indicatorZones,
  level,
  sound,
  camera,
  okolinaRef,
  label,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Callback-ovi kroz ref: petlja se pokreće jednom i ne smije da se restartuje
  // svaki put kad roditelj napravi novu funkciju.
  const onHudRef = useRef(onHud);
  const onFinishRef = useRef(onFinish);
  const runningRef = useRef(running);
  const flagRef = useRef(flagVehicleId);
  const officerRef = useRef(officer);
  const zonesRef = useRef(indicatorZones);
  const levelRef = useRef(level);
  const soundRef = useRef(sound);
  const cameraRef = useRef(camera);
  onHudRef.current = onHud;
  onFinishRef.current = onFinish;
  runningRef.current = running;
  flagRef.current = flagVehicleId;
  officerRef.current = officer;
  zonesRef.current = indicatorZones;
  levelRef.current = level;
  soundRef.current = sound;
  cameraRef.current = camera;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let reported = false;
    let hornPlayed = false;
    let crashPlayed = false;
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = rect.width;
      cssH = rect.height;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.25);
      last = now;

      if (runningRef.current && runner.world.outcome === "running") {
        runner.advance(dt, inputRef.current);
      }

      // Motor svira samo dok se stvarno vozi. Prije toga se ne dira: `ensure`
      // bi napravio `AudioContext` prije ijedne korisničke radnje, a pregledači
      // ga tada drže zaustavljenim i još se i požale u konzoli.
      const vozi = runningRef.current && runner.world.outcome === "running";
      const igrac = runner.world.vehicles.find((x) => x.kind === "player");
      if (vozi && igrac) soundRef.current.engine(igrac.v, inputRef.current.throttle);
      else soundRef.current.engineOff();

      // Truba iza leđa kad je rok zadržavanja na pola — dozvoljen pritisak:
      // saopštava da neko čeka, ne kažnjava i ne skriva ništa.
      const rok = DIFFICULTY[levelRef.current].obstructionTimeout;
      if (!hornPlayed && runner.world.idleT > rok * HORN_AT) {
        hornPlayed = true;
        soundRef.current.horn();
      }
      if (runner.world.idleT === 0) hornPlayed = false;

      if (!crashPlayed && runner.world.violations.some((v) => v.type === "collision")) {
        crashPlayed = true;
        soundRef.current.crash();
      }

      drawScene(ctx, runner, cssW, cssH, {
        playerBraking: inputRef.current.brake > 0,
        flagVehicleId: flagRef.current,
        officer: officerRef.current,
        indicatorZones: zonesRef.current,
        camera: cameraRef.current,
        okolina: okolinaRef?.current ?? null,
      });

      if (now - lastHud > 1000 / HUD_HZ) {
        lastHud = now;
        const player = runner.world.vehicles.find((v) => v.kind === "player");
        onHudRef.current({
          speedKmh: (player?.v ?? 0) * 3.6,
          t: runner.world.t,
          s: player?.s ?? 0,
        });
      }

      // Ishod se javlja tačno jednom po pokušaju; `reset` vraća svijet u
      // „running", pa se time i zastavica sama otpušta za sljedeći pokušaj.
      if (runner.world.outcome === "running") {
        reported = false;
      } else if (!reported) {
        reported = true;
        onFinishRef.current(runner.world.outcome);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // `okolinaRef` je `ref` i ne mijenja se, pa petlja zbog njega ne kreće
    // ispočetka; stoji ovdje samo da bi pravilo o zavisnostima bilo zadovoljeno
    // bez gašenja provjere.
  }, [runner, inputRef, okolinaRef]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="block aspect-square w-full rounded border border-line bg-[#dfe3d8] touch-none select-none"
    />
  );
}
