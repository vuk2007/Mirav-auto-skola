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
import { napraviMrezu, najblizaIvica } from "@/lib/game/grad/mreza";
import { procitaj, type Paket } from "@/lib/game/grad/paket";
import { napraviPovrsinu, ulicaNa, type Povrsina } from "@/lib/game/grad/povrsina";
import { korakSlobodno, pozaSlobodno, slobodnoNaIvici, type SlobodnoVozilo } from "@/lib/game/grad/slobodno";
import type { BojeDekora } from "@/lib/game/grad/dekor";
import type { Palete, ZonaPalete } from "@/lib/game/grad/zgrade";
import type { BojeOsvjetljenja, DobaDana, GradKadar, GradRenderer } from "@/lib/game/ui/gradRenderer";
import { haptika } from "@/lib/game/ui/haptika";
import { dprUredjaja } from "@/lib/game/ui/renderer";
import Brzinomjer from "./Brzinomjer";
import DriveControls from "./DriveControls";
import { useVolan } from "./useVolan";

/** Grad koji se vozi — za sada samo Podgorica (faza 6, stavka 3). */
const GRAD = "podgorica";

/**
 * Koliko brzo kamera sustiže smjer auta [s]. Kamera koja prati auto tačno
 * vrti cijeli grad sa svakim pokretom volana; ovako se okreće mekše.
 */
const KAMERA_SMIRENJE = 0.25;

type Faza = "ucitavam" | "voznja" | "greska" | "bezWebgl";

interface Hud {
  kmh: number;
  ulica: string;
  rikverc: boolean;
  fps: number | null;
}

/** Trzaj telefona pri udaru u ivičnjak [ms] — samo kad udar počne, ne dok struže. */
const UDAR_HAPTIKA = 30;

/**
 * Slobodna vožnja kroz Podgoricu, u razmjeri 1:1 — faza 6, stavka 3.
 *
 * Bez pravila i bez drugih vozila: ovo je da se grad pogleda i provoza, prije
 * nego što dobije izgled (stavka 4) i pravila (stavka 5). Vozi se istim volanom
 * i gasom kao Ruta, ali slobodno (stavka 3c): volan okreće točkove i skreće se
 * gdje igrač skrene; kočnica držana u mjestu ubacuje rikverc.
 */
