import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import {
  RING_ORDER,
  whoYields,
  type Approach,
  type EffectiveControl,
} from "@/lib/simRules";
import { flooringBot, noIndicatorBot, perfectBot, run } from "./bots";
import { RING_YIELD_SETBACK } from "./config";
import { phasesFor } from "./indicatorRules";
import { compile, TEMPLATES } from "./intersection";
import {
  exitArmFor,
  ringGap,
  ringPorts,
  ringU,
  ringUAt,
} from "./roundabout";
import type { Path, RoundaboutTemplate as Rtpl, Scenario } from "./types";
import { createWorld, intentKey, PLAYER_ID, step } from "./world";

const TPL = TEMPLATES["kruzni"] as Rtpl;
const KRUZNI = SCENARIOS.filter(
  (s) => TEMPLATES[s.intersection]?.kind === "roundabout",
);

function put(s: Scenario): Path {
  const tpl = TEMPLATES[s.intersection]!;
  return compile(tpl).paths.get(`${tpl.id}:${s.player.arm}:${intentKey(s.player.intent)}`)!;
}

// ── Prvenstvo ───────────────────────────────────────────────────────────────

describe("prvenstvo u kružnom toku", () => {
  const u = (approach: Approach, control: EffectiveControl, inRing: boolean) => ({
    approach,
    intent: "straight" as const,
    control,
    inRing,
  });

  it("vozilo u prstenu ima prvenstvo nad onim koje ulazi", () => {
    expect(whoYields(u("N", "yield", false), u("E", "yield", true))).toBe("a");
    expect(whoYields(u("E", "yield", true), u("N", "yield", false))).toBe("b");
  });

  it("STOP na ulazu ne mijenja redosljed, samo ponašanje", () => {
    // Znak STOP obavezuje na zaustavljanje, ali vozilo u prstenu ionako ima
    // prvenstvo — pa se ishod ne mijenja.
    expect(whoYields(u("N", "stop", false), u("E", "yield", true))).toBe("a");
  });

  it("dva vozila u prstenu se ne rješavaju prvenstvom", () => {
    // Oba kruže; ko je ispred rješava odstojanje, ne pravilo. Ovdje ostaje
    // pravilo desne strane, ali ga NPC logika nikad ne dobije da riješi jer
    // ih razdvaja praćenje po prstenu.
    expect(whoYields(u("N", "yield", true), u("S", "yield", true))).toBeNull();
  });

  it("dva vozila koja ulaze sa različitih krakova nemaju međusobni konflikt na ulazu", () => {
    const c = compile(TPL).conflicts.get("kruzni:N:exit2") ?? [];
    // Konflikti postoje samo sa vozilima koja su u prstenu na mom ulazu —
    // nikad sa vozilom koje TEK ulazi na svom kraku.
    for (const k of c) {
      const drugi = compile(TPL).paths.get(k.pathB)!;
      const uMom = k.sA;
      const uNjegovom = k.sB;
      const jaUlazim = Math.abs(uMom - put(scenarioById("kruzni-izlaz2")!).stopLineS) < 0.01;
      if (jaUlazim) expect(uNjegovom).toBeGreaterThan(drugi.boxEnterS);
    }
  });
});

// ── Geometrija prstena ──────────────────────────────────────────────────────

describe("geometrija prstena", () => {
  it("izlazi se redaju po `RING_ORDER`", () => {
    expect(RING_ORDER).toEqual(["N", "W", "S", "E"]);
    expect(exitArmFor("N", 1)).toBe("W");
    expect(exitArmFor("N", 2)).toBe("S");
    expect(exitArmFor("N", 3)).toBe("E");
    expect(exitArmFor("N", 4)).toBe("N"); // puni krug
  });

  it("položaj duž prstena raste u smjeru vožnje", () => {
    const p = compile(TPL).paths.get("kruzni:N:exit3")!;
    const u1 = ringUAt(p, p.boxEnterS + 1)!;
    const u2 = ringUAt(p, p.boxEnterS + 10)!;
    expect(u2).toBeGreaterThan(u1);
    // Razmak duž prstena je otprilike pređeni put — prsten je kružnica, ne pravac.
    expect(ringGap(u1, u2, TPL.radius)).toBeCloseTo(9, 0);
  });

  it("ulaz i izlaz istog kraka su na suprotnim stranama njegove ose", () => {
    const { enterAngle, leaveAngle } = ringPorts(TPL, "N");
    // Kretanje ide ka manjem uglu, pa se prvo naiđe na ulaz pa na izlaz — dakle
    // ulaz ima manji `u`.
    expect(ringU(enterAngle, TPL.radius)).toBeGreaterThan(ringU(leaveAngle, TPL.radius));
  });

  it("linija ustupanja je odmaknuta od prstena", () => {
    // Bez odmaka vozilo koje ispravno čeka stoji nosom u kružnoj traci i biva
    // pokošeno — izmjereno, tri od četiri scenarija su tako padala.
    const p = compile(TPL).paths.get("kruzni:N:exit2")!;
    expect(p.boxEnterS - p.stopLineS).toBeCloseTo(RING_YIELD_SETBACK, 1);
  });

  it("prethodni izlaz je zaista prije mog", () => {
    for (const [id, p] of compile(TPL).paths) {
      if (!p.ring) continue;
      expect(p.prevExitS, id).toBeGreaterThanOrEqual(p.boxEnterS - 0.01);
      expect(p.prevExitS, id).toBeLessThanOrEqual(p.boxExitS + 0.01);
    }
  });
});

