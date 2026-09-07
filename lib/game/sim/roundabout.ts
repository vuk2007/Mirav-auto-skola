/**
 * Kružni tok: putanje kroz prsten i njihovi odnosi.
 *
 * Zašto je ovo zaseban fajl, a ne još jedna grana u `intersection.ts`: prsten
 * je jedina geometrija u igri u kojoj dvije putanje dijele istu dionicu puta.
 * Na krstastoj raskrsnici se putanje SIJEKU u tački, pa se odnos svodi na
 * „ko prvi"; u prstenu se POKLAPAJU na dužini, pa se odnos svodi na „ko je
 * ispred". To su dvije različite stvari i miješanje bi pokvarilo obje.
 *
 * Smjer kruženja je N → W → S → E → N (`RING_ORDER` u `lib/simRules.ts`). U
 * ovom koordinatnom sistemu to znači da ugao OPADA duž kretanja, pa se položaj
 * duž prstena mjeri veličinom `u = (−ugao) · radijus`, koja raste u smjeru
 * vožnje i time dozvoljava obično poređenje brojeva.
 */

import { RING_ORDER, type Approach } from "@/lib/simRules";
import {
  APPROACH_LENGTH,
  ARC_SAMPLES,
  EXIT_LENGTH,
  RING_SPLITTER,
  RING_YIELD_SETBACK,
} from "./config";
import { cumulative, right } from "./geometry";
import type { ArmId, ConflictPoint, Path, Point, RoundaboutTemplate } from "./types";

/** Smjer od centra ka kraku. Isti kao `OUTBOUND` u `intersection.ts`. */
const AXIS: Readonly<Record<ArmId, Point>> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

const TWO_PI = Math.PI * 2;

