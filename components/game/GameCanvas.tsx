"use client";

import { useEffect, useRef, useState } from "react";
import { DIFFICULTY, HORN_AT, HUD_HZ, type Level } from "@/lib/game/sim/config";
import type { Input, Outcome, ScenarioOfficer } from "@/lib/game/sim/types";
import { templateById } from "@/lib/game/sim/intersection";
import { pokazivacSvijetli } from "@/lib/game/ui/draw";
import { dprUredjaja, napraviRenderer, type Renderer, type VrstaRenderera } from "@/lib/game/ui/renderer";
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
  camera?: { follow: boolean; half?: number; rotate?: boolean; naprijed?: boolean };
  /**
   * Okolina pored puta, preslikana u koordinate rute.
   *
   * Ide kroz `ref` jer se puni u toku vožnje — tile-ovi stižu jedan po jedan, a
   * svaka izmjena kroz `state` bi ponovo nacrtala cijelo stablo.
   */
  okolinaRef?: React.RefObject<Okolina | null>;
  /**
   * Klik pokazivača dok je upaljen.
   *
   * Samo tamo gdje je tražen — putovanje i ruta. Ispitni ekrani i smjena ga
   * nemaju, da se tamo ništa ne promijeni.
   */
  zvukPokazivaca?: boolean;
  label: string;
  /** Platno ispuni roditelja (okvir vožnje na telefonu), umjesto kvadrata. */
  ispuni?: boolean;
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
  zvukPokazivaca = false,
  label,
  ispuni = false,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Otvoreni put se crta na WebGL-u, sve ostalo na Canvas 2D (vidi
  // `renderer.ts`). `?render=canvas` u adresi traži Canvas i na putu — za
  // poređenje i za slučaj da WebGL na nekom uređaju zakaže.
  const [prinudnoCanvas, setPrinudnoCanvas] = useState(false);
  useEffect(() => {
    setPrinudnoCanvas(new URLSearchParams(window.location.search).get("render") === "canvas");
  }, []);
  const vrsta: VrstaRenderera =
    !prinudnoCanvas && templateById(runner.world.templateId)?.kind === "road" ? "pixi" : "canvas";
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
  const zvukPokazivacaRef = useRef(zvukPokazivaca);
  onHudRef.current = onHud;
  onFinishRef.current = onFinish;
  runningRef.current = running;
  flagRef.current = flagVehicleId;
  officerRef.current = officer;
  zonesRef.current = indicatorZones;
  levelRef.current = level;
  soundRef.current = sound;
  cameraRef.current = camera;
  zvukPokazivacaRef.current = zvukPokazivaca;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: Renderer | null = null;
    let otkazano = false;
    let observer: ResizeObserver | null = null;

    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let reported = false;
    let hornPlayed = false;
    let crashPlayed = false;
    /** Svjetlo pokazivača u prethodnom kadru; `null` dok je ugašen. */
    let zadnjiTreptaj: boolean | null = null;
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      renderer?.resize(cssW, cssH, dprUredjaja());
    };

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

      // Pokazivač kucka u ritmu u kojem trepće: isto vrijeme simulacije po kojem
      // se i crta, pa zvuk i slika ne mogu da se raziđu.
      if (vozi && zvukPokazivacaRef.current && igrac?.indicator) {
        const svijetli = pokazivacSvijetli(runner.world.t);
        if (svijetli !== zadnjiTreptaj) {
          zadnjiTreptaj = svijetli;
          soundRef.current.tick(svijetli);
        }
      } else {
        zadnjiTreptaj = null;
      }

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

      renderer?.draw(runner, {
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
    // Petlja kreće tek kad je renderer spreman: WebGL se pravi asinhrono
    // (Pixi se tada i učitava), a vožnja ne smije teći dok se ne vidi.
    void napraviRenderer(vrsta, canvas).then((napravljen) => {
      if (!napravljen) return;
      if (otkazano) {
        napravljen.renderer.destroy();
        return;
      }
      renderer = napravljen.renderer;
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      raf = requestAnimationFrame(frame);
    });

    return () => {
      otkazano = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      renderer?.destroy();
      renderer = null;
    };
    // `okolinaRef` je `ref` i ne mijenja se, pa petlja zbog njega ne kreće
    // ispočetka; stoji ovdje samo da bi pravilo o zavisnostima bilo zadovoljeno
    // bez gašenja provjere.
  }, [runner, inputRef, okolinaRef, vrsta]);

  return (
    <canvas
      // Isto platno ne može imati i WebGL i 2D kontekst: kad se vrsta
      // promijeni (dionica → grad), React pravi novo.
      key={vrsta}
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={`block bg-[#dfe3d8] touch-none select-none ${ispuni ? "h-full w-full" : "aspect-square w-full rounded border border-line"}`}
    />
  );
}
