import { describe, expect, it } from "vitest";
import {
  DT,
  PRIKLJUCAK_POKAZIVAC,
  PRIKLJUCAK_PRAZNINA,
  PRIKLJUCAK_USPORENJE,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  type Level,
} from "./config";
import { perfectBot } from "./bots";
import { cekaNa, krajLuka } from "./prikljucci";
import { vozacRute } from "./vozac";
import type { Prikljucak, RoadTemplate, Scenario, Vehicle, World } from "./types";
import { createWorld, PLAYER_ID, step } from "./world";

/**
 * Saobraćaj na raskrsnicama sa sporednim putem.
 *
 * Put je prav, raskrsnice su na zadatim mjestima, a tok je pravi — onaj isti
 * koji vozi rute. Mjeri se ono što pravila traže: skretanje se najavljuje i ne
 * koči naglo, a ko se uključuje ne ulazi nikome pred nos.
 */

let broj = 0;
const DUZINA = 7000;
const VMAX = 80 / 3.6;

/** Raskrsnice na svakih 250 m, naizmjenično desno i lijevo. */
const niz = (od = 500, koliko = 24): Prikljucak[] =>
  Array.from({ length: koliko }, (_, i) => ({
    s: od + i * 250,
    strana: i % 2 === 0 ? "desno" : "lijevo",
    rang: "unclassified",
  }));

