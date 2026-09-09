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
  DIFFICULTY,
  GAP,
  HIGHWAY_BRAKE,
  HARD_SHOULDER_TIME,
  HIGHWAY_DRAG,
  HIGHWAY_FOLLOW_TIME,
  HIGHWAY_V_TOP,
  INDICATOR_LEAD_TIME,
  LANE_CHANGE_TIME,
  MERGE_AHEAD_TIME,
  MERGE_GAP_TIME,
  RAMP_STOP_SPEED,
  TAILGATE_GAP,
  TAILGATE_SPEED,
  TAILGATE_TIME,
  TOO_SLOW_TIME,
  HAZARD_WINDOW,
  MAX_SCENARIO_SECONDS,
  ROLL_RESISTANCE,
  SPEEDING_FACTOR,
  STOPPED_SPEED,
  STOP_DWELL,
  STOP_HOLD,
  STOP_MARGIN,
  STOP_ZONE,
  type DifficultyParams,
  ROAD_V_TOP_FACTOR,
  TRIP_SEGMENT_TIME,
  TRIP_SEGMENT_TIMEOUT_FACTOR,
  V_MAX_DEFAULT,
  V_TOP,
  YELLOW_COMMIT_TTC,
} from "./config";
import { headingAt, pointAt, polygonsOverlap, rectCorners, rng } from "./geometry";
import {
  compile,
  crosswalkSpans,
  lightFor,
  pedestrianOnRoad,
  pedestrianSpan,
  registerTemplate,
  templateById,
  TEMPLATES,
} from "./intersection";
import { expectedIndicatorAt, phasesFor } from "./indicatorRules";
import {
  lanePathId,
  lateralX,
  occupiedLanes,
  onExitLane,
  onRamp,
  shareLane,
} from "./highway";
import { ringAngleAt, ringGap, ringUAt } from "./roundabout";
import type {
  ArmId,
  ConflictPoint,
  Control,
  IndicatorEvent,
  Input,
  Intent,
  Path,
  Pedestrian,
  Point,
  Scenario,
  HighwayTemplate,
  ScenarioHazard,
  ScenarioOfficer,
  Severity,
  Template,
  Vehicle,
  Violation,
  World,
} from "./types";
import { bezKrakova, crossIntent } from "./types";
import { whoYields, type EffectiveControl, type YieldParty } from "@/lib/simRules";

export const PLAYER_ID = "player";

/**
 * Veza prekršaja i stavke iz kataloga kazni (`data/kazne.json`).
 *
 * Izvezeno zbog testa: pogrešan slug se ne primijeti nikako drugačije — kartica
 * kazne bi jednostavno ostala prazna i onda kad instruktorka kaznu potvrdi.
 */
export const PENALTY_REF: Readonly<Record<Violation["type"], string | null>> = {
  rightOfWay: "prvenstvo",
  stopSign: "signalizacija",
  redLight: "crveno",
  collision: "nezgoda",
  obstruction: "ometanje-vozaca",
  speeding: null, // stepenovano po brzini — bira se tek kad kazne budu potvrđene
  pedestrian: "pjesacki-prelaz",
  officer: "policija",
  // Propust oko pokazivača spada pod nepropisno skretanje — najbliža stavka u
  // katalogu. Kad instruktorka potvrdi tačan član, mijenja se ovdje.
  indicatorMissing: "skretanje",
  indicatorWrong: "skretanje",
  indicatorLate: "skretanje",
  indicatorLeftOn: "skretanje",
  // Autoput: najbliže stavke iz kataloga. Kad instruktorka potvrdi tačne
  // članove, mijenja se ovdje.
  unsafeMerge: "preticanje",
  stoppedOnRamp: "autoput",
  hardShoulder: "autoput",
  tooSlow: "autoput",
  tailgating: "autoput",
  brakingOnHighway: "autoput",
};

/** Ključ manevra u id-u putanje. Kružni tok i autoput dodaju svoje oblike. */
export function intentKey(intent: Intent): string {
  if (typeof intent === "string") return intent;
  return intent.kind === "exit" ? `exit${intent.n}` : `lane${intent.index}`;
}

/** Da li vožnja pada. `minor` prekršaji se prijave, ali vožnju ne obaraju. */
export function hasFail(world: World): boolean {
  return world.violations.some((v) => v.severity === "fail");
}

// ── pomoćne ────────────────────────────────────────────────────────────────

