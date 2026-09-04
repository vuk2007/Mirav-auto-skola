/**
 * Pokretač simulacije sa fiksnim korakom i akumulatorom.
 *
 * Ovdje se sastaju dvije različite frekvencije: simulacija ide tačno 60 puta u
 * sekundi (`DT`), a ekran se osvježava koliko god puta hoće. Akumulator sakuplja
 * stvarno proteklo vrijeme i troši ga u cijelim koracima; ostatak (`alpha`)
 * ostaje renderu da interpolira, pa kretanje izgleda glatko i na 144 Hz i na
 * 30 Hz, a ishod je isti.
 *
 * Uz to se snima sve što treba za ponavljanje: ulaz igrača u svakom koraku i
 * povremeni snimak cijelog stanja. Pošto je simulacija deterministična, ta dva
 * podatka su dovoljna da se bilo koji trenutak vrati tačno onakav kakav je bio —
 * ne pamti se svaki kadar, nego uputstvo kako da se ponovo dobije.
 *
 * Nema React-a i nema DOM-a — ovo je obična petlja nad `world` objektom.
 */

import { DT, MAX_STEPS_PER_FRAME, REPLAY_SECONDS, SNAPSHOT_INTERVAL, TICK_HZ } from "../sim/config";
import type { Input, Scenario, World } from "../sim/types";
import { createWorld, step } from "../sim/world";

/** Šta renderu treba: stanje, prethodno stanje i koliko je između njih. */
export interface Driver {
  world: World;
  /** `s` i `v` svakog vozila prije posljednjeg koraka — za interpolaciju. */
  prev: Map<string, { s: number; v: number }>;
  /** Koliko je vremena preteklo preko posljednjeg koraka, izraženo u [0, 1). */
  alpha: number;
  /** Odradi sve korake koji stanu u proteklo vrijeme `dt` [s]. */
  advance(dt: number, input: Input): void;
}

export interface Runner extends Driver {
  readonly scenario: Scenario;
  readonly seed: number;
  /** Ulaz igrača u svakom odrađenom koraku. */
  readonly inputLog: Input[];
  /** Snimci stanja na svakih `SNAPSHOT_INTERVAL` sekundi. */
  readonly snapshots: { tick: number; world: World }[];
  /** Vrati scenario na početak sa istim sjemenom. */
  reset(): void;
}

const snapshotOf = (world: World): Map<string, { s: number; v: number }> =>
  new Map(world.vehicles.map((v) => [v.id, { s: v.s, v: v.v }]));

const SNAPSHOT_EVERY = Math.round(TICK_HZ * SNAPSHOT_INTERVAL);

export function createRunner(scenario: Scenario, seed: number): Runner {
  let acc = 0;
  let tick = 0;

  const runner: Runner = {
    scenario,
    seed,
    world: createWorld(scenario, seed),
    prev: new Map(),
    alpha: 0,
    inputLog: [],
    snapshots: [],

    advance(dt, input) {
      // Ako je tab bio u pozadini, `dt` zna da bude i nekoliko sekundi. Tada se
      // višak namjerno BACA umjesto da se odradi: sustizanje bi zaledilo
      // stranicu, a igrač u međuvremenu ionako nije mogao da vozi.
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        if (tick % SNAPSHOT_EVERY === 0) {
          runner.snapshots.push({ tick, world: structuredClone(runner.world) });
        }
        runner.prev = snapshotOf(runner.world);
        // Ulaz se pamti kao kopija: `input` je isti objekat u svakom kadru i
        // mijenja se u mjestu, pa bi se inače cio dnevnik „pomjerio" s njim.
        runner.inputLog.push({ throttle: input.throttle, brake: input.brake });
        step(runner.world, scenario, input);
        tick += 1;
        acc -= DT;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      runner.alpha = acc / DT;
    },

    reset() {
      acc = 0;
      tick = 0;
      runner.world = createWorld(scenario, seed);
      runner.prev = snapshotOf(runner.world);
      runner.alpha = 0;
      runner.inputLog.length = 0;
      runner.snapshots.length = 0;
    },
  };

  runner.prev = snapshotOf(runner.world);
  return runner;
}

/** Pozicija duž putanje kakvu render treba: između prethodnog i tekućeg koraka. */
export function renderS(driver: Driver, vehicleId: string, s: number): number {
  const p = driver.prev.get(vehicleId);
  if (!p) return s;
  return p.s + (s - p.s) * driver.alpha;
}

// ── Ponavljanje ─────────────────────────────────────────────────────────────

export interface Playback extends Driver {
  /** Dostigao je kraj snimka i više se ne pomjera. */
  done: boolean;
}

/**
 * Ponavljanje posljednjih `REPLAY_SECONDS` sekundi.
 *
 * Ne pamti se niz slika nego se simulacija ponovo odigra: uzme se najbliži
 * raniji snimak, premota do željenog trenutka snimljenim ulazom, i odatle pušta
 * u realnom vremenu. Zato determinizam iz faze 1 nije akademska stvar — bez
 * njega bi se ponavljanje razišlo sa onim što je igrač vidio.
 */
export function createPlayback(runner: Runner, seconds = REPLAY_SECONDS): Playback {
  const endTick = runner.inputLog.length;
  const fromTick = Math.max(0, endTick - Math.round(seconds * TICK_HZ));

  // Posljednji snimak koji nije poslije traženog trenutka.
  let base = runner.snapshots[0];
  for (const s of runner.snapshots) {
    if (s.tick <= fromTick) base = s;
  }

  const world = base
    ? structuredClone(base.world)
    : createWorld(runner.scenario, runner.seed);
  let tick = base?.tick ?? 0;

  // Premotavanje do početka isječka — bez crtanja, jednim potezom.
  while (tick < fromTick && tick < endTick) {
    step(world, runner.scenario, runner.inputLog[tick]!);
    tick += 1;
  }

  let acc = 0;
  const playback: Playback = {
    world,
    prev: snapshotOf(world),
    alpha: 0,
    done: tick >= endTick,

    advance(dt) {
      if (playback.done) return;
      acc += dt;
      let steps = 0;
      while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
        if (tick >= endTick) {
          playback.done = true;
          break;
        }
        playback.prev = snapshotOf(playback.world);
        step(playback.world, runner.scenario, runner.inputLog[tick]!);
        tick += 1;
        acc -= DT;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      playback.alpha = playback.done ? 0 : acc / DT;
    },
  };
  return playback;
}
