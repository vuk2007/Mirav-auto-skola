/**
 * Botovi koji igraju umjesto čovjeka.
 *
 * Postoje zbog testova, ne zbog igre:
 *  - `perfectBot` mora proći svaki scenario bez ijednog prekršaja. Ako ne može,
 *    scenario je nemoguć ili su pravila pogrešna — u oba slučaja test pada.
 *  - `flooringBot` (samo gas) i `idleBot` (samo stoji) provjeravaju da detekcija
 *    prekršaja stvarno reaguje. Bez njih bi test „nula prekršaja" prolazio i sa
 *    isključenom detekcijom.
 *
 * `perfectBot` koristi ISTU logiku kao NPC (`npcTarget`), pa ne može „znati"
 * ništa što NPC ne zna — inače bi test mjerio bota, ne pravila.
 */

import {
  A_MAX,
  B_MAX,
  DT,
  INDICATOR_LEAD_TIME,
  MAX_SCENARIO_SECONDS,
  MERGE_AHEAD_TIME,
  MERGE_GAP_TIME,
  V_MAX_DEFAULT,
} from "./config";
import { expectedIndicatorAt } from "./indicatorRules";
import { compile, TEMPLATES } from "./intersection";
import type { Input, Scenario, World } from "./types";
import { createWorld, mergeGap, PLAYER_ID, step } from "./world";

/**
 * Pokazivač kakav tabela traži na mjestu na kojem je igrač.
 *
 * Botovi ga čitaju iz iste funkcije iz koje se crtaju zone i po kojoj se sudi.
 * Da bot ima svoju kopiju pravila, „savršen vozač" bi mogao da prolazi test i
 * kad se tabela promijeni — a test bi i dalje bio zelen.
 */
function ispravanPokazivac(world: World, scenario: Scenario): "left" | "right" | null {
  const p = world.vehicles.find((v) => v.id === PLAYER_ID);
  if (!p) return null;
  const tpl = TEMPLATES[world.templateId]!;
  const path = compile(tpl).paths.get(p.pathId);
  return path ? expectedIndicatorAt(path, p.intent, p.s, scenario.indicatorRules) : null;
}

export type Bot = (world: World, scenario: Scenario) => Input;

/**
 * Kopija svijeta u kojoj je igrač označen kao NPC.
 *
 * SVAKI promjenljiv niz u `World` mora ovdje da se kopira. `step` ih mijenja u
 * mjestu, pa bi proba „potrošila" ono što pripada pravoj vožnji: pješak bi
 * hodao dvostruko brže, dnevnik pokazivača bi ostao bez unosa, a problematičan
 * događaj bi se okinuo u probi i nikad u igri. To se do sad desilo tri puta —
 * zato postoji i `bots.test.ts`, koji pada čim se doda novo polje a zaboravi
 * kopija.
 */
export function probeWorld(world: World): World {
  return {
    ...world,
    vehicles: world.vehicles.map((v) =>
      v.id === PLAYER_ID ? { ...v, kind: "npc" as const } : { ...v },
    ),
    pedestrians: world.pedestrians.map((p) => ({ ...p })),
    indicatorLog: [...world.indicatorLog],
    indicatorDone: [...world.indicatorDone],
    hazardsFired: [...world.hazardsFired],
    reaction: world.reaction.map((r) => ({ ...r })),
    // Brojači autoputa se takođe mijenjaju u mjestu: bez kopije bi svaka proba
    // bota gurala vrijeme prespore vožnje na PRAVOM svijetu, pa bi se prekršaj
    // javio dvostruko brže nego što je igrač vozio.
    highway: { ...world.highway },
    events: [],
    violations: [],
  };
}

const GAS: Input = { throttle: 1, brake: 0, indicator: null };
const STOP: Input = { throttle: 0, brake: 1, indicator: null };
const COAST: Input = { throttle: 0, brake: 0, indicator: null };

/**
 * Samo gas, bez pokazivača — ne gleda ništa. Mora da napravi prekršaj tamo
 * gdje nema prednost, a na skretanjima i prekršaj pokazivača.
 */
export const flooringBot: Bot = () => GAS;

/** Samo stoji — mora da izazove `obstruction`. */
export const idleBot: Bot = () => STOP;

/**
 * Vozi ispravno, ali nikad ne pali pokazivač.
 *
 * Za razliku od `flooringBot`-a, ovaj stigne do kraja manevra — pa se na njemu
 * vidi i propust u fazama koje dolaze tek u raskrsnici ili u prstenu.
 */
