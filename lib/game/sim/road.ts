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

import {
  APPROACH_LENGTH,
  CURVE_WIDENING_LENGTH,
  CURVE_WIDENING_MAX,
  CURVE_WIDENING_RADIUS_SHARE,
  ROAD_STEP,
} from "./config";
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

/**
 * Osovina puta: tačke i ugao smjera u svakoj od njih.
 *
 * Kad šablon nosi stvarnu geometriju (`centerline`), ona se uzima kakva jest i
 * krivine se iz nje ČITAJU, ne crtaju. Proceduralno savijanje ispod važi samo
 * za dionice bez geometrije.
 */
export function centerLine(
  tpl: RoadTemplate,
  od = 0,
  doK = Number.POSITIVE_INFINITY,
): { points: Point[]; heading: number[] } {
  if (tpl.centerline && tpl.centerline.length >= 2) {
    const sve = tpl.centerline;
    const i0 = Math.max(0, Math.floor(od));
    const i1 = Math.min(sve.length - 1, Math.floor(doK));
    // Ugao se računa iz SUSJEDA U CIJELOJ osovini, i kad se vraća samo komad —
    // inače bi se na spoju dva kadra smjer prelomio.
    const points = i0 === 0 && i1 === sve.length - 1 ? sve : sve.slice(i0, i1 + 1);
    const heading = points.map((p, k) => {
      const i = i0 + k;
      const a = i === 0 ? p : sve[i - 1]!;
      const b = i === 0 ? sve[1]! : p;
      return Math.atan2(b.x - a.x, b.y - a.y);
    });
    return { points, heading };
  }
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
  if (od > 0 || Number.isFinite(doK)) {
    const i0 = Math.max(0, Math.floor(od));
    const i1 = Math.min(points.length - 1, Math.floor(doK));
    return { points: points.slice(i0, i1 + 1), heading: heading.slice(i0, i1 + 1) };
  }
  return { points, heading };
}

/**
 * Proširenje kolovoza u svakoj tački osovine [m].
 *
 * `L² / (2R)`, ograničeno odozgo. Na pravcu je nula, u serpentini oko metar i
 * po po strani. Vidi `CURVE_WIDENING_LENGTH` za razlog zbog kojeg postoji.
 */
export function prosirenja(
  points: readonly Point[],
  heading: readonly number[],
  poluSirine = 0,
): number[] {
  return points.map((p, i) => {
    const prije = points[Math.max(0, i - 1)]!;
    const poslije = points[Math.min(points.length - 1, i + 1)]!;
    const d = Math.hypot(poslije.x - prije.x, poslije.y - prije.y);
    if (d < 1e-6) return 0;
    let du = (heading[Math.min(heading.length - 1, i + 1)] ?? 0) - (heading[Math.max(0, i - 1)] ?? 0);
    while (du > Math.PI) du -= 2 * Math.PI;
    while (du <= -Math.PI) du += 2 * Math.PI;
    const kappa = Math.abs(du) / d;
    if (kappa < 1e-9) return 0;
    const radius = 1 / kappa;
    // Proširenje se ograničava i poluprečnikom: pola kolovoza sa proširenjem ne
    // smije da priđe osi zaokreta, inače se traka prelomi kroz nju.
    const koliko = Math.max(0, radius * CURVE_WIDENING_RADIUS_SHARE - poluSirine);
    return Math.min(
      CURVE_WIDENING_MAX,
      koliko,
      (CURVE_WIDENING_LENGTH * CURVE_WIDENING_LENGTH) / (2 * radius),
    );
  });
}

/**
 * Linija na bočnom odmaku od osovine. `offset > 0` je ulijevo.
 *
 * Odmak raste za proširenje krivine, i to na OBJE strane — kolovoz se u krivini
 * širi, a ne pomjera. Zbog toga i vožnja i crtanje moraju ići kroz ovu funkciju:
 * da traka i asfalt idu iz dva računa, vozilo bi u serpentini vozilo van puta.
 */
export function bocnaLinija(
  points: readonly Point[],
  heading: readonly number[],
  offset: number,
): Point[] {
  const w = prosirenja(points, heading, Math.abs(offset));
  return points.map((p, i) => {
    const ugao = heading[i] ?? 0;
    const odmak = offset === 0 ? 0 : offset + Math.sign(offset) * (w[i] ?? 0);
    return { x: p.x + Math.cos(ugao) * odmak, y: p.y - Math.sin(ugao) * odmak };
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
    const znak = isOncoming(index) ? 1 : -1;
    const linija = bocnaLinija(points, heading, znak * pola);
    // Ivica kolovoza na našoj strani i sama razdjelna linija. Oboje ide kroz
    // `bocnaLinija`, dakle kroz isti račun kao i asfalt koji se crta — u
    // krivini se kolovoz širi, pa fiksno „pola širine trake" ne bi valjalo.
    const ivica = bocnaLinija(points, heading, znak * tpl.geometry.laneWidth);
    const razmak = (a: readonly Point[], b: readonly Point[]): number[] =>
      a.map((p, i) => Math.hypot((b[i]?.x ?? p.x) - p.x, (b[i]?.y ?? p.y) - p.y));
    // Daleka ivica kolovoza — spoljna ivica SUSRETNE trake. Do nje se smije
    // pri preticanju, i tu je kraj poprečnog kretanja ulijevo.
    const preko = bocnaLinija(points, heading, -znak * tpl.geometry.laneWidth);
    const doIvice = razmak(linija, ivica);
    const doSredine = razmak(linija, points);
    const doPreko = razmak(linija, preko);
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
      doIvice: isOncoming(index) ? [...doIvice].reverse() : doIvice,
      doSredine: isOncoming(index) ? [...doSredine].reverse() : doSredine,
      doPreko: isOncoming(index) ? [...doPreko].reverse() : doPreko,
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
