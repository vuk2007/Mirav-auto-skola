import { describe, expect, it } from "vitest";
import {
  DT,
  INDICATOR_LEAD_TIME,
  MAX_OVERTAKE_TIME,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  VOZILA,
} from "./config";
import { createWorld, PLAYER_ID, step } from "./world";
import { vozacRute } from "./vozac";
import type { RoadTemplate, Scenario, ScenarioNpc, Vehicle, VrstaVozila, World } from "./types";

/**
 * Vozač rute koji pretiče.
 *
 * Put je prav i prazan, a vozila se postavljaju rukom: mjeri se odluka vozača
 * na situaciji koja se tačno zna. Stvarne rute se voze u `world/ruta.test.ts` i
 * u fuzz testu.
 */

let broj = 0;

interface Opcije {
  /** Brzina sporijeg, kao dio ograničenja. */
  udio?: number;
  vrsta?: VrstaVozila;
  /** Gdje sporiji stoji na početku [m]. */
  ispred?: number;
  zabrane?: { from: number; to: number }[];
  /** Susretno vozilo, mjereno od našeg početka [m]. */
  susretno?: number;
  vMax?: number;
}

function put({
  udio = 0.7,
  vrsta = "kamion",
  ispred = 120,
  zabrane,
  susretno,
  vMax = 80 / 3.6,
}: Opcije = {}): { scenario: Scenario; brzina: number } {
  broj += 1;
  const duzina = 6000;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:vozac:${broj}`,
    length: duzina,
    edgeId: "test--test",
    edgeKm: 6,
    vMax,
    curves: [],
    landmarks: [],
    zabrane,
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  const brzina = vMax * udio;
  const npcs: ScenarioNpc[] = [
    {
      arm: "N",
      intent: { kind: "lane", index: 0 },
      startS: ispred + (VOZILA.auto.duzina + VOZILA[vrsta].duzina) / 2,
      spawnAt: [0, 0],
      speed: brzina,
      fiksno: true,
      vrsta,
    },
  ];
  if (susretno !== undefined) {
    npcs.push({
      arm: "S",
      intent: { kind: "lane", index: 1 },
      // Susretna traka je okrenuta: njeno `s` se mjeri od kraja puta.
      startS: duzina - susretno,
      spawnAt: [0, 0],
      speed: vMax,
      fiksno: true,
    });
  }
  return {
    scenario: {
      id: tpl.id,
      intersection: tpl.id,
      template: tpl,
      player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS: 0, startV: brzina },
      npcs,
      upravljanje: "traka",
      difficulty: 2,
      title: { me: "proba" },
      explanation: { me: "proba" },
    },
    brzina,
  };
}

interface Voznja {
  world: World;
  /** Najduže zadržavanje u suprotnoj traci [s]. */
  uKontri: number;
  /** Koliko puta je sredina vozila prešla razdjelnu liniju. */
  preticanja: number;
  igrac: Vehicle;
  spori: Vehicle;
}

/** Odvozi `sekundi` sekundi datim vozačem. */
function vozi(scenario: Scenario, sekundi: number, pretice = true): Voznja {
  const world = createWorld(scenario, 1);
  const bot = vozacRute({ pretice });
  let uKontri = 0;
  let preticanja = 0;
  let bio = false;
  for (let i = 0; i < Math.round(sekundi / DT) && world.outcome === "running"; i++) {
    step(world, scenario, bot(world, scenario));
    uKontri = Math.max(uKontri, world.volan.kontraT);
    const sada = world.volan.kontraT > 0;
    if (sada && !bio) preticanja += 1;
    bio = sada;
  }
  return {
    world,
    uKontri,
    preticanja,
    igrac: world.vehicles.find((v) => v.id === PLAYER_ID)!,
    spori: world.vehicles.find((v) => v.id === "npc1")!,
  };
}

describe("preticanje sporijeg vozila", () => {
  it("pretekne kamion i vrati se ispred njega, bez ijednog prekršaja", () => {
    const { scenario } = put();
    const v = vozi(scenario, 60);
    expect(v.preticanja).toBe(1);
    expect(v.igrac.s).toBeGreaterThan(v.spori.s);
    expect(v.igrac.lateral).toBeCloseTo(0, 1);
    expect(v.world.violations.map((x) => `${x.type}: ${x.details}`)).toEqual([]);
  });

  it("u suprotnoj traci se zadržava kraće nego što pravilo dozvoljava", () => {
    const v = vozi(put().scenario, 60);
    expect(v.uKontri).toBeGreaterThan(0);
    expect(v.uKontri).toBeLessThan(MAX_OVERTAKE_TIME);
  });

  it("pali lijevi pokazivač prije prelaska, a desni prije povratka", () => {
    const v = vozi(put().scenario, 60);
    const upaljeni = v.world.indicatorLog.filter((e) => e.indicator !== null).map((e) => e.indicator);
    expect(upaljeni).toEqual(["left", "right"]);
    // Rok se mjeri od paljenja do prelaska, a prelazak se ovdje ne vidi — vidi
    // ga pravilo, pa je dokaz da prekršaja nema u testu iznad. Ovdje se mjeri
    // samo da je lijevi gorio bar propisano vrijeme prije nego što je zamijenjen.
    const lijevi = v.world.indicatorLog.find((e) => e.indicator === "left")!;
    const desni = v.world.indicatorLog.find((e) => e.indicator === "right")!;
    expect(desni.t - lijevi.t).toBeGreaterThan(INDICATOR_LEAD_TIME);
  });

  it("preteknuti zbog povratka ne mora da koči", () => {
    const v = vozi(put().scenario, 60);
    const zakocio = v.world.events.some((e) => e.type === "forcedBrake" && e.by === PLAYER_ID);
    expect(zakocio).toBe(false);
  });

  it("isto sjeme i isti put daju istu vožnju", () => {
    const trag = () => {
      const { scenario } = put();
      const v = vozi(scenario, 40);
      return JSON.stringify([v.igrac.s, v.igrac.v, v.igrac.lateral, v.preticanja]);
    };
    expect(trag()).toBe(trag());
  });
});

describe("kad se ne pretiče", () => {
  it("preko pune linije se ne prelazi nego se vozi iza", () => {
    const { scenario } = put({ zabrane: [{ from: 0, to: 6000 }] });
    const v = vozi(scenario, 60);
    expect(v.preticanja).toBe(0);
    expect(v.igrac.s).toBeLessThan(v.spori.s);
    expect(v.world.violations.map((x) => x.type)).toEqual([]);
  });

  it("ne kreće kad susretno vozilo stiže", () => {
    // Igrač je odmah iza kamiona, pa se odluka donosi na početku — dok je
    // susretno vozilo još ispred. Poredi se sa istim putem bez njega, da se vidi
    // da je razlog baš ono, a ne nešto drugo.
    const prazno = vozi(put({ ispred: 25 }).scenario, 10);
    const sa = vozi(put({ ispred: 25, susretno: 400 }).scenario, 10);
    expect(prazno.preticanja).toBe(1);
    expect(sa.preticanja).toBe(0);
    expect(sa.world.violations.map((x) => x.type)).toEqual([]);
  });

  it("ne pretiče vozilo koje je jedva sporije", () => {
    // Pet km/h razlike: preticanje bi trajalo pola minuta, a dobitak je nikakav.
    const { scenario } = put({ udio: 0.94, vrsta: "auto" });
    const v = vozi(scenario, 60);
    expect(v.preticanja).toBe(0);
    expect(v.world.violations.map((x) => x.type)).toEqual([]);
  });

  it("vozač kojem je preticanje isključeno ostaje iza do kraja", () => {
    const { scenario } = put();
    const v = vozi(scenario, 60, false);
    expect(v.preticanja).toBe(0);
    expect(v.igrac.s).toBeLessThan(v.spori.s);
    expect(v.world.violations.map((x) => x.type)).toEqual([]);
  });
});

describe("ograničenje brzine", () => {
  it("ni u preticanju ne prekoračuje ograničenje", () => {
    const { scenario } = put();
    const world = createWorld(scenario, 1);
    const bot = vozacRute({ pretice: true });
    let najveca = 0;
    for (let i = 0; i < Math.round(60 / DT) && world.outcome === "running"; i++) {
      step(world, scenario, bot(world, scenario));
      najveca = Math.max(najveca, world.vehicles.find((v) => v.id === PLAYER_ID)!.v);
    }
    const tpl = scenario.template as RoadTemplate;
    // Jedan korak preko: gas se gasi tek kad brzina pređe ograničenje, pa se u
    // tom koraku pređe stotinka. Prekršaj počinje na pet posto (`SPEEDING_FACTOR`).
    expect(najveca).toBeLessThan(tpl.vMax + 0.05);
    expect(world.violations.map((x) => x.type)).not.toContain("speeding");
  });
});
