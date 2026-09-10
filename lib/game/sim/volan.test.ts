import { describe, expect, it } from "vitest";
import { edgeById } from "@/lib/game/road/roadGraph";
import { dionica } from "@/lib/game/road/segment";
import {
  CAR_WIDTH,
  DT,
  LAT_SPEED_FAST,
  LAT_SPEED_SLOW,
  OFF_ROAD_FAIL_SPEED,
  OFF_ROAD_FAIL_TIME,
  SHOULDER_WIDTH,
} from "./config";
import { compile } from "./intersection";
import { createWorld, PLAYER_ID, poseOn, step } from "./world";
import type { Input, RoadTemplate, Scenario, Vehicle, World } from "./types";

/**
 * Volan na otvorenom putu.
 *
 * Sve do sada je igrač išao po šini: putanja je bila poznata, a jedini izbor
 * brzina. Ovdje se provjerava ono što volan uvodi — poprečni položaj u traci —
 * i, jednako važno, da se scenariji koji volan NEMAJU nisu pomjerili ni za
 * milimetar.
 */

const IVICA = "podgorica--danilovgrad";

function scenario(upravljanje: "traka" | "sina" = "traka"): Scenario {
  const edge = edgeById(IVICA);
  if (!edge) throw new Error(`Nema ivice ${IVICA}`);
  const s = dionica(edge, 7);
  return { ...s, upravljanje: upravljanje === "traka" ? "traka" : undefined };
}

const ulaz = (steer: number, throttle = 0): Input => ({
  throttle,
  brake: 0,
  indicator: null,
  changeLane: null,
  steer,
});

/** Odvozi `koraka` koraka sa istim ulazom i vrati svijet. */
function vozi(s: Scenario, input: Input, koraka: number, seed = 1): World {
  const world = createWorld(s, seed);
  for (let i = 0; i < koraka; i++) step(world, s, input);
  return world;
}

const igrac = (w: World): Vehicle => w.vehicles.find((v) => v.id === PLAYER_ID)!;

describe("poprečni položaj", () => {
  it("volan udesno vodi vozilo udesno, ulijevo ulijevo", () => {
    const s = scenario();
    expect(igrac(vozi(s, ulaz(1), 30)).lateral!).toBeGreaterThan(0);
    expect(igrac(vozi(s, ulaz(-1), 30)).lateral!).toBeLessThan(0);
  });

  it("„desno“ je stvarno desno u svijetu, a ne samo veći broj", () => {
    // Naša traka je desno od razdjelne linije, pa pomjeranje udesno mora da
    // POVEĆA rastojanje od ose puta. Ovo je jedina provjera koja hvata
    // zamijenjen znak normale.
    const s = scenario();
    const tpl = s.template as RoadTemplate;
    const { paths } = compile(tpl);
    const w = vozi(s, ulaz(1), 60);
    const v = igrac(w);
    const put = paths.get(v.pathId)!;
    const naOsi = poseOn(tpl, put, { ...v, lateral: 0 }).pos;
    const pomjeren = poseOn(tpl, put, v).pos;
    // Osa puta je lijevo od naše trake za pola širine; pomjeranje udesno vodi
    // dalje od nje.
    const sredina = { x: 0, y: naOsi.y };
    expect(Math.abs(pomjeren.x - sredina.x)).toBeGreaterThan(Math.abs(naOsi.x - sredina.x));
  });

  it("mrtva zona: sitan pomak klizača ne pomjera ništa", () => {
    expect(igrac(vozi(scenario(), ulaz(0.05), 60)).lateral).toBe(0);
  });

  it("bočna brzina raste sa brzinom vožnje", () => {
    // Isti volan, dvije brzine: brže vozilo se za isto vrijeme pomjeri više.
    const s = scenario();
    const sporo = createWorld(s, 1);
    const brzo = createWorld(s, 1);
    igrac(sporo).v = 10 / 3.6;
    igrac(brzo).v = 80 / 3.6;
    for (let i = 0; i < 30; i++) {
      step(sporo, s, ulaz(1));
      step(brzo, s, ulaz(1));
    }
    expect(igrac(brzo).lateral!).toBeGreaterThan(igrac(sporo).lateral! * 2);
    // I to u granicama koje konfiguracija obećava.
    const t = 30 * DT;
    expect(igrac(sporo).lateral!).toBeLessThanOrEqual(LAT_SPEED_SLOW * t + 1e-6);
    expect(igrac(brzo).lateral!).toBeLessThanOrEqual(LAT_SPEED_FAST * t + 1e-6);
  });

  it("auto se ne vraća sam na sredinu trake", () => {
    const s = scenario();
    const w = createWorld(s, 1);
    for (let i = 0; i < 30; i++) step(w, s, ulaz(1));
    const gdje = igrac(w).lateral!;
    for (let i = 0; i < 120; i++) step(w, s, ulaz(0));
    expect(igrac(w).lateral!).toBeCloseTo(gdje, 9);
  });

  it("isti niz komandi daje isti poprečni položaj", () => {
    const s = scenario();
    const odigraj = () => {
      const w = createWorld(s, 1);
      for (let i = 0; i < 300; i++) step(w, s, ulaz(Math.sin(i / 17)));
      return igrac(w);
    };
    const a = odigraj();
    const b = odigraj();
    expect(b.lateral).toBe(a.lateral);
    expect(b.s).toBe(a.s);
  });
});

