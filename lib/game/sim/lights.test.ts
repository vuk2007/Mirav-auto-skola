import { describe, expect, it } from "vitest";
import { SCENARIOS, scenarioById } from "@/lib/game/scenarios";
import { flooringBot, perfectBot, run } from "./bots";
import { DT } from "./config";
import { compile, lightCountdown, lightFor, TEMPLATES } from "./intersection";
import type { IntersectionTemplate, Scenario, Template } from "./types";
import { createWorld, officerAllow, PLAYER_ID, step } from "./world";

function programOf(t: Template | undefined) {
  return t && t.kind === "cross" ? t.lightProgram : undefined;
}

const SA_SEMAFOROM = Object.values(TEMPLATES).filter(
  (t): t is IntersectionTemplate => (programOf(t)?.length ?? 0) > 0,
);

const SCENARIJI_SA_SEMAFOROM = SCENARIOS.filter(
  (s) => (programOf(TEMPLATES[s.intersection])?.length ?? 0) > 0,
);

describe("program semafora", () => {
  for (const tpl of SA_SEMAFOROM) {
    it(`${tpl.id}: dvije grupe nikad nemaju zeleno istovremeno`, () => {
      const grupe = [
        ...new Set(
          tpl.arms
            .map((a) => (a.control.kind === "light" ? a.control.phaseGroup : null))
            .filter((g): g is string => g !== null),
        ),
      ];
      tpl.lightProgram!.forEach((_, i) => {
        const zelene = grupe.filter((g) => lightFor(tpl, i, g) === "green");
        expect(zelene.length, `${tpl.id}, faza ${i}: zeleno za ${zelene.join(", ")}`).toBeLessThan(2);
      });
    });

    it(`${tpl.id}: poslije svakog žutog ide međufaza u kojoj niko nema zeleno`, () => {
      // Bez te međufaze vozilo koje je legalno ušlo na žuto još je u raskrsnici
      // kad poprečni pravac krene — sudar koji nije ničija greška.
      const program = tpl.lightProgram!;
      program.forEach((faza, i) => {
        if (!faza.yellow?.length) return;
        const sljedeca = program[(i + 1) % program.length]!;
        expect(
          sljedeca.green.length,
          `${tpl.id}: poslije žutog u fazi ${i} odmah ide zeleno`,
        ).toBe(0);
      });
    });

    it(`${tpl.id}: žuto se pali samo grupi koja je prije toga imala zeleno`, () => {
      const program = tpl.lightProgram!;
      program.forEach((faza, i) => {
        for (const g of faza.yellow ?? []) {
          const prije = program[(i - 1 + program.length) % program.length]!;
          expect(prije.green, `${tpl.id}: ${g} dobija žuto bez prethodnog zelenog`).toContain(g);
        }
      });
    });
  }
});

describe("odbrojavanje", () => {
  it("broji do promjene boje, a ne do kraja faze", () => {
    const tpl = TEMPLATES["cross-lights"]!;
    // Faza 1 je žuto za NS. Za EW je tu crveno, i ostaje crveno kroz međufazu
    // (2 s), pa se pali njihovo zeleno — dakle 3 + 2 = 5 s od početka faze 1.
    expect(lightCountdown(tpl, 1, 0, "EW")).toBeCloseTo(5, 6);
    // Za NS je to žuto, i mijenja se za 3 s.
    expect(lightCountdown(tpl, 1, 0, "NS")).toBeCloseTo(3, 6);
    // Protekло vrijeme u fazi se oduzima.
    expect(lightCountdown(tpl, 1, 1.25, "NS")).toBeCloseTo(1.75, 6);
  });

  it("stigne na nulu tačno kad se boja promijeni", () => {
    const s = scenarioById("semafor")!;
    const tpl = TEMPLATES[s.intersection]!;
    const world = createWorld(s, 1);
    const grupa = "NS"; // krak igrača
    let prije = lightFor(tpl, world.phaseIndex, grupa);
    let posljednje = lightCountdown(tpl, world.phaseIndex, world.phaseT, grupa)!;
    for (let i = 0; i < 3000; i++) {
      step(world, s, perfectBot(world, s));
      const sada = lightFor(tpl, world.phaseIndex, grupa);
      if (sada !== prije) {
        // Prije same promjene odbrojavanje mora biti ispod jednog koraka.
        expect(posljednje, `boja se promijenila a odbrojavanje je bilo ${posljednje}`).toBeLessThan(
          2 * DT,
        );
        prije = sada;
      }
      posljednje = lightCountdown(tpl, world.phaseIndex, world.phaseT, grupa)!;
      if (world.outcome !== "running") break;
    }
  });
});

