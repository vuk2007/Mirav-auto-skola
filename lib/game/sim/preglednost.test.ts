import { describe, expect, it } from "vitest";
import {
  CAR_LENGTH,
  DT,
  INDICATOR_LEAD_TIME,
  OKO_LIJEVO,
  PREGLEDNOST_REAKCIJA,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  VOZILA,
} from "./config";
import { compile } from "./intersection";
import { lanePathId } from "./highway";
import type { Input, RoadTemplate, Scenario, VrstaVozila, World } from "./types";
import { createWorld, PLAYER_ID, preglednost, step } from "./world";

/**
 * Preglednost: kamion zaklanja suprotnu traku, ali ne cijelu.
 *
 * Put je prav i prazan, a vozila se postavljaju rukom. Mjeri se i geometrija
 * pogleda i pravilo: u suprotnu traku se ulazi tek kad se ona vidi dovoljno
 * daleko, i to bar `PREGLEDNOST_REAKCIJA`.
 */

let broj = 0;
const VMAX = 80 / 3.6;

/** Vozilo `vrsta` ispred igrača, sa `razmak` metara od branika do branika. */
function put(vrsta: VrstaVozila, razmak: number, brzina = 15): Scenario {
  broj += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:preglednost:${broj}`,
    length: 5000,
    edgeId: "test--test",
    edgeKm: 5,
    vMax: VMAX,
    curves: [],
    landmarks: [],
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS: 0, startV: brzina },
    npcs: [
      {
        arm: "N",
        intent: { kind: "lane", index: 0 },
        startS: razmak + (CAR_LENGTH + VOZILA[vrsta].duzina) / 2,
        spawnAt: [0, 0],
        speed: brzina,
        fiksno: true,
        vrsta,
      },
    ],
    upravljanje: "traka",
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/** Koliko se vidi suprotna traka kad igrač stoji na zadatom poprečnom mjestu. */
function vidi(s: Scenario, lateral: number): number {
  const w = createWorld(s, 1);
  const tpl = s.template as RoadTemplate;
  const paths = compile(tpl).paths;
  const ja = w.vehicles.find((v) => v.id === PLAYER_ID)!;
  ja.lateral = lateral;
  return preglednost(w, paths, ja, paths.get(lanePathId(tpl.id, 0))!);
}

const ulaz = (steer: number, indicator: "left" | "right" | null = "left"): Input => ({
  throttle: 0,
  brake: 0,
  indicator,
  changeLane: null,
  steer,
});

const ima = (w: World, tip: string) => w.violations.some((v) => v.type === tip);

describe("koliko se vidi pored kamiona", () => {
  it("iz sredine trake, dvadeset metara iza kamiona, vidi se malo", () => {
    // Slični trouglovi: oko je `OKO_LIJEVO` lijevo od sredine, lijeva ivica
    // kamiona pola njegove širine, osa suprotne trake širinu trake lijevo.
    const d = vidi(put("kamion", 20), 0);
    const oko = -OKO_LIJEVO;
    const ivica = -VOZILA.kamion.sirina / 2;
    const ocekivano = ((oko + ROAD_LANE_WIDTH) * (20 + CAR_LENGTH / 2)) / (oko - ivica);
    expect(d).toBeCloseTo(ocekivano, 0);
    expect(d).toBeLessThan(120);
  });

  it("dalje od kamiona vidi se dalje — kamion ne zaklanja cijeli pogled", () => {
    const blizu = vidi(put("kamion", 20), 0);
    const dalje = vidi(put("kamion", 60), 0);
    expect(dalje).toBeGreaterThan(blizu * 2.5);
  });

  it("sa lijeve ivice svoje trake pogled prolazi pored kamiona", () => {
    expect(vidi(put("kamion", 20), -1.05)).toBe(Infinity);
  });

  it("autobus zaklanja kao i kamion, a putnički auto i kombi ne", () => {
    expect(vidi(put("autobus", 20), 0)).toBeLessThan(150);
    expect(vidi(put("auto", 20), 0)).toBe(Infinity);
    expect(vidi(put("kombi", 20), 0)).toBe(Infinity);
  });
});

describe("pravilo preglednosti", () => {
  /** Vozi dok tijelo ne pređe razdjelnu liniju, pa još malo. */
  function vozi(s: Scenario, kako: (w: World) => Input, sekundi = 6): World {
    const w = createWorld(s, 1);
    for (let i = 0; i < Math.round(sekundi / DT) && w.outcome === "running"; i++) step(w, s, kako(w));
    return w;
  }

  it("izlazak iz sredine trake tik iza kamiona je prekršaj", () => {
    // Pokazivač gori prije nego što volan krene — da se mjeri samo preglednost.
    const s = put("kamion", 20);
    const w = vozi(s, (x) => ulaz(x.t < INDICATOR_LEAD_TIME + 0.2 ? 0 : -1));
    const p = w.violations.find((v) => v.type === "overtakeNoVisibility");
    expect(p).toBeDefined();
    expect(p?.severity).toBe("fail");
    // Poruka kaže i šta je trebalo uraditi.
    expect(p?.details).toMatch(/Odmakni se|ulijevo/);
  });

  it("izvirivanje na lijevu ivicu trake, pa prelazak, nije prekršaj", () => {
    const s = put("kamion", 20);
    const izviri = -1.05;
    const w = vozi(s, (x) => {
      const ja = x.vehicles.find((v) => v.id === PLAYER_ID)!;
      const lat = ja.lateral ?? 0;
      // Prvo na ivicu trake i tu sekundu i po, pa u suprotnu traku.
      if (x.t < 0.5 + PREGLEDNOST_REAKCIJA + 0.3) return ulaz(Math.max(-1, (izviri - lat) * 20));
      return ulaz(-1);
    });
    expect(ima(w, "overtakeNoVisibility")).toBe(false);
  });

  it("iz dovoljnog odstojanja se vidi i iz sredine trake", () => {
    const s = put("kamion", 120);
    const w = vozi(s, (x) => ulaz(x.t < INDICATOR_LEAD_TIME + 0.2 ? 0 : -1));
    expect(ima(w, "overtakeNoVisibility")).toBe(false);
  });

  it("bez visokog vozila ispred pravilo ne dira ništa", () => {
    const s = put("auto", 20);
    const w = vozi(s, (x) => ulaz(x.t < INDICATOR_LEAD_TIME + 0.2 ? 0 : -1));
    expect(ima(w, "overtakeNoVisibility")).toBe(false);
  });

  it("vraćanje u svoju traku se ne sudi po preglednosti", () => {
    // Igrač kreće već u suprotnoj traci, pored kamiona, i vraća se.
    const s = put("kamion", 20);
    const w = createWorld(s, 1);
    const ja = w.vehicles.find((v) => v.id === PLAYER_ID)!;
    ja.lateral = -ROAD_LANE_WIDTH;
    w.volan.tijeloPreko = true;
    for (let i = 0; i < Math.round(3 / DT); i++) step(w, s, ulaz(1, "right"));
    expect(ima(w, "overtakeNoVisibility")).toBe(false);
  });
});
