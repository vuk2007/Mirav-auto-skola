/**
 * Šabloni raskrsnica, putanje i konfliktne tačke.
 *
 * Putanje i konflikti se računaju **jednom po šablonu** i keširaju: geometrija
 * ne zavisi ni od scenarija ni od vremena, a računanje presjeka svih parova je
 * jedino skupo mjesto u cijeloj simulaciji.
 */

import {
  APPROACH_LENGTH,
  ARC_SAMPLES,
  EXIT_LENGTH,
  LANE_WIDTH,
} from "./config";
import { cumulative, len, right, scale, segmentIntersection, sub } from "./geometry";
import type {
  Arm,
  ArmId,
  ConflictPoint,
  IntersectionTemplate,
  Intent,
  Path,
  Point,
} from "./types";
import { exitOf } from "@/lib/simRules";

/** Smjer u kojem se vozilo kreće kad ULAZI sa datog kraka (ka centru). */
const INBOUND: Readonly<Record<ArmId, Point>> = {
  N: { x: 0, y: 1 }, // sa sjevera ide na jug
  S: { x: 0, y: -1 },
  E: { x: -1, y: 0 },
  W: { x: 1, y: 0 },
};

/** Smjer u kojem se vozilo kreće kad IZLAZI kroz dati krak (od centra). */
const OUTBOUND: Readonly<Record<ArmId, Point>> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

/**
 * Osa jednog kraka i pomak trake.
 *
 * Vozilo vozi desnom stranom, pa je centar njegove trake pomjeren za pola širine
 * trake udesno od smjera kretanja. Time ulazna i izlazna traka istog kraka
 * ispadnu sa suprotnih strana ose — što je i ispravno.
 */
function laneOffset(heading: Point, laneWidth: number): Point {
  return scale(right(heading), laneWidth / 2);
}

/** Tačka na ivici raskrsnice na datom kraku, u traci datog smjera. */
function boundaryPoint(arm: ArmId, dir: Point, size: number, laneWidth: number): Point {
  const half = size / 2;
  const axis = INBOUND[arm];
  // Ivica raskrsnice na tom kraku: −half u smjeru ulaza (dakle prema kraku).
  const base = scale(axis, -half);
  const off = laneOffset(dir, laneWidth);
  return { x: base.x + off.x, y: base.y + off.y };
}