function controlToEffective(
  control: Control,
  tpl: Template,
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

/**
 * Regulacija kraka, uz naredbu policajca ako je ima.
 *
 * Policajac poništava i znak i semafor — zato se provjerava prvi i zato se
 * `tpl` uopšte ne gleda kad je prisutan. Semafor i dalje radi svoj program i
 * dalje se crta; samo prestaje da odlučuje.
 */
function armControl(ctx: Regulacija, armId: ArmId, phaseIndex: number): EffectiveControl {
  if (ctx.officerAllow) return ctx.officerAllow.includes(armId) ? "green" : "red";
  // Ni autoput ni otvoren put nemaju regulisane krakove — tamo prvenstvo
  // uopšte ne odlučuje.
  if (bezKrakova(ctx.tpl)) return "none";
  const a = ctx.tpl.arms.find((x) => x.id === armId);
  return a ? controlToEffective(a.control, ctx.tpl, phaseIndex) : "none";
}

/** Ono što je za odluku o prvenstvu dovoljno znati o raskrsnici. */
interface Regulacija {
  tpl: Template;
  /** Krakovi koje policajac trenutno propušta; `null` kad policajca nema. */
  officerAllow: ArmId[] | null;
}

function party(ctx: Ctx, v: Vehicle, phaseIndex: number): YieldParty {
  const path = ctx.paths.get(v.pathId);
  return {
    approach: v.arm,
    // Kružni tok se ne opisuje manevrom nego time da li je vozilo već u prstenu;
    // manevar se zato svodi na „pravo" i ne učestvuje u odluci.
    intent: crossIntent(v.intent) ?? "straight",
    control: armControl(ctx, v.arm, phaseIndex),
    emergency: v.emergency,
    inRing: path ? ringAngleAt(path, v.s) !== null : false,
  };
}

/**
 * Koje krakove policajac propušta u trenutku `t`.
 *
 * Čista funkcija vremena: naredba se ponavlja ciklično i ne pamti se u stanju
 * svijeta. Zato snimak i ponavljanje ne moraju da nose nijedno dodatno polje.
 */
export function officerAllow(officer: ScenarioOfficer | undefined, t: number): ArmId[] | null {
  if (!officer || officer.phases.length === 0) return null;
  const ciklus = officer.phases.reduce((a, f) => a + f.duration, 0);
  if (ciklus <= 0) return officer.phases[0]!.allow;
  let x = t % ciklus;
  for (const faza of officer.phases) {
    if (x < faza.duration) return faza.allow;
    x -= faza.duration;
  }
  return officer.phases[officer.phases.length - 1]!.allow;
}

/**
 * Gdje je vozilo u svijetu.
 *
 * Na autoputu se bočni položaj ne čita iz putanje nego iz trake: putanja je
 * osa ciljne trake, a vozilo se u toku prelaska nalazi između dvije.
 */
export function poseOn(
  tpl: Template,
  path: Path,
  v: Vehicle,
): { pos: Point; heading: Point } {
  if (tpl.kind === "highway") {
    return {
      pos: { x: lateralX(v.lane ?? 0, v.laneFrom, v.laneT ?? 1), y: v.s },
      heading: { x: 0, y: 1 },
    };
  }
  // Na otvorenom putu je svaka traka svoja putanja i ona je kriva, pa se
  // položaj čita iz nje, a ne iz bočnog pomaka kao na autoputu.
  return {
    pos: pointAt(path.points, path.cum, v.s),
    heading: headingAt(path.points, path.cum, v.s),
  };
}

/** Trake koje vozilo zauzima; van autoputa je to prazan spisak. */
const trake = (v: Vehicle): number[] =>
  v.lane === undefined ? [] : occupiedLanes(v.lane, v.laneFrom, v.laneT ?? 1);

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
  const tpl = scenario.template ?? TEMPLATES[scenario.intersection];
  if (!tpl) throw new Error(`Nepoznata raskrsnica: ${scenario.intersection}`);
  // Napravljeni šablon mora biti dostupan i po `id`-u — vidi `templateById`.
  if (scenario.template) registerTemplate(scenario.template);
  const { paths } = compile(tpl);

  const pathId = (arm: ArmId, intent: Intent) => `${tpl.id}:${arm}:${intentKey(intent)}`;
  const need = (id: string): Path => {
    const p = paths.get(id);
    if (!p) throw new Error(`Nema putanje ${id} — provjeri krakove šablona.`);
    return p;
  };

  const jeAutoput = bezKrakova(tpl);
  const trakaIz = (intent: Intent): number | undefined =>
    typeof intent !== "string" && intent.kind === "lane" ? intent.index : undefined;

  const playerPath = need(
    jeAutoput
      ? lanePathId(tpl.id, trakaIz(scenario.player.intent) ?? 0)
      : pathId(scenario.player.arm, scenario.player.intent),
  );
  const vehicles: Vehicle[] = [
    {
      id: PLAYER_ID,
      kind: "player",
      pathId: playerPath.id,
      s: jeAutoput
        ? (scenario.player.startS ?? 0)
        : Math.max(0, playerPath.stopLineS - scenario.player.spawnDistance),
      v: jeAutoput ? (scenario.player.startV ?? 0) : 0,
      length: CAR_LENGTH,
      width: CAR_WIDTH,
      intent: scenario.player.intent,
      arm: scenario.player.arm,
      // Pokazivač igrača je od sada KOMANDA, ne posljedica namjere — počinje
      // ugašen i pali ga igrač.
      indicator: null,
      stopHeld: 0,
      done: false,
      spawnT: 0,
      lane: jeAutoput ? (trakaIz(scenario.player.intent) ?? 0) : undefined,
      laneT: 1,
    },
  ];

  // Vrijeme nastanka NPC-a se bira po sjemenu — isto sjeme, isti scenario,
  // ista simulacija. Bez toga nema ni ponavljanja snimka ni testova.
  const rand = rng(seed);
  scenario.npcs.forEach((n, i) => {
    const p = need(jeAutoput ? lanePathId(tpl.id, trakaIz(n.intent) ?? 0) : pathId(n.arm, n.intent));
    const [lo, hi] = n.spawnAt;
    const t = lo + rand() * (hi - lo);
    vehicles.push({
      id: `npc${i + 1}`,
      kind: "npc",
      pathId: p.id,
      s: n.startS ?? 0,
      v: n.speed,
      length: CAR_LENGTH,
      width: CAR_WIDTH,
      intent: n.intent,
      arm: n.arm,
      // NPC su idealni vozači: pokazivač im vodi ista tabela po kojoj se sudi
      // igraču, pa uz put i pokazuju kako treba.
      indicator: expectedIndicatorAt(p, n.intent, 0),
      stopHeld: 0,
      done: false,
      spawnT: t,
      emergency: n.emergency,
      lane: jeAutoput ? (trakaIz(n.intent) ?? 0) : undefined,
      laneT: 1,
      cruise: jeAutoput ? n.speed : undefined,
    });
  });

  // Pješaci kreću sa trotoara i idu poprečno preko kolovoza.
  const pedestrians: Pedestrian[] = (scenario.pedestrians ?? []).map((ped, i) => {
    const [lo, hi] = ped.spawnAt;
    const span = pedestrianSpan(tpl, ped.arm);
    return {
      id: `ped${i + 1}`,
      arm: ped.arm,
      u: -ped.dir * span,
      dir: ped.dir,
      speed: ped.speed,
      spawnT: lo + rand() * (hi - lo),
      done: false,
    };
  });

  return {
    t: 0,
    scenarioId: scenario.id,
    templateId: tpl.id,
    vehicles,
    pedestrians,
    phaseIndex: scenario.lightStartPhase ?? 0,
    phaseT: scenario.lightStartT ?? 0,
    events: [],
    violations: [],
    outcome: "running",
    idleT: 0,
    yellowCommitted: false,
    indicatorLog: [],
    indicatorDone: [],
    hazardsFired: [],
    reaction: [],
    highway: { tooSlowT: 0, tailgateT: 0, shoulderT: 0 },
  };
}

// ── jedan korak ─────────────────────────────────────────────────────────────

/** Granica dokle se smije stići i brzina onoga ko je postavlja. */
interface Target {
  limit: number;
  vLead: number;
}

interface Ctx extends Regulacija {
  paths: Map<string, Path>;
  conflicts: Map<string, ConflictPoint[]>;
  vMax: number;
  /** Najveća brzina koju vozilo može da razvije [m/s] — nije isto što i propis. */
  vTop: number;
  drag: number;
  /** Parametri težine za nivo ovog scenarija. */
  dif: DifficultyParams;
}

