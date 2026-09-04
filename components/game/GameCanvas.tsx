"use client";

import { useEffect, useRef } from "react";
import { HUD_HZ } from "@/lib/game/sim/config";
import type { Input, Outcome, ScenarioOfficer } from "@/lib/game/sim/types";
import { drawScene } from "@/lib/game/ui/draw";
import type { Driver } from "@/lib/game/ui/runner";

export interface HudState {
  speedKmh: number;
  t: number;
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
  onHudRef.current = onHud;
  onFinishRef.current = onFinish;
  runningRef.current = running;
  flagRef.current = flagVehicleId;
  officerRef.current = officer;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let reported = false;
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

      drawScene(ctx, runner, cssW, cssH, {
        playerBraking: inputRef.current.brake > 0,
        flagVehicleId: flagRef.current,
        officer: officerRef.current,
      });

      if (now - lastHud > 1000 / HUD_HZ) {
        lastHud = now;
        const player = runner.world.vehicles.find((v) => v.kind === "player");
        onHudRef.current({ speedKmh: (player?.v ?? 0) * 3.6, t: runner.world.t });
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
  }, [runner, inputRef]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="block aspect-square w-full rounded border border-line bg-[#dfe3d8] touch-none select-none"
    />
  );
}
