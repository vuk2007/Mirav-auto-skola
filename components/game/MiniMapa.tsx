"use client";

import { useMemo } from "react";
import { napraviPreslikavanje } from "@/lib/game/world/okolina";
import type { Ruta } from "@/lib/game/world/ruta";
import type { Dict } from "@/lib/i18n";

/**
 * Mini mapa na STVARNIM koordinatama.
 *
 * Sve ostalo u vožnji je sabijeni svijet: rastojanja su skraćena, a krivine
 * ublažene. Ovdje toga nema — obris države, ruta i vozilo crtaju se u UTM
 * koordinatama iz OSM-a, onako kako stvarno stoje. Zato se sa nje vidi ono što
 * se iz kadra ne može vidjeti: gdje si u Crnoj Gori, a ne gdje si na traci.
 *
 * Sjever je gore. Mapa je uvijek cijela država, u istoj razmjeri — ruta koja se
 * vozi je na njoj mala, i tako i treba: kratka dionica mora da izgleda kratko.
 *
 * Nema rasterskih pločica ni tile servera; obris je naš `granica.json`.
 */

/** Koliko se često uzima tačka rute [m]. Na 250 m je linija glatka i jeftina. */
const KORAK = 250;
/** Širina mape u pikselima. */
const SIROKO = 176;
/** Rub oko obrisa, da natpis i tačka ne dodiruju ivicu. */
const RUB = 6;

export interface MiniMapaProps {
  ruta: Ruta;
  /** Pređeni put po ruti [m]. */
  s: number;
  granica: readonly (readonly [number, number][])[];
  t: Dict;
}

export default function MiniMapa({ ruta, s, granica, t }: MiniMapaProps) {
  // Okvir se računa iz obrisa države, ne iz rute: mapa mora izgledati isto bez
  // obzira na to odakle se dokle vozi.
  const okvir = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const komad of granica) {
      for (const [x, y] of komad) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    const razmjera = (SIROKO - 2 * RUB) / Math.max(1, maxX - minX);
    const visina = (maxY - minY) * razmjera + 2 * RUB;
    // UTM raste na sjever, ekran nadolje — zato se `y` okreće.
    const na = (x: number, y: number): [number, number] => [
      RUB + (x - minX) * razmjera,
      visina - RUB - (y - minY) * razmjera,
    ];
    return { na, visina };
  }, [granica]);

  const obris = useMemo(
    () =>
      granica
        .map((komad) =>
          komad.map(([x, y], i) => `${i === 0 ? "M" : "L"}${okvir.na(x, y).join(" ")}`).join(""),
        )
        .join(" "),
    [granica, okvir],
  );

  // Ruta se uzima preko preslikavanja: za dati pređeni put ono zna gdje je to
  // mjesto u prirodi. Isti račun daje i tačku vozila, pa se linija i tačka ne
  // mogu razići.
  const pres = useMemo(() => napraviPreslikavanje(ruta), [ruta]);
  const tacke = useMemo(() => {
    const out: { s: number; x: number; y: number }[] = [];
    for (let d = 0; d <= ruta.duzina; d += KORAK) {
      const u = pres.izRute(d);
      if (u) out.push({ s: d, ...u.p });
    }
    const kraj = pres.izRute(ruta.duzina);
    if (kraj) out.push({ s: ruta.duzina, ...kraj.p });
    return out;
  }, [pres, ruta.duzina]);

  const put = useMemo(() => linija(tacke, okvir.na), [tacke, okvir]);
  const predjeno = useMemo(
    () => linija(tacke.filter((p) => p.s <= s), okvir.na),
    [tacke, s, okvir],
  );

  const gdje = pres.izRute(Math.min(s, ruta.duzina));
  const tacka = gdje ? okvir.na(gdje.p.x, gdje.p.y) : null;

  return (
    <div className="rounded-md border border-glass-line bg-surface/85 backdrop-blur-md p-1">
      <svg
        // Na telefonu manja (do 30 % širine), da ne pokrije put u kadru.
        style={{ width: `min(${SIROKO}px, 30vw)`, height: "auto" }}
        viewBox={`0 0 ${SIROKO} ${okvir.visina}`}
        role="img"
        aria-label={t.rutaMap}
      >
        {/* Obris države, pa cijela ruta, pa pređeni dio preko nje: tri sloja
            od najtišeg ka najglasnijem, jer se prvo gleda gdje je vozilo. */}
        <path d={obris} className="fill-paper stroke-muted" strokeWidth={1} opacity={0.75} />
        <path
          d={put}
          className="stroke-text"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          opacity={0.35}
        />
        <path
          d={predjeno}
          className="stroke-blue"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
        {tacka && (
          <>
            <circle cx={tacka[0]} cy={tacka[1]} r={5} className="fill-surface stroke-text" strokeWidth={1} />
            <circle cx={tacka[0]} cy={tacka[1]} r={3} className="fill-red" />
          </>
        )}
      </svg>
      {/* Licenca stoji na samoj mapi — podaci su tuđi i to se vidi tamo gdje se
          i koriste, a ne samo u nekom spisku. */}
      <p className="mt-0.5 text-center text-[8px] leading-tight text-text-muted">{t.osmKratko}</p>
    </div>
  );
}

/** Polilinija kao SVG putanja; prazna ako nema bar dvije tačke. */
function linija(
  tacke: readonly { x: number; y: number }[],
  na: (x: number, y: number) => [number, number],
): string {
  if (tacke.length < 2) return "";
  return tacke.map((p, i) => `${i === 0 ? "M" : "L"}${na(p.x, p.y).join(" ")}`).join("");
}
