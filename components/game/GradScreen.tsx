"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import {
  DT,
  GRAD_POLA_KADRA,
  GRAD_ZUM,
  HUD_HZ,
  KAMERA_NAPRIJED,
  KAMERA_NAPRIJED_BRZINA,
} from "@/lib/game/sim/config";
import type { Point } from "@/lib/game/sim/types";
import { napraviMrezu, najblizaIvica, type Mreza } from "@/lib/game/grad/mreza";
import { procitaj, type Paket } from "@/lib/game/grad/paket";
import { korak, novoVozilo, poza, pregledIzbora, type GradVozilo } from "@/lib/game/grad/voznja";
import type { GradKadar, GradRenderer } from "@/lib/game/ui/gradRenderer";
import { dprUredjaja } from "@/lib/game/ui/renderer";
import Brzinomjer from "./Brzinomjer";
import DriveControls from "./DriveControls";
import { useVolan } from "./useVolan";

/** Grad koji se vozi — za sada samo Podgorica (faza 6, stavka 3). */
const GRAD = "podgorica";

/**
 * Koliko brzo kamera sustiže smjer auta [s]. Smjer na ulici se mijenja skokom
 * na svakoj tački OSM linije; kamera koja ga prati tačno bi se trzala.
 */
const KAMERA_SMIRENJE = 0.25;

type Faza = "ucitavam" | "voznja" | "greska" | "bezWebgl";

interface Hud {
  kmh: number;
  ulica: string;
  fps: number | null;
}

/**
 * Slobodna vožnja kroz Podgoricu, u razmjeri 1:1 — faza 6, stavka 3.
 *
 * Bez pravila i bez drugih vozila: ovo je da se grad pogleda i provoza, prije
 * nego što dobije izgled (stavka 4) i pravila (stavka 5). Vozi se istim volanom
 * i gasom kao Ruta; pred raskrsnicom volan bira izlaz.
 */
