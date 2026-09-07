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

import { A_MAX, B_MAX, DT, MAX_SCENARIO_SECONDS, V_MAX_DEFAULT } from "./config";
import { expectedIndicatorAt } from "./indicatorRules";
import { compile, TEMPLATES } from "./intersection";
import type { Input, Scenario, World } from "./types";
import { createWorld, PLAYER_ID, step } from "./world";

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
  const indicator = ispravanPokazivac(world, scenario);
  if (a > 0.05) return { throttle: Math.min(1, a / A_MAX), brake: 0, indicator };
  if (a < -0.05) return { throttle: 0, brake: Math.min(1, -a / B_MAX), indicator };
  void path;
  void vMax;
  return { ...COAST, indicator };
};

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
