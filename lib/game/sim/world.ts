/**
 * Jezgro simulacije: fiksni korak, fizika, NPC logika, prekršaji.
 *
 * FIKSNI KORAK (60 Hz) je uslov, ne stil. Bez njega ista igra na 144 Hz ekranu
 * i na 60 Hz ekranu daje različit ishod, pa ni snimak ni test ne znače ništa.
 * Render interpolira između koraka; simulacija ne zna za `requestAnimationFrame`.
 *
 * Stanje je običan objekat. Nema React-a, nema klasa, nema skrivenih referenci —
 * `structuredClone(world)` je valjan snimak za ponavljanje.
 */

import {
  A_MAX,
  B_MAX,
  CAR_LENGTH,
  CAR_WIDTH,
  CLEAR_TIME,
  CRAWL_SPEED,
  DRAG_COEFF,
  DT,
  FOLLOW_GAP,
  GAP,
  MAX_SCENARIO_SECONDS,
  OBSTRUCTION_TIMEOUT,
  ROLL_RESISTANCE,
  SPEEDING_FACTOR,
  STOPPED_SPEED,
  STOP_DWELL,
  STOP_HOLD,
  STOP_MARGIN,
  STOP_ZONE,
  TTC_THRESHOLD,
  V_MAX_DEFAULT,
  V_TOP,
  YELLOW_COMMIT_TTC,
} from "./config";
import { headingAt, pointAt, polygonsOverlap, rectCorners, rng } from "./geometry";
import { compile, lightFor, TEMPLATES } from "./intersection";
import type {
  ArmId,
  ConflictPoint,
  Control,
  Input,
  IntersectionTemplate,
  Path,
  Scenario,
  Vehicle,
  Violation,
  World,
} from "./types";
import { whoYields, type EffectiveControl, type YieldParty } from "@/lib/simRules";

export const PLAYER_ID = "player";

/** Veza prekršaja i stavke iz kataloga kazni (`data/kazne.json`). */
const PENALTY_REF: Readonly<Record<Violation["type"], string | null>> = {
  rightOfWay: "prvenstvo",
  stopSign: "signalizacija",
  redLight: "crveno",
  collision: "nezgoda",
  obstruction: "ometanje-vozaca",
  speeding: null, // stepenovano po brzini — bira se tek kad kazne budu potvrđene
};

// ── pomoćne ────────────────────────────────────────────────────────────────

function controlToEffective(
  control: Control,
  tpl: IntersectionTemplate,
  phaseIndex: number,
): EffectiveControl {
  switch (control.kind) {
    case "light":
      return lightFor(tpl, phaseIndex, control.phaseGroup);
    case "officer":
      // Znaci policajca nijesu podržani u engine-u — vidi lib/simRules.ts.
      return "none";
    default:
      return control.kind;
  }
}

function armControl(tpl: IntersectionTemplate, armId: ArmId, phaseIndex: number): EffectiveControl {
  const a = tpl.arms.find((x) => x.id === armId);
  return a ? controlToEffective(a.control, tpl, phaseIndex) : "none";
}

function party(v: Vehicle, tpl: IntersectionTemplate, phaseIndex: number): YieldParty {
  return { approach: v.arm, intent: v.intent, control: armControl(tpl, v.arm, phaseIndex) };
}

/** Koliko sekundi vozilu treba da stigne do `s`; `Infinity` ako stoji. */
function timeTo(v: Vehicle, s: number): number {
  const d = s - v.s;
  if (d <= 0) return 0;
  return v.v > 0.05 ? d / v.v : Infinity;
}

/** Da li je vozilo trenutno u tijelu raskrsnice. */
function inBox(v: Vehicle, path: Path): boolean {
  return v.s >= path.boxEnterS && v.s <= path.boxExitS;
}

// ── stvaranje svijeta ───────────────────────────────────────────────────────

