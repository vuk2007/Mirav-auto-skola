import { describe, expect, it } from "vitest";
import { DECISION_HOLD, DECISION_LEAD, DT, INDICATOR_LEAD } from "./config";
import { compile, TEMPLATES } from "./intersection";
import { createWorld, PLAYER_ID, step } from "./world";
import type { Input, Intent, Scenario, Vehicle, World } from "./types";

/**
 * Izbor pravca volanom.
 *
 * Do sada je putanju kroz raskrsnicu birao scenario, a igrač ju je samo vozio.
 * Sada je bira volan — i to je jedina razlika: sve ostalo (prvenstvo, pokazivač,
 * prekršaji) radi nad istom putanjom kao i prije.
 */

const scenario = (
  raskrsnica: string,
  intent: Intent,
  upravljanje: "traka" | "sina" = "traka",
): Scenario => ({
  id: `test:izbor:${raskrsnica}:${JSON.stringify(intent)}:${upravljanje}`,
  intersection: raskrsnica,
  player: { arm: "N", intent, spawnDistance: 42 },
  npcs: [],
  upravljanje: upravljanje === "traka" ? "traka" : undefined,
  difficulty: 1,
  title: { me: "proba" },
  explanation: { me: "proba" },
});

const ulaz = (steer: number): Input => ({
  throttle: 0,
  brake: 0,
  indicator: null,
  changeLane: null,
  steer,
});

const igrac = (w: World): Vehicle => w.vehicles.find((v) => v.id === PLAYER_ID)!;

/** Drži volan `sekundi` sekundi, bez gasa — mjesto na prilazu se ne mijenja. */
function drzi(s: Scenario, steer: number, sekundi: number, naS?: number): World {
  const world = createWorld(s, 1);
  if (naS !== undefined) igrac(world).s = naS;
  for (let i = 0; i < Math.round(sekundi / DT); i++) step(world, s, ulaz(steer));
  return world;
}

describe("krstasta raskrsnica", () => {
  it("volan ulijevo bira lijevo, udesno desno", () => {
    expect(igrac(drzi(scenario("cross-none", "straight"), -1, 1)).intent).toBe("left");
    expect(igrac(drzi(scenario("cross-none", "straight"), 1, 1)).intent).toBe("right");
  });

  it("bez volana se ide pravo", () => {
    expect(igrac(drzi(scenario("cross-none", "straight"), 0, 1)).intent).toBe("straight");
  });

  it("izabrana putanja je stvarno druga putanja", () => {
    const w = drzi(scenario("cross-none", "straight"), -1, 1);
    const p = igrac(w);
    expect(p.pathId).toBe("cross-none:N:left");
    expect(compile(TEMPLATES["cross-none"]!).paths.has(p.pathId)).toBe(true);
  });

  it("trzaj volana ne mijenja pravac", () => {
    // Kraće od `DECISION_HOLD`: vozač koji se ispravlja u traci nije izabrao
    // skretanje.
    const w = drzi(scenario("cross-none", "straight"), -1, DECISION_HOLD * 0.6);
    expect(igrac(w).intent).toBe("straight");
  });

  it("poslije tačke odluke se pravac ne mijenja", () => {
    // Tačka odluke je tamo gdje počinje faza najave pokazivača: da se poslije
    // nje mijenja pravac, žmigavac bi se sudio po namjeri koje više nema.
    const put = compile(TEMPLATES["cross-none"]!).paths.get("cross-none:N:straight")!;
    const w = drzi(scenario("cross-none", "straight"), -1, 1, put.stopLineS - INDICATOR_LEAD + 2);
    expect(igrac(w).intent).toBe("straight");
  });

  it("pušten volan prije tačke odluke vraća pravo", () => {
    // Izbor prati volan do tačke odluke, i tamo se zaključava ono što volan
    // TADA pokazuje. Lijevo izabrano pa pušteno nije lijevo.
    const s = scenario("cross-none", "straight");
    const world = createWorld(s, 1);
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(-1));
    expect(igrac(world).intent).toBe("left");
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(0));
    expect(igrac(world).intent).toBe("straight");
  });

  it("prerano okretanje volana ne bira ništa", () => {
    const put = compile(TEMPLATES["cross-none"]!).paths.get("cross-none:N:straight")!;
    const w = drzi(scenario("cross-none", "straight"), -1, 1, put.stopLineS - DECISION_LEAD - 10);
    expect(igrac(w).intent).toBe("straight");
  });

  it("promjena putanje ne pomjera vozilo", () => {
    // Sve putanje sa istog kraka dijele prilaz, pa `s` ostaje isti; da nije
    // tako, vozilo bi na izboru poskočilo.
    const s = scenario("cross-none", "straight");
    const world = createWorld(s, 1);
    const prije = igrac(world).s;
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(-1));
    expect(igrac(world).intent).toBe("left");
    expect(igrac(world).s).toBeCloseTo(prije, 9);
  });

  it("na raskrsnici sa tri kraka se u nepostojeći krak ne može", () => {
    // `cross-t-no-east` nema istočni krak, pa desno sa sjevera ne postoji.
    const t = Object.values(TEMPLATES).find(
      (x) => x.kind === "cross" && x.arms.length === 3 && !x.arms.some((a) => a.id === "E"),
    );
    if (!t) return;
    const w = drzi(scenario(t.id, "straight"), 1, 1);
    expect(igrac(w).intent).toBe("straight");
  });
});

