"use client";

import { useEffect, useRef, useState } from "react";
import {
  BENCH_DO,
  BENCH_KADROVA,
  BENCH_NIVO,
  BENCH_OD,
  BENCH_PLATNO,
  BENCH_TACKE_S,
  DT,
} from "@/lib/game/sim/config";
import { vozacRute } from "@/lib/game/sim/vozac";
import { step } from "@/lib/game/sim/world";
import type { RoadTemplate } from "@/lib/game/sim/types";
import { fps, statistika, type Statistika } from "@/lib/game/ui/bench";
import { createCanvasRenderer, dprUredjaja, type Renderer } from "@/lib/game/ui/renderer";
import { createRunner } from "@/lib/game/ui/runner";
import { nadjiRutu, napraviRutu } from "@/lib/game/world/ruta";
import { rutaScenario } from "@/lib/game/world/svijet";
import { dovuciVrhove, izvorSaMreze, ucitajOkolinu } from "@/lib/game/world/tiles";
import { dovuciGeometriju, dovuciKicme, iviceRute } from "./rutaPodaci";

/** Rezultat jedne tačke mjerenja. */
interface Tacka {
  /** Vrijeme vožnje na kojem je tačka [s]. */
  t: number;
  /** Vrijeme crtanja jednog kadra na procesoru [ms]. */
  crtanje: Statistika;
  /** Sličice u sekundi, iz razmaka između kadrova. */
  fps: number;
}

export interface BenchRezultat {
  renderer: string;
  platno: number;
  dpr: number;
  tacke: Tacka[];
  /** Svi kadrovi sa svih tačaka zajedno. */
  ukupno: { crtanje: Statistika; fps: number };
}

declare global {
  interface Window {
    /** Rezultat za skriptu koja mjeri iz pregledača (`qa/igra_bench.mjs`). */
    __bench?: BenchRezultat | { greska: string };
    /**
     * Javlja skripti da li se sada mjeri ili vozi do tačke. Skripta tako
     * usporava procesor samo dok se mjeri: odvoženje se ne mjeri, a pod
     * usporenjem bi trajalo višestruko duže.
     */
    __benchFaza?: (faza: "vozim" | "mjerim") => Promise<void>;
  }
}

/** Renderer po imenu iz adrese — danas postoji samo Canvas 2D. */
function napraviRenderer(vrsta: string, canvas: HTMLCanvasElement): Renderer | null {
  if (vrsta === "canvas") return createCanvasRenderer(canvas);
  return null;
}

/** Pusti pregledač da odahne između komada dugog računa. */
const predah = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Mjerilo crtanja: uvijek ista ruta, isti bot, isto sjeme.
 *
 * Svijet se botom odvozi do tačke mjerenja (bez crtanja, što brže može), pa se
 * na njoj crta `BENCH_KADROVA` kadrova, sa tačno jednim korakom simulacije po
 * kadru. Tako svaki renderer crta ISTE kadrove, i razlika u brojevima je samo
 * razlika u crtanju.
 *
 * Natpisi su imena veličina iz koda, ne tekst za igrača — ovo je razvojni
 * alat, kao i dev preklop, pa nije u prevodu.
 */
