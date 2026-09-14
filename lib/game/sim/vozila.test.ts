import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { generateChain } from "@/lib/game/shift/generate";
import {
  CAR_LENGTH,
  CAR_WIDTH,
  CUT_IN_TIME,
  DIO_TIJELA,
  DT,
  FOLLOW_GAP,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  VOZILA,
} from "./config";
import { compile } from "./intersection";
import { createWorld, PLAYER_ID, step, tijeloVozila } from "./world";
import type { Input, Point, RoadTemplate, Scenario, ScenarioNpc, VrstaVozila, World } from "./types";

/**
 * Vrste vozila i tijelo dugog vozila.
 *
 * Put je namjerno prazan, a vozila se postavljaju rukom: mjeri se tačno ono što
 * vrsta mijenja — mjere, tijelo u krivini, sudar, odstojanje i razmak pri
 * vraćanju ispred preteknutog — na situaciji koja se unaprijed zna.
 */

let broj = 0;

interface PutOpcije {
  /** Osovina zadata tačkama; bez nje je put prav. */
  osovina?: Point[];
  startS?: number;
  startV?: number;
}

function put(npcs: ScenarioNpc[], { osovina, startS = 0, startV = 0 }: PutOpcije = {}): Scenario {
  broj += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:vozila:${broj}`,
    length: 1200,
    edgeId: "test--test",
    edgeKm: 1.2,
    vMax: 25,
    curves: [],
    ...(osovina ? { centerline: osovina } : {}),
    landmarks: [],
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
    // Pokazivač pali simulacija: ovdje se ne mjeri signalizacija, pa se njen
    // prekršaj ne smije pomiješati sa onim što se mjeri.
    pokazivaci: "auto",
    difficulty: 2,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/** Vozilo u našoj traci, tačno tamo gdje se kaže. */
const uTraci = (startS: number, speed: number, vrsta?: VrstaVozila): ScenarioNpc => ({
  arm: "N",
  intent: { kind: "lane", index: 0 },
  startS,
  spawnAt: [0, 0],
  speed,
  fiksno: true,
  ...(vrsta ? { vrsta } : {}),
});

const miruj: Input = { throttle: 0, brake: 0, indicator: null, changeLane: null, steer: 0 };

const vozilo = (w: World, id: string) => w.vehicles.find((v) => v.id === id)!;

/**
 * Put sa oštrom desnom krivinom: pravac, četvrt kruga poluprečnika `r`, pravac.
 *
 * Osovina je zadata gusto, na po pola metra, da se u mjerenju ne pojavi prelom
 * polilinije umjesto krivine. Vozačeva desna strana je −x (vidi `sim/road.ts`),
 * pa centar desne krivine stoji na −x.
 */
function desnaKrivina(r: number): { osovina: Point[]; centar: Point } {
  const korak = 0.5;
  const osovina: Point[] = [];
  for (let y = 0; y < 300; y += korak) osovina.push({ x: 0, y });
  const centar = { x: -r, y: 300 };
  const koraka = Math.ceil((r * Math.PI) / 2 / korak);
  for (let i = 0; i <= koraka; i++) {
    const f = (i / koraka) * (Math.PI / 2);
    osovina.push({ x: centar.x + r * Math.cos(f), y: centar.y + r * Math.sin(f) });
  }
  for (let t = korak; t <= 300; t += korak) osovina.push({ x: -r - t, y: 300 + r });
  return { osovina, centar };
}

describe("vrste vozila", () => {
  it("srednji putnički auto ima tačno mjere koje su imala sva vozila do sada", () => {
    expect(VOZILA.auto).toEqual({ duzina: CAR_LENGTH, sirina: CAR_WIDTH });
  });

  it("ispitni scenariji i smjena i dalje imaju samo srednje putničke aute", () => {
    // Vrste vozila su za otvoren put. Tamo gdje se uči prvenstvo ne smije se
    // promijeniti ništa — ni dužina po kojoj se računa ko je prošao tačku.
    const scenariji = [...SCENARIOS, ...generateChain(11, 5, 12)];
    for (const s of scenariji) {
      for (const v of createWorld(s, 1).vehicles) {
        expect(v.length, s.id).toBe(CAR_LENGTH);
        expect(v.width, s.id).toBe(CAR_WIDTH);
        expect(v.vrsta, s.id).toBeUndefined();
      }
    }
  });

  it("vozilo dobija mjere svoje vrste", () => {
    const w = createWorld(put([uTraci(100, 10, "kamion"), uTraci(200, 10, "auto-mali")]), 1);
    const kamion = vozilo(w, "npc1");
    const mali = vozilo(w, "npc2");
    expect([kamion.length, kamion.width, kamion.vrsta]).toEqual([
      VOZILA.kamion.duzina,
      VOZILA.kamion.sirina,
      "kamion",
    ]);
    expect([mali.length, mali.width]).toEqual([VOZILA["auto-mali"].duzina, VOZILA["auto-mali"].sirina]);
  });
});

describe("tijelo dugog vozila", () => {
  it("auto i kombi su jedan komad, kamion i autobus više komada iste ukupne dužine", () => {
    const s = put([
      uTraci(100, 0, "kombi"),
      uTraci(150, 0, "kamion"),
      uTraci(200, 0, "autobus"),
      uTraci(250, 0),
    ]);
    const tpl = s.template!;
    const { paths } = compile(tpl);
    const w = createWorld(s, 1);
    const komadi = (id: string) => {
      const v = vozilo(w, id);
      return tijeloVozila(tpl, paths.get(v.pathId)!, v);
    };
    expect(komadi("npc1")).toHaveLength(1);
    expect(komadi("npc4")).toHaveLength(1);
    for (const id of ["npc2", "npc3"]) {
      const t = komadi(id);
      expect(t.length, id).toBeGreaterThan(1);
      expect(t.every((d) => d.length <= DIO_TIJELA), id).toBe(true);
      expect(t.reduce((a, d) => a + d.length, 0), id).toBeCloseTo(12, 9);
    }
  });

  it("u oštroj krivini kamion prati traku, a kruti pravougaonik ne bi", () => {
    // Kamion stoji sredinom na sredini luka, u unutrašnjoj traci. Mjeri se
    // koliko krajevi njegovih komada izlaze iz kruga po kojem ide traka — i
    // koliko bi izlazili krajevi jednog pravougaonika od dvanaest metara
    // postavljenog na tangentu.
    const { osovina, centar } = desnaKrivina(15);
    const s = put([uTraci(0, 0, "kamion")], { osovina });
    const tpl = s.template!;
    const w = createWorld(s, 1);
    const kamion = vozilo(w, "npc1");
    const traka = compile(tpl).paths.get(kamion.pathId)!;
    const odCentra = (p: Point) => Math.hypot(p.x - centar.x, p.y - centar.y);
    const ugao = (p: Point) => Math.atan2(p.y - centar.y, p.x - centar.x);

    // Tačka trake na sredini luka: pod četrdeset pet stepeni od centra.
    let najbliza = 0;
    traka.points.forEach((p, i) => {
      const q = traka.points[najbliza]!;
      if (odCentra(p) < 20 && Math.abs(ugao(p) - Math.PI / 4) < Math.abs(ugao(q) - Math.PI / 4)) {
        najbliza = i;
      }
    });
    kamion.s = traka.cum[najbliza]!;
    const poluprecnikTrake = odCentra(traka.points[najbliza]!);

    const izlazi = (c: Point, h: Point, pola: number) =>
      Math.max(
        odCentra({ x: c.x + h.x * pola, y: c.y + h.y * pola }),
        odCentra({ x: c.x - h.x * pola, y: c.y - h.y * pola }),
      ) - poluprecnikTrake;

    const poKomadima = Math.max(
      ...tijeloVozila(tpl, traka, kamion).map((d) => izlazi(d.pos, d.heading, d.length / 2)),
    );
    const [kruto] = tijeloVozila(tpl, traka, { ...kamion, length: DIO_TIJELA });
    const krutoIzlazi = izlazi(kruto!.pos, kruto!.heading, VOZILA.kamion.duzina / 2);

    expect(poKomadima).toBeLessThan(0.25);
    expect(krutoIzlazi).toBeGreaterThan(1);
  });

  it("u kamion se udara cijelom njegovom dužinom, ne samo sredinom", () => {
    // Kamion stoji, a igrač mu prilazi otpozadi ne kočeći. Sudar mora nastati
    // kad prednji branik auta stigne do ZADNJEG branika kamiona.
    const s = put([uTraci(200, 0, "kamion")], { startS: 150, startV: 8 });
    const w = createWorld(s, 1);
    while (w.outcome === "running" && w.t < 20) step(w, s, miruj);
    expect(w.violations.find((x) => x.type === "collision")?.otherVehicleId).toBe("npc1");
    const igrac = vozilo(w, PLAYER_ID);
    const prednjiBranik = igrac.s + igrac.length / 2;
    const zadnjiBranikKamiona = 200 - VOZILA.kamion.duzina / 2;
    expect(prednjiBranik).toBeGreaterThan(zadnjiBranikKamiona - 0.05);
    expect(prednjiBranik).toBeLessThan(zadnjiBranikKamiona + 8 * DT + 0.05);
  });
});

describe("odstojanje se mjeri od branika do branika", () => {
  /** Praznina između zadnjeg branika vozila `ispred` i prednjeg branika vozila `iza` [m]. */
  const praznina = (w: World, ispred: string, iza: string) => {
    const a = vozilo(w, ispred);
    const b = vozilo(w, iza);
    return a.s - a.length / 2 - (b.s + b.length / 2);
  };

  it.each([
    ["kamion", "auto"],
    ["auto", "kamion"],
  ] as const)("ispred stoji %s, a iza njega staje %s", (ispredVrsta, izaVrsta) => {
    // Da se od razmaka središta oduzme cijela dužina vozila ispred, auto bi
    // iza kamiona stao desetak metara od njega, a kamion iza auta na dva.
    const s = put([uTraci(300, 0, ispredVrsta), uTraci(200, 12, izaVrsta)]);
    const w = createWorld(s, 1);
    for (let i = 0; i < Math.round(30 / DT); i++) step(w, s, { ...miruj, brake: 1 });
    expect(vozilo(w, "npc2").v).toBeLessThan(0.2);
    expect(praznina(w, "npc1", "npc2")).toBeGreaterThan(FOLLOW_GAP - 0.5);
    expect(praznina(w, "npc1", "npc2")).toBeLessThan(FOLLOW_GAP + 1);
  });
});

describe("vraćanje ispred preteknutog kamiona", () => {
  /** Igrač se upravo vratio u svoju traku ispred kamiona, sa zadatom prazninom. */
  function vratioSe(prazninaM: number): World {
    const brzina = 12;
    const s = put([uTraci(100, brzina, "kamion")], { startS: 150, startV: brzina });
    const w = createWorld(s, 1);
    const igrac = vozilo(w, PLAYER_ID);
    const kamion = vozilo(w, "npc1");
    igrac.s = kamion.s + kamion.length / 2 + prazninaM + igrac.length / 2;
    w.volan.kontraT = 3;
    w.volan.preticao = kamion.id;
    step(w, s, miruj);
    return w;
  }

  it("razmak se mjeri od prednjeg branika kamiona, ne od njegove sredine", () => {
    // Deset metara ispred kamiona koji vozi dvanaest metara u sekundi je ispod
    // sekunde. Da se od razmaka središta oduzme samo dužina auta, ispalo bi
    // preko sekunde i vraćanje bi prošlo kao propisno.
    const blizu = vratioSe(CUT_IN_TIME * 12 - 2);
    const daleko = vratioSe(CUT_IN_TIME * 12 + 2);
    expect(blizu.violations.some((v) => v.type === "cutIn")).toBe(true);
    expect(daleko.violations.some((v) => v.type === "cutIn")).toBe(false);
  });
});
