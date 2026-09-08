import { describe, expect, it } from "vitest";
import { run } from "../sim/bots";
import { ONCOMING_GAP, TRIP_SEGMENT_TIME } from "../sim/config";
import { compile } from "../sim/intersection";
import { lanePathId } from "../sim/highway";
import { curvatureAt } from "../sim/road";
import type { Input, RoadTemplate, World } from "../sim/types";
import { createWorld, PLAYER_ID, poseOn, step } from "../sim/world";
import { EDGES, edgeById, type RoadEdge } from "./roadGraph";
import { dionica, nazivDionice, roadTemplate } from "./segment";

const ivica = (id: string): RoadEdge => {
  const e = edgeById(id);
  if (!e) throw new Error(`nema ivice ${id}`);
  return e;
};

/** Vozač koji drži dozvoljenu brzinu i ništa više — mjerilo za trajanje. */
const poPropisu =
  (vMax: number) =>
  (world: World): Input => {
    const igrac = world.vehicles.find((v) => v.id === PLAYER_ID);
    const v = igrac?.v ?? 0;
    return {
      throttle: v < vMax ? 1 : 0,
      brake: v > vMax * 1.02 ? 0.4 : 0,
      indicator: null,
      changeLane: null,
    };
  };

describe("šablon dionice", () => {
  it("traje četiri minuta po dozvoljenoj brzini, koliko god ivica bila duga", () => {
    for (const e of EDGES) {
      const tpl = roadTemplate(e, 1);
      expect(tpl.length / tpl.vMax, e.id).toBeCloseTo(TRIP_SEGMENT_TIME, 6);
    }
  });

  it("dužina koja se vozi nije dužina ivice, i to je namjerno", () => {
    const dugacka = roadTemplate(ivica("bioce--kolasin"), 1);
    const kratka = roadTemplate(ivica("herceg-novi--debeli-brijeg"), 1);
    expect(dugacka.edgeKm).toBe(60);
    expect(kratka.edgeKm).toBe(8);
    // Obje se voze jednako dugo, iako je jedna sedam i po puta duža.
    expect(dugacka.length / dugacka.vMax).toBeCloseTo(kratka.length / kratka.vMax, 6);
  });

  it("ograničenje dolazi iz ivice", () => {
    expect(roadTemplate(ivica("podgorica--danilovgrad"), 1).vMax).toBeCloseTo(80 / 3.6, 6);
    expect(roadTemplate(ivica("njegusi--kotor"), 1).vMax).toBeCloseTo(50 / 3.6, 6);
    expect(roadTemplate(ivica("smokovac--matesevo"), 1).vMax).toBeCloseTo(100 / 3.6, 6);
  });

  it("isto sjeme daje istu dionicu, drugo je mijenja", () => {
    const e = ivica("bioce--kolasin");
    expect(roadTemplate(e, 7)).toEqual(roadTemplate(e, 7));
    expect(roadTemplate(e, 7)).not.toEqual(roadTemplate(e, 8));
  });

  it("naziv prati smjer vožnje", () => {
    const e = ivica("njegusi--kotor");
    expect(nazivDionice(e, false)).toBe("Njeguši — Kotor");
    expect(nazivDionice(e, true)).toBe("Kotor — Njeguši");
  });
});

describe("krivine na dionici", () => {
  const planinske = EDGES.filter((e) => e.kind === "planinski");

  it("ravan put nema nijednu", () => {
    for (const e of EDGES.filter((x) => x.kind !== "planinski")) {
      expect(roadTemplate(e, 3).curves, e.id).toEqual([]);
    }
  });

  it("stoje unutar dionice i ne ulaze jedna u drugu", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const e of planinske) {
        const tpl = roadTemplate(e, seed);
        let krajPrethodne = 0;
        for (const k of tpl.curves) {
          const pocetak = k.atS - k.arc / 2;
          const kraj = k.atS + k.arc / 2;
          expect(pocetak, `${e.id} seed=${seed}`).toBeGreaterThanOrEqual(krajPrethodne);
          expect(kraj, `${e.id} seed=${seed}`).toBeLessThanOrEqual(tpl.length);
          expect(k.arc, `${e.id} seed=${seed}`).toBeGreaterThan(0);
          krajPrethodne = kraj;
        }
      }
    }
  });

  it("poluprečnik dolazi iz preporučene brzine, ne iz oka", () => {
    for (const k of roadTemplate(ivica("njegusi--kotor"), 5).curves) {
      expect(k.radius).toBeCloseTo((k.advisorySpeed / 3.6) ** 2 / 2.5, 6);
    }
  });

  it("Njeguši — Kotor ima svojih dvanaest", () => {
    expect(roadTemplate(ivica("njegusi--kotor"), 1).curves).toHaveLength(12);
    expect(roadTemplate(ivica("njegusi--kotor"), 99).curves).toHaveLength(12);
  });

  it("zakrivljenost je nula van krivine i suprotnog znaka u susjednim", () => {
    const tpl = roadTemplate(ivica("njegusi--kotor"), 4);
    const prva = tpl.curves[0];
    const druga = tpl.curves[1];
    expect(prva && druga).toBeTruthy();
    if (!prva || !druga) return;
    expect(curvatureAt(tpl.curves, 0)).toBe(0);
    const k1 = curvatureAt(tpl.curves, prva.atS);
    const k2 = curvatureAt(tpl.curves, druga.atS);
    expect(k1 * k2).toBeLessThan(0);
  });
});

