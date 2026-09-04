import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { OPPOSITE, whoYields, type Approach, type EffectiveControl, type Intent } from "@/lib/simRules";
import { flooringBot, perfectBot, run } from "./bots";
import {
  compile,
  crosswalkSpans,
  crosswalkWidth,
  lightFor,
  pedestrianOnRoad,
  pedestrianSpan,
  TEMPLATES,
} from "./intersection";
import type { Scenario } from "./types";
import { createWorld, officerAllow, step } from "./world";

// ── Pješaci ─────────────────────────────────────────────────────────────────

describe("pješaci", () => {
  it("prelaz koji putanja siječe se poklapa sa onim što se crta", () => {
    const tpl = TEMPLATES["cross-none"]!;
    const path = [...compile(tpl).paths.values()].find(
      (p) => p.arm === "N" && p.intent === "straight",
    )!;
    const spans = crosswalkSpans(tpl, path);
    // Vožnja pravo siječe dva prelaza: svoj i onaj na izlaznom kraku.
    expect(spans.map((x) => x.arm)).toEqual(["N", "S"]);
    for (const span of spans) {
      expect(span.to - span.from).toBeCloseTo(crosswalkWidth(tpl), 6);
    }
    // Prvi prelaz počinje tačno na stop-liniji — tako je i nacrtan.
    expect(spans[0]!.from).toBeCloseTo(path.stopLineS, 6);
  });

  it("pješak blokira samo dok je na kolovozu", () => {
    const tpl = TEMPLATES["cross-none"]!;
    const half = tpl.geometry.laneWidth;
    expect(pedestrianOnRoad(tpl, { arm: "N", u: 0 })).toBe(true);
    expect(pedestrianOnRoad(tpl, { arm: "N", u: half })).toBe(true);
    expect(pedestrianOnRoad(tpl, { arm: "N", u: half + 0.1 })).toBe(false);
    // Kreće se sa trotoara, dakle van kolovoza.
    expect(pedestrianSpan(tpl, "N")).toBeGreaterThan(half);
  });

  it("ulazak na prelaz dok je pješak na kolovozu je prekršaj", () => {
    const s = scenarioById("pjesaci")!;
    const { world } = run(s, flooringBot);
    expect(world.violations.map((v) => v.type)).toContain("pedestrian");
    expect(world.outcome).toBe("failed");
  });

  it("savršen vozač sačeka pješaka i prođe bez prekršaja", () => {
    const { world } = run(scenarioById("pjesaci")!, perfectBot);
    expect(world.violations).toEqual([]);
    expect(world.outcome).toBe("passed");
  });

  it("čekanje pješaka nije zadržavanje saobraćaja", () => {
    // Bez ovoga bi pravilo o zadržavanju kaznilo baš ono što tražimo od
    // polaznika: da stane i sačeka da pješak siđe sa kolovoza.
    const { world } = run(scenarioById("pjesaci")!, perfectBot);
    expect(world.violations.map((v) => v.type)).not.toContain("obstruction");
  });

  it("i NPC staje pred pješakom", () => {
    const osnovni = scenarioById("pjesaci")!;
    const s: Scenario = {
      ...osnovni,
      // Igrač daleko iza, da ne utiče ni na šta.
      player: { ...osnovni.player, spawnDistance: 400 },
      npcs: [{ arm: "W", intent: "straight", spawnAt: [4, 4], speed: 11 }],
      // Sporiji pješak, da NPC mora stvarno da stane, a ne samo da uspori i
      // dočeka da prelaz bude slobodan.
      pedestrians: [{ arm: "W", dir: 1, spawnAt: [3, 3], speed: 0.7 }],
    };
    const tpl = TEMPLATES[s.intersection]!;
    const world = createWorld(s, 1);
    const npcPath = compile(tpl).paths.get(`${tpl.id}:W:straight`)!;
    const prelaz = crosswalkSpans(tpl, npcPath).find((x) => x.arm === "W")!;

    let stajao = false;
    for (let i = 0; i < 2000 && world.outcome === "running"; i++) {
      step(world, s, { throttle: 0, brake: 1 });
      const npc = world.vehicles.find((v) => v.kind === "npc");
      const ped = world.pedestrians[0]!;
      if (!npc || npc.done || world.t < npc.spawnT) continue;
      if (world.t >= ped.spawnT && !ped.done && pedestrianOnRoad(tpl, ped)) {
        expect(npc.s, `NPC je ušao na prelaz u t=${world.t.toFixed(1)}`).toBeLessThan(prelaz.from);
        if (npc.v < 0.2) stajao = true;
      }
    }
    expect(stajao, "NPC nikad nije stao pred pješakom").toBe(true);
  });
});

