import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { flooringBot, perfectBot, run, wrongIndicatorBot, type Bot } from "./bots";
import { INDICATOR_LEAD, INDICATOR_OFF_AFTER } from "./config";
import {
  expectedIndicatorAt,
  INDICATOR_RULES,
  phasesFor,
  resolveSpot,
  type IndicatorPhase,
} from "./indicatorRules";
import { compile, TEMPLATES } from "./intersection";
import type { Path, Scenario } from "./types";
import { turnSide } from "./types";
import { hasFail, PLAYER_ID } from "./world";

const SKRECU = SCENARIOS.filter((s) => turnSide(s.player.intent) !== null);
const IDU_PRAVO = SCENARIOS.filter((s) => turnSide(s.player.intent) === null);

function putanjaIgraca(s: Scenario): Path {
  const tpl = TEMPLATES[s.intersection]!;
  const { paths } = compile(tpl);
  const p = [...paths.values()].find(
    (x) => x.arm === s.player.arm && x.intent === s.player.intent,
  );
  return p!;
}

/** Bot koji vozi savršeno, ali pokazivač pali po zadatoj funkciji mjesta. */
function pokazivacBot(fn: (s: number) => "left" | "right" | null): Bot {
  return (world, scenario) => {
    const p = world.vehicles.find((v) => v.id === PLAYER_ID)!;
    return { ...perfectBot(world, scenario), indicator: fn(p.s) };
  };
}

// ── Tabela ──────────────────────────────────────────────────────────────────

describe("tabela pravila", () => {
  it("sidra se razrješavaju u mjesta na putanji", () => {
    const s = scenarioById("ljevak")!;
    const path = putanjaIgraca(s);
    expect(resolveSpot(path, { at: "stopLine", offset: 0 })).toBeCloseTo(path.stopLineS, 6);
    expect(resolveSpot(path, { at: "stopLine", offset: -INDICATOR_LEAD })).toBeCloseTo(
      path.stopLineS - INDICATOR_LEAD,
      6,
    );
    // Van putanje se odsijeca — faza ne smije da počne prije početka.
    expect(resolveSpot(path, { at: "pathStart", offset: -999 })).toBe(0);
    expect(resolveSpot(path, { at: "pathEnd", offset: 999 })).toBeCloseTo(path.length, 6);
  });

  it("za skretanje ulijevo važe tri faze, redom", () => {
    const s = scenarioById("ljevak")!;
    const faze = phasesFor(putanjaIgraca(s), s.player.intent);
    expect(faze.map((f) => f.id)).toEqual(["najava-lijevo", "gasenje-lijevo"]);
    expect(faze[0]!.severity).toBe("fail");
    expect(faze[0]!.mustBeSetBefore).toBeCloseTo(putanjaIgraca(s).stopLineS, 6);
    // `mustBeSetBefore` mora biti STROGO unutar faze, inače `indicatorLate`
    // nema gdje da se desi. Vidi komentar uz tabelu.
    expect(faze[0]!.mustBeSetBefore!).toBeLessThan(faze[0]!.to);
    expect(faze[1]!.expected).toBeNull();
  });

  it("očekivano stanje se čita sa mjesta na putanji", () => {
    const s = scenarioById("ljevak")!;
    const path = putanjaIgraca(s);
    expect(expectedIndicatorAt(path, s.player.intent, path.stopLineS - INDICATOR_LEAD - 5)).toBeNull();
    expect(expectedIndicatorAt(path, s.player.intent, path.stopLineS - 1)).toBe("left");
    expect(expectedIndicatorAt(path, s.player.intent, path.boxExitS - 0.5)).toBe("left");
    expect(
      expectedIndicatorAt(path, s.player.intent, path.boxExitS + INDICATOR_OFF_AFTER + 1),
    ).toBeNull();
  });
});

// ── Ponašanje ───────────────────────────────────────────────────────────────