function put(
  prikljucci: Prikljucak[],
  {
    nivo = 5 as Level,
    seed = 1,
    vrsta = "put" as "put" | "planinski",
    kamioni = [] as number[],
    startS = 0,
  } = {},
): Scenario {
  broj += 1;
  const tpl: RoadTemplate = {
    kind: "road",
    id: `test:prikljucci:${broj}`,
    length: DUZINA,
    edgeId: "test--test",
    edgeKm: 7,
    vMax: VMAX,
    curves: [],
    landmarks: [],
    prikljucci,
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
  return {
    id: tpl.id,
    intersection: tpl.id,
    template: tpl,
    player: { arm: "N", intent: { kind: "lane", index: 0 }, spawnDistance: 0, startS, startV: 60 / 3.6 },
    npcs: [],
    tok: { seed, dionice: [{ od: 0, do: DUZINA, vrsta, vMax: VMAX }], kamioni },
    upravljanje: "traka",
    difficulty: nivo,
    title: { me: "proba" },
    explanation: { me: "proba" },
  };
}

/** Mjesto vozila na putu u metrima naše trake, bez obzira na traku. */
function naPutu(w: World, v: Vehicle): number {
  return v.lane === 1 ? DUZINA - v.s : v.s;
}

interface Trag {
  world: World;
  /** Za svako vozilo koje je skrenulo: najjače usporenje dok je skretalo i od kada gori pokazivač. */
  skrenuli: Map<string, { usporenje: number; pokazivacOd: number | null; raskrsnica: number }>;
  /** Za svako vozilo koje se uključilo: najmanje vrijeme do raskrsnice onih koji su joj prilazili. */
  usli: Map<string, number>;
}

/** Odvozi `sekundi` sekundi i zapamti ponašanje na raskrsnicama. */
function vozi(s: Scenario, sekundi: number): Trag {
  const w = createWorld(s, 1);
  const bot = vozacRute({ pretice: false });
  const tpl = s.template as RoadTemplate;
  const skrenuli: Trag["skrenuli"] = new Map();
  const usli: Trag["usli"] = new Map();
  // Brzina svakog vozila kroz posljednjih pola sekunde: usporenje se mjeri kroz
  // taj prozor, a ne korak po korak. Vozilo u koloni na samoj granici
  // odstojanja u jednom koraku zakoči punom kočnicom pa odmah doda gas — trzaj
  // od desetinke m/s koji postoji i bez skretanja, i nije ono što se ovdje mjeri.
  const PROZOR = Math.round(0.5 / DT);
  const brzine = new Map<string, number[]>();
  const vidjeni = new Set(w.vehicles.map((v) => v.id));
  for (let i = 0; i < Math.round(sekundi / DT) && w.outcome === "running"; i++) {
    step(w, s, bot(w, s));
    for (const v of w.vehicles) {
      if (v.done) continue;
      // Uključio se: sad se gleda ko je prilazio raskrsnici i koliko mu je trebalo.
      if (v.id.startsWith("tok-u-") && !vidjeni.has(v.id)) {
        const p = tpl.prikljucci![Number(v.id.slice(6))]!;
        const smjer = v.lane === 1 ? -1 : 1;
        let najmanje = Infinity;
        for (const o of w.vehicles) {
          if (o === v || o.done || (o.lane ?? 0) !== (v.lane ?? 0)) continue;
          const rel = (naPutu(w, o) - p.s) * smjer;
          if (rel < 0 && o.v > 0.5) najmanje = Math.min(najmanje, -rel / o.v);
        }
        const ja = w.vehicles.find((o) => o.id === PLAYER_ID)!;
        if (ja.s < p.s && ja.v > 0.5) najmanje = Math.min(najmanje, (p.s - ja.s) / ja.v);
        usli.set(v.id, najmanje);
      }
      vidjeni.add(v.id);
      if (v.skrece !== undefined) {
        const zapis = skrenuli.get(v.id) ?? { usporenje: 0, pokazivacOd: null, raskrsnica: v.skrece };
        const istorija = brzine.get(v.id);
        if (istorija && istorija.length >= PROZOR) {
          zapis.usporenje = Math.max(zapis.usporenje, (istorija[0]! - v.v) / (PROZOR * DT));
        }
        const p = tpl.prikljucci![v.skrece]!;
        const doRaskrsnice = (p.s - naPutu(w, v)) * (v.lane === 1 ? -1 : 1);
        if (v.indicator === "right" && zapis.pokazivacOd === null) zapis.pokazivacOd = doRaskrsnice;
        skrenuli.set(v.id, zapis);
      }
      const istorija = brzine.get(v.id) ?? [];
      istorija.push(v.v);
      if (istorija.length > PROZOR) istorija.shift();
      brzine.set(v.id, istorija);
    }
  }
  return { world: w, skrenuli, usli };
}

describe("skretanje u sporedni put", () => {
  const trag = vozi(put(niz()), 240);

  it("na raskrsnicama se i skreće i uključuje", () => {
    expect(trag.skrenuli.size).toBeGreaterThan(2);
    expect(trag.usli.size).toBeGreaterThan(2);
  });

  it("skretanje se najavljuje pokazivačem, na vrijeme", () => {
    for (const [id, z] of trag.skrenuli) {
      expect(z.pokazivacOd, id).not.toBeNull();
      expect(z.pokazivacOd!, id).toBeGreaterThan(PRIKLJUCAK_POKAZIVAC - 5);
    }
  });

  it("vozilo koje skreće usporava blago, ne koči naglo", () => {
    // Naglo kočenje je dozvoljeno samo u opasnosti; pred skretanjem je blago.
    // Mala zaliha je za korak integracije, ne za jače kočenje.
    for (const [id, z] of trag.skrenuli) expect(z.usporenje, id).toBeLessThanOrEqual(PRIKLJUCAK_USPORENJE + 0.1);
  });

  it("skrenulo vozilo napusti traku i ode niz sporedni put", () => {
    for (const id of trag.skrenuli.keys()) {
      const uTraci = trag.world.vehicles.find((v) => v.id === id && !v.done);
      expect(uTraci, id).toBeUndefined();
    }
  });

  it("na svakoj raskrsnici skrene najviše jedno vozilo", () => {
    const poRaskrsnici = new Map<number, number>();
    for (const z of trag.skrenuli.values()) poRaskrsnici.set(z.raskrsnica, (poRaskrsnici.get(z.raskrsnica) ?? 0) + 1);
    for (const [j, n] of poRaskrsnici) expect(n, `raskrsnica ${j}`).toBe(1);
  });

  it("vožnja pored raskrsnica prolazi bez ijednog prekršaja", () => {
    expect(trag.world.violations.map((v) => `${v.type}: ${v.details}`)).toEqual([]);
  });
});

// Duge simulacije sa saobraćajem: pod opterećenjem mašine traju duže od
// podrazumijevanih 5 s, kao i `playable.test.ts`.
describe("uključivanje sa sporednog puta", { timeout: 30000 }, () => {
  it("ne ulazi pred nekoga ko je bliže od propisanog vremena", () => {
    // Od odluke do ulaska prođe luk skretanja, pa se od praga oduzima vrijeme
    // za njega — nekoliko sekundi pri brzini kojom se kreće iz mjesta.
    const trag = vozi(put(niz()), 240);
    for (const [id, t] of trag.usli) expect(t, id).toBeGreaterThan(PRIKLJUCAK_PRAZNINA - 4);
  });

  it("u susretnu traku ne ulazi pred igračem koji njome pretiče", () => {
    // Jedna raskrsnica lijevo, i sjeme u kojem na njoj neko čeka. Igrač kreće
    // dvjesta metara pred njom, susretnom trakom — kao da pretiče. Vozilo sa
    // sporednog puta mu ide u susret, pa ne smije krenuti dok on ne prođe.
    let seed = 1;
    while (!cekaNa(seed, 5, 0)) seed += 1;
    const s = put([{ s: 900, strana: "lijevo", rang: "unclassified" }], { seed, startS: 700 });
    const w = createWorld(s, 1);
    const ja = w.vehicles.find((v) => v.id === PLAYER_ID)!;
    let usaoPredIgracem = false;
    let cekao = false;
    let usao = false;
    for (let i = 0; i < Math.round(40 / DT) && w.outcome === "running"; i++) {
      // Dok je pred raskrsnicom vozi osom susretne trake, poslije se vraća.
      // Ostala susretna vozila se sklanjaju: mjeri se samo ovo koje čeka.
      ja.lateral = ja.s < 920 ? -ROAD_LANE_WIDTH : 0;
      for (const o of w.vehicles) if (o.lane === 1 && o.id !== "tok-u-0") o.done = true;
      step(w, s, { throttle: ja.v < 16 ? 0.5 : 0, brake: 0, indicator: null, steer: 0 });
      if ((w.naSporednom ?? []).some((x) => x.id === "tok-u-0")) cekao = true;
      const krenuo = (w.naSporednom ?? []).some((x) => x.id === "tok-u-0" && x.faza !== "ceka");
      const uTraci = w.vehicles.some((v) => v.id === "tok-u-0");
      if ((krenuo || uTraci) && ja.s < 900) usaoPredIgracem = true;
      if (uTraci) usao = true;
    }
    expect(cekao).toBe(true);
    expect(usaoPredIgracem).toBe(false);
    // A kad je igrač prošao, uključilo se. Bilježi se u toku vožnje: vozilo
    // odlazi u suprotnom smjeru, i kad ostane daleko iza igrača, tok ga briše.
    expect(usao).toBe(true);
  });

  it("uključeno vozilo kreće iz skretanja, sa kraja luka", () => {
    let seed = 1;
    while (!cekaNa(seed, 5, 0)) seed += 1;
    const p: Prikljucak = { s: 900, strana: "desno", rang: "unclassified" };
    // Igrač stoji dvjesta metara pred raskrsnicom: vozilo se pojavi, a igrač
    // mu ne smeta — ko stoji, ne prilazi.
    const s = put([p], { seed, startS: 700 });
    const w = createWorld(s, 1);
    w.vehicles.find((v) => v.id === PLAYER_ID)!.v = 0;
    let novo: Vehicle | undefined;
    for (let i = 0; i < Math.round(30 / DT) && !novo; i++) {
      step(w, s, { throttle: 0, brake: 1, indicator: null, steer: 0 });
      novo = w.vehicles.find((v) => v.id === "tok-u-0");
    }
    expect(novo).toBeDefined();
    expect(novo!.lane).toBe(0);
    expect(novo!.s).toBeCloseTo(krajLuka(p, "ulazi"), 0);
    expect(novo!.v).toBeLessThan(7);
  });
});

describe("zagarantovani kamion na planini", () => {
  it("ne skreće, ma koliko raskrsnica prošao", () => {
    const s = put(niz(300, 26), { vrsta: "planinski", kamioni: [150] });
    const trag = vozi(s, 180);
    for (const id of trag.skrenuli.keys()) expect(id.startsWith("tok-k-"), id).toBe(false);
  });
});

describe("ponovljivost i proba", { timeout: 30000 }, () => {
  it("isto sjeme daje ista skretanja i ista uključivanja", () => {
    const a = vozi(put(niz(), { seed: 3 }), 120);
    const b = vozi(put(niz(), { seed: 3 }), 120);
    expect([...a.skrenuli.keys()]).toEqual([...b.skrenuli.keys()]);
    expect([...a.usli.keys()]).toEqual([...b.usli.keys()]);
  });

  it("proba savršenog vozača ne mijenja svijet sa vozilima na sporednim putevima", () => {
    const s = put(niz());
    const w = createWorld(s, 1);
    for (let i = 0; i < 90 * 60 && (w.naSporednom?.length ?? 0) === 0; i++) step(w, s, perfectBot(w, s));
    expect(w.naSporednom?.length ?? 0).toBeGreaterThan(0);
    const prije = JSON.stringify(w);
    perfectBot(w, s);
    expect(JSON.stringify(w)).toBe(prije);
  });
});