function ctxFor(world: World, scenario: Scenario): Ctx {
  const tpl = scenario.template ?? templateById(world.templateId)!;
  const c = compile(tpl);
  return {
    tpl,
    officerAllow: officerAllow(scenario.officer, world.t),
    paths: c.paths,
    conflicts: c.conflicts,
    vMax: bezKrakova(tpl) ? tpl.vMax : (scenario.vMax ?? V_MAX_DEFAULT),
    // Gradski `V_TOP` je ispod dozvoljene brzine na magistrali, pa bi na
    // otvorenom putu ograničenje bilo nedostižno — vidi `ROAD_V_TOP_FACTOR`.
    vTop:
      tpl.kind === "highway"
        ? HIGHWAY_V_TOP
        : tpl.kind === "road"
          ? tpl.vMax * ROAD_V_TOP_FACTOR
          : V_TOP,
    drag: bezKrakova(tpl) ? HIGHWAY_DRAG : DRAG_COEFF,
    dif: DIFFICULTY[scenario.difficulty],
  };
}

/**
 * Koliko `s` NPC smije da dostigne prije nego što mora da stane.
 * `Infinity` znači „put je slobodan".
 */
function npcTarget(world: World, ctx: Ctx, me: Vehicle, mePath: Path): Target {
  // Autoput i otvoren put: nema prvenstva ni znakova, samo traka i odstojanje.
  if (bezKrakova(ctx.tpl)) return highwayFollowLimit(world, ctx, me);

  let limit = Infinity;

  // Vozilo koje se ponaša neispravno ne poštuje ni znak ni prvenstvo. Pješake
  // i dalje propušta — „prolazi STOP" nije isto što i „gazi pješake".
  const bezobzirno = Boolean(me.reckless);

  // STOP znak: potpuno zaustavljanje na liniji, pa nastavak po pravilima.
  const control = armControl(ctx, me.arm, world.phaseIndex);
  // Cilja se ISPRED linije, ne na nju — vidi `STOP_MARGIN`.
  if (!bezobzirno && control === "stop" && me.stopHeld < STOP_DWELL && me.s < mePath.stopLineS) {
    limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }
  // Semafor. Na žuto se staje SAMO ako se stigne bezbjedno stati — isti prag
  // (`YELLOW_COMMIT_TTC`) po kojem se sudi i igraču. Da NPC koči na svako žuto,
  // sudio bi mu se drugi aršin nego čovjeku, a uz to bi kočio jače nego što
  // vozilo može i završio nasred raskrsnice.
  //
  // Vozilo pod pratnjom se ovdje ne zaustavlja: ono prolazi i na crveno, uz
  // obavezu da se uvjeri da može bezbjedno. Ostali mu ustupaju kroz `whoYields`.
  if (me.s < mePath.stopLineS && !me.emergency && !bezobzirno) {
    const staje =
      control === "red" ||
      (control === "yellow" && timeTo(me, mePath.stopLineS) >= YELLOW_COMMIT_TTC);
    if (staje) limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }

  // Ulazak u kružni tok: prilazi se SPREMAN DA SE STANE.
  //
  // Bez ovoga vozilo donese odluku tek kad drugi uđe u prsten — a tada je već
  // prešlo svoju liniju ustupanja i staje unutar kružne trake, gdje ga pokosi
  // onaj ko kruži. Fuzz test je to izvukao kao sudar bez ičije greške.
  if (mePath.ring && me.s < mePath.stopLineS && !me.emergency && !bezobzirno) {
    const nekoKruzi = (ctx.conflicts.get(mePath.id) ?? []).some((c) => {
      // Samo konflikt na MOM ulasku u prsten; vozilo koje izlazi prije njega mi
      // ne prelazi put.
      if (Math.abs(c.sA - mePath.boxEnterS) > 0.5) return false;
      return world.vehicles.some((o) => {
        if (o.id === me.id || o.done || world.t < o.spawnT) return false;
        if (o.pathId !== c.pathB) return false;
        const oPath = ctx.paths.get(o.pathId);
        if (!oPath?.ring) return false;
        // Već u prstenu, prije moje ulazne tačke.
        if (o.s >= oPath.boxEnterS && o.s <= c.sB) return true;
        // Ili tek stiže, ali će ući PRIJE mene. Poređenje ide po vremenu do
        // prstena, pa je poredak strog i ne može doći do uzajamnog čekanja:
        // vozilo koje stoji ima beskonačno vrijeme i nikoga ne blokira.
        if (o.s >= oPath.boxEnterS) return false;
        const tOn = timeTo(o, oPath.boxEnterS);
        const tJa = timeTo(me, mePath.boxEnterS);
        return tOn < tJa;
      });
    });
    if (nekoKruzi) limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }

  // Pješak na prelazu preko kojeg prolazim — staje se prije prelaza.
  limit = Math.min(limit, pedestrianLimit(world, ctx, me, mePath));

  // Vozilo ispred u istoj traci.
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.pathId !== me.pathId || o.s <= me.s) continue;
    limit = Math.min(limit, o.s - o.length - FOLLOW_GAP);
  }

  // Vozilo ispred u ISTOJ IZLAZNOJ TRACI, i kad mu je putanja druga.
  // Dva vozila koja izlaze na isti krak voze jednu za drugim po istom asfaltu;
  // to nije pitanje prvenstva nego odstojanja. Na krstastoj raskrsnici je taj
  // slučaj do sad pokrivala `merge` konfliktna tačka, koja odlučuje KO PRVI —
  // a poslije raskrsnice više nema „ko prvi", nego samo „ko je ispred".
  limit = Math.min(limit, exitLaneFollowLimit(world, ctx, me, mePath));

  // Vozilo ispred U PRSTENU. Putanje kroz prsten se poklapaju na dužini, pa ovo
  // nije pitanje prvenstva nego odstojanja — i ne može se svesti na „ista
  // putanja", jer dva vozila mogu dijeliti luk a izlaziti na različitim
  // krakovima.
  limit = Math.min(limit, ringFollowLimit(world, ctx, me, mePath));

  // Prvenstvo na konfliktnim tačkama. Bezobzirno vozilo ga preskače — u tome i
  // jeste poenta vježbe defanzivne vožnje.
  if (bezobzirno) return { limit, vLead: 0 };
  for (const c of ctx.conflicts.get(mePath.id) ?? []) {
    if (c.sA < me.s) continue; // konflikt je iza nas
    for (const o of world.vehicles) {
      if (o.id === me.id || o.done || world.t < o.spawnT) continue;
      if (o.pathId !== c.pathB) continue;

      const oPath = ctx.paths.get(o.pathId)!;
      const decision = whoYields(
        party(ctx, me, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision !== "a") continue; // ja imam prednost ili se ne tičemo

      // Ustupa se ako je drugi već u raskrsnici, ili bi stigao prije nego što
      // ja stignem da očistim konfliktnu tačku. Sam `TTC_THRESHOLD` nije
      // dovoljan — vidi `CLEAR_TIME`.
      const oPast = o.s > c.sB + o.length;
      if (oPast) continue;
      const tMe = timeTo(me, c.sA);
      const tThem = timeTo(o, c.sB);
      const oNear = inBox(o, oPath) || tThem < Math.max(ctx.dif.ttcThreshold, tMe + CLEAR_TIME);
      if (!oNear) continue;
      // Vozilo koje ustupa nikad ne planira da stane IZA svoje linije. Bez ovog
      // ograničenja odluka doneseta kasno (jer je treće vozilo tek ušlo u prag)
      // ostavlja vozilo zaustavljeno nasred raskrsnice — a tamo ga zakuca onaj
      // ko ima prednost.
      const svoja = me.s < mePath.stopLineS ? mePath.stopLineS - STOP_MARGIN : Infinity;
      limit = Math.min(limit, Math.min(c.sA - GAP, svoja));
    }
  }

  return { limit, vLead: 0 };
}