export default function GradScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  const volan = useVolan(true, { pokazivacRukom: false });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [faza, setFaza] = useState<Faza>("ucitavam");
  const [hud, setHud] = useState<Hud>({ kmh: 0, ulica: "", fps: null });
  const [ogranicenje, setOgranicenje] = useState<number | null>(null);
  const inputRef = volan.inputRef;
  // Udaljavanje kadra — da se grad može pregledati, ne samo voziti. Ide kroz
  // `ref`, jer ga petlja čita svakog kadra.
  const [zum, setZum] = useState(0);
  const zumRef = useRef(0);
  zumRef.current = zum;

  useEffect(() => {
    let otkazano = false;
    let renderer: GradRenderer | null = null;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";

    const pokreni = async () => {
      const spisak = (await (await fetch("/data/grad/gradovi.json")).json()) as Record<string, { fajl: string }>;
      const fajl = spisak[GRAD]?.fajl;
      if (!fajl) throw new Error(`nema paketa za ${GRAD}`);
      const odgovor = await fetch(`/data/grad/${fajl}`);
      if (!odgovor.ok) throw new Error(`paket grada: HTTP ${odgovor.status}`);
      const paket: Paket = procitaj(await odgovor.arrayBuffer());
      const mreza: Mreza = napraviMrezu(paket);
      if (otkazano) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Pixi se učitava tek ovdje — ostatak igre ga ne plaća u početnom paketu.
      const { createGradRenderer } = await import("@/lib/game/ui/gradRenderer");
      renderer = await createGradRenderer(canvas, paket, mreza);
      if (otkazano) {
        renderer?.destroy();
        return;
      }
      if (!renderer) {
        setFaza("bezWebgl");
        return;
      }

      // Start: najbliža ulica Trgu nezavisnosti (ishodište paketa).
      const start = najblizaIvica(mreza, { x: 0, y: 0 });
      if (!start) throw new Error("mreža nema nijednu voznu ulicu");
      const st: GradVozilo = novoVozilo(mreza, start.ivica, 1, start.s);
      let prije = poza(mreza, st);
      let sada = prije;
      let ugaoKamere = Math.atan2(sada.heading.y, sada.heading.x);

      let cssW = 0;
      let cssH = 0;
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        cssW = r.width;
        cssH = r.height;
        renderer?.resize(cssW, cssH, dprUredjaja());
      };
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
      setFaza("voznja");
      volan.release();

      let zadnji = 0;
      let acc = 0;
      let zadnjiHud = 0;
      let kadrova = 0;
      let odFps = performance.now();
      let fps: number | null = null;
      const kadar = (now: number) => {
        raf = requestAnimationFrame(kadar);
        const dt = zadnji === 0 ? 0 : Math.min(0.25, (now - zadnji) / 1000);
        zadnji = now;
        acc += dt;
        let koraka = 0;
        while (acc >= DT && koraka < 8) {
          prije = sada;
          korak(mreza, st, inputRef.current);
          sada = poza(mreza, st);
          acc -= DT;
          koraka += 1;
        }
        if (koraka === 8) acc = 0;
        const alfa = acc / DT;
        const pos: Point = {
          x: prije.pos.x + (sada.pos.x - prije.pos.x) * alfa,
          y: prije.pos.y + (sada.pos.y - prije.pos.y) * alfa,
        };
        const cilj = Math.atan2(sada.heading.y, sada.heading.x);
        let razlika = cilj - ugaoKamere;
        while (razlika > Math.PI) razlika -= 2 * Math.PI;
        while (razlika < -Math.PI) razlika += 2 * Math.PI;
        ugaoKamere += razlika * Math.min(1, dt / KAMERA_SMIRENJE);

        // Kamera kao na otvorenom putu: pravac vožnje nagore, igrač na 62 %
        // visine, i niže što se brže vozi.
        const naprijed = KAMERA_NAPRIJED * Math.min(1, st.v / KAMERA_NAPRIJED_BRZINA);
        const hx = Math.cos(ugaoKamere);
        const hy = Math.sin(ugaoKamere);
        const k: GradKadar = {
          wx: pos.x,
          wy: pos.y,
          cx: cssW / 2,
          cy: cssH * (0.62 + naprijed),
          rot: -Math.PI / 2 - Math.atan2(-hy, -hx),
          scale: Math.min(cssW, cssH) / (2 * GRAD_POLA_KADRA * GRAD_ZUM[zumRef.current]!),
        };
        renderer?.draw({
          kadar: k,
          igrac: { pos, heading: sada.heading, koci: inputRef.current.brake > 0 },
          pregled: pregledIzbora(mreza, st),
        });

        kadrova += 1;
        if (now - odFps > 1000) {
          fps = (1000 * kadrova) / (now - odFps);
          kadrova = 0;
          odFps = now;
        }
        if (now - zadnjiHud > 1000 / HUD_HZ) {
          zadnjiHud = now;
          const iv = mreza.ivice[st.luk ? st.luk.cilj.ivica : st.ivica]!;
          setHud({ kmh: st.v * 3.6, ulica: iv.ime, fps: debug ? fps : null });
          setOgranicenje(iv.brzina);
        }
      };
      raf = requestAnimationFrame(kadar);
    };

    pokreni().catch(() => {
      if (!otkazano) setFaza("greska");
    });
    return () => {
      otkazano = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      renderer?.destroy();
    };
    // Petlja se pokreće jednom po otvaranju ekrana; `volan` i `inputRef` su
    // stabilni za cijeli život komponente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          volan.release();
          onExit();
        }}
        className="text-sm font-semibold text-blue underline-offset-4 hover:underline"
      >
        ← {t.tripBack}
      </button>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t.gradTitle}
          className="block aspect-square w-full rounded border border-line bg-[#e8e4dc] touch-none select-none"
        />
        {faza !== "voznja" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <p className="rounded border border-line bg-panel px-3 py-2 text-sm font-semibold">
              {faza === "ucitavam" ? t.gradLoading : faza === "bezWebgl" ? t.gradNoWebgl : t.gradFailed}
            </p>
          </div>
        )}
        {faza === "voznja" && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <button
              type="button"
              onClick={() => setZum((z) => Math.min(GRAD_ZUM.length - 1, z + 1))}
              disabled={zum === GRAD_ZUM.length - 1}
              aria-label={t.gradZoomOut}
              className="h-9 w-9 rounded border border-line bg-panel text-lg font-bold disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZum((z) => Math.max(0, z - 1))}
              disabled={zum === 0}
              aria-label={t.gradZoomIn}
              className="h-9 w-9 rounded border border-line bg-panel text-lg font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
        {faza === "voznja" && (
          <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-2">
            {/* Ograničenje samo kad ga OSM zna — bez pretpostavke, pravila još nema. */}
            <Brzinomjer brzina={hud.kmh} ogranicenje={ogranicenje} t={t} />
            <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
              {t.gradStreet}: {hud.ulica || t.gradUnnamed}
              {hud.fps !== null ? ` · ${hud.fps.toFixed(0)} fps` : ""}
            </p>
          </div>
        )}
      </div>
      <p className="text-sm text-muted">{t.gradHint}</p>
      <DriveControls
        volan={volan}
        steerLabel={t.gameSteer}
        throttleLabel={t.gameThrottle}
        brakeLabel={t.gameBrake}
      />
    </div>
  );
}
