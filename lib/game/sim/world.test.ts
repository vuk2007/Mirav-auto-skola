import { beforeEach, describe, expect, it } from "vitest";
import { PLAYER_MUST_YIELD, SCENARIOS } from "@/lib/game/scenarios";
import { flooringBot, idleBot, perfectBot, run } from "./bots";
import { OBSTRUCTION_TIMEOUT } from "./config";
import { clearCache, compile, TEMPLATES } from "./intersection";
import { createWorld, step } from "./world";
import { bezKrakova } from "./types";
import type { Scenario } from "./types";

beforeEach(() => clearCache());

describe("putanje", () => {
  it("svaki šablon ima putanju za svaki mogući manevar sa svakog kraka", () => {
    for (const tpl of Object.values(TEMPLATES)) {
      const { paths } = compile(tpl);
      // Krstasta: 3 manevra po kraku. Kružni tok: po jedan izlaz za svaki krak
      // do kojeg se može stići, uključujući puni krug — dakle po broju krakova.
      if (tpl.kind === "highway") {
        // Autoput ima po jednu putanju za svaku traku, uključujući spoljnu.
        expect(paths.size).toBe(tpl.lanes + 1);
      } else if (tpl.kind === "road") {
        // Otvoren put ima našu i susretnu traku, i ništa više.
        expect(paths.size).toBe(2);
      } else {
        const poKraku = tpl.kind === "roundabout" ? tpl.arms.length : 3;
        expect(paths.size).toBe(tpl.arms.length * poKraku);
      }
      for (const p of paths.values()) {
        expect(p.length).toBeGreaterThan(0);
        // Traka autoputa je prava linija sa dvije tačke; kroz raskrsnicu ide
        // prilaz–tijelo–izlaz, pa ih tamo mora biti bar tri.
        expect(p.points.length).toBeGreaterThanOrEqual(bezKrakova(tpl) ? 2 : 3);
        expect(p.boxEnterS).toBeLessThan(p.boxExitS);
        // Kumulativne dužine moraju rasti — inače `pointAt` daje besmislice.
        for (let i = 1; i < p.cum.length; i++) {
          expect(p.cum[i]!).toBeGreaterThanOrEqual(p.cum[i - 1]!);
        }
      }
    }
  });
});

describe("konfliktne tačke", () => {
  it("simetrične su — svaki konflikt postoji sa obje strane", () => {
    for (const tpl of Object.values(TEMPLATES)) {
      const { conflicts } = compile(tpl);
      for (const [pathId, list] of conflicts) {
        for (const c of list) {
          const back = conflicts.get(c.pathB) ?? [];
          const match = back.find(
            (x) =>
              x.pathB === pathId &&
              Math.abs(x.sA - c.sB) < 1e-6 &&
              Math.abs(x.sB - c.sA) < 1e-6,
          );
          expect(match, `nema uzvratnog konflikta ${c.pathB} → ${pathId}`).toBeDefined();
        }
      }
    }
  });

  it("putanje sa istog kraka nemaju konflikt (rješava ih odstojanje, ne prvenstvo)", () => {
    const { conflicts, paths } = compile(TEMPLATES["cross-none"]!);
    for (const [pathId, list] of conflicts) {
      const arm = paths.get(pathId)!.arm;
      for (const c of list) {
        expect(paths.get(c.pathB)!.arm).not.toBe(arm);
      }
    }
  });

  it("ukrštanje pravaca daje konflikt, a desno skretanje uz ivicu ne", () => {
    const { conflicts } = compile(TEMPLATES["cross-none"]!);
    const id = (a: string, i: string) => `cross-none:${a}:${i}`;

    // N pravo i W pravo se sijeku u sredini raskrsnice.
    const nsWithEw = (conflicts.get(id("N", "straight")) ?? []).filter(
      (c) => c.pathB === id("W", "straight"),
    );
    expect(nsWithEw.length).toBeGreaterThan(0);

    // N pravo i S pravo idu paralelno u svojim trakama — ne sijeku se.
    const nsWithSn = (conflicts.get(id("N", "straight")) ?? []).filter(
      (c) => c.pathB === id("S", "straight"),
    );
    expect(nsWithSn).toHaveLength(0);
  });

  it("dva manevra u istu izlaznu traku daju `merge` konflikt", () => {
    const { conflicts } = compile(TEMPLATES["cross-none"]!);
    // N lijevo izlazi na E; W pravo takođe izlazi na E.
    const list = (conflicts.get("cross-none:N:left") ?? []).filter(
      (c) => c.pathB === "cross-none:W:straight",
    );
    expect(list.some((c) => c.kind === "merge")).toBe(true);
  });
});