/**
 * Do kojeg `s` se smije ići zbog vozila ispred u zajedničkoj izlaznoj traci.
 *
 * Rastojanje se mjeri preostalim putem do izlaza: ko ima manje preostalo, taj
 * je ispred. Time se ne mora znati ništa o obliku putanja — samo da vode na
 * isti krak.
 */
function exitLaneFollowLimit(world: World, ctx: Ctx, me: Vehicle, mePath: Path): number {
  let limit = Infinity;
  const doIzlaza = mePath.boxExitS - me.s;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.pathId === me.pathId) continue; // već pokriveno pravilom iste trake
    const oPath = ctx.paths.get(o.pathId);
    if (!oPath || oPath.exitArm !== mePath.exitArm) continue;
    // Vozilo koje još nije ušlo u raskrsnicu nije u zajedničkoj traci.
    if (o.s < oPath.boxEnterS) continue;
    const njegovo = oPath.boxExitS - o.s;
    const razmak = doIzlaza - njegovo;
    if (razmak <= 0 || razmak > 40) continue; // iza mene, ili predaleko
    limit = Math.min(limit, me.s + razmak - o.length - FOLLOW_GAP);
  }
  return limit;
}

/**
 * Do kojeg `s` se smije ići zbog vozila ispred u prstenu.
 *
 * Položaj duž prstena je jedan broj (`ringU`), pa je „ko je ispred" obično
 * poređenje po modulu obima. Razmak se onda prevede nazad u `s` na mojoj
 * putanji — u prstenu su to iste jedinice.
 */
function ringFollowLimit(world: World, ctx: Ctx, me: Vehicle, mePath: Path): number {
  const uMe = ringUAt(mePath, me.s);
  if (uMe === null) return Infinity;
  const radius = mePath.ring!.radius;
  let limit = Infinity;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId);
    if (!oPath) continue;
    const uO = ringUAt(oPath, o.s);
    if (uO === null) continue;
    const gap = ringGap(uMe, uO, radius);
    // Nula znači „na istom mjestu"; pola obima i više je vozilo iza mene.
    if (gap <= 0 || gap > Math.PI * radius) continue;
    limit = Math.min(limit, me.s + gap - o.length - FOLLOW_GAP);
  }
  return limit;
}

/**
 * Do kojeg `s` se smije ići zbog pješaka na prelazu ispred.
 *
 * Prelaz blokira dok je pješak NA KOLOVOZU, bez obzira na to koju polovinu je
 * prešao. Prolazak iza pješaka je u praksi čest, ali polazniku se uči sigurnija
 * verzija — i ista ona koju već primjenjuje statični simulator.
 */
function pedestrianLimit(world: World, ctx: Ctx, v: Vehicle, path: Path): number {
  let limit = Infinity;
  for (const span of crosswalkSpans(ctx.tpl, path)) {
    if (span.to < v.s) continue; // prelaz je iza nas
    const zauzet = world.pedestrians.some(
      (p) =>
        !p.done &&
        world.t >= p.spawnT &&
        p.arm === span.arm &&
        pedestrianOnRoad(ctx.tpl, p),
    );
    if (zauzet) limit = Math.min(limit, span.from - GAP);
  }
  return limit;
}

/**
 * Dokle vozilo na autoputu smije da stigne zbog vozila ispred u svojoj traci.
 *
 * Odstojanje se mjeri u sekundama, ne u metrima: na sto na sat dva metra nisu
 * isto što i na trideset. `FOLLOW_GAP` ostaje kao donja granica za male brzine.
 */
function highwayFollowLimit(world: World, ctx: Ctx, me: Vehicle): Target {
  let limit = Infinity;
  let vLead = 0;
  const mojeTrake = trake(me);
  const razmak = Math.max(FOLLOW_GAP, HIGHWAY_FOLLOW_TIME * me.v);
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.s <= me.s) continue;
    if (!shareLane(mojeTrake, trake(o))) continue;
    const kandidat = o.s - o.length - razmak;
    if (kandidat < limit) {
      limit = kandidat;
      vLead = o.v;
    }
  }
  return { limit, vLead };
}

/**
 * Ubrzanje kojim se stiže do `limit` i tu staje, ograničeno na [−B_MAX, A_MAX].
 *
 * `vLead` je brzina onoga zbog koga je granica postavljena. Kod stop-linije i
 * kod prvenstva je to nula i formula je klasična „stani tačno tu". Kod vožnje
 * iza drugog vozila nije: tada se ne mora izgubiti cijela brzina nego samo
 * razlika. Bez toga vozilo koči i kad je granica ispred njega sto metara i sama
 * bježi — izmjereno na autoputu, gdje se savršen vozač zaglavljivao na
 * pedesetak km/h iza kamiona sa sto metara praznine.
 */
function accelToward(v: Vehicle, limit: number, vMax: number, vLead = 0): number {
  if (limit === Infinity) {
    return v.v < vMax ? A_MAX : 0;
  }
  const d = limit - v.s;
  if (d <= 0) return -B_MAX;
  // (v − vLead)² = 2·a·d  →  a potrebno da se razlika brzina izgubi do `limit`.
  const razlika = Math.max(0, v.v - vLead);
  const need = (razlika * razlika) / (2 * Math.max(d, 0.01));
  if (need >= B_MAX) return -B_MAX;
  if (need > A_MAX * 0.5) return -need;
  return v.v < vMax ? A_MAX : 0;
}

/**
 * Brzina se steže na ono što vozilo MOŽE (`V_TOP`), ne na ono što SMIJE.
 * Zbog toga prekoračenje uopšte može da se desi i da se prijavi.
 */
function integrate(v: Vehicle, a: number, top = V_TOP, coeff = DRAG_COEFF): void {
  const drag = coeff * v.v + (v.v > 0.01 ? ROLL_RESISTANCE : 0);
  const acc = a - (a > 0 ? drag : 0);
  v.v = Math.max(0, Math.min(top, v.v + acc * DT));
  v.s += v.v * DT;
}

