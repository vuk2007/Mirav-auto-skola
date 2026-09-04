/**
 * Pokretač simulacije sa fiksnim korakom i akumulatorom.
 *
 * Ovdje se sastaju dvije različite frekvencije: simulacija ide tačno 60 puta u
 * sekundi (`DT`), a ekran se osvježava koliko god puta hoće. Akumulator sakuplja
 * stvarno proteklo vrijeme i troši ga u cijelim koracima; ostatak (`alpha`)
 * ostaje renderu da interpolira, pa kretanje izgleda glatko i na 144 Hz i na
 * 30 Hz, a ishod je isti.
 *
 * Nema React-a i nema DOM-a — ovo je obična petlja nad `world` objektom.
 */

import { DT, MAX_STEPS_PER_FRAME } from "../sim/config";
import type { Input, Scenario, World } from "../sim/types";
import { createWorld, step } from "../sim/world";

export interface Runner {
  readonly scenario: Scenario;
  readonly seed: number;
  world: World;
  /** `s` i `v` svakog vozila prije posljednjeg koraka — za interpolaciju. */
  prev: Map<string, { s: number; v: number }>;
  /** Koliko je vremena preteklo preko posljednjeg koraka, izraženo u [0, 1). */
  alpha: number;
  /** Odradi sve korake koji stanu u proteklo vrijeme `dt` [s]. */
  advance(dt: number, input: Input): void;
  /** Vrati scenario na početak sa istim sjemenom. */
  reset(): void;
}

export function createRunner(scenario: Scenario, seed: number): Runner {
  let acc = 0;

  const snapshot = (world: World): Map<string, { s: number; v: number }> =>
    new Map(world.vehicles.map((v) => [v.id, { s: v.s, v: v.v }]));

  const runner: Runner = {
    scenario,
    seed,
    world: createWorld(scenario, seed),
    prev: new Map(),
    alpha: 0,

    advance(dt, input) {
      // Ako je tab bio u pozadini, `dt` zna da bude i nekoliko sekundi. Tada se
      // višak namjerno BACA umjesto da se odradi: sustizanje bi zaledilo
      // stranicu, a igrač u međuvremenu ionako nije mogao da vozi.
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        runner.prev = snapshot(runner.world);
        step(runner.world, scenario, input);
        acc -= DT;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      runner.alpha = acc / DT;
    },

    reset() {
      acc = 0;
      runner.world = createWorld(scenario, seed);
      runner.prev = new Map();
      runner.alpha = 0;
    },
  };

  runner.prev = snapshot(runner.world);
  return runner;
}

/** Pozicija duž putanje kakvu render treba: između prethodnog i tekućeg koraka. */
export function renderS(runner: Runner, vehicleId: string, s: number): number {
  const p = runner.prev.get(vehicleId);
  if (!p) return s;
  return p.s + (s - p.s) * runner.alpha;
}