export default function BenchScreen() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stanje, setStanje] = useState("priprema");
  const [rezultat, setRezultat] = useState<BenchRezultat | null>(null);

  useEffect(() => {
    let otkazano = false;
    let renderer: Renderer | null = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mjeri = async () => {
      const vrsta = new URLSearchParams(window.location.search).get("render") ?? "canvas";
      renderer = napraviRenderer(vrsta, canvas);
      if (!renderer) throw new Error(`nepoznat renderer: ${vrsta}`);
      const dpr = dprUredjaja();
      renderer.resize(BENCH_PLATNO, BENCH_PLATNO, dpr);

      setStanje("učitavam rutu");
      const cvorovi = nadjiRutu(BENCH_OD, BENCH_DO);
      if (!cvorovi) throw new Error("nema rute");
      const [geom, kicme, vrhovi] = await Promise.all([
        dovuciGeometriju(iviceRute(cvorovi)),
        dovuciKicme(cvorovi),
        dovuciVrhove(),
      ]);
      const ruta = napraviRutu(cvorovi, geom, kicme);
      // Okolina se ovdje čeka cijela: u igri stiže tokom vožnje, ali mjerenje
      // mora crtati isto na svakoj tački, bez obzira na to koliko brzo mreža radi.
      setStanje("učitavam okolinu");
      const { okolina } = await ucitajOkolinu(ruta, izvorSaMreze, { vrhovi });

      const scenario = rutaScenario(ruta, 1, BENCH_NIVO);
      const tpl = scenario.template as RoadTemplate;
      const runner = createRunner(scenario, 1);
      const w = runner.world;
      const bot = vozacRute({ pretice: true });
      const opcije = {
        camera: { follow: true, rotate: true, naprijed: true, half: tpl.viewHalf },
        okolina,
      };

      const tacke: Tacka[] = [];
      const sviCrtanje: number[] = [];
      const sviRazmaci: number[] = [];
      for (let k = 1; w.outcome === "running"; k++) {
        const doT = k * BENCH_TACKE_S;
        setStanje(`vozim do ${doT} s`);
        while (w.outcome === "running" && w.t < doT) {
          for (let i = 0; i < 600 && w.outcome === "running" && w.t < doT; i++) step(w, scenario, bot(w, scenario));
          await predah();
          if (otkazano) return;
        }
        if (w.outcome !== "running") break;

        setStanje(`mjerim na ${doT} s`);
        await window.__benchFaza?.("mjerim");
        const crtanje: number[] = [];
        const razmaci: number[] = [];
        await new Promise<void>((gotovo) => {
          let prije = 0;
          const kadar = (sada: number) => {
            if (otkazano) return gotovo();
            runner.advance(DT, bot(w, scenario));
            const t0 = performance.now();
            renderer!.draw(runner, opcije);
            crtanje.push(performance.now() - t0);
            if (prije > 0) razmaci.push(sada - prije);
            prije = sada;
            if (crtanje.length >= BENCH_KADROVA || w.outcome !== "running") gotovo();
            else requestAnimationFrame(kadar);
          };
          requestAnimationFrame(kadar);
        });
        await window.__benchFaza?.("vozim");
        if (otkazano) return;
        tacke.push({ t: doT, crtanje: statistika(crtanje), fps: fps(razmaci) });
        sviCrtanje.push(...crtanje);
        sviRazmaci.push(...razmaci);
      }

      const r: BenchRezultat = {
        renderer: vrsta,
        platno: BENCH_PLATNO,
        dpr,
        tacke,
        ukupno: { crtanje: statistika(sviCrtanje), fps: fps(sviRazmaci) },
      };
      window.__bench = r;
      setRezultat(r);
      setStanje("gotovo");
    };

    mjeri().catch((e: unknown) => {
      const poruka = e instanceof Error ? e.message : String(e);
      window.__bench = { greska: poruka };
      setStanje(`greška: ${poruka}`);
    });
    return () => {
      otkazano = true;
      renderer?.destroy();
    };
  }, []);

  const ms = (x: number) => x.toFixed(2);
  return (
    <div className="space-y-3 font-mono text-sm">
      <p data-bench-stanje={stanje}>
        {BENCH_OD} → {BENCH_DO}, nivo {BENCH_NIVO}: {stanje}
      </p>
      <canvas
        ref={canvasRef}
        style={{ width: BENCH_PLATNO, height: BENCH_PLATNO }}
        className="block rounded border border-line bg-[#dfe3d8]"
      />
      {rezultat && (
        <table className="w-full text-right">
          <thead>
            <tr>
              <th className="text-left">t [s]</th>
              <th>crtanje med [ms]</th>
              <th>p95</th>
              <th>max</th>
              <th>fps</th>
            </tr>
          </thead>
          <tbody>
            {rezultat.tacke.map((x) => (
              <tr key={x.t}>
                <td className="text-left">{x.t}</td>
                <td>{ms(x.crtanje.medijana)}</td>
                <td>{ms(x.crtanje.p95)}</td>
                <td>{ms(x.crtanje.najvise)}</td>
                <td>{x.fps.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="text-left">ukupno</td>
              <td>{ms(rezultat.ukupno.crtanje.medijana)}</td>
              <td>{ms(rezultat.ukupno.crtanje.p95)}</td>
              <td>{ms(rezultat.ukupno.crtanje.najvise)}</td>
              <td>{rezultat.ukupno.fps.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
