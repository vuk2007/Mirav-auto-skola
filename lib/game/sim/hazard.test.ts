import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { flooringBot, perfectBot, run } from "./bots";
import { DIFFICULTY, HAZARD_WINDOW, TTC_FLOOR, type Level } from "./config";
import type { Scenario } from "./types";
import { createWorld, step } from "./world";

const NIVOI: Level[] = [1, 2, 3, 4, 5];
const SA_DOGADJAJEM = SCENARIOS.filter((s) => (s.hazards?.length ?? 0) > 0);

// ── Tabela težine ───────────────────────────────────────────────────────────

describe("parametri težine", () => {
  it("prag ustupanja nikad ne pada ispod poda", () => {
    // Ispod 2,5 s bi se kažnjavalo ponašanje koje je ispravno — vozač koji uđe
    // sa dvije sekunde rezerve nije pogriješio, nego je igra postala nemoguća.
    for (const n of NIVOI) {
      expect(DIFFICULTY[n].ttcThreshold, `nivo ${n}`).toBeGreaterThanOrEqual(TTC_FLOOR);
    }
  });

  it("težina raste monotono", () => {
    for (let i = 1; i < NIVOI.length; i++) {
      const a = DIFFICULTY[NIVOI[i - 1]!];
      const b = DIFFICULTY[NIVOI[i]!];
      expect(b.densityMultiplier).toBeGreaterThanOrEqual(a.densityMultiplier);
      expect(b.speedMultiplier).toBeGreaterThanOrEqual(a.speedMultiplier);
      expect(b.ruleBreakerChance).toBeGreaterThanOrEqual(a.ruleBreakerChance);
      // Ovi padaju kako težina raste.
      expect(b.obstructionTimeout).toBeLessThanOrEqual(a.obstructionTimeout);
      expect(b.ttcThreshold).toBeLessThanOrEqual(a.ttcThreshold);
      expect(b.indicatorGrace).toBeLessThanOrEqual(a.indicatorGrace);
    }
  });

  it("na prva dva nivoa nema problematičnih događaja", () => {
    expect(DIFFICULTY[1].ruleBreakerChance).toBe(0);
    expect(DIFFICULTY[2].ruleBreakerChance).toBe(0);
  });

  it("kraći rok za zadržavanje se stvarno primjenjuje", () => {
    // Isti scenario na dva nivoa: na težem se `obstruction` javlja ranije.
    const osnovni = scenarioById("desna-imas-prednost")!;
    const kada = (nivo: Level) => {
      const s: Scenario = { ...osnovni, difficulty: nivo };
      const world = createWorld(s, 1);
      for (let i = 0; i < 2000; i++) {
        step(world, s, { throttle: 0, brake: 1, indicator: null });
        const v = world.violations.find((x) => x.type === "obstruction");
        if (v) return v.t;
      }
      return Infinity;
    };
    expect(kada(5)).toBeLessThan(kada(1));
  });
});

// ── Problematični događaji ──────────────────────────────────────────────────