describe("kružni tok", () => {
  it("desno je prvi izlaz, ništa drugi, lijevo treći", () => {
    expect(igrac(drzi(scenario("kruzni", { kind: "exit", n: 2 }), 1, 1)).intent).toEqual({
      kind: "exit",
      n: 1,
    });
    expect(igrac(drzi(scenario("kruzni", { kind: "exit", n: 2 }), 0, 1)).intent).toEqual({
      kind: "exit",
      n: 2,
    });
    expect(igrac(drzi(scenario("kruzni", { kind: "exit", n: 2 }), -1, 1)).intent).toEqual({
      kind: "exit",
      n: 3,
    });
  });

  it("u prstenu se desnim volanom bira prvi sljedeći izlaz", () => {
    const s = scenario("kruzni", { kind: "exit", n: 3 });
    const world = createWorld(s, 1);
    const put = compile(TEMPLATES["kruzni"]!).paths.get("kruzni:N:exit3")!;
    // Ući u prsten i proći malo dalje od prvog izlaza.
    igrac(world).s = put.boxEnterS + 4;
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(1));
    const intent = igrac(world).intent;
    expect(typeof intent === "object" && intent.kind === "exit").toBe(true);
    if (typeof intent === "object" && intent.kind === "exit") {
      expect(intent.n).toBeLessThan(3);
    }
  });

  it("izlaz koji je prošao se ne može izabrati", () => {
    const s = scenario("kruzni", { kind: "exit", n: 3 });
    const world = createWorld(s, 1);
    const put = compile(TEMPLATES["kruzni"]!).paths.get("kruzni:N:exit3")!;
    const izlaz1 = compile(TEMPLATES["kruzni"]!).paths.get("kruzni:N:exit1")!;
    // Tik pred sopstveni izlaz: prvi izlaz je davno iza nas.
    igrac(world).s = put.boxExitS - 1;
    void izlaz1;
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(1));
    const intent = igrac(world).intent;
    if (typeof intent === "object" && intent.kind === "exit") {
      expect(intent.n).toBe(3);
    }
  });

  it("promjena izlaza u prstenu ne pomjera vozilo po luku", () => {
    // Dvije putanje kroz isti prsten uzorkuju luk različitim korakom, pa se
    // prelazak mjeri UGLOM. Da se prenosio `s`, vozilo bi skočilo unaprijed.
    const s = scenario("kruzni", { kind: "exit", n: 3 });
    const world = createWorld(s, 1);
    const put = compile(TEMPLATES["kruzni"]!).paths.get("kruzni:N:exit3")!;
    igrac(world).s = put.boxEnterS + 2;
    const p = igrac(world);
    const prije = { ...p };
    for (let i = 0; i < Math.round(1 / DT); i++) step(world, s, ulaz(1));
    // Vozilo stoji (nema gasa), pa se `s` smije razlikovati samo za milimetre
    // preslikavanja između dvije putanje.
    expect(Math.abs(igrac(world).s - prije.s)).toBeLessThan(0.5);
  });
});

describe("šina ostaje šina", () => {
  it("scenario bez volana ne mijenja pravac", () => {
    const w = drzi(scenario("cross-none", "straight", "sina"), -1, 2);
    expect(igrac(w).intent).toBe("straight");
    expect(igrac(w).pathId).toBe("cross-none:N:straight");
  });
});