export const noIndicatorBot: Bot = (world, scenario) => ({
  ...perfectBot(world, scenario),
  indicator: null,
});

/** Vozi ispravno, ali pali pokazivač na pogrešnu stranu. */
export const wrongIndicatorBot: Bot = (world, scenario) => {
  const ispravan = ispravanPokazivac(world, scenario);
  const obrnut = ispravan === "left" ? "right" : ispravan === "right" ? "left" : "right";
  return { ...perfectBot(world, scenario), indicator: obrnut };
};

/**
 * Savršen vozač: vozi po istim pravilima po kojima voze NPC-ovi.
 *
 * Trik je što se `npcTarget` ne izvozi — umjesto da se logika duplira, igračevo
 * vozilo se privremeno predstavi kao NPC i pusti kroz istu funkciju. Tako bot i
 * NPC ne mogu da se raziđu.
 */
/**
 * Da li je sudar neposredno pred nama, bez obzira na to ko ima prvenstvo.
 *
 * Pravila kažu ko SMIJE da prođe; ne kažu šta da radiš kad neko drugi ne
 * poštuje pravila. Savršen vozač u toj situaciji koči — prednost se ne uzima
 * silom.
 *
 * Ključni uslov nije „stižemo u isto vrijeme" nego „drugi više NE MOŽE da
 * stane": ako mu je potrebno usporenje veće od onog koje vozilo ima, on ulazi
 * u raskrsnicu bez obzira na pravila i to se vidi golim okom. Bez tog uslova
 * bot koči i pred vozilom koje uredno usporava da ga propusti — izmjereno, na
 * `glavni-put` je time pravio sudar kojeg prije nije bilo.
 */
const SUDAR_TTC = 2.5;
const SUDAR_RAZLIKA = 1.2;

function sudarNeizbjezan(world: World): boolean {
  const player = world.vehicles.find((v) => v.id === PLAYER_ID);
  if (!player || player.done) return false;
  const tpl = TEMPLATES[world.templateId]!;
  const { conflicts } = compile(tpl);
  const doTacke = (v: { s: number; v: number }, s: number) => {
    const d = s - v.s;
    if (d <= 0) return v.v > 0.05 ? d / v.v : -Infinity;
    return v.v > 0.05 ? d / v.v : Infinity;
  };

  for (const c of conflicts.get(player.pathId) ?? []) {
    if (c.sA + player.length < player.s) continue; // konflikt je iza nas
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT) continue;
      if (o.pathId !== c.pathB) continue;
      const tJa = doTacke(player, c.sA);
      const tOn = doTacke(o, c.sB);
      if (tJa < 0 || tOn < 0) continue;
      if (tJa >= SUDAR_TTC || tOn >= SUDAR_TTC) continue;
      if (Math.abs(tJa - tOn) >= SUDAR_RAZLIKA) continue;
      // Može li on još da stane pred tom tačkom?
      const d = Math.max(0.01, c.sB - o.s);
      const potrebno = (o.v * o.v) / (2 * d);
      if (potrebno > B_MAX * 0.9) return true;
    }
  }
  return false;
}

/**
 * Koliko prije kraja trake za ubrzavanje savršen vozač počinje da se uključuje.
 *
 * Nije proizvoljno: prelazak traje `LANE_CHANGE_TIME`, a pokazivač mora biti
 * upaljen `INDICATOR_LEAD_TIME` prije njega. Na sto na sat je to osamdesetak
 * metara, pa ostatak trake ostaje za čekanje praznine.
 */
const UKLJUCENJE_OD = 200;

/**
 * Šta savršen vozač radi sa trakom na autoputu.
 *
 * Jedino pravilo koje ga tjera da promijeni traku je zaustavna traka: u njoj se
 * ne vozi, pa se sa trake za ubrzavanje mora uključiti prije nego što ona
 * prestane. Preticanje i isključenje nisu pravila nego zadatak, i njih vozi
 * `highwayBot` iz scenarija — inače bi ovaj bot znao ono što mu niko nije rekao.
 */
