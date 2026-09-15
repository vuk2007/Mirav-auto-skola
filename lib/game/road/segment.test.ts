import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { perfectBot, run } from "../sim/bots";
import { TRIP_SEGMENT_TIME } from "../sim/config";
import { compile } from "../sim/intersection";
import { lanePathId } from "../sim/highway";
import { curvatureAt } from "../sim/road";
import type { Input, RoadTemplate, Scenario, World } from "../sim/types";
import { createWorld, PLAYER_ID, poseOn, step } from "../sim/world";
import { parseGeometry, type EdgeGeometry } from "./edgeGeometry";
import { EDGES, edgeById, type RoadEdge } from "./roadGraph";
import { dionica, nazivDionice, roadTemplate } from "./segment";

const ivica = (id: string): RoadEdge => {
  const e = edgeById(id);
  if (!e) throw new Error(`nema ivice ${id}`);
  return e;
};

/** Vozač koji drži dozvoljenu brzinu i ništa više — mjerilo za trajanje. */
/**
 * Vozač koji drži ograničenje i odstojanje.
 *
 * Osnovu daje savršen vozač, dakle ista logika po kojoj voze NPC-ovi — otkad u
 * našoj traci ima sporijih vozila, vozač koji gleda samo brzinomjer ih zakuca
 * s leđa. Preticanje ne zna: ko ne pretiče, vozi iza njih i plaća vremenom.
 */
const poPropisu =
  (vMax: number, scenario: Scenario) =>
  (world: World): Input => {
    const igrac = world.vehicles.find((v) => v.id === PLAYER_ID);
    const v = igrac?.v ?? 0;
    const osnova = perfectBot(world, scenario);
    if (v > vMax * 1.02) return { ...osnova, throttle: 0, brake: 0.4 };
    if (v < vMax) return osnova;
    return { ...osnova, throttle: 0 };
  };