/** Kvadratna Bézier kriva — luk kroz raskrsnicu. */
function quadratic(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

/**
 * Pravi putanju: prilazna traka → stop-linija → luk kroz raskrsnicu → izlazna
 * traka. Nema slobodnog upravljanja, pa je putanja fiksna po (krak, manevar).
 */
export function buildPath(tpl: IntersectionTemplate, arm: ArmId, intent: Intent): Path {
  const { size, laneWidth } = tpl.geometry;
  const inDir = INBOUND[arm];
  const exitArm = exitOf(arm, intent);
  const outDir = OUTBOUND[exitArm];

  const enter = boundaryPoint(arm, inDir, size, laneWidth);
  const leave = boundaryPoint(exitArm, outDir, size, laneWidth);

  // Prilaz: od tačke udaljene APPROACH_LENGTH do ivice raskrsnice.
  const start = { x: enter.x - inDir.x * APPROACH_LENGTH, y: enter.y - inDir.y * APPROACH_LENGTH };
  // Izlaz: od ivice raskrsnice još EXIT_LENGTH dalje.
  const end = { x: leave.x + outDir.x * EXIT_LENGTH, y: leave.y + outDir.y * EXIT_LENGTH };

  const points: Point[] = [start];

  if (intent === "straight") {
    points.push(enter, leave);
  } else {
    // Kontrolna tačka je presjek dvije tangente — prirodni „ugao" skretanja.
    const ctrl = { x: enter.x + inDir.x * (size / 2), y: enter.y + inDir.y * (size / 2) };
    points.push(enter);
    for (let i = 1; i <= ARC_SAMPLES; i++) {
      points.push(quadratic(enter, ctrl, leave, i / ARC_SAMPLES));
    }
  }
  points.push(end);

  const cum = cumulative(points);
  const length = cum[cum.length - 1]!;

  // `s` na kojem se ulazi u tijelo raskrsnice: to je druga tačka (`enter`).
  const boxEnterS = cum[1]!;
  // `s` na kojem se izlazi: pretposljednja tačka (`leave`).
  const boxExitS = cum[cum.length - 2]!;

  return {
    id: `${tpl.id}:${arm}:${intent}`,
    arm,
    intent,
    exitArm,
    points,
    cum,
    length,
    // Stop-linija je tik pred ivicom raskrsnice.
    stopLineS: boxEnterS,
    boxEnterS,
    boxExitS,
  };
}

/**
 * Konfliktne tačke za par putanja.
 *
 * Dvije vrste:
 *  - `cross` — putanje se geometrijski sijeku;
 *  - `merge` — ulaze u ISTU izlaznu traku (npr. lijevo sa N i desno sa S), pa se
 *    spajaju iako se možda ne sijeku pod uglom.
 *
 * Putanje sa istog kraka se preskaču: one dijele cijelu prilaznu traku, pa bi
 * dале gomilu lažnih presjeka. Vozila u istoj traci rješava držanje odstojanja,
 * ne pravila prvenstva.
 */
export function conflictsBetween(a: Path, b: Path): ConflictPoint[] {
  if (a.id === b.id || a.arm === b.arm) return [];

  const out: ConflictPoint[] = [];

  // Traže se presjeci samo u dijelu putanje kroz raskrsnicu i malo oko nje —
  // prilazne trake različitih krakova se ionako ne dodiruju.
  for (let i = 0; i < a.points.length - 1; i++) {
    for (let j = 0; j < b.points.length - 1; j++) {
      const hit = segmentIntersection(a.points[i]!, a.points[i + 1]!, b.points[j]!, b.points[j + 1]!);
      if (!hit) continue;
      const segA = len(sub(a.points[i + 1]!, a.points[i]!));
      const segB = len(sub(b.points[j + 1]!, b.points[j]!));
      const sA = a.cum[i]! + hit.ta * segA;
      const sB = b.cum[j]! + hit.tb * segB;
      // Više uzastopnih uzoraka luka može dati skoro istu tačku — zadržava se
      // samo prva, inače bi jedan presjek postao deset konflikata.
      if (out.some((c) => Math.abs(c.sA - sA) < 1 && Math.abs(c.sB - sB) < 1)) continue;
      out.push({ pathA: a.id, pathB: b.id, sA, sB, kind: "cross" });
    }
  }

  // Spajanje u istu izlaznu traku — konflikt i kad se putanje ne sijeku.
  if (a.exitArm === b.exitArm && !out.some((c) => c.kind === "merge")) {
    out.push({ pathA: a.id, pathB: b.id, sA: a.boxExitS, sB: b.boxExitS, kind: "merge" });
  }

  return out;
}

// ── Keš po šablonu ──────────────────────────────────────────────────────────

export interface CompiledTemplate {
  template: IntersectionTemplate;
  paths: Map<string, Path>;
  /** Za brzo traženje: id putanje → svi konflikti u kojima učestvuje. */
  conflicts: Map<string, ConflictPoint[]>;
}

const INTENTS: Intent[] = ["straight", "left", "right"];
const cache = new Map<string, CompiledTemplate>();

export function compile(tpl: IntersectionTemplate): CompiledTemplate {
  const hit = cache.get(tpl.id);
  if (hit) return hit;

  const armIds = new Set(tpl.arms.map((a) => a.id));
  const paths = new Map<string, Path>();
  for (const arm of tpl.arms) {
    for (const intent of INTENTS) {
      // Manevar koji vodi na krak kojeg nema (raskrsnica sa tri kraka) ne postoji.
      if (!armIds.has(exitOf(arm.id, intent))) continue;
      const p = buildPath(tpl, arm.id, intent);
      paths.set(p.id, p);
    }
  }

  const conflicts = new Map<string, ConflictPoint[]>();
  const list = [...paths.values()];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      for (const c of conflictsBetween(list[i]!, list[j]!)) {
        // Konflikt se pamti sa obje strane, sa `s` okrenutim kako treba —
        // tako pretraga „šta je meni na putu" nikad ne mora da gleda smjer.
        conflicts.set(c.pathA, [...(conflicts.get(c.pathA) ?? []), c]);
        conflicts.set(c.pathB, [
          ...(conflicts.get(c.pathB) ?? []),
          { pathA: c.pathB, pathB: c.pathA, sA: c.sB, sB: c.sA, kind: c.kind },
        ]);
      }
    }
  }

  const compiled: CompiledTemplate = { template: tpl, paths, conflicts };
  cache.set(tpl.id, compiled);
  return compiled;
}