export function createWorld(scenario: Scenario, seed: number): World {
  const tpl = TEMPLATES[scenario.intersection];
  if (!tpl) throw new Error(`Nepoznata raskrsnica: ${scenario.intersection}`);
  const { paths } = compile(tpl);

  const pathId = (arm: ArmId, intent: Vehicle["intent"]) => `${tpl.id}:${arm}:${intent}`;
  const need = (id: string): Path => {
    const p = paths.get(id);
    if (!p) throw new Error(`Nema putanje ${id} — provjeri krakove šablona.`);
    return p;
  };

  const playerPath = need(pathId(scenario.player.arm, scenario.player.intent));
  const vehicles: Vehicle[] = [
    {
      id: PLAYER_ID,
      kind: "player",
      pathId: playerPath.id,
      s: Math.max(0, playerPath.stopLineS - scenario.player.spawnDistance),
      v: 0,
      length: CAR_LENGTH,
      width: CAR_WIDTH,
      intent: scenario.player.intent,
      arm: scenario.player.arm,
      indicator: scenario.player.intent === "straight" ? null : scenario.player.intent,
      stopHeld: 0,
      done: false,
      spawnT: 0,
    },
  ];

  // Vrijeme nastanka NPC-a se bira po sjemenu — isto sjeme, isti scenario,
  // ista simulacija. Bez toga nema ni ponavljanja snimka ni testova.
  const rand = rng(seed);
  scenario.npcs.forEach((n, i) => {
    const p = need(pathId(n.arm, n.intent));
    const [lo, hi] = n.spawnAt;
    const t = lo + rand() * (hi - lo);
    vehicles.push({
      id: `npc${i + 1}`,
      kind: "npc",
      pathId: p.id,
      s: 0,
      v: n.speed,
      length: CAR_LENGTH,
      width: CAR_WIDTH,
      intent: n.intent,
      arm: n.arm,
      indicator: n.intent === "straight" ? null : n.intent,
      stopHeld: 0,
      done: false,
      spawnT: t,
    });
  });

  return {
    t: 0,
    scenarioId: scenario.id,
    templateId: tpl.id,
    vehicles,
    phaseIndex: scenario.lightStartPhase ?? 0,
    phaseT: 0,
    events: [],
    violations: [],
    outcome: "running",
    idleT: 0,
    yellowCommitted: false,
  };
}

// ── jedan korak ─────────────────────────────────────────────────────────────

interface Ctx {
  tpl: IntersectionTemplate;
  paths: Map<string, Path>;
  conflicts: Map<string, ConflictPoint[]>;
  vMax: number;
}

function ctxFor(world: World, scenario: Scenario): Ctx {
  const tpl = TEMPLATES[world.templateId]!;
  const c = compile(tpl);
  return { tpl, paths: c.paths, conflicts: c.conflicts, vMax: scenario.vMax ?? V_MAX_DEFAULT };
}

/**
 * Koliko `s` NPC smije da dostigne prije nego što mora da stane.
 * `Infinity` znači „put je slobodan".
 */
function npcTarget(world: World, ctx: Ctx, me: Vehicle, mePath: Path): number {
  let limit = Infinity;

  // STOP znak: potpuno zaustavljanje na liniji, pa nastavak po pravilima.
  const control = armControl(ctx.tpl, me.arm, world.phaseIndex);
  // Cilja se ISPRED linije, ne na nju — vidi `STOP_MARGIN`.
  if (control === "stop" && me.stopHeld < STOP_DWELL && me.s < mePath.stopLineS) {
    limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }
  if ((control === "red" || control === "yellow") && me.s < mePath.stopLineS) {
    limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }

  // Vozilo ispred u istoj traci.
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.pathId !== me.pathId || o.s <= me.s) continue;
    limit = Math.min(limit, o.s - o.length - FOLLOW_GAP);
  }

  // Prvenstvo na konfliktnim tačkama.
  for (const c of ctx.conflicts.get(mePath.id) ?? []) {
    if (c.sA < me.s) continue; // konflikt je iza nas
    for (const o of world.vehicles) {
      if (o.id === me.id || o.done || world.t < o.spawnT) continue;
      if (o.pathId !== c.pathB) continue;

      const oPath = ctx.paths.get(o.pathId)!;
      const decision = whoYields(
        party(me, ctx.tpl, world.phaseIndex),
        party(o, ctx.tpl, world.phaseIndex),
      );
      if (decision !== "a") continue; // ja imam prednost ili se ne tičemo

      // Ustupa se ako je drugi već u raskrsnici, ili bi stigao prije nego što
      // ja stignem da očistim konfliktnu tačku. Sam `TTC_THRESHOLD` nije
      // dovoljan — vidi `CLEAR_TIME`.
      const oPast = o.s > c.sB + o.length;
      if (oPast) continue;
      const tMe = timeTo(me, c.sA);
      const tThem = timeTo(o, c.sB);
      const oNear = inBox(o, oPath) || tThem < Math.max(TTC_THRESHOLD, tMe + CLEAR_TIME);
      if (oNear) limit = Math.min(limit, c.sA - GAP);
    }
  }

  return limit;
}

