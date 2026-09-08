/**
 * Otvoren put: krivine umjesto raskrsnice.
 *
 * Autoput je bio prava linija sa trakama; ovdje je obrnuto — trake su samo
 * dvije, ali se osovina puta savija. Zato se putanja ne piše sa dvije tačke
 * nego se hoda korak po korak: u krivini se smjer mijenja za `korak / R`, a
 * između krivina se ide pravo.
 *
 * Smjer vožnje je +y, kao i na autoputu, a veći `x` je vozačeva lijeva strana
 * (vidi `laneX` u `highway.ts`). Skretanje ulijevo zato povećava ugao smjera.
 *
 * Vozi se desnom trakom, pa je traka 0 pomjerena za pola širine udesno od ose,
 * a susretna traka 1 za pola širine ulijevo. Putanja susretne trake je okrenuta
 * naopako: vozilo koje njome ide počinje na kraju dionice i vozi nama u susret,
 * a `s` mu i dalje raste — bez toga bi cijeli model kretanja morao da poznaje
 * smjer, umjesto samo putanju.
 */

import { APPROACH_LENGTH, ROAD_STEP } from "./config";
import { cumulative } from "./geometry";
import { lanePathId } from "./highway";
import type { Path, Point, RoadCurve, RoadTemplate } from "./types";

/** Trake otvorenog puta: naša i susretna. */
export const ROAD_LANES = [0, 1] as const;

/** Da li je traka susretna. */
export const isOncoming = (index: number): boolean => index === 1;

/**
 * Zakrivljenost na `s` [1/m]; pozitivno je ulijevo.
 *
 * Sabira se preko svih krivina umjesto da se uzme prva pogođena: ako se dvije
 * krivine ipak preklope, put se savije jače, a ne skokovito.
 */
export function curvatureAt(curves: readonly RoadCurve[], s: number): number {
  let k = 0;
  for (const c of curves) {
    if (Math.abs(s - c.atS) > c.arc / 2) continue;
    k += (c.side === "left" ? 1 : -1) / c.radius;
  }
  return k;
}

/** Osovina puta: tačke i ugao smjera u svakoj od njih. */
export function centerLine(tpl: RoadTemplate): { points: Point[]; heading: number[] } {
  const koraka = Math.max(1, Math.round(tpl.length / ROAD_STEP));
  const korak = tpl.length / koraka;
  const points: Point[] = [];
  const heading: number[] = [];

  let x = 0;
  let y = 0;
  let ugao = 0;
  for (let i = 0; i <= koraka; i++) {
    points.push({ x, y });
    heading.push(ugao);
    if (i === koraka) break;
    // Ugao se mijenja na sredini koraka, pa se poligon ne „razvlači" prema
    // spolja u krivini — običan Ojler bi svaku serpentinu napravio širom.
    const s = i * korak;
    const pola = ugao + (curvatureAt(tpl.curves, s + korak / 2) * korak) / 2;
    x += Math.sin(pola) * korak;
    y += Math.cos(pola) * korak;
    ugao += curvatureAt(tpl.curves, s + korak / 2) * korak;
  }
  return { points, heading };
}

/** Osa jedne trake: osovina pomjerena bočno. `offset > 0` je ulijevo. */
function offsetLine(points: Point[], heading: number[], offset: number): Point[] {
  return points.map((p, i) => {
    const ugao = heading[i] ?? 0;
    return { x: p.x + Math.cos(ugao) * offset, y: p.y - Math.sin(ugao) * offset };
  });
}

/**
 * Putanje obje trake.
 *
 * Stop-linija i tijelo raskrsnice se stavljaju iza kraja putanje — otvoren put
 * ih nema, pa detekcija koja ih koristi nikad ne okine. Isti postupak kao na
 * autoputu.
 */
export function buildRoadPaths(tpl: RoadTemplate): Path[] {
  const { points, heading } = centerLine(tpl);
  const pola = tpl.geometry.laneWidth / 2;

  return ROAD_LANES.map((index) => {
    const linija = offsetLine(points, heading, isOncoming(index) ? pola : -pola);
    // Susretna traka se vozi u suprotnom smjeru, pa joj putanja ide unazad.
    const tacke = isOncoming(index) ? [...linija].reverse() : linija;
    const cum = cumulative(tacke);
    const duzina = cum[cum.length - 1] ?? 0;
    const daleko = duzina + APPROACH_LENGTH;
    return {
      id: lanePathId(tpl.id, index),
      arm: isOncoming(index) ? "S" : "N",
      intent: { kind: "lane" as const, index },
      exitArm: isOncoming(index) ? "N" : "S",
      points: tacke,
      cum,
      length: duzina,
      stopLineS: daleko,
      boxEnterS: daleko,
      boxExitS: daleko + 1,
    };
  });
}

/**
 * Gdje na putanji naše trake leži krivina.
 *
 * Krivine su zadate po osovini, a vozi se trakom koja je u krivini kraća ili
 * duža od nje. Razlika je mala, ali tabla sa preporučenom brzinom mora da
 * stoji tamo gdje krivina i počinje, pa se `s` prevodi srazmjerno dužini.
 */
export function curveAtOnPath(tpl: RoadTemplate, path: Path, curve: RoadCurve): number {
  if (tpl.length <= 0) return 0;
  return (curve.atS / tpl.length) * path.length;
}
