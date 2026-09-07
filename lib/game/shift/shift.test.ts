import { describe, expect, it } from "vitest";
import { flooringBot, perfectBot, run } from "../sim/bots";
import { MAX_SCENARIO_SECONDS, type Level } from "../sim/config";
import { TEMPLATES } from "../sim/intersection";
import type { Scenario } from "../sim/types";
import {
  CLEAN_TO_LEVEL_UP,
  generateChain,
  generateSegment,
  HIGHWAY_TEMPLATE,
  nextLevel,
  SEGMENT_TEMPLATES,
} from "./generate";
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

  it("svi šabloni iz banke postoje", () => {
    for (const t of SEGMENT_TEMPLATES) expect(TEMPLATES[t], t).toBeDefined();
    expect(TEMPLATES[HIGHWAY_TEMPLATE]?.kind).toBe("highway");
    // Raskrsnice se biraju ravnopravno; autoput ne — on ide po vjerovatnoći
    // nivoa, pa u toj banci nema šta da traži.
    expect(SEGMENT_TEMPLATES as readonly string[]).not.toContain(HIGHWAY_TEMPLATE);
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

// ── Autoput u lancu ─────────────────────────────────────────────────────────

describe("autoput u smjeni", () => {
  const dionice = (nivo: Level, koliko = 300) =>
    generateChain(99, nivo, koliko).filter((s) => s.intersection === HIGHWAY_TEMPLATE);

  it("na prvom nivou ga nema uopšte", () => {
    expect(dionice(1)).toEqual([]);
  }, 60000);

  it("od drugog nivoa se pojavljuje, ali ostaje manjina", () => {
    for (const nivo of [2, 3, 4, 5] as Level[]) {
      const udio = dionice(nivo).length / 300;
      expect(udio, `nivo ${nivo}`).toBeGreaterThan(0.05);
      expect(udio, `nivo ${nivo}`).toBeLessThan(0.35);
    }
  }, 120000);

  it("javljaju se oba zadatka, i oba su imenovana", () => {
    const kljucevi = new Set(dionice(5).map((s) => s.taskKey));
    expect(kljucevi).toEqual(new Set(["gameTaskMerge", "gameTaskFollow"]));
  }, 60000);

  it("uključivanje počinje na traci za ubrzavanje, kolona u voznoj", () => {
    const tpl = TEMPLATES[HIGHWAY_TEMPLATE]!;
    for (const s of dionice(4)) {
      const traka = s.player.intent as { kind: string; index: number };
      expect(traka.kind).toBe("lane");
      expect(traka.index).toBe(s.taskKey === "gameTaskMerge" ? -1 : 0);
      // Polazi se u pokretu: na autoput se ne ulazi iz mjesta.
      expect(s.player.startV ?? 0).toBeGreaterThan(10);
      if (s.taskKey === "gameTaskMerge") {
        expect(s.player.startS ?? 0).toBeLessThan(
          tpl.kind === "highway" ? tpl.rampRange[1] : 0,
        );
      }
      // Sva vozila su na dionici, nijedno u zaustavnoj traci.
      for (const n of s.npcs) {
        expect((n.intent as { index: number }).index).toBeGreaterThanOrEqual(0);
      }
    }
  }, 60000);

  it("bezobzirna vožnja pada na svakoj dionici", () => {
    // Ako bi gas do daske prolazio, dionica ne bi ništa ni provjeravala.
    for (const s of dionice(4).slice(0, 25)) {
      const { world } = run(s, flooringBot, 5);
      expect(
        world.violations.some((v) => v.severity === "fail"),
        `${s.id} ${s.taskKey}`,
      ).toBe(true);
    }
  }, 60000);

  it("dionica traje kao raskrsnica, ne duže", () => {
    const trajanje = (lista: typeof SEGMENT_TEMPLATES extends never ? never : Scenario[]) =>
      lista.reduce((a, s) => a + run(s, perfectBot, 5).time, 0) / Math.max(1, lista.length);
    const ap = trajanje(dionice(4).slice(0, 20));
    const raskrsnice = trajanje(
      generateChain(99, 4, 300)
        .filter((s) => s.intersection !== HIGHWAY_TEMPLATE)
        .slice(0, 20),
    );
    // Dva puta duže bi razbilo ritam smjene; ovoliko je promjena tempa.
    expect(ap).toBeLessThan(raskrsnice * 2);
  }, 120000);
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