describe("savršen bot prolazi svaki scenario", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: nula prekršaja, bez zaglavljivanja`, () => {
      const { world, finished } = run(s, perfectBot);
      expect(
        world.violations.map((v) => `${v.type}: ${v.details}`),
        `prekršaji u ${s.id}`,
      ).toEqual([]);
      expect(finished, `${s.id} se nije završio — zaglavljivanje?`).toBe(true);
      expect(world.outcome).toBe("passed");
    });
  }
});

describe("bot koji samo gasi", () => {
  for (const s of SCENARIOS.filter((x) => PLAYER_MUST_YIELD.includes(x.id))) {
    it(`${s.id}: prijavljuje prekršaj zbog ulaska bez prava prolaza`, () => {
      const { world } = run(s, flooringBot);
      const tipovi = world.violations.map((v) => v.type);
      // Sve su to načini da se uđe u raskrsnicu bez prava: oduzeta prednost,
      // sudar, crveno, STOP, pješak na prelazu, naredba policajca. Ono što se
      // NE prihvata je `obstruction` i `speeding` — oni bi značili da je bot
      // negdje stao ili prebrzao, a ne da je ušao kad nije smio.
      expect(
        tipovi.some(
          (t) =>
            t === "rightOfWay" ||
            t === "collision" ||
            t === "redLight" ||
            t === "stopSign" ||
            t === "pedestrian" ||
            t === "officer",
        ),
        `${s.id} nije prijavio nijedan prekršaj: ${JSON.stringify(tipovi)}`,
      ).toBe(true);
    });
  }
});

describe("bot koji samo stoji", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: prijavljuje zadržavanje saobraćaja`, () => {
      const { world } = run(s, idleBot);
      expect(
        world.violations.some((v) => v.type === "obstruction"),
        `${s.id}: ${JSON.stringify(world.violations.map((v) => v.type))}`,
      ).toBe(true);
    });
  }
});

describe("determinizam", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: isto sjeme daje identičnu istoriju`, () => {
      const snimi = (scenario: Scenario) => {
        const w = createWorld(scenario, 42);
        const istorija: string[] = [];
        for (let i = 0; i < 600 && w.outcome === "running"; i++) {
          step(w, scenario, perfectBot(w, scenario));
          istorija.push(w.vehicles.map((v) => `${v.id}:${v.s.toFixed(4)}:${v.v.toFixed(4)}`).join("|"));
        }
        return istorija;
      };
      expect(snimi(s)).toEqual(snimi(s));
    });
  }

  it("različito sjeme mijenja trenutak nastanka NPC-a", () => {
    const s = SCENARIOS[0]!;
    const a = createWorld(s, 1).vehicles.map((v) => v.spawnT);
    const b = createWorld(s, 999).vehicles.map((v) => v.spawnT);
    expect(a).not.toEqual(b);
  });
});

describe("zadržavanje saobraćaja", () => {
  it("tajmer NE teče dok vozilo kojem se ustupa prolazi kroz raskrsnicu", () => {
    // U scenariju gdje igrač mora da ustupi, savršen bot stoji dok NPC prolazi.
    // Ako bi tajmer tekao i tada, ovaj test bi pao — a upravo to je greška koju
    // pravilo `obstruction` lako napravi ako se napiše naivno.
    const s = SCENARIOS.find((x) => x.id === "ljevak")!;
    const { world } = run(s, perfectBot);
    expect(world.violations.some((v) => v.type === "obstruction")).toBe(false);
    expect(world.idleT).toBeLessThan(OBSTRUCTION_TIMEOUT);
  });
});