export default function GradScreen({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  const volan = useVolan(true, { pokazivacRukom: false });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [faza, setFaza] = useState<Faza>("ucitavam");
  const [hud, setHud] = useState<Hud>({ kmh: 0, ulica: "", rikverc: false, fps: null });
  const [ogranicenje, setOgranicenje] = useState<number | null>(null);
  const inputRef = volan.inputRef;
  // Udaljavanje kadra — da se grad može pregledati, ne samo voziti. Ide kroz
  // `ref`, jer ga petlja čita svakog kadra.
  const [zum, setZum] = useState(0);
  const zumRef = useRef(0);
  zumRef.current = zum;
  // Doba dana i vrijeme (stavka 4d): bira igrač; kiša mijenja i kočenje.
  const [doba, setDoba] = useState<DobaDana>("dan");
  const [kisa, setKisa] = useState(false);
  const uslovRef = useRef({ doba, kisa });
  uslovRef.current = { doba, kisa };

  useEffect(() => {
    let otkazano = false;
    let renderer: GradRenderer | null = null;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";

    const pokreni = async () => {
      const json = async <T,>(url: string): Promise<T> => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return (await r.json()) as T;
      };
      // Izgled zgrada je podatak: palete i zone (sa paletom po zoni).
      const [spisak, palete, zone] = await Promise.all([
        json<Record<string, { fajl: string }>>("/data/grad/gradovi.json"),
        json<Palete & { dekor: BojeDekora; osvjetljenje: BojeOsvjetljenja }>("/data/grad/palete.json"),
        json<{ zone: ZonaPalete[] }>(`/data/grad/cityZones/${GRAD}.json`),
      ]);
      const fajl = spisak[GRAD]?.fajl;
      if (!fajl) throw new Error(`nema paketa za ${GRAD}`);
      const odgovor = await fetch(`/data/grad/${fajl}`);
      if (!odgovor.ok) throw new Error(`paket grada: HTTP ${odgovor.status}`);
      const paket: Paket = procitaj(await odgovor.arrayBuffer());
      const mreza = napraviMrezu(paket);
      const povrsina: Povrsina = napraviPovrsinu(mreza);
      if (otkazano) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Pixi se učitava tek ovdje — ostatak igre ga ne plaća u početnom paketu.
      const { createGradRenderer } = await import("@/lib/game/ui/gradRenderer");
      renderer = await createGradRenderer(canvas, paket, povrsina, { palete, zone: zone.zone });
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
      const st: SlobodnoVozilo = slobodnoNaIvici(povrsina, start.ivica, 1, start.s);
      let prije = pozaSlobodno(st);
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
      let bioUdar = false;
      let ulica = start.ivica;
      const kadar = (now: number) => {
        raf = requestAnimationFrame(kadar);
        const dt = zadnji === 0 ? 0 : Math.min(0.25, (now - zadnji) / 1000);
        zadnji = now;
        acc += dt;
        let koraka = 0;
        while (acc >= DT && koraka < 8) {
          prije = sada;
          korakSlobodno(povrsina, st, inputRef.current, { kisa: uslovRef.current.kisa });
          sada = pozaSlobodno(st);
          if (st.udar && !bioUdar) haptika(UDAR_HAPTIKA);
          bioUdar = st.udar;
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
        // visine, i niže što se brže vozi. Unazad kamera ostaje iza auta.
        const naprijed = KAMERA_NAPRIJED * Math.min(1, Math.max(0, st.v) / KAMERA_NAPRIJED_BRZINA);
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
          osvjetljenje: { ...uslovRef.current, sekunde: now / 1000 },
          igrac: {
            pos,
            heading: sada.heading,
            koci: inputRef.current.brake > 0,
            rikverc: st.rikverc,
            tocak: st.tocak,
          },
        });

        kadrova += 1;
        if (now - odFps > 1000) {
          fps = (1000 * kadrova) / (now - odFps);
          kadrova = 0;
          odFps = now;
        }
        if (now - zadnjiHud > 1000 / HUD_HZ) {
          zadnjiHud = now;
          // Van ulice (ne bi trebalo da se desi) ostaje zadnja poznata.
          ulica = ulicaNa(povrsina, st.x, st.y) ?? ulica;
          const iv = mreza.ivice[ulica]!;
          setHud({ kmh: Math.abs(st.v) * 3.6, ulica: iv.ime, rikverc: st.rikverc, fps: debug ? fps : null });
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
            <div className="flex items-start gap-2">
              <Brzinomjer brzina={hud.kmh} ogranicenje={ogranicenje} t={t} />
              {hud.rikverc && (
                <p
                  className="rounded border border-line bg-panel/90 px-2 py-1 text-xs font-bold"
                  aria-live="polite"
                >
                  R · {t.gradReverse}
                </p>
              )}
            </div>
            <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
              {t.gradStreet}: {hud.ulica || t.gradUnnamed}
              {hud.fps !== null ? ` · ${hud.fps.toFixed(0)} fps` : ""}
            </p>
            {kisa && (
              <p className="max-w-[16rem] rounded border border-line bg-panel/90 px-2 py-1 text-xs font-semibold">
                {t.gradRainNote}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.gradTimeOfDay}</legend>
          <span className="mr-1 text-muted" aria-hidden>
            {t.gradTimeOfDay}:
          </span>
          {(
            [
              ["dan", t.gradDay],
              ["sumrak", t.gradDusk],
              ["noc", t.gradNight],
            ] as const
          ).map(([d, ime]) => (
            <button
              key={d}
              type="button"
              aria-pressed={doba === d}
              onClick={() => setDoba(d)}
              className={`rounded border px-2 py-1 font-semibold ${doba === d ? "border-blue bg-blue text-white" : "border-line bg-panel"}`}
            >
              {ime}
            </button>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.gradWeather}</legend>
          <span className="mr-1 text-muted" aria-hidden>
            {t.gradWeather}:
          </span>
          {(
            [
              [false, t.gradSun],
              [true, t.gradRain],
            ] as const
          ).map(([k, ime]) => (
            <button
              key={ime}
              type="button"
              aria-pressed={kisa === k}
              onClick={() => setKisa(k)}
              className={`rounded border px-2 py-1 font-semibold ${kisa === k ? "border-blue bg-blue text-white" : "border-line bg-panel"}`}
            >
              {ime}
            </button>
          ))}
        </fieldset>
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
