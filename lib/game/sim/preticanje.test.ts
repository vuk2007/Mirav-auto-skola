import { describe, expect, it } from "vitest";
import {
  DT,
  MAX_OVERTAKE_TIME,
  ONCOMING_TTC,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
} from "./config";
import { createWorld, PLAYER_ID, step } from "./world";
import type { Input, RoadTemplate, Scenario, ScenarioNpc, Vehicle, World } from "./types";

/**
 * Preticanje na dvosmjernom putu.
 *
 * Put je ovdje namjerno prav i prazan, a vozila se postavljaju rukom: pravilo
 * se provjerava na situaciji koja se tačno zna, ne na onome što stvarni put
 * slučajno donese. Stvarna Crna Gora se mjeri u `road/zabrane.test.ts`.
 */

let broj = 0;

interface PutOpcije {
  zabrane?: { from: number; to: number }[];
  npcs?: ScenarioNpc[];
  startV?: number;
}

function put({ zabrane, npcs = [], startV = 22 }: PutOpcije = {}): Scenario {
  broj += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:preticanje:${broj}`,
    length: 4000,
    edgeId: "test--test",
    edgeKm: 4,
    vMax: 25,
    curves: [],
    landmarks: [],
    zabrane,
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS: 0, startV },
    npcs,
    upravljanje: "traka",
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/** Sporije vozilo u našoj traci, tačno tamo gdje se kaže. */
const spori = (startS: number, speed: number): ScenarioNpc => ({
  arm: "N",
  intent: { kind: "lane", index: 0 },
  startS,
  spawnAt: [0, 0],
  speed,
  fiksno: true,
});

/** Susretno vozilo; `startS` je mjereno po NJEGOVOJ putanji, od kraja dionice. */
const susretno = (startS: number, speed: number): ScenarioNpc => ({
  arm: "S",
  intent: { kind: "lane", index: 1 },
  startS,
  spawnAt: [0, 0],
  speed,
  fiksno: true,
});

const ulaz = (steer: number, throttle = 0): Input => ({
  throttle,
  brake: 0,
  indicator: null,
  changeLane: null,
  steer,
});

const igrac = (w: World): Vehicle => w.vehicles.find((v) => v.id === PLAYER_ID)!;

/** Odvozi `sekundi` sekundi, sa ulazom koji se bira u svakom koraku. */
function vozi(s: Scenario, sekundi: number, kako: (w: World) => Input): World {
  const world = createWorld(s, 1);
  const koraka = Math.round(sekundi / DT);
  for (let i = 0; i < koraka && world.outcome === "running"; i++) step(world, s, kako(world));
  return world;
}

/** Drži volan ulijevo dok ne pređe u kontra traku, pa ga pusti. */
const uKontru = (w: World): Input => {
  const lat = igrac(w).lateral ?? 0;
  return ulaz(lat > -ROAD_LANE_WIDTH ? -1 : 0, 0.4);
};

const imaPrekrsaj = (w: World, tip: string) => w.violations.some((v) => v.type === tip);

describe("puna linija", () => {
  it("prelazak preko pune linije obara vožnju", () => {
    const w = vozi(put({ zabrane: [{ from: 0, to: 4000 }] }), 4, uKontru);
    const p = w.violations.find((v) => v.type === "crossingSolidLine");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("fail");
  });

  it("gdje je linija isprekidana, prelazak nije prekršaj", () => {
    const w = vozi(put(), 4, uKontru);
    expect(imaPrekrsaj(w, "crossingSolidLine")).toBe(false);
  });

  it("držanje uz liniju nije prelazak", () => {
    // Traka je 4,2 m, auto 1,8 m: do linije ima 1,2 m i vozač smije da joj se
    // približi. Prekršaj je prelazak, ne blizina.
    const s = put({ zabrane: [{ from: 0, to: 4000 }] });
    const w = vozi(s, 6, (x) => ulaz((igrac(x).lateral ?? 0) > -1 ? -1 : 0, 0.3));
    expect(imaPrekrsaj(w, "crossingSolidLine")).toBe(false);
  });
});

describe("kontra traka", () => {
  it("susretno vozilo preblizu znači nebezbjedno preticanje", () => {
    // Susretno je 300 m ispred; pri zbirnoj brzini od oko 45 m/s to je ispod
    // šest sekundi, dakle taman ispod praga.
    const s = put({ npcs: [susretno(4000 - 300, 22)] });
    const w = vozi(s, 4, uKontru);
    const p = w.violations.find((v) => v.type === "unsafeOvertake");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("fail");
  });

  it("prazan put ispred nije prekršaj", () => {
    const s = put({ npcs: [susretno(200, 22)] });
    const w = vozi(s, 4, uKontru);
    expect(imaPrekrsaj(w, "unsafeOvertake")).toBe(false);
  });

  it("prag se mjeri po ZBIRNOJ brzini, ne po razdaljini", () => {
    // Isto rastojanje, ali susretno vozilo stoji: vrijeme do susreta je onda
    // duplo veće i preticanje je bezbjedno.
    const blizu = vozi(put({ npcs: [susretno(4000 - 260, 20)] }), 4, uKontru);
    const stoji = vozi(put({ npcs: [susretno(4000 - 260, 0)] }), 4, uKontru);
    expect(imaPrekrsaj(blizu, "unsafeOvertake")).toBe(true);
    expect(imaPrekrsaj(stoji, "unsafeOvertake")).toBe(false);
  });

  it("predugo zadržavanje u kontra traci se prijavljuje", () => {
    const w = vozi(put(), MAX_OVERTAKE_TIME + 3, uKontru);
    const p = w.violations.find((v) => v.type === "overtakeTooLong");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("minor");
    expect(imaPrekrsaj(w, "unsafeOvertake")).toBe(false);
  });

  it("kratko preticanje ne pravi nijedan prekršaj", () => {
    const s = put({ npcs: [spori(120, 10)] });
    const w = vozi(s, MAX_OVERTAKE_TIME - 2, uKontru);
    expect(w.violations.map((v) => v.type)).toEqual([]);
  });
});

describe("vraćanje u svoju traku", () => {
  /** Pretekni sporo vozilo i vrati se čim mu pređeš branik. */
  const preticiIVratiSe = (razmakM: number) => (w: World) => {
    const p = igrac(w);
    const npc = w.vehicles.find((v) => v.id === "npc1");
    // Gas se drži do ograničenja, da prekoračenje ne zamagli ono što se mjeri.
    const gas = p.v < 24 ? 1 : 0;
    const lat = p.lateral ?? 0;
    if (!npc) return ulaz(0, gas);
    const ispred = p.s - npc.s;
    if (ispred < razmakM) return ulaz(lat > -ROAD_LANE_WIDTH ? -1 : 0, gas);
    return ulaz(lat < 0 ? 1 : 0, gas);
  };

  it("povratak tik ispred preteknutog je prekršaj", () => {
    const s = put({ npcs: [spori(60, 12)], startV: 24 });
    // Vraća se čim mu pređe branik: dok volan prevuče auto nazad, razmak
    // naraste na desetak metara, što je na dvanaest metara u sekundi manje od
    // sekunde.
    const w = vozi(s, 20, preticiIVratiSe(1));
    const p = w.violations.find((v) => v.type === "cutIn");
    expect(p).toBeDefined();
    expect(p?.otherVehicleId).toBe("npc1");
  });

  it("povratak sa razmakom nije prekršaj", () => {
    const s = put({ npcs: [spori(60, 12)], startV: 24 });
    const w = vozi(s, 25, preticiIVratiSe(60));
    expect(imaPrekrsaj(w, "cutIn")).toBe(false);
  });
});

describe("ostali vide gdje smo", () => {
  it("vozilo kojem uđemo u traku koči", () => {
    // Susretno vozilo koje nam ide u susret dok smo mi u njegovoj traci nije
    // kolona ispred nas nego prepreka: mora da uspori. Mjeri se najmanja
    // brzina do koje je palo, jer se koči tek kad se rastojanje stvarno skrati.
    const s = put({ npcs: [susretno(4000 - 400, 20)] });
    const world = createWorld(s, 1);
    let najmanja = 20;
    for (let i = 0; i < Math.round(9 / DT) && world.outcome === "running"; i++) {
      step(world, s, uKontru(world));
      const npc = world.vehicles.find((v) => v.id === "npc1");
      if (npc) najmanja = Math.min(najmanja, npc.v);
    }
    expect(najmanja).toBeLessThan(19);
  });

  it("dok smo u kontra traci, naša traka je za druge slobodna", () => {
    // Vozilo iza nas u našoj traci ne smije da koči zbog nas kad smo se
    // sklonili — inače bi se kolona zaustavljala bez razloga.
    const s = put({ npcs: [spori(300, 22)], startV: 22 });
    const w = vozi(s, 5, uKontru);
    const npc = w.vehicles.find((v) => v.id === "npc1")!;
    expect(npc.v).toBeGreaterThan(20);
  });
});

describe("prag vremena do susreta", () => {
  it("odgovara podešenom broju sekundi", () => {
    // Ovo nije provjera koda nego podešenja: ako se prag promijeni, mora se
    // promijeniti i ono što igrač vidi kao objašnjenje.
    expect(ONCOMING_TTC).toBeGreaterThanOrEqual(4);
    expect(ONCOMING_TTC).toBeLessThanOrEqual(10);
  });
});
