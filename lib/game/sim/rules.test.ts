import { describe, expect, it } from "vitest";
import {
  OPPOSITE,
  YIELDS_TO,
  priorityTier,
  solveOrder,
  whoYields,
  type Approach,
  type DrawnScenario,
  type EffectiveControl,
  type Intent,
  type YieldParty,
} from "@/lib/simRules";
import { SCENARIOS } from "@/lib/game/scenarios";

const p = (approach: Approach, intent: Intent, control: EffectiveControl): YieldParty => ({
  approach,
  intent,
  control,
});

describe("whoYields — pravilo desne strane", () => {
  it("ustupa se vozilu sa desne strane", () => {
    // N ustupa W, W ustupa S, S ustupa E, E ustupa N.
    for (const from of ["N", "E", "S", "W"] as Approach[]) {
      const to = YIELDS_TO[from];
      expect(whoYields(p(from, "straight", "none"), p(to, "straight", "none"))).toBe("a");
      expect(whoYields(p(to, "straight", "none"), p(from, "straight", "none"))).toBe("b");
    }
  });

  it("vozila iz suprotnih krakova koja idu pravo se ne sudaraju po pravilima", () => {
    expect(whoYields(p("N", "straight", "none"), p("S", "straight", "none"))).toBeNull();
    expect(whoYields(p("E", "straight", "none"), p("W", "straight", "none"))).toBeNull();
  });
});

describe("whoYields — znaci", () => {
  it("sporedni ustupa glavnom bez obzira na stranu", () => {
    // W je sa desne strane N-a, ali N je na glavnom putu — znak je jači.
    expect(whoYields(p("N", "straight", "priority"), p("W", "straight", "yield"))).toBe("b");
    expect(whoYields(p("W", "straight", "yield"), p("N", "straight", "priority"))).toBe("a");
  });

  it("STOP i trougao su isti NIVO prvenstva", () => {
    expect(priorityTier("stop")).toBe(priorityTier("yield"));
    // Među njima odlučuje desna strana, ne vrsta znaka.
    expect(whoYields(p("N", "straight", "stop"), p("W", "straight", "yield"))).toBe("a");
  });

  it("dva vozila na glavnom putu razrješava pravilo desne strane", () => {
    // Ovo je slučaj izlomljenog glavnog puta: oba kraka nose `priority`.
    expect(whoYields(p("N", "straight", "priority"), p("W", "straight", "priority"))).toBe("a");
  });
});

describe("whoYields — semafor", () => {
  it("crveno ustupa zelenom", () => {
    expect(whoYields(p("N", "straight", "red"), p("E", "straight", "green"))).toBe("a");
    expect(whoYields(p("E", "straight", "green"), p("N", "straight", "red"))).toBe("b");
  });

  it("zeleno ne znači slobodno — među zelenima važe ostala pravila", () => {
    // Ljevak na zeleno ustupa susretnom koji ide pravo na zeleno.
    expect(whoYields(p("N", "left", "green"), p("S", "straight", "green"))).toBe("a");
  });

  it("semafor je jači od znaka", () => {
    expect(whoYields(p("N", "straight", "red"), p("W", "straight", "yield"))).toBe("a");
  });
});

describe("whoYields — ljevak", () => {
  it("ljevak ustupa susretnom koji ide pravo", () => {
    expect(whoYields(p("N", "left", "none"), p("S", "straight", "none"))).toBe("a");
    expect(whoYields(p("S", "straight", "none"), p("N", "left", "none"))).toBe("b");
  });

  it("ljevak ustupa susretnom koji skreće desno", () => {
    expect(whoYields(p("N", "left", "none"), p("S", "right", "none"))).toBe("a");
  });

  it("dva ljevaka iz suprotnih krakova se mimoilaze", () => {
    expect(whoYields(p("N", "left", "none"), p("S", "left", "none"))).toBeNull();
  });
});

describe("whoYields — simetričnost", () => {
  it("nikad oba ne ustupaju jedan drugom", () => {
    const arms: Approach[] = ["N", "E", "S", "W"];
    const intents: Intent[] = ["straight", "left", "right"];
    const controls: EffectiveControl[] = ["none", "yield", "stop", "priority", "green", "red"];
    for (const a1 of arms)
      for (const a2 of arms)
        for (const i1 of intents)
          for (const i2 of intents)
            for (const c1 of controls)
              for (const c2 of controls) {
                if (a1 === a2) continue;
                const ab = whoYields(p(a1, i1, c1), p(a2, i2, c2));
                const ba = whoYields(p(a2, i2, c2), p(a1, i1, c1));
                // Ako jedan ustupa, drugi ne smije da ustupa istovremeno.
                if (ab === "a") expect(ba).toBe("b");
                if (ab === "b") expect(ba).toBe("a");
                if (ab === null) expect(ba).toBeNull();
              }
  });
});

describe("izvedeni pojmovi", () => {
  it("OPPOSITE je involucija", () => {
    for (const a of ["N", "E", "S", "W"] as Approach[]) {
      expect(OPPOSITE[OPPOSITE[a]]).toBe(a);
    }
  });
});

// ── regresija za POSTOJEĆI simulator ────────────────────────────────────────
// Komentar u lib/simScenarios.ts tvrdi da svaki `answer` provjerava test protiv
// rule-engine-a. Taj test nije postojao — evo ga.

describe("postojeći scenariji statičnog simulatora", () => {
  it("svaki autorski `answer` se poklapa sa rule-engine-om", async () => {
    const { DRAWN_SCENARIOS } = await import("@/lib/simScenarios");
    const neslaganja: string[] = [];
    for (const s of DRAWN_SCENARIOS as DrawnScenario[]) {
      if (!s.answer) continue;
      const solved = solveOrder(s);
      if (!solved || solved.join(",") !== s.answer.join(",")) {
        neslaganja.push(`${s.id}: engine ${solved?.join(",") ?? "null"} ≠ autor ${s.answer.join(",")}`);
      }
    }
    expect(neslaganja).toEqual([]);
  });

  it("nijedna scena nema dva vozila na istom kraku", async () => {
    const { DRAWN_SCENARIOS } = await import("@/lib/simScenarios");
    for (const s of DRAWN_SCENARIOS as DrawnScenario[]) {
      const arms = s.vehicles.map((v) => v.approach);
      expect(new Set(arms).size).toBe(arms.length);
    }
  });
});

describe("scenariji igre", () => {
  it("svaki ima jedinstven id i objašnjenje na crnogorskom", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS) {
      const me = s.explanation.me;
      expect(me, `${s.id} nema objasnjenje na crnogorskom`).toBeTruthy();
      expect(me!.length).toBeGreaterThan(40);
      // Prva verzija ovih tekstova je bila bez dijakritika („vazi", „propustate")
      // i tako je i završila na ekranu. Ostatak sajta piše pravopisno, pa mora i
      // ovo: tekst bez ijednog našeg slova je gotovo sigurno nedovršen.
      expect(me!, `${s.id}: objašnjenje je bez dijakritika`).toMatch(/[čćžšđ]/);
    }
  });
});
