/**
 * Autoput: trake umjesto krivina.
 *
 * Do sada je svaka putanja bila jedna linija kroz raskrsnicu i vozilo je imalo
 * samo `s`. Na autoputu se putanje ne sijeku nego stoje jedna pored druge, pa
 * odnos među vozilima nije prvenstvo nego traka i odstojanje. Zbog toga vozilo
 * ovdje dobija i traku, a prelazak iz trake u traku je bočni prelaz u trajanju
 * `LANE_CHANGE_TIME` — nema slobodnog upravljanja, kao ni drugdje u igri.
 *
 * Vožnja ide ka jugu (+y). Vozačeva desna strana je zapad, pa su trake
 * poređane od razdjelne linije ka desno: traka 1 je lijeva (za preticanje),
 * traka 0 je desna, a traka −1 je spoljna — traka za ubrzavanje na ulasku i za
 * usporavanje na izlasku.
 *
 * Pojednostavljenje koje priznajem: spoljna traka postoji cijelom dužinom
 * segmenta, a `rampRange` i `exitRange` samo kažu gdje je ona zaista traka za
 * ubrzavanje odnosno usporavanje. Modelovati traku koja se prekida značilo bi
 * putanju promjenljive dužine, a od toga scenariji ove faze nemaju koristi.
 */

import { APPROACH_LENGTH, LANE_WIDTH } from "./config";
import { cumulative } from "./geometry";
import type { HighwayTemplate, Path, Point } from "./types";

/** Indeksi traka koje autoput ima: spoljna, desna, lijeva. */
export const HIGHWAY_LANES = [-1, 0, 1] as const;

/** Bočni položaj ose trake [m]. Manji `x` je više udesno u smjeru vožnje. */
export const laneX = (index: number): number => -LANE_WIDTH * (1.5 - index);

export const lanePathId = (tplId: string, index: number): string => `${tplId}:lane${index}`;

/**
 * Putanja jedne trake — prava linija duž segmenta.
 *
 * `stopLineS` i tijelo raskrsnice se namjerno stavljaju iza kraja putanje:
 * autoput ih nema, a detekcija koja ih koristi tako nikad ne okine.
 */
export function buildLanePath(tpl: HighwayTemplate, index: number): Path {
  const x = laneX(index);
  const points: Point[] = [
    { x, y: 0 },
    { x, y: tpl.length },
  ];
  const cum = cumulative(points);
  const daleko = tpl.length + APPROACH_LENGTH;
  return {
    id: lanePathId(tpl.id, index),
    arm: "N",
    intent: { kind: "lane", index },
    exitArm: "S",
    points,
    cum,
    length: tpl.length,
    stopLineS: daleko,
    boxEnterS: daleko,
    boxExitS: daleko + 1,
    // Samo spoljna traka ima kraj trake za ubrzavanje; u voznim trakama zona
    // uključenja nema smisla, pa se ni ne crta.
    rampEndS: index === -1 ? tpl.rampRange[1] : undefined,
  };
}

/** Da li je `s` unutar trake za ubrzavanje. */
export const onRamp = (tpl: HighwayTemplate, s: number): boolean =>
  s >= tpl.rampRange[0] && s <= tpl.rampRange[1];

/** Da li je `s` unutar trake za usporavanje. */
export const onExitLane = (tpl: HighwayTemplate, s: number): boolean =>
  s >= tpl.exitRange[0] && s <= tpl.exitRange[1];

/**
 * Bočni položaj vozila, uz prelazak iz trake u traku.
 *
 * Prelazak je S-kriva u vremenu: na početku i na kraju je bočna brzina nula, pa
 * se vozilo ne „teleportuje" preko linije. Za potrebe detekcije se u toku
 * prelaska smatra da je vozilo u OBJE trake — vidi `occupiedLanes`.
 */
export function lateralX(lane: number, laneFrom: number | undefined, laneT: number): number {
  if (laneFrom === undefined || laneFrom === lane) return laneX(lane);
  const t = Math.min(1, Math.max(0, laneT));
  const glatko = t * t * (3 - 2 * t); // smoothstep
  return laneX(laneFrom) + (laneX(lane) - laneX(laneFrom)) * glatko;
}

/** Trake koje vozilo trenutno zauzima. */
export function occupiedLanes(lane: number, laneFrom: number | undefined, laneT: number): number[] {
  if (laneFrom === undefined || laneFrom === lane || laneT >= 1) return [lane];
  return [laneFrom, lane];
}

/** Da li dva vozila dijele bar jednu traku. */
export function shareLane(a: number[], b: number[]): boolean {
  return a.some((x) => b.includes(x));
}