// ── Policajac ───────────────────────────────────────────────────────────────

describe("policajac", () => {
  const SA_POLICAJCEM = SCENARIOS.filter((s) => s.officer);

  it("naredba se vrti u krug po vremenu", () => {
    const officer = { phases: [{ allow: ["N", "S"] as Approach[], duration: 5 }, { allow: ["E", "W"] as Approach[], duration: 3 }] };
    expect(officerAllow(officer, 0)).toEqual(["N", "S"]);
    expect(officerAllow(officer, 4.9)).toEqual(["N", "S"]);
    expect(officerAllow(officer, 5)).toEqual(["E", "W"]);
    expect(officerAllow(officer, 7.9)).toEqual(["E", "W"]);
    expect(officerAllow(officer, 8)).toEqual(["N", "S"]); // novi krug
    expect(officerAllow(undefined, 3)).toBeNull();
  });

  for (const s of SA_POLICAJCEM) {
    it(`${s.id}: naredba je uvijek jedan pravac, dva nasuprotna kraka`, () => {
      // Policajac raširenim rukama propušta jedan pravac; scena se tako i crta.
      // Naredba koja propušta npr. N i E ne bi mogla da se nacrta, pa ni pročita.
      for (const faza of s.officer!.phases) {
        expect(faza.allow).toHaveLength(2);
        expect(OPPOSITE[faza.allow[0]!]).toBe(faza.allow[1]);
      }
    });
  }

  it("policajac je jači od crvenog svjetla — prolazak nije prekršaj", () => {
    const s = scenarioById("policajac-propusta")!;
    const tpl = TEMPLATES[s.intersection]!;
    // Svjetlo na kraku igrača zaista JESTE crveno — inače scenario ne dokazuje ništa.
    const arm = tpl.arms.find((a) => a.id === s.player.arm)!;
    expect(arm.control.kind).toBe("light");
    if (arm.control.kind === "light") {
      expect(lightFor(tpl, s.lightStartPhase ?? 0, arm.control.phaseGroup)).toBe("red");
    }
    const { world } = run(s, perfectBot);
    expect(world.violations).toEqual([]);
    expect(world.outcome).toBe("passed");
  });

  it("policajac je jači i od zelenog — prolazak jeste prekršaj", () => {
    const s = scenarioById("policajac-zaustavlja")!;
    const tpl = TEMPLATES[s.intersection]!;
    const arm = tpl.arms.find((a) => a.id === s.player.arm)!;
    expect(arm.control.kind).toBe("light");
    if (arm.control.kind === "light") {
      expect(lightFor(tpl, s.lightStartPhase ?? 0, arm.control.phaseGroup)).toBe("green");
    }
    const tipovi = run(s, flooringBot).world.violations.map((v) => v.type);
    // Prekršaj se mora zvati po policajcu: „prolazak na crveno" bi bio netačan
    // jer je svjetlo u tom trenutku zeleno.
    expect(tipovi).toContain("officer");
    expect(tipovi).not.toContain("redLight");
  });

  it("ko sačeka da ga policajac propusti, prođe", () => {
    const { world } = run(scenarioById("policajac-zaustavlja")!, perfectBot);
    expect(world.violations).toEqual([]);
    expect(world.outcome).toBe("passed");
  });

  it("NPC sluša policajca, a ne svoje svjetlo", () => {
    const s = scenarioById("policajac-propusta")!;
    const tpl = TEMPLATES[s.intersection]!;
    const world = createWorld(s, 1);
    const npcPath = compile(tpl).paths.get(`${tpl.id}:E:straight`)!;
    let imaoZeleno = false;
    for (let i = 0; i < 2000 && world.outcome === "running"; i++) {
      step(world, s, perfectBot(world, s));
      const npc = world.vehicles.find((v) => v.kind === "npc");
      if (!npc || world.t < npc.spawnT) continue;
      const arm = tpl.arms.find((a) => a.id === npc.arm)!;
      if (arm.control.kind === "light" && lightFor(tpl, world.phaseIndex, arm.control.phaseGroup) === "green") {
        imaoZeleno = true;
      }
      // Policajac ga ne propušta ni u jednom trenutku ovog scenarija.
      expect(npc.s, `NPC je prošao liniju iako ga policajac zaustavlja`).toBeLessThan(
        npcPath.stopLineS,
      );
    }
    expect(imaoZeleno, "NPC nikad nije imao zeleno — test ne dokazuje ništa").toBe(true);
  });
});