// ── Pokazivač u prstenu ─────────────────────────────────────────────────────

describe("pokazivač u kružnom toku", () => {
  const faze = (exitN: number) =>
    phasesFor(compile(TPL).paths.get(`kruzni:N:exit${exitN}`)!, { kind: "exit", n: exitN });

  it("prvi izlaz: desni od prilaza", () => {
    const f = faze(1);
    expect(f[0]!.expected).toBe("right");
    expect(f[0]!.severity).toBe("fail");
  });

  it("drugi izlaz: ništa na prilazu, desni tek poslije prethodnog izlaza", () => {
    const f = faze(2);
    expect(f[0]!.expected).toBeNull();
    expect(f[1]!.expected).toBe("right");
    const p = compile(TPL).paths.get("kruzni:N:exit2")!;
    expect(f[1]!.from).toBeCloseTo(p.prevExitS!, 1);
  });

  it("treći izlaz i puni krug: lijevi na prilazu, pa desni pred izlazom", () => {
    for (const n of [3, 4]) {
      const f = faze(n);
      expect(f[0]!.expected, `izlaz ${n}`).toBe("left");
      expect(f[1]!.expected, `izlaz ${n}`).toBe("right");
    }
  });

  it("lijevi ostaje uključen kroz krug, do izlaza prije svog", () => {
    // Ovo je tačka koju tabela izričito propisuje: `left` se ne gasi po ulasku
    // u prsten nego traje do prethodnog izlaza.
    const p = compile(TPL).paths.get("kruzni:N:exit4")!;
    const f = faze(4)[0]!;
    expect(f.from).toBeLessThan(p.boxEnterS);
    expect(f.to).toBeCloseTo(p.prevExitS!, 1);
  });
});

// ── Scenariji ───────────────────────────────────────────────────────────────

describe("scenariji kružnog toka", () => {
  it("ima ih četiri i pokrivaju ulazak, gužvu, puni krug i STOP", () => {
    expect(KRUZNI.map((s) => s.id)).toEqual([
      "kruzni-izlaz2",
      "kruzni-stop",
      "kruzni-gust",
      "kruzni-polukruzno",
    ]);
  });

  for (const s of KRUZNI) {
    it(`${s.id}: savršen vozač prolazi bez ijednog prekršaja`, () => {
      for (const seed of [1, 7, 42]) {
        const { world } = run(s, perfectBot, seed);
        expect(
          world.violations.map((v) => `${v.type}:${v.phaseId ?? ""}`),
          `${s.id}/${seed}`,
        ).toEqual([]);
        expect(world.outcome).toBe("passed");
      }
    });

    it(`${s.id}: bez pokazivača se prijavljuje propust`, () => {
      const { world } = run(s, noIndicatorBot);
      expect(world.violations.some((v) => v.type.startsWith("indicator"))).toBe(true);
    });
  }

  it("kruzni-stop: znak STOP traži potpuno zaustavljanje i kad je prsten prazan", () => {
    const s = scenarioById("kruzni-stop")!;
    const prazan: Scenario = { ...s, npcs: [] };
    const { world } = run(prazan, flooringBot);
    expect(world.violations.map((v) => v.type)).toContain("stopSign");
  });

  it("kruzni-polukruzno: vozila koja ulaze ne sijeku igrača u prstenu", () => {
    const s = scenarioById("kruzni-polukruzno")!;
    const tpl = TEMPLATES[s.intersection]! as Rtpl;
    const { paths } = compile(tpl);
    const world = createWorld(s, 1);
    const prije = new Map(world.vehicles.map((v) => [v.id, v.s]));
    let biloUPrstenu = false;
    let bioUlazak = false;

    for (let i = 0; i < 4000 && world.outcome === "running"; i++) {
      step(world, s, perfectBot(world, s));
      const igrac = world.vehicles.find((v) => v.id === PLAYER_ID)!;
      const pp = paths.get(igrac.pathId)!;
      const uIgraca = ringUAt(pp, igrac.s);
      if (uIgraca !== null) biloUPrstenu = true;

      for (const npc of world.vehicles) {
        if (npc.kind !== "npc" || world.t < npc.spawnT) continue;
        const np = paths.get(npc.pathId)!;
        const bio = prije.get(npc.id) ?? 0;
        prije.set(npc.id, npc.s);
        // Zanima nas TREN ulaska u prsten, ne stanje poslije toga.
        if (!(bio < np.boxEnterS && npc.s >= np.boxEnterS)) continue;
        bioUlazak = true;
        if (uIgraca === null) continue;
        const uUlaza = ringU(ringPorts(tpl, npc.arm).enterAngle, tpl.radius);
        // Koliko je igraču ostalo do te ulazne tačke duž prstena.
        const razmak = ringGap(uIgraca, uUlaza, tpl.radius);
        expect(
          razmak,
          `${npc.id} je ušao u prsten dok mu je igrač bio ${razmak.toFixed(1)} m iza`,
        ).toBeGreaterThan(8);
      }
    }
    expect(biloUPrstenu, "igrač nikad nije ušao u prsten").toBe(true);
    expect(bioUlazak, "nijedan NPC nije ušao u prsten — test ne dokazuje ništa").toBe(true);
  });
});