/** Ubrzanje kojim se stiže do `limit` i tu staje, ograničeno na [−B_MAX, A_MAX]. */
function accelToward(v: Vehicle, limit: number, vMax: number): number {
  if (limit === Infinity) {
    return v.v < vMax ? A_MAX : 0;
  }
  const d = limit - v.s;
  if (d <= 0) return -B_MAX;
  // v² = 2·a·d  →  a potrebno da se stane tačno na `limit`.
  const need = (v.v * v.v) / (2 * Math.max(d, 0.01));
  if (need >= B_MAX) return -B_MAX;
  if (need > A_MAX * 0.5) return -need;
  return v.v < vMax ? A_MAX : 0;
}

/**
 * Brzina se steže na ono što vozilo MOŽE (`V_TOP`), ne na ono što SMIJE.
 * Zbog toga prekoračenje uopšte može da se desi i da se prijavi.
 */
function integrate(v: Vehicle, a: number): void {
  const drag = DRAG_COEFF * v.v + (v.v > 0.01 ? ROLL_RESISTANCE : 0);
  const acc = a - (a > 0 ? drag : 0);
  v.v = Math.max(0, Math.min(V_TOP, v.v + acc * DT));
  v.s += v.v * DT;
}

/** Jedan korak simulacije. Mijenja `world` na mjestu. */
export function step(world: World, scenario: Scenario, input: Input): void {
  if (world.outcome !== "running") return;
  const ctx = ctxFor(world, scenario);

  // ── semafor ───────────────────────────────────────────────────────────────
  const program = ctx.tpl.lightProgram;
  if (program && program.length > 0) {
    const before = armControl(ctx.tpl, scenario.player.arm, world.phaseIndex);
    world.phaseT += DT;
    const dur = program[world.phaseIndex]!.duration;
    if (world.phaseT >= dur) {
      world.phaseT -= dur;
      world.phaseIndex = (world.phaseIndex + 1) % program.length;
    }
    const after = armControl(ctx.tpl, scenario.player.arm, world.phaseIndex);
    // Trenutak kad se upali žuto: ako je igrač bio preblizu liniji da bezbjedno
    // stane, prolazak mu se ne računa kao prekršaj.
    if (before === "green" && after === "yellow") {
      const p = world.vehicles.find((x) => x.id === PLAYER_ID)!;
      const path = ctx.paths.get(p.pathId)!;
      world.yellowCommitted = timeTo(p, path.stopLineS) < YELLOW_COMMIT_TTC;
    }
    if (after === "green") world.yellowCommitted = false;
  }

  const player = world.vehicles.find((x) => x.id === PLAYER_ID)!;
  const playerPath = ctx.paths.get(player.pathId)!;
  const playerBefore = player.s;

  // ── kretanje ──────────────────────────────────────────────────────────────
  for (const v of world.vehicles) {
    if (v.done || world.t < v.spawnT) continue;
    const path = ctx.paths.get(v.pathId)!;

    if (v.kind === "player") {
      const a = input.throttle * A_MAX - input.brake * B_MAX;
      integrate(v, a);
    } else {
      const limit = npcTarget(world, ctx, v, path);
      const a = accelToward(v, limit, ctx.vMax);
      // Naglo kočenje zbog igrača je događaj, ne samo usporenje — po njemu se
      // prepoznaje oduzeta prednost i kad do sudara ne dođe.
      if (a <= -B_MAX + 1e-6 && v.v > 1) {
        const culprit = blamePlayer(world, ctx, v, path, player, playerPath);
        if (culprit) {
          world.events.push({ type: "forcedBrake", t: world.t, vehicleId: v.id, by: PLAYER_ID });
        }
      }
      integrate(v, a);
    }

    // Zaustavljanje na STOP liniji se broji samo dok je vozilo pred njom.
    if (v.v < STOPPED_SPEED && v.s < path.stopLineS && v.s > path.stopLineS - STOP_ZONE) {
      v.stopHeld += DT;
    }

    if (v.s >= path.length) {
      v.done = true;
      world.events.push({ type: "exit", t: world.t, vehicleId: v.id });
    }
  }

  detectViolations(world, ctx, scenario, player, playerPath, playerBefore);

  world.t += DT;

  if (world.outcome === "running") {
    if (player.done) {
      world.outcome = world.violations.length === 0 ? "passed" : "failed";
    } else if (world.t > MAX_SCENARIO_SECONDS) {
      world.outcome = "failed";
    }
  }
}