interface Traka extends Pick<Input, "indicator" | "changeLane"> {
  /**
   * Brzina na koju se vozilo drži dok traži prazninu [m/s].
   *
   * Postoji zato što je „izjednači brzinu sa saobraćajem" dio samog pravila o
   * uključivanju, a ne stil vožnje. Bez toga savršen vozač na traci za
   * ubrzavanje juri do najveće dozvoljene, prestigne kolonu u koju treba da se
   * uključi, i praznina ispred njega se samo skuplja — izmjereno na
   * generisanim segmentima, gdje je tako završavao na zaustavnoj traci.
   */
  cap?: number;
}

function autoputTraka(
  world: World,
  player: { lane?: number; laneFrom?: number; laneT?: number; s: number; v: number; id: string },
): Traka {
  const tpl = TEMPLATES[world.templateId]!;
  if (tpl.kind !== "highway") return { indicator: null };
  if ((player.lane ?? 0) !== -1) return { indicator: null };
  // Traka za usporavanje nije traka za ubrzavanje: iz nje se ne vraća na
  // autoput nego se sa njega izlazi. Bez ovog uslova bi bot, čim se isključi,
  // odmah krenuo nazad u desnu traku.
  if (player.s >= tpl.rampRange[1]) return { indicator: null };
  // Prelazak već traje — pokazivač ostaje dok se ne završi.
  if (player.laneFrom !== undefined && (player.laneT ?? 1) < 1) return { indicator: "left" };
  if (player.s < tpl.rampRange[1] - UKLJUCENJE_OD) return { indicator: null };

  const uPravoVrijeme = world.indicatorLog
    .filter((e) => e.indicator === "left")
    .some((e) => world.t - e.t >= INDICATOR_LEAD_TIME);
  const me = world.vehicles.find((v) => v.id === player.id)!;
  const g = mergeGap(world, me, 0);
  if (uPravoVrijeme && g.safe) return { indicator: "left", changeLane: "left" };

  // Nema praznine — brzinom se bira gdje će se ući.
  //
  // Vozilo koje sustiže s leđa, a nije sporije od nas, ne može se „pobjeći":
  // traka za ubrzavanje je kraća od puta koji bi za to trebalo. Ispravno je
  // popustiti i ući iza njega, i to je jedini potez koji tu i postoji.
  if (g.behind < MERGE_GAP_TIME && g.behindV !== null && g.behindV >= player.v - 1) {
    return { indicator: "left", cap: Math.max(4, g.behindV - 12) };
  }
  if (g.aheadV !== null) {
    return {
      indicator: "left",
      cap: g.ahead < MERGE_AHEAD_TIME ? Math.max(4, g.aheadV - 3) : g.aheadV + 2,
    };
  }
  return { indicator: "left" };
}

export const perfectBot: Bot = (world, scenario) => {
  const player = world.vehicles.find((v) => v.id === PLAYER_ID);
  if (!player || player.done) return COAST;

  // Izbjegavanje sudara ide PRIJE pravila: ako neko ne poštuje prvenstvo,
  // ispravan potez je kočnica, a ne insistiranje na svom pravu.
  if (sudarNeizbjezan(world)) {
    return { throttle: 0, brake: 1, indicator: ispravanPokazivac(world, scenario) };
  }

  const tpl = TEMPLATES[world.templateId]!;
  const path = compile(tpl).paths.get(player.pathId)!;
  const vMax = scenario.vMax ?? V_MAX_DEFAULT;

  // Kopija svijeta u kojoj je igrač NPC — `npcTarget` je interna funkcija
  // `world.ts`-a, pa se do nje dolazi tako što se odigra jedan korak sa
  // igračem u ulozi NPC-a i pogleda koliko bi ubrzao.
  const probe = probeWorld(world);
  step(probe, scenario, COAST);
  const after = probe.vehicles.find((v) => v.id === PLAYER_ID)!;

  // Ubrzanje koje je NPC logika izabrala za naše vozilo.
  const a = (after.v - player.v) / DT;
  const traka = autoputTraka(world, player);
  const indicator = traka.indicator ?? ispravanPokazivac(world, scenario);
  const lane = { indicator, changeLane: traka.changeLane ?? null };
  // Otpor u modelu usporava samo pod gasom, pa se višak brzine skida kočnicom.
  if (traka.cap !== undefined && player.v > traka.cap) {
    return { throttle: 0, brake: Math.min(1, (player.v - traka.cap) / 4), ...lane };
  }
  if (a > 0.05) return { throttle: Math.min(1, a / A_MAX), brake: 0, ...lane };
  if (a < -0.05) return { throttle: 0, brake: Math.min(1, -a / B_MAX), ...lane };
  void path;
  void vMax;
  return { ...COAST, ...lane };
};