describe("putanje dionice", () => {
  it("ima našu i susretnu traku, obje pune dužine", () => {
    const tpl = roadTemplate(ivica("podgorica--danilovgrad"), 1);
    const { paths } = compile(tpl);
    expect(paths.size).toBe(2);
    for (const p of paths.values()) {
      expect(p.length).toBeGreaterThan(tpl.length * 0.95);
      expect(p.length).toBeLessThan(tpl.length * 1.05);
    }
  });

  it("susretna traka ide u suprotnom smjeru", () => {
    const tpl = roadTemplate(ivica("njegusi--kotor"), 2);
    const { paths } = compile(tpl);
    const nasa = paths.get(lanePathId(tpl.id, 0));
    const susretna = paths.get(lanePathId(tpl.id, 1));
    expect(nasa && susretna).toBeTruthy();
    if (!nasa || !susretna) return;
    const pocetakNase = nasa.points[0];
    const krajNase = nasa.points[nasa.points.length - 1];
    const pocetakSusretne = susretna.points[0];
    expect(pocetakNase && krajNase && pocetakSusretne).toBeTruthy();
    if (!pocetakNase || !krajNase || !pocetakSusretne) return;
    // Susretno vozilo počinje tamo gdje mi završavamo.
    const doKraja = Math.hypot(pocetakSusretne.x - krajNase.x, pocetakSusretne.y - krajNase.y);
    const doPocetka = Math.hypot(pocetakSusretne.x - pocetakNase.x, pocetakSusretne.y - pocetakNase.y);
    expect(doKraja).toBeLessThan(doPocetka);
    expect(doKraja).toBeLessThan(tpl.geometry.laneWidth * 2);
  });

  it("planinski put stvarno vijuga, ravan ne", () => {
    const raspon = (tpl: RoadTemplate) => {
      const { paths } = compile(tpl);
      const p = paths.get(lanePathId(tpl.id, 0));
      const xs = (p?.points ?? []).map((t) => t.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(raspon(roadTemplate(ivica("njegusi--kotor"), 3))).toBeGreaterThan(50);
    expect(raspon(roadTemplate(ivica("podgorica--danilovgrad"), 3))).toBeLessThan(1);
  });
});

describe("vožnja dionicom", () => {
  it("po propisu se pređe za oko četiri minuta i bez ijednog prekršaja", () => {
    for (const id of ["podgorica--danilovgrad", "njegusi--kotor", "plav--gusinje"]) {
      const e = ivica(id);
      const s = dionica(e, 5);
      const tpl = s.template as RoadTemplate;
      const r = run(s, poPropisu(tpl.vMax), 5);
      expect(r.finished, id).toBe(true);
      expect(r.world.outcome, `${id}: ${JSON.stringify(r.world.violations)}`).toBe("passed");
      // Kreće se sa osamdeset odsto brzine, pa je nešto sporije od tačno 240 s.
      expect(r.time, id).toBeGreaterThan(TRIP_SEGMENT_TIME * 0.9);
      expect(r.time, id).toBeLessThan(TRIP_SEGMENT_TIME * 1.15);
    }
  });

  // Vožnja jedne dionice je 14 400 koraka simulacije sa tridesetak vozila, pa
  // se cijeli graf ne vozi u svakom pokretanju testova: vozi se po jedna
  // dionica svake vrste puta, a za sve ostale se provjerava da se scenario i
  // putanje uopšte mogu napraviti.
  it(
    "svaka vrsta puta se prevozi bez zaglavljivanja",
    () => {
      for (const id of [
        "podgorica--danilovgrad",
        "smokovac--matesevo",
        "berane--petnjica",
        "bioce--kolasin",
        "tivat--kamenari",
      ]) {
        const e = ivica(id);
        const s = dionica(e, 11);
        const tpl = s.template as RoadTemplate;
        const r = run(s, poPropisu(tpl.vMax), 11);
        expect(r.finished, id).toBe(true);
        expect(r.world.outcome, `${id}: ${JSON.stringify(r.world.violations)}`).toBe("passed");
      }
    },
    30_000,
  );

  it("svaka ivica u grafu daje scenario koji se može napraviti", () => {
    for (const e of EDGES) {
      const s = dionica(e, 11);
      const tpl = s.template as RoadTemplate;
      expect(compile(tpl).paths.size, e.id).toBe(2);
      expect(s.npcs.length, e.id).toBeGreaterThan(20);
      for (const n of s.npcs) {
        expect(n.spawnAt[0], e.id).toBeLessThan(TRIP_SEGMENT_TIME);
        expect(n.startS ?? 0, e.id).toBeLessThanOrEqual(tpl.length);
        expect(n.speed, e.id).toBeGreaterThan(0);
      }
      // Svijet mora da se sastavi — tu puca sve što fali putanjama.
      expect(createWorld(s, 11).vehicles.length).toBe(s.npcs.length + 1);
    }
  });

  it("susretna vozila su raspoređena po cijeloj dionici, ne samo na početku", () => {
    const s = dionica(ivica("podgorica--danilovgrad"), 9);
    const tpl = s.template as RoadTemplate;
    const world = createWorld(s, 9);
    const bot = poPropisu(tpl.vMax);
    const mimoilazenja: number[] = [];
    const bilo = new Set<string>();

    while (world.outcome === "running") {
      step(world, s, bot(world));
      const ja = world.vehicles.find((v) => v.id === PLAYER_ID);
      if (!ja) break;
      const predjeno = ja.s;
      for (const v of world.vehicles) {
        if (v.kind !== "npc" || bilo.has(v.id)) continue;
        // Susretno vozilo ide unazad po našoj kilometraži: mimoilaženje je
        // trenutak kad mu je preostali put jednak našem pređenom.
        const njegovo = tpl.length - v.s;
        if (v.spawnT <= world.t && Math.abs(njegovo - predjeno) < 6) {
          bilo.add(v.id);
          mimoilazenja.push(world.t);
        }
      }
    }

    expect(mimoilazenja.length).toBeGreaterThan(20);
    const prvo = mimoilazenja[0] ?? 0;
    const zadnje = mimoilazenja[mimoilazenja.length - 1] ?? 0;
    expect(prvo).toBeLessThan(ONCOMING_GAP * 3);
    expect(zadnje).toBeGreaterThan(TRIP_SEGMENT_TIME * 0.85);
  });
});

describe("strana puta", () => {
  // Mjeri se i na krivom putu: na pravcu se greška u znaku ne bi ni vidjela,
  // jer je tamo „lijevo" prosto +x.
  it.each(["podgorica--danilovgrad", "njegusi--kotor"])(
    "susretno vozilo se mimoilazi sa vozačeve lijeve strane (%s)",
    (id) => {
    const s = dionica(ivica(id), 4);
    const tpl = s.template as RoadTemplate;
    const world = createWorld(s, 4);
    const bot = poPropisu(tpl.vMax);
    const { paths } = compile(tpl);
    let mjereno = 0;

    while (world.outcome === "running" && mjereno < 5) {
      step(world, s, bot(world));
      const ja = world.vehicles.find((v) => v.id === PLAYER_ID);
      const mojaPutanja = ja ? paths.get(ja.pathId) : undefined;
      if (!ja || !mojaPutanja) break;
      const mojaPoz = poseOn(tpl, mojaPutanja, ja).pos;
      const smjer = poseOn(tpl, mojaPutanja, ja).heading;

      for (const v of world.vehicles) {
        if (v.kind !== "npc" || v.spawnT > world.t) continue;
        const p = paths.get(v.pathId);
        if (!p) continue;
        const poz = poseOn(tpl, p, v).pos;
        const dx = poz.x - mojaPoz.x;
        const dy = poz.y - mojaPoz.y;
        // Uzduž smjera vožnje: mimoilaženje je kad je vozilo tačno bočno.
        const uzduz = dx * smjer.x + dy * smjer.y;
        if (Math.abs(uzduz) > 1) continue;
        // Vozačeva lijeva strana je +x zaokrenuto sa smjerom (vidi `laneX`).
        const ulijevo = dx * smjer.y - dy * smjer.x;
        expect(ulijevo, `susretno vozilo ${v.id} nije lijevo`).toBeGreaterThan(0);
        expect(Math.abs(ulijevo)).toBeLessThan(tpl.geometry.laneWidth * 1.5);
        mjereno += 1;
      }
    }
    expect(mjereno).toBeGreaterThanOrEqual(5);
    },
  );
});