// ── Vozila pod pratnjom ─────────────────────────────────────────────────────

describe("vozilo pod pratnjom", () => {
  const arms: Approach[] = ["N", "E", "S", "W"];
  const intents: Intent[] = ["straight", "left", "right"];
  const controls: EffectiveControl[] = ["none", "yield", "stop", "priority", "green", "red"];

  it("ima prvenstvo nad svim regulacijama", () => {
    for (const a1 of arms)
      for (const a2 of arms) {
        if (a1 === a2) continue;
        for (const i1 of intents)
          for (const i2 of intents)
            for (const c1 of controls)
              for (const c2 of controls) {
                const hitna = { approach: a1, intent: i1, control: c1, emergency: true };
                const obicno = { approach: a2, intent: i2, control: c2 };
                expect(whoYields(hitna, obicno)).toBe("b");
                expect(whoYields(obicno, hitna)).toBe("a");
              }
      }
  });

  it("dva vozila pod pratnjom se sude po običnim pravilima", () => {
    const a = { approach: "N" as Approach, intent: "straight" as Intent, control: "none" as EffectiveControl, emergency: true };
    const b = { approach: "W" as Approach, intent: "straight" as Intent, control: "none" as EffectiveControl, emergency: true };
    // W je sa desne strane N-a — pravilo desne strane i dalje odlučuje.
    expect(whoYields(a, b)).toBe("a");
  });

  it("prolazi i na crveno svjetlo", () => {
    const s: Scenario = {
      id: "test-hitna-crveno",
      intersection: "cross-lights",
      difficulty: 3,
      title: { me: "test" },
      lightStartPhase: 0, // NS zeleno, dakle EW crveno
      player: { arm: "N", intent: "straight", spawnDistance: 400 },
      npcs: [{ arm: "E", intent: "straight", spawnAt: [0, 0], speed: 11, emergency: true }],
      explanation: { me: "test" },
    };
    const tpl = TEMPLATES[s.intersection]!;
    const world = createWorld(s, 1);
    const npcPath = compile(tpl).paths.get(`${tpl.id}:E:straight`)!;
    let presaoNaCrveno = false;
    let prije = 0;
    for (let i = 0; i < 1200 && world.outcome === "running"; i++) {
      const faza = world.phaseIndex;
      step(world, s, { throttle: 0, brake: 1 });
      const npc = world.vehicles.find((v) => v.kind === "npc")!;
      if (prije < npcPath.stopLineS && npc.s >= npcPath.stopLineS) {
        presaoNaCrveno = lightFor(tpl, faza, "EW") === "red";
      }
      prije = npc.s;
    }
    expect(presaoNaCrveno, "vozilo pod pratnjom nije prošlo na crveno").toBe(true);
  });

  it("igrač na glavnom putu mu ipak mora ustupiti", () => {
    const s = scenarioById("hitna")!;
    const tipovi = run(s, flooringBot).world.violations.map((v) => v.type);
    expect(tipovi.some((x) => x === "rightOfWay" || x === "collision")).toBe(true);
    const { world } = run(s, perfectBot);
    expect(world.violations).toEqual([]);
    expect(world.outcome).toBe("passed");
  });
});