/** Jedan korak simulacije. Mijenja `world` na mjestu. */
export function step(world: World, scenario: Scenario, input: Input): void {
  if (world.outcome !== "running") return;
  const ctx = ctxFor(world, scenario);

  // ── semafor ───────────────────────────────────────────────────────────────
  const program = ctx.tpl.kind === "cross" ? ctx.tpl.lightProgram : undefined;
  if (program && program.length > 0) {
    const before = armControl(ctx, scenario.player.arm, world.phaseIndex);
    world.phaseT += DT;
    const dur = program[world.phaseIndex]!.duration;
    if (world.phaseT >= dur) {
      world.phaseT -= dur;
      world.phaseIndex = (world.phaseIndex + 1) % program.length;
    }
    const after = armControl(ctx, scenario.player.arm, world.phaseIndex);
    // Trenutak kad se upali žuto: ako je igrač bio preblizu liniji da bezbjedno
    // stane, prolazak mu se ne računa kao prekršaj.
    if (before === "green" && after === "yellow") {
      const p = world.vehicles.find((x) => x.id === PLAYER_ID)!;
      const path = ctx.paths.get(p.pathId)!;
      world.yellowCommitted = timeTo(p, path.stopLineS) < YELLOW_COMMIT_TTC;
    }
    if (after === "green") world.yellowCommitted = false;
  }

  // ── pješaci ───────────────────────────────────────────────────────────────
  for (const ped of world.pedestrians) {
    if (ped.done || world.t < ped.spawnT) continue;
    ped.u += ped.dir * ped.speed * DT;
    if (Math.abs(ped.u) >= pedestrianSpan(ctx.tpl, ped.arm)) ped.done = true;
  }

  const player = world.vehicles.find((x) => x.id === PLAYER_ID)!;
  const playerPath = ctx.paths.get(player.pathId)!;
  const playerBefore = player.s;

  fireHazards(world, scenario, player);
  // Reakcija se mjeri od trenutka kad je događaj postao vidljiv do prvog
  // kočenja. Gas se ne broji: reakcija na opasnost je kočnica.
  if (input.brake > 0) {
    for (const r of world.reaction) if (r.brakedAt === null) r.brakedAt = world.t;
  }

  // ── kretanje ──────────────────────────────────────────────────────────────
  for (const v of world.vehicles) {
    if (v.done || world.t < v.spawnT) continue;
    const path = ctx.paths.get(v.pathId)!;

    if (v.kind === "player") {
      // Pokazivač je komanda: svaka promjena ide u dnevnik, sa mjestom na
      // putanji, jer se pravila vezuju za mjesto a ne za vrijeme.
      const zeljeni = input.indicator ?? null;
      if (v.indicator !== zeljeni) {
        v.indicator = zeljeni;
        world.indicatorLog.push({ t: world.t, s: v.s, indicator: zeljeni });
      }
      if (ctx.tpl.kind === "highway") laneStep(world, ctx, v, input);
      const a = input.throttle * A_MAX - input.brake * B_MAX;
      integrate(v, a, ctx.vTop, ctx.drag);
    } else {
      v.indicator = expectedIndicatorAt(path, v.intent, v.s);
      const { limit, vLead } = npcTarget(world, ctx, v, path);
      const a = accelToward(v, limit, v.cruise ?? ctx.vMax, vLead);
      // Naglo kočenje zbog igrača je događaj, ne samo usporenje — po njemu se
      // prepoznaje oduzeta prednost i kad do sudara ne dođe.
      if (a <= -B_MAX + 1e-6 && v.v > 1) {
        const culprit = blamePlayer(world, ctx, v, path, player, playerPath);
        if (culprit) {
          world.events.push({ type: "forcedBrake", t: world.t, vehicleId: v.id, by: PLAYER_ID });
        }
      }
      integrate(v, a, ctx.vTop, ctx.drag);
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
  if (ctx.tpl.kind === "highway" && !player.done) highwayViolations(world, ctx, player, input);
  // Pokazivač se ocjenjuje van `detectViolations` jer ta funkcija odustaje čim
  // igrač izađe sa putanje — a posljednja faza (gašenje) se završava baš tada.
  evaluateIndicator(world, scenario, player, playerPath);

  world.t += DT;

  if (world.outcome === "running") {
    if (player.done) {
      // Blagi prekršaji se prijave i objasne, ali vožnju ne obaraju.
      world.outcome = hasFail(world) ? "failed" : "passed";
    } else if (world.t > maxSecondsFor(ctx.tpl)) {
      world.outcome = "failed";
    }
  }
}

/**
 * Poslije koliko sekundi se scenario prekida.
 *
 * Raskrsnica se rješava u sekundama i dvije minute su tamo znak da je nešto
 * zaglavljeno. Dionica putovanja po zadatku traje četiri minuta, pa bi je isti
 * broj obarao uvijek — vidi `TRIP_SEGMENT_TIMEOUT_FACTOR`.
 */
export function maxSecondsFor(tpl: Template): number {
  // Rok se računa iz DUŽINE dionice, ne iz dogovorenog trajanja: sa stvarnom
  // geometrijom dionice više nisu jednako duge, pa bi fiksnih deset minuta
  // obaralo Žabljak — Plužine svaki put.
  if (tpl.kind !== "road") return MAX_SCENARIO_SECONDS;
  const trajanje = tpl.vMax > 0 ? tpl.length / tpl.vMax : TRIP_SEGMENT_TIME;
  return Math.max(trajanje, TRIP_SEGMENT_TIME) * TRIP_SEGMENT_TIMEOUT_FACTOR;
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
    const playerNear = inBox(player, playerPath) || timeTo(player, c.sB) < ctx.dif.ttcThreshold;
    if (!playerNear) continue;
    // Kriv je samo ako je NPC imao prednost.
    const decision = whoYields(
      party(ctx, npc, world.phaseIndex),
      party(ctx, player, world.phaseIndex),
    );
    if (decision === "b") return true;
  }
  return false;
}

// ── prekršaji ───────────────────────────────────────────────────────────────

/**
 * Upisuje prekršaj. Jedan po vrsti — a kod pokazivača jedan po vrsti I fazi,
 * jer „nema žmigavca pri najavi" i „ugašen prije kraja skretanja" nisu ista
 * greška iako nose isti tip.
 */
function add(
  world: World,
  v: Omit<Violation, "penaltyRef" | "severity"> & { severity?: Severity },
): void {
  const kljuc = `${v.type}:${v.phaseId ?? ""}`;
  if (world.violations.some((x) => `${x.type}:${x.phaseId ?? ""}` === kljuc)) return;
  world.violations.push({
    ...v,
    severity: v.severity ?? "fail",
    penaltyRef: PENALTY_REF[v.type],
  });
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
  const control = armControl(ctx, player.arm, world.phaseIndex);
  const crossedStopLine = sBefore < path.stopLineS && player.s >= path.stopLineS;

  // ── STOP znak ─────────────────────────────────────────────────────────────
  if (crossedStopLine && control === "stop" && player.stopHeld < STOP_HOLD) {
    add(world, {
      type: "stopSign",
      t: world.t,
      details: `Prošao stop-liniju bez zaustavljanja (stajao ${player.stopHeld.toFixed(2)} s).`,
    });
  }

  // ── naredba policajca ─────────────────────────────────────────────────────
  // Kad je policajac na raskrsnici, on je taj koji zabranjuje prolaz, pa i
  // prekršaj mora tako da se zove: „prošao na crveno" bi bilo netačno, jer
  // svjetlo u tom trenutku može biti i zeleno.
  if (crossedStopLine && ctx.officerAllow && control === "red") {
    add(world, {
      type: "officer",
      t: world.t,
      details: "Prošao iako policajac zaustavlja saobraćaj sa tog pravca.",
    });
    world.outcome = "failed";
    return;
  }

  // ── crveno svjetlo ────────────────────────────────────────────────────────
  if (
    crossedStopLine &&
    !ctx.officerAllow &&
    (control === "red" || (control === "yellow" && !world.yellowCommitted))
  ) {
    add(world, {
      type: "redLight",
      t: world.t,
      details: control === "red" ? "Ušao na crveno svjetlo." : "Ušao na žuto, a mogao je stati.",
    });
    world.outcome = "failed";
  }

  // ── pješak na prelazu ─────────────────────────────────────────────────────
  for (const span of crosswalkSpans(ctx.tpl, path)) {
    // Prekršaj je ULAZAK na prelaz dok je pješak na kolovozu, a ne blizina.
    if (sBefore >= span.from || player.s < span.from) continue;
    const ped = world.pedestrians.find(
      (x) => !x.done && world.t >= x.spawnT && x.arm === span.arm && pedestrianOnRoad(ctx.tpl, x),
    );
    if (!ped) continue;
    add(world, {
      type: "pedestrian",
      t: world.t,
      details: "Ušao na pješački prelaz dok je pješak na kolovozu.",
    });
    world.outcome = "failed";
    return;
  }

  // ── sudar ─────────────────────────────────────────────────────────────────
  const ja = poseOn(ctx.tpl, path, player);
  const pRect = rectCorners(ja.pos, ja.heading, player.length, player.width);
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId)!;
    const on = poseOn(ctx.tpl, oPath, o);
    if (polygonsOverlap(pRect, rectCorners(on.pos, on.heading, o.length, o.width))) {
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
    // Zona u kojoj se sudi „ušao je ispred onoga ko ima prednost".
    //
    // Na krstastoj raskrsnici je konflikt duboko u tijelu raskrsnice, pa je
    // dovoljno gledati metar prije njega. U kružnom toku je konflikt SAM ULAZ,
    // pa bi ta ista zona bila široka jedan metar — a igrač bi u njoj već važio
    // za vozilo u prstenu i dobio bi ravnopravan tretman. Zato tamo zona
    // počinje na liniji ustupanja, gdje se odluka i donosi.
    const naUlasku = Boolean(path.ring) && Math.abs(c.sA - path.boxEnterS) < 0.5;
    const odKada = naUlasku ? path.stopLineS : c.sA - 1;
    if (player.s < odKada || player.s > c.sA + player.length) continue;
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.pathId !== c.pathB) continue;
      if (o.s > c.sB + o.length) continue; // već prošao
      const decision = whoYields(
        party(ctx, player, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision !== "a") continue;
      if (timeTo(o, c.sB) < ctx.dif.ttcThreshold || inBox(o, ctx.paths.get(o.pathId)!)) {
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
    if (world.idleT > ctx.dif.obstructionTimeout) {
      add(world, {
        type: "obstruction",
        t: world.t,
        details: `Stajao ${ctx.dif.obstructionTimeout} s na slobodnom putu i zadržavao saobraćaj.`,
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

// ── autoput ────────────────────────────────────────────────────────────────

/**
 * Prelazak iz trake u traku.
 *
 * Zahtjev se prihvata samo kad prelazak već ne traje — držanje dugmeta ne znači
 * ništa. Uslov za prelazak je pokazivač uključen bar `INDICATOR_LEAD_TIME`
 * ranije; bez njega ostali ne znaju šta namjeravaš, a to je cijela poenta.
 */
function laneStep(world: World, ctx: Ctx, v: Vehicle, input: Input): void {
  const tpl = ctx.tpl as HighwayTemplate;

  // Prelazak u toku — samo napreduje.
  if (v.laneFrom !== undefined && (v.laneT ?? 1) < 1) {
    v.laneT = Math.min(1, (v.laneT ?? 0) + DT / LANE_CHANGE_TIME);
    if (v.laneT >= 1) v.laneFrom = undefined;
    return;
  }

  const strana = input.changeLane ?? null;
  if (!strana) return;
  const iz = v.lane ?? 0;
  const u = strana === "left" ? iz + 1 : iz - 1;
  if (u < -1 || u > tpl.lanes - 1) return;

  // Pokazivač: mora biti na pravu stranu i uključen dovoljno rano.
  const upaljen = world.indicatorLog.filter((e) => e.indicator === strana).at(-1);
  const trenutni = v.indicator;
  if (trenutni !== strana || !upaljen) {
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: "traka",
      details: "Promjena trake bez pokazivača.",
    });
  } else if (world.t - upaljen.t < INDICATOR_LEAD_TIME) {
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: "traka",
      details: "Pokazivač je uključen prekasno prije promjene trake.",
    });
  }

  // Odstojanje u traci u koju se ulazi.
  const praznina = mergeGap(world, v, u);
  if (!praznina.safe) {
    add(world, {
      type: "unsafeMerge",
      t: world.t,
      details:
        praznina.behind < MERGE_GAP_TIME
          ? "Uključenje ispred vozila koje je bilo preblizu."
          : "Uključenje preblizu vozilu ispred.",
      otherVehicleId: praznina.blame ?? undefined,
    });
  }

  v.laneFrom = iz;
  v.lane = u;
  v.laneT = 0;
}

/**
 * Praznina u traci u koju se prelazi, mjerena u sekundama.
 *
 * Izdvojeno zato što isto pitanje postavljaju dvije strane: simulacija kad
 * sudi igraču, i savršen vozač kad odlučuje da li smije da se uključi. Da
 * svaka ima svoju kopiju, bot bi mogao da prolazi test i po pravilu koje se u
 * međuvremenu promijenilo.
 */
export function mergeGap(
  world: World,
  me: Vehicle,
  target: number,
): {
  behind: number;
  ahead: number;
  safe: boolean;
  blame: string | null;
  /** Brzine prvog vozila ispred i prvog iza u toj traci; `null` ako ih nema. */
  aheadV: number | null;
  behindV: number | null;
} {
  let iza: Vehicle | null = null;
  let ispred: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (!trake(o).includes(target)) continue;
    if (o.s < me.s && (!iza || o.s > iza.s)) iza = o;
    if (o.s > me.s && (!ispred || o.s < ispred.s)) ispred = o;
  }
  const behind = iza && iza.v > 0.5 ? (me.s - iza.s) / iza.v : Infinity;
  const ahead = ispred && me.v > 0.5 ? (ispred.s - me.s) / me.v : Infinity;
  const safe = behind >= MERGE_GAP_TIME && ahead >= MERGE_AHEAD_TIME;
  return {
    behind,
    ahead,
    safe,
    blame: safe ? null : ((behind < MERGE_GAP_TIME ? iza?.id : ispred?.id) ?? null),
    aheadV: ispred?.v ?? null,
    behindV: iza?.v ?? null,
  };
}

/**
 * Prekršaji koji postoje samo na autoputu.
 *
 * Nijedan se ne oslanja na prvenstvo — tamo ga nema. Sve je brzina, odstojanje
 * i to da li si u traci u kojoj smiješ da budeš.
 */
function highwayViolations(world: World, ctx: Ctx, player: Vehicle, input: Input): void {
  const tpl = ctx.tpl as HighwayTemplate;
  const uTraci = player.lane ?? 0;
  const vozna = uTraci >= 0;

  // Vozilo ispred u istoj traci — nekoliko pravila zavisi od njega.
  let ispred: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    if (o.s <= player.s || !shareLane(trake(player), trake(o))) continue;
    if (!ispred || o.s < ispred.s) ispred = o;
  }
  const razmak =
    ispred && player.v > 0.5 ? (ispred.s - player.s - ispred.length) / player.v : Infinity;

  /**
   * Prespora vožnja u voznoj traci — ali samo kad je put ispred slobodan.
   *
   * Donja granica na autoputu ne važi kad te usporava saobraćaj: vozilo iza
   * kolone koja stoji ne krši ništa. Bez ovog uslova bi se kažnjavalo baš ono
   * ponašanje koje se traži — držanje odstojanja iza sporijeg vozila.
   */
  const putSlobodan = razmak > HIGHWAY_FOLLOW_TIME * 3;
  if (vozna && putSlobodan && player.v < tpl.vMin) {
    world.highway.tooSlowT += DT;
    if (world.highway.tooSlowT > TOO_SLOW_TIME) {
      add(world, {
        type: "tooSlow",
        t: world.t,
        details: `Vožnja ispod donje granice (${Math.round(tpl.vMin * 3.6)} km/h).`,
      });
    }
  } else {
    world.highway.tooSlowT = 0;
  }

  // Zaustavljanje na traci za ubrzavanje, poslije njene polovine.
  const polovina = (tpl.rampRange[0] + tpl.rampRange[1]) / 2;
  if (!vozna && onRamp(tpl, player.s) && player.s > polovina && player.v < RAMP_STOP_SPEED) {
    add(world, {
      type: "stoppedOnRamp",
      t: world.t,
      details: "Zaustavljanje na traci za ubrzavanje.",
    });
  }

  // Vožnja spoljnom trakom tamo gdje ona nije ni ulaz ni izlaz.
  const trakaVazi = onRamp(tpl, player.s) || onExitLane(tpl, player.s);
  if (!vozna && !trakaVazi) {
    world.highway.shoulderT += DT;
    if (world.highway.shoulderT > HARD_SHOULDER_TIME) {
      add(world, {
        type: "hardShoulder",
        t: world.t,
        details: "Vožnja zaustavnom trakom van ulaza i izlaza.",
      });
    }
  } else {
    world.highway.shoulderT = 0;
  }

  // Odstojanje do vozila ispred.
  if (player.v > TAILGATE_SPEED && razmak < TAILGATE_GAP) {
    world.highway.tailgateT += DT;
    if (world.highway.tailgateT > TAILGATE_TIME) {
      add(world, { type: "tailgating", t: world.t, details: "Vožnja preblizu vozilu ispred." });
    }
  } else {
    world.highway.tailgateT = 0;
  }

  /**
   * Naglo kočenje bez razloga.
   *
   * Dva uslova, i oba su nužna: put ispred je slobodan (znači nema razloga) i
   * neko je odmah iza (znači da to nekoga ugrožava). Bez drugog uslova bi se
   * kažnjavalo svako usporavanje na praznom autoputu, a to nije prekršaj nego
   * način da se vozi sporije.
   */
  let iza: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    if (o.s >= player.s || !shareLane(trake(player), trake(o))) continue;
    if (!iza || o.s > iza.s) iza = o;
  }
  const razmakIza = iza && iza.v > 0.5 ? (player.s - player.length - iza.s) / iza.v : Infinity;
  if (
    vozna &&
    input.brake * B_MAX > HIGHWAY_BRAKE &&
    razmak > TAILGATE_GAP * 2 &&
    razmakIza < TAILGATE_GAP * 1.5
  ) {
    add(world, {
      type: "brakingOnHighway",
      t: world.t,
      details: "Naglo kočenje bez vozila ispred, a sa vozilom neposredno iza.",
      otherVehicleId: iza?.id,
    });
  }
}

