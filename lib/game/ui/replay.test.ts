import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { DT, REPLAY_SECONDS, ROAD_LANE_WIDTH, ROAD_VIEW_HALF } from "@/lib/game/sim/config";
import { rng } from "@/lib/game/sim/geometry";
import type { Input, PokazivaciRezim, RoadTemplate, Scenario, World } from "@/lib/game/sim/types";
import { PLAYER_ID } from "@/lib/game/sim/world";
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

// ── Volan ───────────────────────────────────────────────────────────────────

/** Prav put koji se vozi volanom, bez ijednog drugog vozila. */
function putVolanom(pokazivaci: PokazivaciRezim): Scenario {
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:replay:volan:${pokazivaci}`,
    length: 4000,
    edgeId: "test--test",
    edgeKm: 4,
    vMax: 25,
    curves: [],
    landmarks: [],
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS: 0, startV: 20 },
    npcs: [],
    upravljanje: "traka",
    pokazivaci,
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

const bocno = (w: World): number => w.vehicles.find((v) => v.id === PLAYER_ID)?.lateral ?? 0;

describe("ponavljanje vožnje volanom", () => {
  /**
   * Volan je ulaz kao i gas. Da ga dnevnik ne pamti, ponavljanje bi vozilo
   * pravo dok je igrač skretao — i to se ne bi vidjelo nigdje osim ovdje, jer
   * mjerenje po `s` i brzini ostaje isto.
   */
  for (const rezim of ["auto", "rucni"] as const) {
    it(`pokazivači ${rezim}: ponovljeni poprečni položaj je isti, korak po korak`, () => {
      const runner = createRunner(putVolanom(rezim), 5);
      const rnd = rng(4242);
      const input: Input = { throttle: 0.3, brake: 0, indicator: null, steer: 0 };
      const odvezeno: number[] = [];
      for (let i = 0; i < 1200; i++) {
        // Volan stalno radi; pokazivač se u ručnom režimu povremeno prebaci.
        input.steer = Math.sin(i / 40) * 0.8 - 0.2;
        if (rezim === "rucni" && rnd() < 0.01) input.indicator = rnd() < 0.5 ? "left" : null;
        runner.advance(DT, input);
        odvezeno.push(bocno(runner.world));
      }

      const pb = createPlayback(runner, REPLAY_SECONDS);
      const ponovljeno: number[] = [];
      for (let i = 0; i < 3600 && !pb.done; i++) {
        pb.advance(DT, { throttle: 0, brake: 0, indicator: null });
        if (!pb.done) ponovljeno.push(bocno(pb.world));
      }

      expect(pb.done).toBe(true);
      expect(ponovljeno.length).toBeGreaterThan(REPLAY_SECONDS / DT / 2);
      // Isječak nije miran — volan je u njemu stvarno pomjerao auto, pa bi se
      // izgubljen volan morao vidjeti.
      expect(Math.max(...ponovljeno) - Math.min(...ponovljeno)).toBeGreaterThan(0.5);
      expect(ponovljeno).toEqual(odvezeno.slice(-ponovljeno.length));
      expect(pb.world.indicatorLog).toEqual(runner.world.indicatorLog);
      expect(otisak(pb.world)).toBe(otisak(runner.world));
    });
  }
});