/** Ista dionica bez ijednog vozila — za mjere koje se tiču puta, ne saobraćaja. */
const prazna = (s: Scenario): Scenario => ({ ...s, npcs: [], tok: undefined });

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
      // Četiri minuta je obećanje o DUŽINI dionice, pa se mjeri na praznom
      // putu; sa saobraćajem se vozi duže, i to je tačno.
      const p = prazna(s);
      const bez = run(p, poPropisu(tpl.vMax, p), 5);
      expect(bez.finished, id).toBe(true);
      expect(bez.world.outcome, `${id}: ${JSON.stringify(bez.world.violations)}`).toBe("passed");
      // Kreće se sa osamdeset odsto brzine, pa je nešto sporije od tačno 240 s.
      expect(bez.time, id).toBeGreaterThan(TRIP_SEGMENT_TIME * 0.9);
      expect(bez.time, id).toBeLessThan(TRIP_SEGMENT_TIME * 1.15);

      const r = run(s, poPropisu(tpl.vMax, s), 5);
      expect(r.finished, id).toBe(true);
      expect(r.world.outcome, `${id}: ${JSON.stringify(r.world.violations)}`).toBe("passed");
      expect(r.time, id).toBeLessThan(TRIP_SEGMENT_TIME * 1.6);
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
        const r = run(s, poPropisu(tpl.vMax, s), 11);
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
      // Saobraćaj je opis toka koji pokriva cijelu dionicu; planinska dobija i
      // zagarantovan kamion, ostale ne.
      expect(s.tok?.dionice, e.id).toEqual([
        { od: 0, do: tpl.length, vrsta: e.kind === "planinski" ? "planinski" : "put", vMax: tpl.vMax },
      ]);
      expect((s.tok?.kamioni.length ?? 0) > 0, e.id).toBe(e.kind === "planinski");
      // Svijet mora da se sastavi — tu puca sve što fali putanjama — i već na
      // startu nosi saobraćaj oko igrača.
      const world = createWorld(s, 11);
      expect(world.vehicles.length, e.id).toBeGreaterThan(3);
      for (const v of world.vehicles) {
        expect(v.s >= 0 && v.s <= tpl.length * 1.05, `${e.id} ${v.id}`).toBe(true);
        expect(v.v, `${e.id} ${v.id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("susretna vozila su raspoređena po cijeloj dionici, ne samo na početku", () => {
    const s = dionica(ivica("podgorica--danilovgrad"), 9);
    const tpl = s.template as RoadTemplate;
    const world = createWorld(s, 9);
    const bot = poPropisu(tpl.vMax, s);
    const mimoilazenja: number[] = [];
    const bilo = new Set<string>();

    while (world.outcome === "running") {
      step(world, s, bot(world));
      const ja = world.vehicles.find((v) => v.id === PLAYER_ID);
      if (!ja) break;
      const predjeno = ja.s;
      for (const v of world.vehicles) {
        // Mimoilazi se samo susretno vozilo; ono što ide u našem smjeru se
        // pretiče ili prati.
        if (v.kind !== "npc" || v.lane !== 1 || bilo.has(v.id)) continue;
        // Susretno vozilo ide unazad po našoj kilometraži: mimoilaženje je
        // trenutak kad mu je preostali put jednak našem pređenom.
        const njegovo = tpl.length - v.s;
        if (v.spawnT <= world.t && Math.abs(njegovo - predjeno) < 6) {
          bilo.add(v.id);
          mimoilazenja.push(world.t);
        }
      }
    }

    // Na drugom nivou je oko šest susretnih na dva kilometra, i dolaze u
    // kolonama — pa jedna dionica od četiri minuta ima između petnaest i
    // trideset mimoilaženja, zavisno od toga koliko kolona naiđe.
    expect(mimoilazenja.length).toBeGreaterThan(12);
    const prvo = mimoilazenja[0] ?? 0;
    const zadnje = mimoilazenja[mimoilazenja.length - 1] ?? 0;
    // Prvo mimoilaženje dolazi brzo: saobraćaj već postoji u prozoru kad vožnja
    // počne, pa se ne čeka da prvo susretno vozilo stigne sa ivice prozora.
    expect(prvo).toBeLessThan(30);
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
    const bot = poPropisu(tpl.vMax, s);
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
        // Mjeri se mimoilaženje, dakle SUSRETNA vozila; ono što ide u našem
        // smjeru se ne mimoilazi nego pretiče ili prati.
        if (v.kind !== "npc" || v.spawnT > world.t || v.lane !== 1) continue;
        const p = paths.get(v.pathId);
        if (!p) continue;
        const poz = poseOn(tpl, p, v).pos;
        const dx = poz.x - mojaPoz.x;
        const dy = poz.y - mojaPoz.y;
        // Uzduž smjera vožnje: mimoilaženje je kad je vozilo tačno bočno.
        const uzduz = dx * smjer.x + dy * smjer.y;
        if (Math.abs(uzduz) > 1) continue;
        // Na serpentini je i vozilo iz druge okuke „tačno bočno", a sa njim se
        // ne mimoilazimo nego ga gledamo preko doline. Mjeri se samo ono što
        // nam je zaista pod bokom.
        if (Math.hypot(dx, dy) > tpl.geometry.laneWidth * 3) continue;
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

describe("znamenitosti uz dionicu", () => {
  it("stoje unutar dionice i sa jedne od dvije strane", () => {
    for (const e of EDGES) {
      for (const obrnuto of [false, true]) {
        const tpl = roadTemplate(e, 3, obrnuto);
        for (const z of tpl.landmarks) {
          expect(z.atS, `${e.id} ${z.name}`).toBeGreaterThan(0);
          expect(z.atS, `${e.id} ${z.name}`).toBeLessThan(tpl.length);
          expect(["left", "right"], z.name).toContain(z.side);
          expect(z.icon.startsWith("/assets/landmarks/"), z.name).toBe(true);
          expect(z.name.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("kilometraža ivice se preslikava srazmjerno na dužinu koja se vozi", () => {
    // Ostrog je na 12. od 35 km ivice Danilovgrad — Nikšić.
    const e = ivica("danilovgrad--niksic");
    const tpl = roadTemplate(e, 1);
    const ostrog = tpl.landmarks.find((z) => z.name.includes("Ostrog"));
    expect(ostrog).toBeTruthy();
    expect(ostrog?.atS).toBeCloseTo((12 / 35) * tpl.length, 6);
  });

  it("u suprotnom smjeru se okreću i redoslijed i strana", () => {
    const e = ivica("kotor--kamenari");
    const naprijed = roadTemplate(e, 1, false).landmarks;
    const nazad = roadTemplate(e, 1, true).landmarks;
    expect(naprijed.map((z) => z.name)).toEqual([...nazad].reverse().map((z) => z.name));
    const perastN = naprijed.find((z) => z.name === "Perast");
    const perastZ = nazad.find((z) => z.name === "Perast");
    expect(perastN?.side).toBe("left");
    expect(perastZ?.side).toBe("right");
    // Dvanaesti kilometar od Kotora je osamnaesti od Kamenara.
    const tpl = roadTemplate(e, 1);
    expect(perastZ?.atS).toBeCloseTo((18 / 30) * tpl.length, 6);
  });

  it("dva smjera su dva šablona, da im se raspored ne pomiješa", () => {
    const e = ivica("kotor--kamenari");
    expect(roadTemplate(e, 1, false).id).not.toBe(roadTemplate(e, 1, true).id);
  });

  it("dionica bez znamenitosti ih nema, a ne dobija tuđe", () => {
    expect(roadTemplate(ivica("berane--rozaje"), 1).landmarks).toEqual([]);
  });

  it("scenario nosi znamenitosti u smjeru u kojem se vozi", () => {
    const e = ivica("bar--ulcinj");
    const tpl = dionica(e, 1, false).template as RoadTemplate;
    expect(tpl.landmarks.map((z) => z.name)).toContain("Stara maslina na Mirovici");
  });
});

// Sabijanje stvarne geometrije traje oko sedam sekundi za cijelu mrežu pri
// prvom prolazu (poslije se čita iz keša). Rok je zato duži od podrazumijevanog.
describe("dionica sa stvarnom geometrijom", { timeout: 60000 }, () => {
  /**
   * Ovdje se ne pravi izmišljena geometrija nego se čita ona iz
   * `public/data/osm/edgeGeometry/`, koju pravi `npm run osm:ivice`. Razlog je
   * isti kao i kod sabijanja: greške su bile u onome što izmišljena kriva
   * nema — u nepravilnom razmaku tačaka i u serpentinama.
   */
  const geom = (id: string): EdgeGeometry => {
    const g = parseGeometry(
      JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${id}.json`, "utf8")),
    );
    if (!g) throw new Error(`neispravna geometrija ${id}`);
    return g;
  };

  it("gasi proceduralne krivine i uzima osovinu iz OSM-a", () => {
    const e = ivica("njegusi--kotor");
    const proceduralna = roadTemplate(e, 1);
    const stvarna = roadTemplate(e, 1, false, geom(e.id));
    expect(proceduralna.centerline).toBeUndefined();
    expect(stvarna.centerline!.length).toBeGreaterThan(100);
    // Ivica ima zadatih dvanaest proceduralnih krivina; stvarni put ih ima
    // mnogo više, jer je to serpentina, a ne dvanaest zavoja.
    expect(proceduralna.curves).toHaveLength(12);
    expect(stvarna.curves.length).toBeGreaterThan(20);
  });

  it("dužina više nije ista za sve, i to je posljedica terena", () => {
    const ravna = roadTemplate(ivica("podgorica--zeta"), 1, false, geom("podgorica--zeta"));
    const planinska = roadTemplate(ivica("zabljak--pluzine"), 1, false, geom("zabljak--pluzine"));
    expect(ravna.length / ravna.vMax).toBeLessThan(planinska.length / planinska.vMax);
  });

  it("oba smjera su jednako dugačka", () => {
    // Isti put u suprotnom smjeru mora dati istu dionicu po dužini — inače bi
    // se povratak razlikovao od odlaska bez ijednog razloga.
    for (const id of ["njegusi--kotor", "bioce--kolasin", "podgorica--zeta"]) {
      const e = ivica(id);
      const tamo = roadTemplate(e, 1, false, geom(id));
      const nazad = roadTemplate(e, 1, true, geom(id));
      expect(nazad.length, id).toBeCloseTo(tamo.length, 6);
    }
  });

  it("znamenitosti ostaju unutar dionice i u redoslijedu", () => {
    for (const e of EDGES) {
      const tpl = roadTemplate(e, 1, false, geom(e.id));
      let prethodna = -1;
      for (const z of tpl.landmarks) {
        expect(z.atS, `${e.id} ${z.name}`).toBeGreaterThanOrEqual(0);
        expect(z.atS, `${e.id} ${z.name}`).toBeLessThanOrEqual(tpl.length);
        expect(z.atS, `${e.id} ${z.name}`).toBeGreaterThanOrEqual(prethodna);
        prethodna = z.atS;
      }
    }
  });

  it("table stoje unutar dionice", () => {
    for (const e of EDGES) {
      const tpl = roadTemplate(e, 1, false, geom(e.id));
      for (const c of tpl.curves) {
        expect(c.atS, e.id).toBeGreaterThanOrEqual(0);
        expect(c.atS, e.id).toBeLessThanOrEqual(tpl.length);
        expect(c.advisorySpeed, e.id).toBeGreaterThan(0);
      }
    }
  });

  it("obje trake se sastave i imaju dužinu dionice", () => {
    const e = ivica("cetinje--njegusi");
    const tpl = roadTemplate(e, 1, false, geom(e.id));
    const { paths } = compile(tpl);
    for (const traka of [0, 1]) {
      const p = paths.get(lanePathId(tpl.id, traka));
      expect(p, `traka ${traka}`).toBeDefined();
      // Traka je osovina pomjerena bočno, pa joj se dužina razlikuje za nešto
      // u krivinama, ali ne za red veličine.
      expect(p!.length).toBeGreaterThan(tpl.length * 0.85);
      expect(p!.length).toBeLessThan(tpl.length * 1.15);
    }
  });

  it("vozač po propisu prevozi svaku dionicu bez isteka vremena", () => {
    // Nepromjenjivo pravilo: savršen bot prolazi svaku rutu. Sa stvarnom
    // geometrijom dionice više nisu jednako duge, pa je rok morao da se veže za
    // dužinu — bez toga bi Žabljak — Plužine padao na vrijeme svaki put.
    for (const id of ["podgorica--zeta", "njegusi--kotor", "zabljak--pluzine", "smokovac--matesevo"]) {
      const e = ivica(id);
      const s = dionica(e, 1, false, geom(id));
      const tpl = s.template as RoadTemplate;
      const { world, finished } = run(s, poPropisu(tpl.vMax, s), 1);
      expect(finished, id).toBe(true);
      const sudar = world.violations.some((v) => v.type === "collision");
      expect(sudar, id).toBe(false);
    }
  });
});