// ── problematični događaji ─────────────────────────────────────────────────

/**
 * Okida događaje kojima je došlo vrijeme.
 *
 * Okidač je vrijeme ili mjesto igrača — oboje determinisano, pa ponavljanje
 * snimka daje isti događaj u istom trenutku. Nasumičnost bi pokvarila i snimak
 * i testove, pa je ovdje nema: nivo težine bira KOJI scenariji nose događaje,
 * ne hoće li se dogoditi.
 */
function fireHazards(world: World, scenario: Scenario, player: Vehicle): void {
  const spisak = scenario.hazards ?? [];
  spisak.forEach((h, i) => {
    if (world.hazardsFired.includes(i)) return;
    const vrijeme = h.atTime !== undefined && world.t >= h.atTime;
    const mjesto = h.atPlayerS !== undefined && player.s >= h.atPlayerS;
    if (!vrijeme && !mjesto) return;

    world.hazardsFired.push(i);
    world.events.push({ type: "hazard", t: world.t, kind: h.kind, index: i });
    world.reaction.push({ at: world.t, kind: h.kind, brakedAt: null });
    applyHazard(world, h);
  });
}

function applyHazard(world: World, h: ScenarioHazard): void {
  if (h.kind === "pedestrianSteps") {
    const ped = world.pedestrians[h.target];
    if (ped) ped.spawnT = world.t;
    return;
  }
  const v = world.vehicles.find((x) => x.id === `npc${h.target + 1}`);
  if (!v) return;
  switch (h.kind) {
    case "npcRunsStop":
      v.reckless = true;
      break;
    case "npcLateSpawn":
      v.spawnT = world.t;
      if (h.npcS !== undefined) v.s = h.npcS;
      break;
    case "emergencyVehicle":
      v.emergency = true;
      v.spawnT = Math.min(v.spawnT, world.t);
      break;
  }
}