/** Da li je NPC zakočio baš zbog igrača (a ne zbog drugog NPC-a). */
function blamePlayer(
  world: World,
  ctx: Ctx,
  npc: Vehicle,
  npcPath: Path,
  player: Vehicle,
  playerPath: Path,
): boolean {
  for (const c of ctx.conflicts.get(npcPath.id) ?? []) {
    if (c.pathB !== playerPath.id || c.sA < npc.s) continue;
    const playerNear = inBox(player, playerPath) || timeTo(player, c.sB) < TTC_THRESHOLD;
    if (!playerNear) continue;
    // Kriv je samo ako je NPC imao prednost.
    const decision = whoYields(
      party(npc, ctx.tpl, world.phaseIndex),
      party(player, ctx.tpl, world.phaseIndex),
    );
    if (decision === "b") return true;
  }
  return false;
}

// ── prekršaji ───────────────────────────────────────────────────────────────

function add(world: World, v: Omit<Violation, "penaltyRef">): void {
  if (world.violations.some((x) => x.type === v.type)) return; // jedan po vrsti
  world.violations.push({ ...v, penaltyRef: PENALTY_REF[v.type] });
}

function detectViolations(
  world: World,
  ctx: Ctx,
  scenario: Scenario,
  player: Vehicle,
  path: Path,
  sBefore: number,
): void {
  if (player.done) return;
  const control = armControl(ctx.tpl, player.arm, world.phaseIndex);
  const crossedStopLine = sBefore < path.stopLineS && player.s >= path.stopLineS;

  // ── STOP znak ─────────────────────────────────────────────────────────────
  if (crossedStopLine && control === "stop" && player.stopHeld < STOP_HOLD) {
    add(world, {
      type: "stopSign",
      t: world.t,
      details: `Prošao stop-liniju bez zaustavljanja (stajao ${player.stopHeld.toFixed(2)} s).`,
    });
  }

  // ── crveno svjetlo ────────────────────────────────────────────────────────
  if (crossedStopLine && (control === "red" || (control === "yellow" && !world.yellowCommitted))) {
    add(world, {
      type: "redLight",
      t: world.t,
      details: control === "red" ? "Ušao na crveno svjetlo." : "Ušao na žuto, a mogao je stati.",
    });
    world.outcome = "failed";
  }

  // ── sudar ─────────────────────────────────────────────────────────────────
  const pPos = pointAt(path.points, path.cum, player.s);
  const pHead = headingAt(path.points, path.cum, player.s);
  const pRect = rectCorners(pPos, pHead, player.length, player.width);
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId)!;
    const oPos = pointAt(oPath.points, oPath.cum, o.s);
    const oHead = headingAt(oPath.points, oPath.cum, o.s);
    if (polygonsOverlap(pRect, rectCorners(oPos, oHead, o.length, o.width))) {
      add(world, { type: "collision", t: world.t, details: "Sudar.", otherVehicleId: o.id });
      world.outcome = "failed";
      return;
    }
  }

  // ── oduzeto prvenstvo ─────────────────────────────────────────────────────
  const forced = world.events.find((e) => e.type === "forcedBrake" && e.by === PLAYER_ID);
  if (forced && forced.type === "forcedBrake") {
    add(world, {
      type: "rightOfWay",
      t: world.t,
      details: "Vozilo koje ima prednost moralo je naglo da koči.",
      otherVehicleId: forced.vehicleId,
    });
    world.outcome = "failed";
    return;
  }

  for (const c of ctx.conflicts.get(path.id) ?? []) {
    if (player.s < c.sA - 1 || player.s > c.sA + player.length) continue; // nije u zoni
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.pathId !== c.pathB) continue;
      if (o.s > c.sB + o.length) continue; // već prošao
      const decision = whoYields(
        party(player, ctx.tpl, world.phaseIndex),
        party(o, ctx.tpl, world.phaseIndex),
      );
      if (decision !== "a") continue;
      if (timeTo(o, c.sB) < TTC_THRESHOLD || inBox(o, ctx.paths.get(o.pathId)!)) {
        add(world, {
          type: "rightOfWay",
          t: world.t,
          details: "Ušao u raskrsnicu ispred vozila koje ima prednost.",
          otherVehicleId: o.id,
        });
        world.outcome = "failed";
        return;
      }
    }
  }

  // ── zadržavanje saobraćaja ────────────────────────────────────────────────
  // Tajmer teče SAMO kad je put stvarno slobodan: ne smije da kazni ispravno
  // čekanje dok vozilo kojem se ustupa još prelazi raskrsnicu.
  const blocked = pathBlocked(world, ctx, player, path);
  if (player.v < CRAWL_SPEED && !blocked && control !== "red" && control !== "yellow") {
    world.idleT += DT;
    if (world.idleT > OBSTRUCTION_TIMEOUT) {
      add(world, {
        type: "obstruction",
        t: world.t,
        details: `Stajao ${OBSTRUCTION_TIMEOUT} s na slobodnom putu i zadržavao saobraćaj.`,
      });
    }
  } else {
    world.idleT = 0;
  }

  // ── prekoračenje brzine ───────────────────────────────────────────────────
  if (player.v > ctx.vMax * SPEEDING_FACTOR) {
    add(world, {
      type: "speeding",
      t: world.t,
      details: `Brzina ${(player.v * 3.6).toFixed(0)} km/h iznad dozvoljene.`,
    });
  }
}