describe("vozila i semafor", () => {
  for (const s of SCENARIJI_SA_SEMAFOROM) {
    it(`${s.id}: nijedan NPC ne prelazi stop-liniju bez prava prolaza`, () => {
      const tpl = TEMPLATES[s.intersection] as IntersectionTemplate;
      const { paths } = compile(tpl);
      for (const seed of [1, 7, 42]) {
        const world = createWorld(s, seed);
        const prije = new Map(world.vehicles.map((v) => [v.id, v.s]));
        for (let i = 0; i < 4000 && world.outcome === "running"; i++) {
          const faza = world.phaseIndex;
          const naredba = officerAllow(s.officer, world.t);
          step(world, s, perfectBot(world, s));
          for (const v of world.vehicles) {
            if (v.kind !== "npc" || world.t < v.spawnT) continue;
            const path = paths.get(v.pathId)!;
            const bio = prije.get(v.id) ?? 0;
            if (bio < path.stopLineS && v.s >= path.stopLineS) {
              // Kad je policajac na raskrsnici, pravo prolaza daje ON, a ne
              // semafor — vozilo tada smije preko linije i na crveno svjetlo.
              // Vozilo pod pratnjom prolazi u oba slučaja.
              const smije = naredba
                ? naredba.includes(v.arm) || v.emergency
                : (() => {
                    const arm = tpl.arms.find((a) => a.id === v.arm)!;
                    const boja =
                      arm.control.kind === "light"
                        ? lightFor(tpl, faza, arm.control.phaseGroup)
                        : "green";
                    return boja !== "red" || Boolean(v.emergency);
                  })();
              expect(smije, `${s.id}/${seed}: ${v.id} prešao liniju bez prava`).toBe(true);
            }
            prije.set(v.id, v.s);
          }
        }
      }
    });
  }
});

describe("odluka na žuto", () => {
  it("žuto izdaleka: prolazak je prekršaj", () => {
    const s = scenarioById("semafor-zuto")!;
    const { world } = run(s, flooringBot);
    expect(world.violations.map((v) => v.type)).toContain("redLight");
  });

  it("žuto tik pred linijom: prolazak nije prekršaj", () => {
    // Isti scenario, samo se žuto pali kasnije — taman kad je bezobzirni igrač
    // preblizu da bi bezbjedno stao. Tada pravilo dozvoljava nastavak, pa
    // prekršaja nema. Bez ovog para se ne vidi da `YELLOW_COMMIT_TTC` uopšte
    // radi: prvi test bi prošao i da je prolazak na žuto uvijek prekršaj.
    const osnovni = scenarioById("semafor-zuto")!;
    const kasno: Scenario = { ...osnovni, lightStartT: 1.4, npcs: [] };
    const { world } = run(kasno, flooringBot);
    expect(world.violations.map((v) => v.type)).not.toContain("redLight");
  });

  it("igrač koji ispravno stane na žuto prođe bez ijednog prekršaja", () => {
    const s = scenarioById("semafor-zuto")!;
    const { world } = run(s, perfectBot);
    expect(world.violations).toEqual([]);
    expect(world.outcome).toBe("passed");
  });
});

describe("zeleno ne znači slobodno", () => {
  it("ljevak na zeleno mora propustiti susretnog", () => {
    const s = scenarioById("semafor-ljevak")!;
    const tpl = TEMPLATES[s.intersection] as IntersectionTemplate;
    // Oba vozila zaista imaju zeleno na startu — inače scenario uči nešto drugo.
    const zaKrak = (id: string) => tpl.arms.find((a) => a.id === id)!.control;
    for (const krak of [s.player.arm, s.npcs[0]!.arm]) {
      const c = zaKrak(krak);
      expect(c.kind).toBe("light");
      if (c.kind === "light") {
        expect(lightFor(tpl, s.lightStartPhase ?? 0, c.phaseGroup)).toBe("green");
      }
    }
    expect(run(s, flooringBot).world.violations.map((v) => v.type)).toContain("rightOfWay");
    expect(run(s, perfectBot).world.violations).toEqual([]);
  });
});

describe("igrač na crvenom ne dobija zadržavanje saobraćaja", () => {
  it("stajanje na crveno se ne kažnjava", () => {
    const s = scenarioById("semafor")!;
    const world = createWorld(s, 1);
    // Vozi normalno do linije, pa stoji dok je crveno.
    for (let i = 0; i < 4000 && world.outcome === "running"; i++) {
      step(world, s, perfectBot(world, s));
      const p = world.vehicles.find((v) => v.id === PLAYER_ID)!;
      if (p.done) break;
    }
    expect(world.violations.map((v) => v.type)).not.toContain("obstruction");
  });
});