/** Ugao sveden na [0, 2π). */
function norm2pi(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Položaj duž prstena, mjeren u metrima i rastući u smjeru vožnje.
 *
 * Kretanje ide ka manjem uglu, pa se ugao okreće znakom — time „ispred mene"
 * postaje prosto „veći broj", po modulu obima.
 */
export function ringU(angle: number, radius: number): number {
  return norm2pi(-angle) * radius;
}

export const ringCircumference = (radius: number): number => TWO_PI * radius;

/** Razmak do vozila ispred duž prstena [m]; uvijek nenegativan. */
export function ringGap(uMe: number, uOther: number, radius: number): number {
  const c = ringCircumference(radius);
  return ((uOther - uMe) % c + c) % c;
}

/** Bočni pomak ulazne odnosno izlazne trake od ose kraka [m]. */
export const portOffset = (laneWidth: number): number => laneWidth / 2 + RING_SPLITTER / 2;

/** Tačka na prstenu pod datim uglom. */
const onRing = (angle: number, radius: number): Point => ({
  x: Math.cos(angle) * radius,
  y: Math.sin(angle) * radius,
});

/**
 * Ulazna i izlazna tačka jednog kraka na prstenu.
 *
 * Ulaz je pomjeren udesno od smjera ulaska, izlaz udesno od smjera izlaska —
 * dakle na suprotne strane ose kraka, kao i na krstastoj raskrsnici. Zbog toga
 * ulaz pada malo IZA centra kraka gledano u smjeru kruženja, a izlaz malo
 * ispred, što je i stvarni raspored.
 */
export function ringPorts(
  tpl: RoundaboutTemplate,
  arm: ArmId,
): { enter: Point; leave: Point; enterAngle: number; leaveAngle: number } {
  const out = AXIS[arm];
  const inb = { x: -out.x, y: -out.y };
  const off = portOffset(tpl.geometry.laneWidth);
  // Rastojanje po osi kraka na kojem tačka sa bočnim pomakom `off` pada tačno
  // na kružnicu poluprečnika `radius`.
  const d = Math.sqrt(Math.max(0.01, tpl.radius * tpl.radius - off * off));
  const sideIn = right(inb);
  const sideOut = right(out);
  const enter = { x: out.x * d + sideIn.x * off, y: out.y * d + sideIn.y * off };
  const leave = { x: out.x * d + sideOut.x * off, y: out.y * d + sideOut.y * off };
  return {
    enter,
    leave,
    enterAngle: Math.atan2(enter.y, enter.x),
    leaveAngle: Math.atan2(leave.y, leave.x),
  };
}

/** Krak koji se dostiže poslije `n` izlaza, računato od kraka ulaska. */
export function exitArmFor(arm: ArmId, n: number): ArmId {
  const i = RING_ORDER.indexOf(arm as Approach);
  return RING_ORDER[(i + n) % RING_ORDER.length] as ArmId;
}

/** Koliko izlaza uopšte ima smisla na ovom šablonu (bez punog kruga preko 4). */
export function exitCountsFor(tpl: RoundaboutTemplate, arm: ArmId): number[] {
  const ima = new Set(tpl.arms.map((a) => a.id));
  const out: number[] = [];
  for (let n = 1; n <= RING_ORDER.length; n++) {
    if (ima.has(exitArmFor(arm, n))) out.push(n);
  }
  return out;
}

/**
 * Putanja kroz kružni tok: prilaz → ulaz u prsten → luk → izlaz.
 *
 * `stopLineS` je linija ustupanja na ulasku u prsten, a `boxExitS` mjesto na
 * kojem se prsten napušta. `prevExitS` je mjesto prethodnog izlaza — po njemu
 * se sudi kad najkasnije mora da se upali desni pokazivač.
 */
export function buildRingPath(tpl: RoundaboutTemplate, arm: ArmId, exitN: number): Path {
  const exitArm = exitArmFor(arm, exitN);
  const ulaz = ringPorts(tpl, arm);
  const izlaz = ringPorts(tpl, exitArm);

  const out = AXIS[arm];
  const inb = { x: -out.x, y: -out.y };
  const off = portOffset(tpl.geometry.laneWidth);
  const sideIn = right(inb);
  const start = {
    x: out.x * (tpl.radius + APPROACH_LENGTH) + sideIn.x * off,
    y: out.y * (tpl.radius + APPROACH_LENGTH) + sideIn.y * off,
  };

  const outAxis = AXIS[exitArm];
  const sideOut = right(outAxis);
  const end = {
    x: outAxis.x * (tpl.radius + EXIT_LENGTH) + sideOut.x * off,
    y: outAxis.y * (tpl.radius + EXIT_LENGTH) + sideOut.y * off,
  };

  // Kretanje ide ka manjem uglu; luk se razvija unazad dok ne stigne do izlaza.
  const a0 = ulaz.enterAngle;
  let a1 = izlaz.leaveAngle;
  while (a1 >= a0) a1 -= TWO_PI;
  // Puni krug: izlaz je na istom kraku, pa razlika ispadne skoro nula.
  if (a0 - a1 < 0.05) a1 -= TWO_PI;

  // Linija ustupanja je uvučena u odnosu na ivicu prstena — vidi
  // `RING_YIELD_SETBACK`. Bez toga vozilo koje ispravno čeka stoji u prstenu.
  const linija = {
    x: ulaz.enter.x - inb.x * RING_YIELD_SETBACK,
    y: ulaz.enter.y - inb.y * RING_YIELD_SETBACK,
  };

  const koraka = Math.max(ARC_SAMPLES, Math.round((ARC_SAMPLES * (a0 - a1)) / (Math.PI / 2)));
  const points: Point[] = [start, linija, ulaz.enter];
  for (let i = 1; i <= koraka; i++) {
    points.push(onRing(a0 + ((a1 - a0) * i) / koraka, tpl.radius));
  }
  points.push(end);

  const cum = cumulative(points);
  const length = cum[cum.length - 1]!;
  const stopS = cum[1]!;
  const ringFrom = cum[2]!;
  const ringTo = cum[cum.length - 2]!;

  // Prethodni izlaz: ugao izlaza kraka koji dolazi prije mog. Za prvi izlaz to
  // je sam ulazak — desni pokazivač se tada traži od ulaska.
  const prethodni = exitN <= 1 ? null : exitArmFor(arm, exitN - 1);
  const prevExitS =
    prethodni === null
      ? ringFrom
      : ringSFromAngle(ringPorts(tpl, prethodni).leaveAngle, a0, a1, ringFrom, ringTo);

  return {
    id: `${tpl.id}:${arm}:exit${exitN}`,
    arm,
    intent: { kind: "exit", n: exitN },
    exitArm,
    points,
    cum,
    length,
    stopLineS: stopS,
    boxEnterS: ringFrom,
    boxExitS: ringTo,
    ring: { from: ringFrom, to: ringTo, angleFrom: a0, angleTo: a1, radius: tpl.radius },
    prevExitS,
  };
}

/** Gdje na putanji leži dati ugao prstena. */
function ringSFromAngle(
  angle: number,
  a0: number,
  a1: number,
  from: number,
  to: number,
): number {
  let a = angle;
  while (a >= a0) a -= TWO_PI;
  while (a < a1) a += TWO_PI;
  const t = (a0 - a) / (a0 - a1);
  return from + (to - from) * Math.min(1, Math.max(0, t));
}

/** Ugao prstena na kojem se vozilo nalazi, ili `null` ako nije u prstenu. */
export function ringAngleAt(path: Path, s: number): number | null {
  const r = path.ring;
  if (!r || s < r.from || s > r.to) return null;
  const t = (s - r.from) / Math.max(1e-6, r.to - r.from);
  return r.angleFrom + (r.angleTo - r.angleFrom) * t;
}

/** Položaj duž prstena, ili `null` ako vozilo nije u njemu. */
export function ringUAt(path: Path, s: number): number | null {
  const a = ringAngleAt(path, s);
  return a === null ? null : ringU(a, path.ring!.radius);
}

/**
 * Konfliktne tačke u kružnom toku.
 *
 * Postoji tačno jedna vrsta: vozilo koje ULAZI presijeca putanju vozila koje je
 * već u prstenu i prolazi preko tog ulaza. Sve ostalo je dijeljenje iste trake
 * i rješava se odstojanjem, ne prvenstvom — zato se ovdje NE traže geometrijski
 * presjeci: dvije putanje kroz prsten se poklapaju na dužini, pa bi ih tražilac
 * presjeka izbrojao na desetine.
 */
export function ringConflicts(tpl: RoundaboutTemplate, paths: Path[]): ConflictPoint[] {
  const out: ConflictPoint[] = [];
  for (const ulazna of paths) {
    const ulaz = ringPorts(tpl, ulazna.arm);
    for (const kruzna of paths) {
      if (kruzna === ulazna || kruzna.arm === ulazna.arm) continue;
      const r = kruzna.ring;
      if (!r) continue;
      // Da li luk tog vozila prelazi preko mog ulaza.
      const sNaLuku = ringSFromAngle(ulaz.enterAngle, r.angleFrom, r.angleTo, r.from, r.to);
      const ugaoTamo = ringAngleAt(kruzna, sNaLuku);
      if (ugaoTamo === null) continue;
      const razlika = Math.abs(norm2pi(ugaoTamo - ulaz.enterAngle));
      if (razlika > 0.02 && razlika < TWO_PI - 0.02) continue; // luk ne stiže do mog ulaza
      out.push({
        pathA: ulazna.id,
        pathB: kruzna.id,
        // Konflikt je na ULASKU u prsten, ne na liniji ustupanja. Linija je
        // mjesto gdje se STAJE; da je i konflikt tamo, vozilo koje uredno čeka
        // iza linije bilo bi prijavljeno da je oduzelo prvenstvo.
        sA: ulazna.boxEnterS,
        sB: sNaLuku,
        kind: "cross",
      });
    }
  }
  return out;
}
