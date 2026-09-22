import { describe, expect, it } from "vitest";
import {
  BUS_POKAZIVAC_POLAZAK,
  BUS_POKAZIVAC_PRIJE,
  BUS_STOJI,
  CAR_WIDTH,
  DIFFICULTY,
  DT,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
} from "./config";
import { perfectBot } from "./bots";
import { compile } from "./intersection";
import { createWorld, PLAYER_ID, step } from "./world";
import type {
  Input,
  ParkiranoVozilo,
  RoadTemplate,
  Scenario,
  ScenarioNpc,
  Stanica,
  Vehicle,
  World,
} from "./types";

/**
 * Grad na ruti u simulaciji: autobus na stanici, igrač iza njega, parkirani auti.
 *
 * Put je prav i prazan, a vozila, stanice i parkirani auti se postavljaju rukom:
 * mjeri se pravilo na situaciji koja se tačno zna.
 */

let broj = 0;

interface Opcije {
  npcs?: ScenarioNpc[];
  stanice?: Stanica[];
  parkirana?: ParkiranoVozilo[];
  startS?: number;
  startV?: number;
}

function put({ npcs = [], stanice, parkirana, startS = 0, startV = 0 }: Opcije): Scenario {
  broj += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:grad:${broj}`,
    length: 1500,
    edgeId: "test--test",
    edgeKm: 1.5,
    vMax: 50 / 3.6,
    curves: [],
    landmarks: [],
    stanice,
    parkirana,
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS, startV },
    npcs,
    upravljanje: "traka",
    pokazivaci: "auto",
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

const autobus = (startS: number, speed: number, traka: 0 | 1 = 0): ScenarioNpc => ({
  arm: traka === 1 ? "S" : "N",
  intent: { kind: "lane", index: traka },
  startS,
  spawnAt: [0, 0],
  speed,
  fiksno: true,
  vrsta: "autobus",
});

const ulaz = (throttle = 0, brake = 0, steer = 0): Input => ({ throttle, brake, indicator: null, steer });
const vozilo = (w: World, id: string): Vehicle => w.vehicles.find((v) => v.id === id)!;

/** Trag autobusa po koracima: mjesto, brzina, pokazivač. */
function pratiAutobus(s: Scenario, sekundi: number, igrac: Input = ulaz(0, 1)) {
  const w = createWorld(s, 1);
  const trag: { t: number; s: number; v: number; ind: string | null }[] = [];
  for (let i = 0; i < Math.round(sekundi / DT) && w.outcome === "running"; i++) {
    step(w, s, igrac);
    const b = vozilo(w, "npc1");
    trag.push({ t: w.t, s: b.s, v: b.v, ind: b.indicator });
  }
  return { w, trag };
}

describe("autobus na stanici", () => {
  it("staje na stanici svoje trake, stoji propisano vrijeme i nastavlja", () => {
    const s = put({ npcs: [autobus(100, 12)], stanice: [{ s: 400, traka: 0 }] });
    const { trag } = pratiAutobus(s, 60);
    const stoji = trag.filter((k) => k.v < 0.15 && Math.abs(k.s - 400) < 1.5);
    expect(stoji.length * DT).toBeGreaterThan(BUS_STOJI - 0.5);
    expect(stoji.length * DT).toBeLessThan(BUS_STOJI + 1);
    // Poslije stajanja je otišao dalje.
    expect(trag[trag.length - 1]!.s).toBeGreaterThan(450);
  });

  it("pali desni pokazivač prije stanice, a lijevi pred polazak", () => {
    const s = put({ npcs: [autobus(100, 12)], stanice: [{ s: 400, traka: 0 }] });
    const { trag } = pratiAutobus(s, 60);
    const prviDesni = trag.find((k) => k.ind === "right")!;
    expect(400 - prviDesni.s).toBeGreaterThan(BUS_POKAZIVAC_PRIJE - 2);
    expect(400 - prviDesni.s).toBeLessThanOrEqual(BUS_POKAZIVAC_PRIJE + 1);
    const lijevi = trag.filter((k) => k.ind === "left");
    expect(lijevi.length * DT).toBeGreaterThan(BUS_POKAZIVAC_POLAZAK - 0.2);
    expect(lijevi.length * DT).toBeLessThan(BUS_POKAZIVAC_POLAZAK + 0.5);
    // Kad je krenuo, pokazivač je ugašen.
    expect(trag[trag.length - 1]!.ind).toBeNull();
  });

  it("stanicu do koje bi morao naglo kočiti preskače", () => {
    // Dvanaest metara u sekundi i dvadeset metara do stanice: za stajanje bi
    // trebalo 3,6 m/s², jače nego što autobus koči pred stanicom.
    const s = put({ npcs: [autobus(380, 12)], stanice: [{ s: 400, traka: 0 }] });
    const { trag } = pratiAutobus(s, 10);
    expect(Math.min(...trag.map((k) => k.v))).toBeGreaterThan(10);
  });

  it("i u susretnoj traci staje na svojoj stanici", () => {
    const s = put({ npcs: [autobus(100, 12, 1)], stanice: [{ s: 1000, traka: 1 }, { s: 1200, traka: 0 }] });
    const tpl = s.template as RoadTemplate;
    const susretna = [...compile(tpl).paths.values()].find((p) => p.intent !== undefined && p.arm === "S")!;
    const { trag } = pratiAutobus(s, 60);
    // Stanica na 1000 m naše trake je, gledano po putanji susretne trake,
    // na `dužina − 1000`. Stanica naše trake ga se ne tiče.
    const naStanici = susretna.length - 1000;
    const stoji = trag.filter((k) => k.v < 0.15);
    expect(stoji.length * DT).toBeGreaterThan(BUS_STOJI - 0.5);
    expect(Math.abs(stoji[0]!.s - naStanici)).toBeLessThan(1.5);
  });
});

describe("igrač iza autobusa na stanici", () => {
  it("dok čeka iza vozila koje stoji, ne zadržava saobraćaj", () => {
    // U naselju je linija puna — autobus se ne obilazi nego se čeka.
    // Igrač vozi odmah iza autobusa, pa na stanici čeka skoro cijelo stajanje —
    // mnogo duže od roka za zadržavanje saobraćaja.
    const s = put({ npcs: [autobus(160, 12)], stanice: [{ s: 300, traka: 0 }], startS: 125, startV: 12 });
    const w = createWorld(s, 1);
    let stajao = 0;
    for (let i = 0; i < Math.round(40 / DT) && w.outcome === "running"; i++) {
      // Savršen vozač drži odstojanje po istoj logici po kojoj voze i ostali.
      step(w, s, { ...perfectBot(w, s), steer: 0 });
      if (vozilo(w, PLAYER_ID).v < 0.1) stajao += DT;
    }
    expect(stajao).toBeGreaterThan(DIFFICULTY[s.difficulty].obstructionTimeout + 2);
    expect(w.violations.map((v) => v.type)).not.toContain("obstruction");
    expect(w.violations.map((v) => v.type)).not.toContain("collision");
  });

  it("ali stajanje na praznom putu i dalje jeste zadržavanje", () => {
    const s = put({ startS: 60, startV: 0 });
    const w = createWorld(s, 1);
    for (let i = 0; i < Math.round(10 / DT); i++) step(w, s, ulaz(0, 1));
    expect(w.violations.map((v) => v.type)).toContain("obstruction");
  });
});

describe("parkirani auti", () => {
  const parkirano: ParkiranoVozilo = { s: 200, strana: "desno", vrsta: "auto" };

  it("uz parkirani auto igrač ne može udesno preko ivične linije", () => {
    // Igrač kreće tačno uz parkirani auto: mjeri se granica, a ne to da li je
    // na bankinu ušao prije nego što je do auta stigao.
    const s = put({ parkirana: [parkirano], startS: 200, startV: 0 });
    const tpl = s.template as RoadTemplate;
    const nasa = [...compile(tpl).paths.values()].find((p) => p.arm === "N")!;
    const w = createWorld(s, 1);
    // Puni volan udesno, a vozilo polako prolazi pored parkiranog auta.
    let najdesnije = 0;
    for (let i = 0; i < Math.round(8 / DT) && w.outcome === "running"; i++) {
      const ja = vozilo(w, PLAYER_ID);
      step(w, s, ulaz(ja.v < 2 ? 0.3 : 0, 0, 1));
      const poslije = vozilo(w, PLAYER_ID);
      if (Math.abs(poslije.s - 200) < 3) najdesnije = Math.max(najdesnije, poslije.lateral ?? 0);
    }
    const doIvice = nasa.doIvice![0]!;
    expect(najdesnije).toBeLessThanOrEqual(doIvice - CAR_WIDTH / 2 + 1e-6);
    expect(w.violations.map((v) => v.type)).not.toContain("collision");
  });

  it("ko vozi bankinom, udari u parkirani auto", () => {
    // Igrač je već na bankini prije parkiranog auta i vozi pravo u njega.
    const s = put({ parkirana: [parkirano], startS: 150, startV: 5 });
    const w = createWorld(s, 1);
    vozilo(w, PLAYER_ID).lateral = ROAD_LANE_WIDTH / 2 + 0.8;
    for (let i = 0; i < Math.round(20 / DT) && w.outcome === "running"; i++) step(w, s, ulaz(0.2, 0, 0));
    const sudar = w.violations.find((v) => v.type === "collision");
    expect(sudar?.details).toMatch(/parkirano/i);
  });
});