// ── pokazivač pravca ───────────────────────────────────────────────────────

/** Stanje pokazivača na mjestu `s` — posljednja promjena prije tog mjesta. */
function indicatorAt(log: readonly IndicatorEvent[], s: number): "left" | "right" | null {
  let cur: "left" | "right" | null = null;
  for (const e of log) if (e.s <= s) cur = e.indicator;
  return cur;
}

/** Sva stanja kroz koja je pokazivač prošao na dionici `[from, to)`. */
function statesOver(
  log: readonly IndicatorEvent[],
  from: number,
  to: number,
): ("left" | "right" | null)[] {
  const out: ("left" | "right" | null)[] = [indicatorAt(log, from)];
  for (const e of log) if (e.s > from && e.s < to) out.push(e.indicator);
  return out;
}

/** Gdje je pokazivač PRVI put bio u traženom stanju na toj dionici. */
function firstAt(
  log: readonly IndicatorEvent[],
  want: "left" | "right",
  from: number,
  to: number,
): number | null {
  if (indicatorAt(log, from) === want) return from;
  for (const e of log) if (e.s > from && e.s < to && e.indicator === want) return e.s;
  return null;
}

/**
 * Ocjenjuje faze pokazivača čim ih igrač pređe.
 *
 * Ova funkcija ne zna nijedno pravilo napamet — sve čita iz `phasesFor`, koji
 * čita iz tabele. Zbog toga izmjena tabele mijenja ocjenu bez ijedne izmjene
 * ovdje, što `indicator.test.ts` i provjerava.
 */