/** Briše keš — koristi se u testovima da jedan test ne zagadi drugi. */
export function clearCache(): void {
  cache.clear();
}

// ── Šabloni ─────────────────────────────────────────────────────────────────

const arm = (id: ArmId, control: Arm["control"], hasCrosswalk = true): Arm => ({
  id,
  control,
  lanes: 1,
  hasCrosswalk,
});

const BOX = 14; // tijelo raskrsnice [m]
const geometry = { size: BOX, laneWidth: LANE_WIDTH };

export const TEMPLATES: Readonly<Record<string, IntersectionTemplate>> = {
  /** Neregulisana krstasta raskrsnica — pravilo desne strane. */
  "cross-none": {
    id: "cross-none",
    arms: [
      arm("N", { kind: "none" }),
      arm("E", { kind: "none" }),
      arm("S", { kind: "none" }),
      arm("W", { kind: "none" }),
    ],
    geometry,
  },

  /** Glavni put N–S; E i W imaju trougao. */
  "cross-priority-ns": {
    id: "cross-priority-ns",
    arms: [
      arm("N", { kind: "priority" }),
      arm("E", { kind: "yield" }),
      arm("S", { kind: "priority" }),
      arm("W", { kind: "yield" }),
    ],
    priorityRoad: ["N", "S"],
    geometry,
  },

  /** Glavni put N–S; E i W imaju STOP. */
  "cross-stop-ew": {
    id: "cross-stop-ew",
    arms: [
      arm("N", { kind: "priority" }),
      arm("E", { kind: "stop" }),
      arm("S", { kind: "priority" }),
      arm("W", { kind: "stop" }),
    ],
    priorityRoad: ["N", "S"],
    geometry,
  },

  /**
   * Izlomljeni glavni put: ulazi sa sjevera, izlazi na istok. Krakovi S i W su
   * sporedni. Među vozilima NA glavnom putu odlučuje pravilo desne strane —
   * zato oba nose `priority`, pa `whoYields` pada na desnu stranu.
   */
  "cross-priority-bent-ne": {
    id: "cross-priority-bent-ne",
    arms: [
      arm("N", { kind: "priority" }),
      arm("E", { kind: "priority" }),
      arm("S", { kind: "yield" }),
      arm("W", { kind: "yield" }),
    ],
    priorityRoad: ["N", "E"],
    geometry,
  },

  /** Semafor: N–S i E–W naizmjenično. */
  "cross-lights": {
    id: "cross-lights",
    arms: [
      arm("N", { kind: "light", phaseGroup: "NS" }),
      arm("E", { kind: "light", phaseGroup: "EW" }),
      arm("S", { kind: "light", phaseGroup: "NS" }),
      arm("W", { kind: "light", phaseGroup: "EW" }),
    ],
    lightProgram: [
      { green: ["NS"], duration: 12 },
      { green: [], yellow: ["NS"], duration: 3 },
      { green: ["EW"], duration: 12 },
      { green: [], yellow: ["EW"], duration: 3 },
    ],
    geometry,
  },
};

/** Koje svjetlo ima grupa u datoj fazi. */
export function lightFor(
  tpl: IntersectionTemplate,
  phaseIndex: number,
  group: string,
): "green" | "yellow" | "red" {
  const phase = tpl.lightProgram?.[phaseIndex];
  if (!phase) return "red";
  if (phase.green.includes(group)) return "green";
  if (phase.yellow?.includes(group)) return "yellow";
  return "red";
}