describe("pokazivač u vožnji", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: savršen vozač nema nijedan prekršaj pokazivača`, () => {
      const { world } = run(s, perfectBot);
      expect(world.violations.filter((v) => v.type.startsWith("indicator"))).toEqual([]);
    });
  }

  for (const s of SKRECU) {
    it(`${s.id}: bez pokazivača na skretanju je prekršaj koji obara vožnju`, () => {
      const { world } = run(s, flooringBot);
      const v = world.violations.find((x) => x.type === "indicatorMissing");
      expect(v, `prijavljeno: ${JSON.stringify(world.violations.map((x) => x.type))}`).toBeDefined();
      expect(v!.severity).toBe("fail");
      expect(v!.phaseId).toBe(turnSide(s.player.intent) === "left" ? "najava-lijevo" : "najava-desno");
    });

    it(`${s.id}: pokazivač na pogrešnu stranu je prijavljen`, () => {
      const { world } = run(s, wrongIndicatorBot);
      expect(world.violations.map((x) => x.type)).toContain("indicatorWrong");
    });
  }

  for (const s of IDU_PRAVO) {
    it(`${s.id}: vožnja pravo bez pokazivača ne prijavljuje ništa`, () => {
      const { world } = run(s, flooringBot);
      expect(world.violations.filter((v) => v.type.startsWith("indicator"))).toEqual([]);
    });
  }

  it("pokazivač uključen pri vožnji pravo je blaga greška, ne pad", () => {
    const s = scenarioById("desna-imas-prednost")!;
    const { world } = run(s, pokazivacBot(() => "left"));
    const v = world.violations.find((x) => x.type === "indicatorWrong");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("minor");
    // Blaga greška se prijavi, ali vožnja ostaje ispravna.
    expect(hasFail(world)).toBe(false);
    expect(world.outcome).toBe("passed");
  });
});

describe("kasno i ostavljeno", () => {
  it("uključen tek poslije stop-linije je `indicatorLate`, i to blago", () => {
    const s = scenarioById("ljevak")!;
    const path = putanjaIgraca(s);
    const { world } = run(
      s,
      pokazivacBot((x) => (x > path.stopLineS + 0.5 && x < path.boxExitS ? "left" : null)),
    );
    const tipovi = world.violations.map((v) => v.type);
    expect(tipovi).toContain("indicatorLate");
    expect(world.violations.find((v) => v.type === "indicatorLate")!.severity).toBe("minor");
    // Kašnjenje je JEDAN prekršaj, ne dva: pokazivač jeste bio uključen na toj
    // dionici, samo prekasno, pa `indicatorMissing` nema šta da traži.
    expect(tipovi).not.toContain("indicatorMissing");
    expect(world.outcome).toBe("passed");
  });

  it("ostavljen poslije skretanja je `indicatorLeftOn`, blago, i vožnja prolazi", () => {
    const s = scenarioById("ljevak")!;
    const { world } = run(s, pokazivacBot(() => "left"));
    const v = world.violations.find((x) => x.type === "indicatorLeftOn");
    expect(v, `prijavljeno: ${JSON.stringify(world.violations.map((x) => x.type))}`).toBeDefined();
    expect(v!.severity).toBe("minor");
    expect(world.outcome).toBe("passed");
  });
});

// ── Tabela je podatak ───────────────────────────────────────────────────────

describe("izmjena tabele mijenja ocjenu bez izmjene detekcije", () => {
  const s = scenarioById("ljevak")!;

  it("ista vožnja pada po zadatoj tabeli, a prolazi kad se najava spusti na blagu", () => {
    const strogo = run(s, flooringBot).world;
    expect(strogo.violations.find((v) => v.type === "indicatorMissing")!.severity).toBe("fail");

    const blaza: IndicatorPhase[] = INDICATOR_RULES.map((r) =>
      r.id === "najava-lijevo" ? { ...r, severity: "minor" as const } : r,
    );
    const popustljivo = run({ ...s, indicatorRules: blaza }, flooringBot).world;
    expect(popustljivo.violations.find((v) => v.type === "indicatorMissing")!.severity).toBe(
      "minor",
    );
  });

  it("tabela koja traži suprotnu stranu obara i savršenog vozača", () => {
    // Dokaz da detekcija stvarno čita tabelu: savršen bot vozi po njoj, pa ako
    // se tabela okrene, i on i ocjena se okrenu — bez ijedne izmjene u kodu.
    const obrnuto: IndicatorPhase[] = INDICATOR_RULES.map((r) =>
      r.maneuver === "left" && r.expected === "left" ? { ...r, expected: "right" as const } : r,
    );
    // Bot koji i dalje pali lijevi (kao da tabela nije promijenjena).
    const staraNavika = pokazivacBot((x) => {
      const path = putanjaIgraca(s);
      return x > path.stopLineS - INDICATOR_LEAD && x < path.boxExitS ? "left" : null;
    });
    const { world } = run({ ...s, indicatorRules: obrnuto }, staraNavika);
    expect(world.violations.map((v) => v.type)).toContain("indicatorWrong");
  });
});