/**
 * Vozač koji uz pravila izvršava i zadatak: promjenu trake u zadatom trenutku.
 *
 * Postoji zato što preticanje i isključenje nisu pravila nego namjera — nešto
 * što igraču kaže zadatak, a ne saobraćajni propis. Bot pali pokazivač na
 * vrijeme, čeka da prelazak prođe, pa prelazi na sljedeći korak plana.
 */
export interface LaneStep {
  side: "left" | "right";
  /** Od kada se smije tražiti prelazak [s]. */
  t?: number;
  /** Ili: od kojeg mjesta na dionici [m]. Otpornije na promjenu brzina. */
  atS?: number;
}

export function highwayBot(plan: readonly LaneStep[], cruise = Infinity): Bot {
  let i = 0;
  let trazeno = false;
  return (world, scenario) => {
    const p = world.vehicles.find((v) => v.id === PLAYER_ID);
    // Brzina se bira prije trake: pred izlazom se usporava, a to je i razlog
    // zašto traka za usporavanje postoji.
    const prebrzo = p !== undefined && p.v > cruise;
    const osnova = prebrzo
      ? { ...perfectBot(world, scenario), throttle: 0, brake: 1 }
      : perfectBot(world, scenario);
    const korak = plan[i];
    if (!p || p.done || !korak) return osnova;

    const uToku = p.laneFrom !== undefined && (p.laneT ?? 1) < 1;
    if (trazeno && !uToku) {
      i += 1;
      trazeno = false;
      return { ...osnova, indicator: null, changeLane: null };
    }
    const vodi = Math.max(20, p.v * (INDICATOR_LEAD_TIME + 0.5));
    const najava =
      korak.t !== undefined ? world.t >= korak.t - INDICATOR_LEAD_TIME - 0.5 : p.s >= (korak.atS ?? 0) - vodi;
    const sada = korak.t !== undefined ? world.t >= korak.t : p.s >= (korak.atS ?? 0);
    if (!najava) return osnova;
    if (uToku) return { ...osnova, indicator: korak.side, changeLane: null };
    if (sada && mergeGap(world, p, (p.lane ?? 0) + (korak.side === "left" ? 1 : -1)).safe) {
      trazeno = true;
      return { ...osnova, indicator: korak.side, changeLane: korak.side };
    }
    return { ...osnova, indicator: korak.side, changeLane: null };
  };
}

export interface RunResult {
  world: World;
  /** Koliko je sekundi trajalo dok igrač nije izašao (ili istekao scenario). */
  time: number;
  finished: boolean;
}

/** Pusti scenario do kraja sa datim botom. Deterministički za dato sjeme. */
export function run(scenario: Scenario, bot: Bot, seed = 1): RunResult {
  const world = createWorld(scenario, seed);
  const maxTicks = Math.ceil(MAX_SCENARIO_SECONDS / DT);
  let ticks = 0;
  while (world.outcome === "running" && ticks < maxTicks) {
    step(world, scenario, bot(world, scenario));
    ticks += 1;
  }
  return { world, time: world.t, finished: world.outcome !== "running" };
}

/**
 * Idealno vrijeme prolaska — koliko treba savršenom vozaču.
 * „Kvalitet prolaska" igrača je njegovo vrijeme minus ovo.
 */
export function idealTime(scenario: Scenario, seed = 1): number {
  return run(scenario, perfectBot, seed).time;
}

/**
 * Vozač sa dvije pedale i ničim između — gas do `brakeFrom`, kočnica do
 * `brakeTo`, pa opet gas.
 *
 * Igrač na ekranu nema klizač: dugme je pritisnuto ili nije. Zato scenario koji
 * može da položi samo `perfectBot` (koji dozira gas) nije stvarno rješiv. Ovim
 * botom se to provjerava — vidi `playable.test.ts`.
 */
export function bangBangBot(brakeFrom: number, brakeTo: number): Bot {
  // Pokazivač je ispravan i ovdje: čovjek sa dvije pedale ima i ručicu, a ovaj
  // bot mjeri da li se scenario može odvoziti, ne da li se zna žmigavac.
  return (world, scenario) => ({
    ...(world.t >= brakeFrom && world.t < brakeTo ? STOP : GAS),
    indicator: ispravanPokazivac(world, scenario),
  });
}
