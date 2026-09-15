import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import { EDGES, NODES, edgeById } from "@/lib/game/road/roadGraph";
import { dionica } from "@/lib/game/road/segment";
import { nadjiRutu, napraviRutu, vMaxNaprijed, type Ruta } from "@/lib/game/world/ruta";
import { rutaScenario, uProzoruGustine } from "@/lib/game/world/svijet";
import { perfectBot } from "./bots";
import { KAMION_PLANINA, SAOBRACAJ_U_PROZORU, type Level } from "./config";
import { compile } from "./intersection";
import { dionicaToka } from "./tok";
import type { Input, RoadTemplate, Scenario, World } from "./types";
import { createWorld, PLAYER_ID, step } from "./world";

/**
 * Saobraćaj na otvorenom putu kao tok.
 *
 * Mjeri se ono što zadatak traži — koliko vozila ima u prozoru po nivou — i ono
 * od čega ta mjera zavisi: da tok teče i kad igrač stoji, da je isti za isto
 * sjeme, da vozila ne nastaju jedno u drugom i da svijet ne raste do kraja vožnje.
 */

const GEOM: ReadonlyMap<string, EdgeGeometry> = new Map(
  EDGES.map((e) => [
    e.id,
    parseGeometry(JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${e.id}.json`, "utf8")))!,
  ]),
);
const KICME: ReadonlyMap<string, Kicma> = new Map(
  NODES.filter((n) => n.kind === "opstina").map((n) => [
    n.id,
    parseKicma(JSON.parse(readFileSync(`public/data/osm/kicme/${n.id}.json`, "utf8")))!,
  ]),
);

const RUTA: Ruta = napraviRutu(nadjiRutu("budva", "kolasin")!, GEOM, KICME);

const ivica = (id: string) => {
  const e = edgeById(id);
  if (!e) throw new Error(`nema ivice ${id}`);
  return e;
};

/** Savršen vozač koji uz to drži ograničenje — i usporava prije nego što ono padne. */
const poPropisu =
  (scenario: Scenario, ogranicenjeNa: (s: number) => number) =>
  (world: World): Input => {
    const ja = world.vehicles.find((v) => v.id === PLAYER_ID)!;
    const limit = ogranicenjeNa(ja.s);
    const osnova = perfectBot(world, scenario);
    if (ja.v > limit * 1.02) return { ...osnova, throttle: 0, brake: 0.35, steer: 0 };
    if (ja.v >= limit) return { ...osnova, throttle: 0, steer: 0 };
    return { ...osnova, steer: 0 };
  };

interface Mjerenje {
  world: World;
  /** Prosječan broj vozila u prozoru, dok je prozor cijeli na putu. */
  gustina: number;
  /** Najveći broj zapisa vozila u svijetu u toku vožnje. */
  najviseZapisa: number;
  /** Najmanja praznina između dva vozila u istoj traci, od branika do branika [m]. */
  najmanjaPraznina: number;
  /** Najveći višak brzine vozila toka iznad ograničenja dionice na kojoj jeste [m/s]. */
  najveciVisak: number;
}

/** Provozaj scenario do kraja i izmjeri tok. */
function izmjeri(scenario: Scenario, ogranicenjeNa: (s: number) => number): Mjerenje {
  const tpl = scenario.template as RoadTemplate;
  const { paths } = compile(tpl);
  const world = createWorld(scenario, 1);
  const bot = poPropisu(scenario, ogranicenjeNa);
  const uzorci: number[] = [];
  let najviseZapisa = 0;
  let najmanjaPraznina = Infinity;
  let najveciVisak = -Infinity;
  let korak = 0;
  while (world.outcome === "running" && korak < 2_000_000) {
    step(world, scenario, bot(world));
    korak += 1;
    najviseZapisa = Math.max(najviseZapisa, world.vehicles.length);
    if (korak % 60 !== 0) continue;
    const g = uProzoruGustine(world, tpl);
    if (g.cijeli) uzorci.push(g.vozila);

    // Praznine po traci i brzina vozila toka prema ograničenju.
    for (const traka of [0, 1]) {
      const tijela = world.vehicles
        .filter((v) => !v.done && world.t >= v.spawnT && (v.lane ?? 0) === traka)
        .map((v) => {
          const p = paths.get(v.pathId)!;
          const x = traka === 1 ? p.length - v.s : v.s;
          return { x, pola: v.length / 2, id: v.id };
        })
        .sort((a, b) => a.x - b.x);
      for (let i = 1; i < tijela.length; i++) {
        const a = tijela[i - 1]!;
        const b = tijela[i]!;
        // Igrač u pretjecanju nije u ovoj mjeri: njegova traka se čita iz tijela.
        if (a.id === PLAYER_ID || b.id === PLAYER_ID) continue;
        najmanjaPraznina = Math.min(najmanjaPraznina, b.x - b.pola - (a.x + a.pola));
      }
    }
    for (const v of world.vehicles) {
      if (v.done || v.udioBrzine === undefined || !scenario.tok) continue;
      const p = paths.get(v.pathId)!;
      const x = v.lane === 1 ? p.length - v.s : v.s;
      const d = dionicaToka(scenario.tok.dionice, x);
      // Na samoj granici se tek usporava; mjeri se dublje u dionici.
      if (x - d.od < 80 || d.do - x < 80) continue;
      najveciVisak = Math.max(najveciVisak, v.v - d.vMax);
    }
  }
  return {
    world,
    gustina: uzorci.reduce((a, b) => a + b, 0) / Math.max(1, uzorci.length),
    najviseZapisa,
    najmanjaPraznina,
    najveciVisak,
  };
}

describe("gustina saobraćaja po nivou", { timeout: 180_000 }, () => {
  // Ruta sa gradovima i planinskim putem: tu se mijenjaju i ograničenje i
  // mješavina vozila, pa je to teža provjera od prave magistrale.
  const nivoi: Level[] = [1, 3, 5];
  const mjerenja = nivoi.map((nivo) => ({
    nivo,
    po: [1, 2].map((seed) => izmjeri(rutaScenario(RUTA, seed, nivo), (s) => vMaxNaprijed(RUTA, s, 200))),
  }));

  it("prosječan broj vozila u prozoru je u opsegu nivoa", () => {
    for (const { nivo, po } of mjerenja) {
      const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[nivo];
      const prosjek = po.reduce((a, m) => a + m.gustina, 0) / po.length;
      expect(prosjek, `nivo ${nivo}`).toBeGreaterThanOrEqual(najmanje);
      expect(prosjek, `nivo ${nivo}`).toBeLessThanOrEqual(najvise);
    }
  });

  it("više nivoa je gušći saobraćaj", () => {
    const prosjeci = mjerenja.map(({ po }) => po.reduce((a, m) => a + m.gustina, 0) / po.length);
    expect(prosjeci[0]!).toBeLessThan(prosjeci[1]!);
    expect(prosjeci[1]!).toBeLessThan(prosjeci[2]!);
  });

  it("savršen vozač prolazi rutu bez ijednog prekršaja na svakom nivou", () => {
    for (const { nivo, po } of mjerenja) {
      for (const m of po) {
        expect(m.world.outcome, `nivo ${nivo}`).toBe("passed");
        expect(m.world.violations.map((v) => v.type), `nivo ${nivo}`).toEqual([]);
      }
    }
  });

  it("vozila ne nastaju jedno u drugom i ne sudaraju se međusobno", () => {
    for (const { nivo, po } of mjerenja) {
      for (const m of po) expect(m.najmanjaPraznina, `nivo ${nivo}`).toBeGreaterThan(0);
    }
  });

  it("vozila toka voze po ograničenju dionice na kojoj jesu", () => {
    // Iz magistrale u grad se ulazi usporeno, a ne brzinom sa magistrale.
    for (const { nivo, po } of mjerenja) {
      for (const m of po) expect(m.najveciVisak, `nivo ${nivo}`).toBeLessThan(0.5);
    }
  });

  it("svijet ne raste sa dužinom vožnje — vozila koja odu brišu se", () => {
    // Ruta traje dvadesetak minuta i tok za to vrijeme napravi stotine vozila.
    for (const { nivo, po } of mjerenja) {
      for (const m of po) expect(m.najviseZapisa, `nivo ${nivo}`).toBeLessThan(60);
    }
  });
});

describe("tok teče bez obzira na igrača", () => {
  it("susretna vozila prolaze i dok igrač stoji", () => {
    const s = dionica(ivica("podgorica--danilovgrad"), 3, false, undefined, 3);
    const tpl = s.template as RoadTemplate;
    const { paths } = compile(tpl);
    const world = createWorld(s, 1);
    const stoji: Input = { throttle: 0, brake: 1, indicator: null, steer: 0 };
    const ispredIgraca = new Map<string, boolean>();
    /** Prolasci pored igrača poslije dva minuta stajanja. */
    let prosla = 0;
    const susretnihUProzoru: number[] = [];
    for (let i = 0; i < 180 * 60; i++) {
      step(world, s, stoji);
      const ja = world.vehicles.find((v) => v.id === PLAYER_ID)!;
      for (const v of world.vehicles) {
        if (v.lane !== 1 || v.done || world.t < v.spawnT) continue;
        const x = paths.get(v.pathId)!.length - v.s;
        const ispred = x > ja.s;
        if (ispredIgraca.get(v.id) === true && !ispred && world.t > 120) prosla += 1;
        ispredIgraca.set(v.id, ispred);
      }
      if (i > 60 * 60 && i % 60 === 0) {
        susretnihUProzoru.push(world.vehicles.filter((v) => v.lane === 1 && !v.done).length);
      }
    }
    // Zastoj je prekršaj, ali ovdje se mjeri samo tok.
    expect(world.vehicles.find((v) => v.id === PLAYER_ID)!.v).toBeLessThan(0.2);
    // Na trećem nivou je osam susretnih na dva kilometra, na dvadesetak metara u
    // sekundi — oko pet u minuti. Broji se tek poslije dva minuta: dotle su
    // prošla i sva vozila koja su bila u prozoru na startu, pa ovo mogu biti
    // samo ona koja je tok pustio dok je igrač stajao.
    expect(prosla).toBeGreaterThanOrEqual(3);
    const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[3];
    const prosjek = susretnihUProzoru.reduce((a, b) => a + b, 0) / susretnihUProzoru.length;
    expect(prosjek).toBeGreaterThan(najmanje / 2 - 3);
    expect(prosjek).toBeLessThan(najvise / 2 + 4);
  });

  it("isto sjeme i isti ulaz daju isti saobraćaj, drugo sjeme drugi", () => {
    const poslije = (seed: number) => {
      const s = dionica(ivica("podgorica--danilovgrad"), seed, false, undefined, 5);
      const w = createWorld(s, 1);
      for (let i = 0; i < 90 * 60; i++) step(w, s, poPropisu(s, () => (s.template as RoadTemplate).vMax)(w));
      return JSON.stringify(w.vehicles);
    };
    expect(poslije(4)).toBe(poslije(4));
    expect(poslije(4)).not.toBe(poslije(5));
  });

  it("proba savršenog vozača ne mijenja svijet sa tokom", () => {
    // Tok mijenja stanje izvora u mjestu; proba ga mora kopirati, inače bi
    // pustila vozilo koje pravi svijet nikad ne bi dobio.
    const s = dionica(ivica("podgorica--danilovgrad"), 8, false, undefined, 5);
    const w = createWorld(s, 1);
    for (let i = 0; i < 600; i++) step(w, s, perfectBot(w, s));
    const prije = JSON.stringify(w);
    perfectBot(w, s);
    expect(JSON.stringify(w)).toBe(prije);
  });
});

describe("kamion na planinskom putu", () => {
  it("ubrzo po ulasku na planinski put ispred igrača vozi kamion od 30 do 40 km/h", () => {
    const s = dionica(ivica("njegusi--kotor"), 6, false, undefined, 1);
    const tpl = s.template as RoadTemplate;
    const { paths } = compile(tpl);
    const world = createWorld(s, 1);
    const bot = poPropisu(s, () => tpl.vMax);
    let nadjen: { t: number; kapa: number; ispred: number } | null = null;
    for (let i = 0; i < 60 * 60 && !nadjen; i++) {
      step(world, s, bot(world));
      const ja = world.vehicles.find((v) => v.id === PLAYER_ID)!;
      for (const v of world.vehicles) {
        if (v.done || v.vrsta !== "kamion" || v.lane !== 0 || v.kapaBrzine === undefined) continue;
        const ispred = v.s - ja.s;
        if (ispred > 0) nadjen = { t: world.t, kapa: v.kapaBrzine, ispred };
      }
      void paths;
    }
    expect(nadjen).not.toBeNull();
    expect(nadjen!.kapa).toBeGreaterThanOrEqual(KAMION_PLANINA[0]);
    expect(nadjen!.kapa).toBeLessThanOrEqual(KAMION_PLANINA[1]);
    expect(nadjen!.ispred).toBeLessThan(400);
  });

  it("kamion van planinskog puta vozi po ograničenju, bez planinske kape", () => {
    const s = dionica(ivica("podgorica--danilovgrad"), 2, false, undefined, 5);
    const world = createWorld(s, 1);
    for (let i = 0; i < 120 * 60; i++) step(world, s, poPropisu(s, () => (s.template as RoadTemplate).vMax)(world));
    const kamioni = world.vehicles.filter((v) => v.vrsta === "kamion");
    expect(kamioni.length).toBeGreaterThan(0);
    for (const k of kamioni) expect(k.kapaBrzine).toBeUndefined();
    expect(world.vehicles.some((v) => v.vrsta === "autobus")).toBe(false);
  });
});
