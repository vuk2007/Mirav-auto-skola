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
import { compile, TEMPLATES } from "./intersection";
import type { Input, Scenario, World } from "./types";
import { createWorld, PLAYER_ID, step } from "./world";

export type Bot = (world: World, scenario: Scenario) => Input;

const GAS: Input = { throttle: 1, brake: 0 };
const STOP: Input = { throttle: 0, brake: 1 };
const COAST: Input = { throttle: 0, brake: 0 };

/** Samo gas — ne gleda ništa. Mora da napravi prekršaj tamo gdje nema prednost. */
export const flooringBot: Bot = () => GAS;

/** Samo stoji — mora da izazove `obstruction`. */
export const idleBot: Bot = () => STOP;

/**
 * Savršen vozač: vozi po istim pravilima po kojima voze NPC-ovi.
 *
 * Trik je što se `npcTarget` ne izvozi — umjesto da se logika duplira, igračevo
 * vozilo se privremeno predstavi kao NPC i pusti kroz istu funkciju. Tako bot i
 * NPC ne mogu da se raziđu.
 */
export const perfectBot: Bot = (world, scenario) => {
  const player = world.vehicles.find((v) => v.id === PLAYER_ID);
  if (!player || player.done) return COAST;

  const tpl = TEMPLATES[world.templateId]!;
  const path = compile(tpl).paths.get(player.pathId)!;
  const vMax = scenario.vMax ?? V_MAX_DEFAULT;

  // Kopija svijeta u kojoj je igrač NPC — `npcTarget` je interna funkcija
  // `world.ts`-a, pa se do nje dolazi tako što se odigra jedan korak sa
  // igračem u ulozi NPC-a i pogleda koliko bi ubrzao.
  const probe: World = {
    ...world,
    vehicles: world.vehicles.map((v) => (v.id === PLAYER_ID ? { ...v, kind: "npc" as const } : { ...v })),
    events: [],
    violations: [],
  };
  step(probe, scenario, COAST);
  const after = probe.vehicles.find((v) => v.id === PLAYER_ID)!;

  // Ubrzanje koje je NPC logika izabrala za naše vozilo.
  const a = (after.v - player.v) / DT;
  if (a > 0.05) return { throttle: Math.min(1, a / A_MAX), brake: 0 };
  if (a < -0.05) return { throttle: 0, brake: Math.min(1, -a / B_MAX) };
  void path;
  void vMax;
  return COAST;
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
