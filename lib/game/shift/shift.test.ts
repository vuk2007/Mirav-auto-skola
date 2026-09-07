import { describe, expect, it } from "vitest";
import { perfectBot, run } from "../sim/bots";
import { MAX_SCENARIO_SECONDS, type Level } from "../sim/config";
import { TEMPLATES } from "../sim/intersection";
import { CLEAN_TO_LEVEL_UP, generateChain, generateSegment, nextLevel, SEGMENT_TEMPLATES } from "./generate";
import { applySegment, averageReaction, LIVES, startShift } from "./session";

const NIVOI: Level[] = [1, 2, 3, 4, 5];

// ── Generisanje ─────────────────────────────────────────────────────────────

describe("generisanje segmenata", () => {
  it("isto sjeme daje isti segment", () => {
    const a = generateSegment(123, 3, 5);
    const b = generateSegment(123, 3, 5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("različito sjeme daje različite lance", () => {
    const a = JSON.stringify(generateChain(1, 3, 20));
    const b = JSON.stringify(generateChain(2, 3, 20));
    expect(a).not.toBe(b);
  });

  it("svaki šablon iz banke se stvarno pojavi", () => {
    const vidjeni = new Set(generateChain(7, 3, 200).map((s) => s.intersection));
    for (const t of SEGMENT_TEMPLATES) expect(vidjeni.has(t), t).toBe(true);
  });

  it("svi šabloni iz banke postoje, i autoputa nema", () => {
    for (const t of SEGMENT_TEMPLATES) expect(TEMPLATES[t], t).toBeDefined();
    expect(SEGMENT_TEMPLATES).not.toContain("autoput");
  });

  it("gustina i brzina rastu sa nivoom", () => {
    const prosjek = (nivo: Level, sto: "npc" | "brzina") => {
      const lanac = generateChain(11, nivo, 120);
      const brojevi = lanac.map((s) =>
        sto === "npc"
          ? s.npcs.length
          : s.npcs.reduce((a, n) => a + n.speed, 0) / Math.max(1, s.npcs.length),
      );
      return brojevi.reduce((a, b) => a + b, 0) / brojevi.length;
    };
    expect(prosjek(5, "npc")).toBeGreaterThan(prosjek(1, "npc"));
    expect(prosjek(5, "brzina")).toBeGreaterThan(prosjek(1, "brzina"));
  });

  it("problematični događaji postoje samo od trećeg nivoa", () => {
    for (const nivo of [1, 2] as Level[]) {
      const lanac = generateChain(3, nivo, 150);
      expect(lanac.some((s) => (s.hazards?.length ?? 0) > 0), `nivo ${nivo}`).toBe(false);
    }
    const teski = generateChain(3, 5, 150);
    expect(teski.some((s) => (s.hazards?.length ?? 0) > 0)).toBe(true);
  });
});

// ── Prilagođavanje ──────────────────────────────────────────────────────────

describe("prilagođavanje težine", () => {
  it("tri čista segmenta dižu nivo, izgubljen život ga spušta", () => {
    expect(nextLevel(2, CLEAN_TO_LEVEL_UP, false)).toBe(3);
    expect(nextLevel(2, 2, false)).toBe(2);
    expect(nextLevel(2, 5, true)).toBe(1);
  });

  it("nikad ispod jedan i nikad iznad pet", () => {
    expect(nextLevel(1, 0, true)).toBe(1);
    expect(nextLevel(5, CLEAN_TO_LEVEL_UP, false)).toBe(5);
  });
});

// ── Fuzz: svaki generisani segment mora biti rješiv ─────────────────────────

describe("fuzz — savršen vozač prolazi sve", () => {
  for (const nivo of NIVOI) {
    it(`nivo ${nivo}: 200 nasumičnih segmenata bez prekršaja i bez zaglavljivanja`, () => {
      const pali: string[] = [];
      for (let seed = 1; seed <= 200; seed++) {
        const s = generateSegment(seed, nivo, seed % 13);
        const { world, time, finished } = run(s, perfectBot, seed);
        if (!finished || world.outcome !== "passed" || world.violations.length > 0) {
          pali.push(
            `sjeme ${seed}: ${world.outcome} t=${time.toFixed(1)} ${JSON.stringify(
              world.violations.map((v) => v.type),
            )} (${s.intersection}, ${s.npcs.length} vozila)`,
          );
        }
        expect(time, `sjeme ${seed}: zaglavljeno`).toBeLessThan(MAX_SCENARIO_SECONDS);
      }
      expect(pali.slice(0, 5), `palo ${pali.length} od 200`).toEqual([]);
    }, 120000);
  }
});

// ── Determinizam lanca ──────────────────────────────────────────────────────

describe("determinizam smjene", () => {
  it("isti lanac i sjeme daju identičnu istoriju", () => {
    const otisak = () =>
      generateChain(42, 4, 10)
        .map((s, i) => {
          const { world } = run(s, perfectBot, 42 + i);
          return `${s.id}:${world.outcome}:${world.t.toFixed(4)}:${world.violations
            .map((v) => v.type)
            .join(",")}`;
        })
        .join("|");
    expect(otisak()).toBe(otisak());
  });
});

// ── Tok smjene ──────────────────────────────────────────────────────────────

describe("smjena", () => {
  const svijet = (violations: { type: string; severity: string }[], reakcije: number[] = []) =>
    ({
      violations: violations.map((v) => ({ ...v, t: 1, details: "", penaltyRef: null })),
      reaction: reakcije.map((r) => ({ at: 0, kind: "npcRunsStop", brakedAt: r })),
    }) as unknown as Parameters<typeof applySegment>[1];

  it("počinje sa tri života i na prvom nivou", () => {
    const s = startShift(1);
    expect(s.lives).toBe(LIVES);
    expect(s.level).toBe(1);
    expect(s.over).toBe(false);
  });

  it("čist segment ne uzima život i produžava niz", () => {
    const s = applySegment(startShift(1), svijet([]));
    expect(s.lives).toBe(LIVES);
    expect(s.cleanStreak).toBe(1);
    expect(s.segments).toBe(1);
  });

  it("blaga greška se broji, ali život ne uzima", () => {
    const s = applySegment(startShift(1), svijet([{ type: "indicatorLeftOn", severity: "minor" }]));
    expect(s.lives).toBe(LIVES);
    expect(s.violations.indicatorLeftOn).toBe(1);
    // Vožnja je i dalje ispravna, pa niz ne puca.
    expect(s.cleanStreak).toBe(1);
  });

  it("prekršaj koji obara vožnju uzima jedan život i spušta nivo", () => {
    let s = startShift(1);
    s = { ...s, level: 3 };
    s = applySegment(s, svijet([{ type: "rightOfWay", severity: "fail" }]));
    expect(s.lives).toBe(LIVES - 1);
    expect(s.level).toBe(2);
    expect(s.cleanStreak).toBe(0);
    expect(s.over).toBe(false);
  });

  it("sudar je kraj smjene, bez obzira na preostale živote", () => {
    const s = applySegment(startShift(1), svijet([{ type: "collision", severity: "fail" }]));
    expect(s.lives).toBe(0);
    expect(s.over).toBe(true);
  });

  it("tri čista segmenta dižu nivo", () => {
    let s = startShift(1);
    for (let i = 0; i < 3; i++) s = applySegment(s, svijet([]));
    expect(s.level).toBe(2);
    expect(s.bestStreak).toBe(3);
  });

  it("prosječno vrijeme reakcije se računa samo od izmjerenih", () => {
    let s = startShift(1);
    s = applySegment(s, svijet([], [0.8]));
    s = applySegment(s, svijet([], [1.2]));
    expect(averageReaction(s)).toBeCloseTo(1.0, 6);
    expect(averageReaction(startShift(1))).toBeNull();
  });
});
