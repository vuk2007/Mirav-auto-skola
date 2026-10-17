"use client";

import { useMemo } from "react";
import type { Point } from "@/lib/game/sim/types";
import type { Dict } from "@/lib/i18n";

/**
 * Mini mapa grada (faza 6, stavka 9): ulice oko auta, ruta do cilja i cilj,
 * okrenuta u pravcu vožnje kao kadar — strelica auta je uvijek gore. Linije
 * ulica su osovine iz OSM-a (atribucija u uglu, odjeljak 10); ništa rastersko.
 *
 * Ulice se pripreme jednom za okolinu (`MrljaUlica`, kad auto ode dalje od
 * pola kruga) — svaki kadar se samo pomjeri i okrene grupa.
 */

/** Poluprečnik prikaza [m]. */
export const MINI_POLUPRECNIK = 260;
/** Strana mape [px]. */
const STRANA = 150;

export interface MrljaUlica {
  centar: Point;
  /** SVG putanje (svjetske koordinate): glavne i ostale ulice. */
  glavne: string;
  ostale: string;
}

export interface MiniMapaGradaProps {
  ulice: MrljaUlica | null;
  auto: { x: number; y: number; ugao: number };
  /** Ostatak rute (od auta do cilja) i cilj. */
  ruta: Point[] | null;
  cilj: Point | null;
  t: Dict;
}

export default function MiniMapaGrada({ ulice, auto, ruta, cilj, t }: MiniMapaGradaProps) {
  const R = MINI_POLUPRECNIK;
  // Pravac vožnje nagore: ugao 0 je istok (+x), y je na jug — kao SVG.
  const okret = (-auto.ugao * 180) / Math.PI - 90;
  const putanjaRute = useMemo(
    () => (ruta && ruta.length > 1 ? ruta.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") : ""),
    [ruta],
  );
  // Cilj van kruga: na rubu, u svom pravcu.
  let ciljNaMapi: Point | null = null;
  if (cilj) {
    const dx = cilj.x - auto.x;
    const dy = cilj.y - auto.y;
    const d = Math.hypot(dx, dy);
    const k = d > R * 0.92 ? (R * 0.92) / d : 1;
    ciljNaMapi = { x: auto.x + dx * k, y: auto.y + dy * k };
  }
  return (
    <figure
      aria-label={t.gradMiniMap}
      className="relative overflow-hidden rounded-full border-2 border-line bg-panel/90 shadow"
      style={{ width: STRANA, height: STRANA }}
    >
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} width={STRANA} height={STRANA} aria-hidden>
        <g transform={`rotate(${okret.toFixed(2)}) translate(${(-auto.x).toFixed(1)} ${(-auto.y).toFixed(1)})`}>
          {ulice && (
            <>
              <path d={ulice.ostale} fill="none" stroke="#b9b3a6" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              <path d={ulice.glavne} fill="none" stroke="#8f887a" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {putanjaRute && <path d={putanjaRute} fill="none" stroke="#1e6bff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />}
          {ciljNaMapi && <circle cx={ciljNaMapi.x} cy={ciljNaMapi.y} r={16} fill="#d32f2f" stroke="#fff" strokeWidth={5} />}
        </g>
        {/* Auto: strelica u središtu, uvijek nagore. */}
        <path d="M0 -20 L13 14 L0 7 L-13 14 Z" fill="#1d3c8f" stroke="#fff" strokeWidth={4} strokeLinejoin="round" />
      </svg>
      <figcaption className="absolute bottom-1 left-0 right-0 text-center text-[8px] text-muted">{t.gradOsmAttribution}</figcaption>
    </figure>
  );
}