/**
 * Da li igrač ima razlog da stoji: neko kome mora ustupiti nailazi, ili neko
 * fizički zauzima konfliktnu tačku na njegovoj putanji.
 */
function pathBlocked(world: World, ctx: Ctx, player: Vehicle, path: Path): boolean {
  for (const c of ctx.conflicts.get(path.id) ?? []) {
    if (c.sA < player.s) continue;
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.pathId !== c.pathB) continue;
      if (o.s > c.sB + o.length) continue;

      const oPath = ctx.paths.get(o.pathId)!;
      // Vozilo koje trenutno zauzima konfliktnu tačku blokira bez obzira na to
      // ko ima prednost — čekanje da prođe nije zadržavanje saobraćaja.
      if (Math.abs(o.s - c.sB) < o.length + GAP) return true;
      if (inBox(o, oPath)) return true;

      const decision = whoYields(
        party(player, ctx.tpl, world.phaseIndex),
        party(o, ctx.tpl, world.phaseIndex),
      );
      if (decision === "a" && timeTo(o, c.sB) < TTC_THRESHOLD) return true;
    }
  }
  return false;
}

// ── pomoć za render i testove ───────────────────────────────────────────────

export function vehiclePose(world: World, v: Vehicle): { pos: { x: number; y: number }; heading: { x: number; y: number } } {
  const tpl = TEMPLATES[world.templateId]!;
  const path = compile(tpl).paths.get(v.pathId)!;
  return {
    pos: pointAt(path.points, path.cum, v.s),
    heading: headingAt(path.points, path.cum, v.s),
  };
}