describe("problematični događaji", () => {
  it("ima ih bar tri i pokrivaju tri različite vrste", () => {
    const vrste = new Set(SA_DOGADJAJEM.flatMap((s) => s.hazards!.map((h) => h.kind)));
    expect(SA_DOGADJAJEM.length).toBeGreaterThanOrEqual(3);
    expect(vrste.size).toBeGreaterThanOrEqual(3);
  });

  for (const s of SA_DOGADJAJEM) {
    it(`${s.id}: događaj se okine, i to na istom mjestu za isto sjeme`, () => {
      const a = run(s, perfectBot, 1).world;
      const b = run(s, perfectBot, 1).world;
      expect(a.hazardsFired.length).toBe(s.hazards!.length);
      expect(a.events.filter((e) => e.type === "hazard").map((e) => e.t)).toEqual(
        b.events.filter((e) => e.type === "hazard").map((e) => e.t),
      );
    });

    it(`${s.id}: ko reaguje prolazi bez ijednog prekršaja`, () => {
      for (const seed of [1, 7, 42]) {
        const { world } = run(s, perfectBot, seed);
        expect(world.violations.map((v) => v.type), `${s.id}/${seed}`).toEqual([]);
        expect(world.outcome).toBe("passed");
      }
    });

    it(`${s.id}: ko ne reaguje strada`, () => {
      const { world } = run(s, flooringBot);
      const tipovi = world.violations.map((v) => v.type);
      expect(
        tipovi.some((t) => t === "collision" || t === "pedestrian" || t === "rightOfWay"),
        `prijavljeno: ${JSON.stringify(tipovi)}`,
      ).toBe(true);
    });
  }

  it("dok traje događaj, zadržavanje saobraćaja se ne broji", () => {
    // Ovo je pravilo bez kojeg bi igra kaznila baš ono što uči: igrač stoji i
    // čeka da prekršilac prođe, a to nije zadržavanje saobraćaja.
    const s = scenarioById("nepropisni")!;
    const world = createWorld(s, 1);
    let bilo = false;
    for (let i = 0; i < 3000 && world.outcome === "running"; i++) {
      // Poslije okidanja događaja stojimo u mjestu duže nego što rok dozvoljava.
      const stani = world.hazardsFired.length > 0;
      step(world, s, { throttle: stani ? 0 : 1, brake: stani ? 1 : 0, indicator: null });
      if (stani) bilo = true;
      if (world.hazardsFired.length > 0 && world.t - world.reaction[0]!.at > HAZARD_WINDOW - 0.5) {
        break;
      }
    }
    expect(bilo, "događaj se nikad nije okinuo").toBe(true);
    expect(world.violations.map((v) => v.type)).not.toContain("obstruction");
  });
});

// ── Vrijeme reakcije ────────────────────────────────────────────────────────

describe("vrijeme reakcije", () => {
  it("mjeri se od pojave događaja do prve kočnice", () => {
    const s = scenarioById("pjesak-iskace")!;
    const world = createWorld(s, 1);
    // Vozimo punim gasom dok se ne pojavi pješak, pa kočimo poslije pola sekunde.
    let pojava = -1;
    for (let i = 0; i < 3000 && world.outcome === "running"; i++) {
      if (pojava < 0 && world.reaction.length > 0) pojava = world.reaction[0]!.at;
      const kasnimo = pojava >= 0 && world.t - pojava >= 0.5;
      step(world, s, { throttle: kasnimo ? 0 : 1, brake: kasnimo ? 1 : 0, indicator: null });
      if (world.reaction[0]?.brakedAt !== null && world.reaction.length > 0) break;
    }
    const r = world.reaction[0]!;
    expect(r.brakedAt).not.toBeNull();
    expect(r.brakedAt! - r.at).toBeGreaterThanOrEqual(0.5);
    expect(r.brakedAt! - r.at).toBeLessThan(0.6);
  });

  it("ostaje neizmjereno kad kočnice nije ni bilo", () => {
    const s = scenarioById("pjesak-iskace")!;
    const world = createWorld(s, 1);
    for (let i = 0; i < 200; i++) step(world, s, { throttle: 1, brake: 0, indicator: null });
    for (const r of world.reaction) expect(r.brakedAt).toBeNull();
  });
});

// ── Prekršilac ne dobija prvenstvo ──────────────────────────────────────────

describe("prekršilac", () => {
  it("vozilo koje ne ustupa zaista prolazi bez zaustavljanja", () => {
    const s = scenarioById("nepropisni")!;
    const world = createWorld(s, 1);
    let najmanja = Infinity;
    let bioBezobziran = false;
    for (let i = 0; i < 3000 && world.outcome === "running"; i++) {
      step(world, s, perfectBot(world, s));
      const npc = world.vehicles.find((v) => v.kind === "npc")!;
      if (npc.reckless) bioBezobziran = true;
      if (npc.reckless && world.t >= npc.spawnT && !npc.done) {
        najmanja = Math.min(najmanja, npc.v);
      }
    }
    expect(bioBezobziran, "vozilo nikad nije postalo bezobzirno").toBe(true);
    // Da poštuje trougao, usporilo bi skoro do nule pred glavnim putem.
    expect(najmanja).toBeGreaterThan(5);
  });

  it("igraču se ne pripisuje oduzeto prvenstvo zbog tuđeg prekršaja", () => {
    const s = scenarioById("nepropisni")!;
    for (const seed of [1, 7, 42]) {
      const { world } = run(s, perfectBot, seed);
      expect(world.violations.map((v) => v.type)).not.toContain("rightOfWay");
    }
  });
});
