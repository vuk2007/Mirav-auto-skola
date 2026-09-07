import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { DT, REPLAY_SECONDS } from "@/lib/game/sim/config";
import { rng } from "@/lib/game/sim/geometry";
import type { Input, Scenario, World } from "@/lib/game/sim/types";
import { createPlayback, createRunner, type Runner } from "./runner";

/**
 * Ponavljanje ne čuva slike nego uputstvo: snimak stanja i ulaz igrača po
 * koraku. Ako se simulacija razlikuje pri drugom izvođenju, igrač bi u
 * ponavljanju vidio nešto što se nije desilo — a to je gore od toga da
 * ponavljanja uopšte nema.
 *
 * Zato ovaj test ne gleda „liči li", nego traži da završno stanje ponavljanja
 * bude jednako završnom stanju vožnje, do posljednje decimale.
 */
function otisak(world: World): string {
  return JSON.stringify({
    t: world.t,
    outcome: world.outcome,
    violations: world.violations.map((v) => [v.type, v.t, v.details]),
    vehicles: world.vehicles.map((v) => [v.id, v.s, v.v, v.done, v.stopHeld]),
    phaseIndex: world.phaseIndex,
    phaseT: world.phaseT,
  });
}

/** Odigra scenario nasumičnim, ali ponovljivim mijenjanjem pedala. */
function odigraj(s: Scenario, seed: number): Runner {
  const runner = createRunner(s, seed);
  const rnd = rng(seed * 977 + 13);
  const input: Input = { throttle: 1, brake: 0, indicator: null };
  while (runner.world.outcome === "running" && runner.inputLog.length < 3600) {
    if (rnd() < 0.03) {
      const gas = rnd() < 0.5;
      input.throttle = gas ? 1 : 0;
      input.brake = gas ? 0 : 1;
    }
    runner.advance(DT, input);
  }
  return runner;
}

describe("ponavljanje snimka", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: ponovljeni kraj je identičan odvoženom`, () => {
      const runner = odigraj(s, 3);
      expect(runner.inputLog.length, `${s.id}: vožnja se nije ni pokrenula`).toBeGreaterThan(60);
      expect(runner.snapshots.length, `${s.id}: nema nijednog snimka stanja`).toBeGreaterThan(0);

      const pb = createPlayback(runner, REPLAY_SECONDS);
      let steps = 0;
      while (!pb.done && steps < 3600) {
        pb.advance(DT, { throttle: 0, brake: 0, indicator: null });
        steps += 1;
      }

      expect(pb.done, `${s.id}: ponavljanje se nije završilo`).toBe(true);
      expect(otisak(pb.world)).toBe(otisak(runner.world));
    });
  }

  it("isječak počinje najviše REPLAY_SECONDS prije kraja", () => {
    const runner = odigraj(SCENARIOS[0]!, 3);
    const pb = createPlayback(runner, REPLAY_SECONDS);
    const preostalo = runner.world.t - pb.world.t;
    // Premotavanje ide do tačnog koraka, pa je početak isječka tačno toliko
    // ranije — osim kad je cijela vožnja kraća od pet sekundi.
    expect(preostalo).toBeLessThanOrEqual(REPLAY_SECONDS + DT);
    expect(preostalo).toBeGreaterThan(0);
  });

  it("ponavljanje ne dira original", () => {
    const runner = odigraj(SCENARIOS[0]!, 3);
    const prije = otisak(runner.world);
    const pb = createPlayback(runner, REPLAY_SECONDS);
    for (let i = 0; i < 3600 && !pb.done; i++) pb.advance(DT, { throttle: 0, brake: 0, indicator: null });
    expect(otisak(runner.world)).toBe(prije);
  });
});