function evaluateIndicator(
  world: World,
  scenario: Scenario,
  player: Vehicle,
  path: Path,
): void {
  const grace = DIFFICULTY[scenario.difficulty].indicatorGrace;
  const prekinuto = world.outcome !== "running";
  for (const ph of phasesFor(path, player.intent, scenario.indicatorRules)) {
    if (world.indicatorDone.includes(ph.id)) continue;

    const predjena = player.s >= ph.to || player.done;
    // Kad se vožnja prekine usred faze (sudar, oduzeto prvenstvo), ocjenjuje se
    // samo ono što je stvarno odvezeno, i samo ono što je do tog mjesta već
    // bilo dužno. Bez toga bi propušten žmigavac nestao svaki put kad scenario
    // padne prije izlaska iz raskrsnice — a upravo tada je najvažniji.
    const dospjelo = ph.mustBeSetBefore === null ? predjena : player.s >= ph.mustBeSetBefore;
    const usla = player.s > ph.from;
    if (!predjena && !(prekinuto && usla && dospjelo)) continue;
    world.indicatorDone.push(ph.id);

    const kraj = Math.min(ph.to, Math.max(player.s, ph.from));
    if (kraj <= ph.from) continue;
    // Zahtjev faze stupa na snagu `INDICATOR_GRACE` metara poslije njenog
    // početka. Bez toga se prelaz iz jedne faze u drugu prijavljuje kao greška:
    // vozač koji prebaci žmigavac TAČNO na granici biva zabilježen metar
    // kasnije, jer se simulacija odvija u koracima.
    const pocetak = Math.min(ph.from + grace, kraj);
    const stanja = statesOver(world.indicatorLog, pocetak, kraj);
    const detalj = (x: string) => x;

    if (ph.expected === null) {
      if (stanja.some((x) => x !== null)) {
        add(world, {
          type: ph.mismatchType,
          severity: ph.severity,
          t: world.t,
          phaseId: ph.id,
          details: detalj("Pokazivač je bio uključen tamo gdje se ne očekuje."),
        });
      }
      continue;
    }

    if (stanja.some((x) => x !== null && x !== ph.expected)) {
      add(world, {
        type: "indicatorWrong",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Uključen je pokazivač na pogrešnu stranu."),
      });
      continue;
    }

    if (!stanja.includes(ph.expected)) {
      add(world, {
        type: "indicatorMissing",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač uopšte nije bio uključen."),
      });
      continue;
    }

    const prvi = firstAt(world.indicatorLog, ph.expected, pocetak, kraj);
    if (
      ph.mustBeSetBefore !== null &&
      prvi !== null &&
      prvi > ph.mustBeSetBefore + grace
    ) {
      add(world, {
        type: "indicatorLate",
        severity: "minor",
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač je uključen prekasno — poslije mjesta na kojem se traži."),
      });
      continue;
    }

    if (predjena && indicatorAt(world.indicatorLog, kraj - 0.01) !== ph.expected) {
      add(world, {
        type: "indicatorMissing",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač je ugašen prije nego što je manevar završen."),
      });
    }
  }
}

/**
 * Da li igrač ima razlog da stoji: neko kome mora ustupiti nailazi, ili neko
 * fizički zauzima konfliktnu tačku na njegovoj putanji.
 */
function pathBlocked(world: World, ctx: Ctx, player: Vehicle, path: Path): boolean {
  // Dok traje problematičan događaj, zadržavanje saobraćaja se NE broji.
  // Igrač tada ispravno stoji i čeka da prekršilac prođe; kazniti ga za to bilo
  // bi tačno ono što se ovom igrom uči da se ne radi.
  if (world.reaction.some((r) => world.t - r.at < HAZARD_WINDOW)) return true;

  // Pješak na prelazu ispred je razlog da se stoji — čekanje tada nije
  // zadržavanje saobraćaja nego propisno ustupanje.
  if (Number.isFinite(pedestrianLimit(world, ctx, player, path))) return true;

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
        party(ctx, player, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision === "a" && timeTo(o, c.sB) < ctx.dif.ttcThreshold) return true;
    }
  }
  return false;
}

// ── pomoć za render i testove ───────────────────────────────────────────────

export function vehiclePose(world: World, v: Vehicle): { pos: { x: number; y: number }; heading: { x: number; y: number } } {
  const tpl = templateById(world.templateId)!;
  const path = compile(tpl).paths.get(v.pathId)!;
  return {
    pos: pointAt(path.points, path.cum, v.s),
    heading: headingAt(path.points, path.cum, v.s),
  };
}