describe("granice kolovoza", () => {
  it("vozilo stane na bankini, ma koliko se držao volan", () => {
    const w = vozi(scenario(), ulaz(1), 900);
    const v = igrac(w);
    // Najviše do kraja bankine, mjereno po spoljnoj strani auta.
    expect(v.lateral!).toBeLessThan(CAR_WIDTH + SHOULDER_WIDTH);
    expect(Number.isFinite(v.lateral!)).toBe(true);
  });

  it("ulijevo se za sada staje na razdjelnoj liniji", () => {
    // Prelazak u kontra traku dolazi sa preticanjem; do tada se lijevi bok
    // zaustavlja na liniji, pa je pomak manji od pola širine trake.
    const v = igrac(vozi(scenario(), ulaz(-1), 900));
    expect(v.lateral!).toBeGreaterThan(-3);
    expect(v.lateral!).toBeLessThan(0);
  });

  it("izlazak sa kolovoza se prijavljuje", () => {
    const w = vozi(scenario(), ulaz(1), 200);
    const p = w.violations.find((x) => x.type === "offRoad");
    expect(p, "očekivan prekršaj offRoad").toBeDefined();
  });

  it("kratko i sporo je greška, dugo je pad", () => {
    // Vozilo stoji: brzina ne obara vožnju, pa odlučuje samo vrijeme.
    const s = scenario();
    const w = createWorld(s, 1);
    igrac(w).v = 0;
    // Do ivice se tek mora stići: pri jednom metru u sekundi to je oko 1,2 s,
    // pa se tek poslije toga broji vrijeme van kolovoza.
    for (let i = 0; i < Math.round((OFF_ROAD_FAIL_TIME / DT) * 1.5); i++) {
      step(w, s, ulaz(1));
      igrac(w).v = 0;
    }
    expect(w.volan.offRoadT).toBeGreaterThan(0);
    expect(w.volan.offRoadT).toBeLessThan(OFF_ROAD_FAIL_TIME);
    expect(w.violations.find((x) => x.type === "offRoad")?.severity).toBe("minor");
    for (let i = 0; i < Math.round(OFF_ROAD_FAIL_TIME / DT) + 10; i++) {
      step(w, s, ulaz(1));
      igrac(w).v = 0;
    }
    // Ista kartica, ali sada teška — jedno pravilo, jedno objašnjenje.
    expect(w.violations.filter((x) => x.type === "offRoad").length).toBe(1);
    expect(w.violations.find((x) => x.type === "offRoad")?.severity).toBe("fail");
  });

  it("izlazak u brzini obara vožnju odmah", () => {
    const s = scenario();
    const w = createWorld(s, 1);
    igrac(w).v = OFF_ROAD_FAIL_SPEED + 5;
    for (let i = 0; i < 200; i++) {
      step(w, s, ulaz(1));
      igrac(w).v = Math.max(igrac(w).v, OFF_ROAD_FAIL_SPEED + 5);
    }
    expect(w.violations.find((x) => x.type === "offRoad")?.severity).toBe("fail");
  });
});

describe("šina ostaje šina", () => {
  it("scenario bez volana ne reaguje na klizač", () => {
    const s = scenario("sina");
    const w = vozi(s, ulaz(1), 300);
    const v = igrac(w);
    expect(v.lateral).toBeUndefined();
    expect(w.violations.some((x) => x.type === "offRoad")).toBe(false);
  });

  it("položaj na osi trake je isti kao prije volana", () => {
    const s = scenario();
    const tpl = s.template as RoadTemplate;
    const put = compile(tpl).paths.get(`${tpl.id}:lane0`)!;
    const v = { ...igrac(createWorld(s, 1)), s: 120, lateral: 0 };
    const sa = poseOn(tpl, put, v);
    const bez = poseOn(tpl, put, { ...v, lateral: undefined });
    expect(sa.pos.x).toBe(bez.pos.x);
    expect(sa.pos.y).toBe(bez.pos.y);
  });
});
