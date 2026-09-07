import { describe, expect, it } from "vitest";
import { scenarioById } from "@/lib/game/scenarios";
import { flooringBot, highwayBot, perfectBot, run, type Bot, type LaneStep } from "./bots";
import { HARD_SHOULDER_TIME, MERGE_AHEAD_TIME, MERGE_GAP_TIME } from "./config";
import { HIGHWAY_LANES, lanePathId, laneX, lateralX, occupiedLanes, shareLane } from "./highway";
import { compile, TEMPLATES } from "./intersection";
import type { HighwayTemplate, Input, Vehicle, World } from "./types";
import { createWorld, mergeGap, PLAYER_ID, step } from "./world";

const AUTOPUT = TEMPLATES.autoput as HighwayTemplate;

/**
 * Planovi kojima se svaki scenario odvozi do kraja.
 *
 * Nisu ukras nego dokaz igrivosti: `playable.test.ts` traži rješenje sa dvije
 * pedale, a na autoputu igrač ima i treću komandu. Ovdje se pokazuje da rješenje
 * postoji i sa njom — i u kojoj traci vožnja treba da se završi.
 */
const PLAN: Record<string, { plan: LaneStep[]; cruise?: number; traka: number }> = {
  "autoput-ukljucenje": { plan: [{ side: "left", atS: 120 }], traka: 0 },
  "autoput-gust": { plan: [{ side: "left", atS: 140 }], traka: 0 },
  "autoput-preticanje": {
    plan: [
      { side: "left", atS: 90 },
      { side: "right", atS: 450 },
    ],
    traka: 0,
  },
  "autoput-iskljucenje": { plan: [{ side: "right", atS: 580 }], cruise: 24, traka: -1 },
};

const IDS = Object.keys(PLAN);

const igrac = (w: World): Vehicle => w.vehicles.find((x) => x.id === PLAYER_ID)!;

/** Vozi savršeno dok se ne ispuni uslov, pa radi ono što je zadato. */
function botDo(uslov: (v: Vehicle) => boolean, onda: Partial<Input>): Bot {
  return (world, scenario) => {
    const base = perfectBot(world, scenario);
    return uslov(igrac(world)) ? { ...base, ...onda } : base;
  };
}

// ── Geometrija traka ────────────────────────────────────────────────────────

describe("trake autoputa", () => {
  it("spoljna je desno od desne, a lijeva uz razdjelni pojas", () => {
    // Vožnja ide ka jugu (`heading` je +y), pa je vozačeva desna strana manji
    // `x` — spoljna traka mora biti najdesnija, a traka za preticanje najlijeva.
    expect(laneX(-1)).toBeLessThan(laneX(0));
    expect(laneX(0)).toBeLessThan(laneX(1));
    expect(laneX(1) - laneX(0)).toBeCloseTo(AUTOPUT.geometry.laneWidth, 6);
  });

  it("prelazak počinje i završava na osi trake, bez skoka", () => {
    expect(lateralX(0, -1, 0)).toBeCloseTo(laneX(-1), 6);
    expect(lateralX(0, -1, 1)).toBeCloseTo(laneX(0), 6);
    // Bez prelaska u toku vozilo je tačno na osi svoje trake.
    expect(lateralX(1, undefined, 1)).toBeCloseTo(laneX(1), 6);
    // Bočna brzina na krajevima je nula — zato smoothstep, a ne prava linija.
    expect(Math.abs(lateralX(0, -1, 0.02) - laneX(-1))).toBeLessThan(
      Math.abs(lateralX(0, -1, 0.5) - laneX(-1)) / 10,
    );
  });

  it("u toku prelaska vozilo zauzima obje trake", () => {
    expect(occupiedLanes(0, -1, 0.5)).toEqual([-1, 0]);
    expect(occupiedLanes(0, -1, 1)).toEqual([0]);
    expect(occupiedLanes(0, undefined, 1)).toEqual([0]);
    expect(shareLane([-1, 0], [0])).toBe(true);
    expect(shareLane([-1], [0, 1])).toBe(false);
  });

  it("šablon daje po jednu putanju za svaku traku i nijednu konfliktnu tačku", () => {
    const { paths, conflicts } = compile(AUTOPUT);
    expect(paths.size).toBe(HIGHWAY_LANES.length);
    for (const i of HIGHWAY_LANES) expect(paths.has(lanePathId(AUTOPUT.id, i))).toBe(true);
    expect(conflicts.size).toBe(0);
    // Stop-linija i tijelo raskrsnice moraju biti iza kraja dionice — autoput
    // ih nema, pa detekcija koja ih koristi ne smije nikad da okine.
    for (const p of paths.values()) expect(p.stopLineS).toBeGreaterThan(p.length);
  });
});

// ── Scenariji ───────────────────────────────────────────────────────────────

describe("scenariji autoputa", () => {
  for (const id of IDS) {
    it(`${id}: savršen vozač ne pravi nijedan prekršaj`, () => {
      const { world } = run(scenarioById(id)!, perfectBot);
      expect(world.violations.map((v) => `${v.type}@${v.t.toFixed(1)}`)).toEqual([]);
      expect(world.outcome).toBe("passed");
    });

    for (const seed of [1, 7, 42]) {
      it(`${id} (sjeme ${seed}): zadatak se može odvoziti do kraja`, () => {
        const { plan, cruise, traka } = PLAN[id]!;
        const { world } = run(scenarioById(id)!, highwayBot(plan, cruise), seed);
        expect(world.violations.map((v) => v.type)).toEqual([]);
        expect(world.outcome).toBe("passed");
        // Zadatak je izvršen tek ako se vožnja završila u traci koju traži.
        expect(igrac(world).lane).toBe(traka);
      });
    }
  }
});

