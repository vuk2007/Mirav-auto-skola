"use client";

import { useEffect, useRef, useState } from "react";
import { compile } from "@/lib/game/sim/intersection";
import type { Input, RoadTemplate, Template, World } from "@/lib/game/sim/types";
import { PLAYER_ID, trakeNaPutu } from "@/lib/game/sim/world";
import { uProzoruGustine } from "@/lib/game/world/svijet";

interface DebugPreklopProps {
  /** Svijet koji se vozi — čita se, nikad ne mijenja. */
  svijet: () => World | null;
  template: Template | null | undefined;
  inputRef: React.RefObject<Input>;
  /**
   * Na čemu se vozi, za „laneId": ivica grafa ili grad. Id putanje to ne kaže —
   * na ruti je cijela ruta jedna putanja, sa id-em od svih ivica redom.
   */
  dionica?: string;
}

/** Koliko puta u sekundi se brojevi osvježavaju — dovoljno za čitanje, a ne troši. */
const OSVJEZAVANJE_MS = 200;

interface Stanje {
  put: string;
  traka: string;
  lateral: string;
  steer: string;
  ttc: string;
  pregled: string;
  vozila: string;
  fps: string;
}

/**
 * Dev preklop: samo uz `?debug=1` u adresi.
 *
 * Iz zadatka: „laneId, lateral, steer, TTC do najbližeg konflikta, broj vozila
 * u prozoru, fps". Uz to i preglednost suprotne trake, jer je po njoj novo
 * pravilo. Natpisi su imena veličina iz koda, ne tekst za igrača — zato nisu u
 * prevodu.
 *
 * TTC je na otvorenom putu vrijeme do najbližeg vozila u traci koju tijelo
 * zauzima: prema vozilu ispred razlikom brzina, prema susretnom zbirom. Na
 * raskrsnici se ne računa — tamo je sukob tačka prvenstva, a ne odstojanje.
 */
export default function DebugPreklop({ svijet, template, inputRef, dionica }: DebugPreklopProps) {
  const [ukljucen, setUkljucen] = useState(false);
  const [stanje, setStanje] = useState<Stanje | null>(null);
  const kadrovi = useRef(0);

  useEffect(() => {
    setUkljucen(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  useEffect(() => {
    if (!ukljucen) return;
    let raf = 0;
    const kadar = () => {
      kadrovi.current += 1;
      raf = requestAnimationFrame(kadar);
    };
    raf = requestAnimationFrame(kadar);
    let prije = performance.now();
    const id = window.setInterval(() => {
      const sada = performance.now();
      const fps = (kadrovi.current * 1000) / Math.max(1, sada - prije);
      kadrovi.current = 0;
      prije = sada;
      setStanje(izmjeri(svijet(), template, inputRef.current, fps, dionica));
    }, OSVJEZAVANJE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [ukljucen, svijet, template, inputRef, dionica]);

  if (!ukljucen || !stanje) return null;
  const red = (k: string, v: string) => (
    <div key={k} className="flex justify-between gap-3">
      <span className="text-white/60">{k}</span>
      <span>{v}</span>
    </div>
  );
  return (
    <div
      data-debug-preklop
      className="pointer-events-none absolute bottom-2 left-2 min-w-[11rem] rounded bg-bg/80 px-2 py-1 font-mono text-[11px] leading-tight text-white"
    >
      {red("laneId", stanje.put)}
      {red("traka", stanje.traka)}
      {red("lateral", stanje.lateral)}
      {red("steer", stanje.steer)}
      {red("TTC", stanje.ttc)}
      {red("pregled", stanje.pregled)}
      {red("u prozoru", stanje.vozila)}
      {red("fps", stanje.fps)}
    </div>
  );
}

/** Brojevi za preklop, iz jednog pogleda na svijet. */
function izmjeri(
  world: World | null,
  tpl: Template | null | undefined,
  input: Input,
  fps: number,
  dionica: string | undefined,
): Stanje {
  const prazno = "—";
  const ja = world?.vehicles.find((v) => v.id === PLAYER_ID);
  if (!world || !ja || !tpl) {
    return { put: prazno, traka: prazno, lateral: prazno, steer: prazno, ttc: prazno, pregled: prazno, vozila: prazno, fps: fps.toFixed(0) };
  }
  const paths = compile(tpl).paths;
  const put = paths.get(ja.pathId);
  let ttc = Infinity;
  let traka = prazno;
  let vozila = prazno;
  if (tpl.kind === "road" && put) {
    const moje = trakeNaPutu(put, ja);
    traka = moje.join("+");
    for (const o of world.vehicles) {
      if (o.id === ja.id || o.done || world.t < o.spawnT) continue;
      const p = paths.get(o.pathId);
      if (!p || !trakeNaPutu(p, o).some((t) => moje.includes(t))) continue;
      const naPutu = o.lane === 1 ? p.length - o.s : o.s;
      const d = naPutu - ja.s - (ja.length + o.length) / 2;
      if (d <= 0) continue;
      const prilazi = o.lane === 1 ? ja.v + o.v : ja.v - o.v;
      if (prilazi > 0.1) ttc = Math.min(ttc, d / prilazi);
    }
    vozila = String(uProzoruGustine(world, tpl as RoadTemplate).vozila);
  }
  return {
    // Traka je zadnji dio id-a putanje (`…:lane0`).
    put: `${dionica ?? tpl.id}:${ja.pathId.split(":").at(-1)}`,
    traka,
    lateral: `${(ja.lateral ?? 0).toFixed(2)} m`,
    steer: (input.steer ?? 0).toFixed(2),
    ttc: Number.isFinite(ttc) ? `${ttc.toFixed(1)} s` : prazno,
    pregled: Number.isFinite(world.volan.pregledM) ? `${world.volan.pregledM.toFixed(0)} m` : "∞",
    vozila,
    fps: fps.toFixed(0),
  };
}