// ── Pravila ─────────────────────────────────────────────────────────────────

describe("pravila autoputa", () => {
  it("ostanak u spoljnoj traci je `hardShoulder`", () => {
    // Bezobzirni vozač se nikad ne uključi: samo gas, pravo kroz zaustavnu.
    const { world } = run(scenarioById("autoput-ukljucenje")!, flooringBot);
    const v = world.violations.find((x) => x.type === "hardShoulder");
    expect(v, JSON.stringify(world.violations.map((x) => x.type))).toBeDefined();
    expect(v!.severity).toBe("fail");
    // Ne prijavljuje se odmah: traka za ubrzavanje se smije voziti do kraja.
    expect(v!.t).toBeGreaterThan(HARD_SHOULDER_TIME);
  });

  it("gas do kraja probija i najveću dozvoljenu brzinu", () => {
    const { world } = run(scenarioById("autoput-ukljucenje")!, flooringBot);
    expect(world.violations.map((x) => x.type)).toContain("speeding");
  });

  it("promjena trake bez pokazivača je `indicatorMissing` sa fazom `traka`", () => {
    const bot = botDo((p) => p.s > 120, { indicator: null, changeLane: "left" });
    const { world } = run(scenarioById("autoput-ukljucenje")!, bot);
    const v = world.violations.find((x) => x.type === "indicatorMissing");
    expect(v, JSON.stringify(world.violations.map((x) => x.type))).toBeDefined();
    expect(v!.phaseId).toBe("traka");
  });

  it("uključenje bez dovoljne praznine je `unsafeMerge`", () => {
    // Odmah na startu: iza je vozilo na manje od `MERGE_GAP_TIME`.
    const bot = botDo(() => true, { indicator: "left", changeLane: "left" });
    const { world } = run(scenarioById("autoput-gust")!, bot);
    expect(world.violations.map((x) => x.type)).toContain("unsafeMerge");
  });

  it("zaustavljanje na traci za ubrzavanje je prekršaj", () => {
    // Ne preko `botDo`: savršen vozač bi se uključio prije nego što stigne
    // dovde, pa se ne bi ni zaustavio na traci za ubrzavanje.
    const bot: Bot = (world) =>
      igrac(world).s > 160
        ? { throttle: 0, brake: 1, indicator: null }
        : { throttle: 1, brake: 0, indicator: null };
    const { world } = run(scenarioById("autoput-ukljucenje")!, bot);
    expect(world.violations.map((x) => x.type)).toContain("stoppedOnRamp");
  });

  it("prespora vožnja po slobodnoj traci je prekršaj", () => {
    const bot = botDo((p) => p.v > 10, { throttle: 0, brake: 1 });
    const { world } = run(scenarioById("autoput-iskljucenje")!, bot);
    expect(world.violations.map((x) => x.type)).toContain("tooSlow");
  });

  it("prespora vožnja IZA sporijeg vozila nije prekršaj", () => {
    // Savršen vozač u `preticanje` ostaje iza kamiona koji vozi 14 m/s. To je
    // ispravno ponašanje i ne smije da se kazni donjom granicom brzine.
    const { world } = run(scenarioById("autoput-preticanje")!, perfectBot);
    expect(world.violations.map((x) => x.type)).not.toContain("tooSlow");
    expect(igrac(world).v).toBeLessThan(AUTOPUT.vMin);
  });

  it("vožnja preblizu vozilu ispred je `tailgating`", () => {
    const { world } = run(scenarioById("autoput-preticanje")!, flooringBot);
    expect(world.violations.map((x) => x.type)).toContain("tailgating");
  });

  it("naglo kočenje bez vozila iza NIJE prekršaj", () => {
    // Kočenje samo po sebi ne ugrožava nikoga; prekršaj je tek kad je neko
    // neposredno iza. Bez ovog uslova bi se kažnjavalo usporavanje na praznom.
    const bot = botDo((p) => p.s > 60 && p.s < 120, { throttle: 0, brake: 1 });
    const { world } = run(scenarioById("autoput-iskljucenje")!, bot);
    expect(world.violations.map((x) => x.type)).not.toContain("brakingOnHighway");
  });
});

// ── Praznina za uključenje ──────────────────────────────────────────────────

describe("praznina u traci", () => {
  it("mjeri se u sekundama i sa obje strane", () => {
    const w = createWorld(scenarioById("autoput-gust")!, 1);
    const g = mergeGap(w, igrac(w), 0);
    // Na startu je vozilo iza bliže od dozvoljenog, a ono ispred nije.
    expect(g.behind).toBeLessThan(MERGE_GAP_TIME);
    expect(g.ahead).toBeGreaterThan(MERGE_AHEAD_TIME);
    expect(g.safe).toBe(false);
    expect(g.blame).not.toBeNull();
  });

  it("prekršaj zaustavne trake se ne prijavljuje prije isteka tolerancije", () => {
    const s = scenarioById("autoput-ukljucenje")!;
    const w = createWorld(s, 1);
    // Igrač se gura iza kraja trake za ubrzavanje i vozi pola tolerancije.
    igrac(w).s = AUTOPUT.rampRange[1] + 10;
    for (let i = 0; i < Math.floor((HARD_SHOULDER_TIME / 2) * 60); i++) {
      step(w, s, { throttle: 1, brake: 0, indicator: null });
    }
    expect(w.violations.map((v) => v.type)).not.toContain("hardShoulder");
    expect(w.highway.shoulderT).toBeGreaterThan(0);
  });
});
