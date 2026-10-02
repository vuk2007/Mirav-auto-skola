import { describe, expect, it } from "vitest";
import { DT, GRAD_BUS_TRAJE, GRAD_SIRINA_TRAKE, type Level } from "../sim/config";
import type { Point } from "../sim/types";
import { LICENCA_OVERLAYA, VERZIJA_OVERLAYA, sidroUlice, type Izmjena, type Overlay, type SidroKraka, type SidroUlice, type Zona } from "./overlay";
import { korakSlobodno, type SlobodnoVozilo } from "./slobodno";
import { noviSudija, sudi, type GradZaSudiju } from "./sudija";
import { svijetGrada } from "./svijet";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";
import { naPutanji, putanja, vozi } from "./vozacGrad";

/**
 * Pravila koja postavlja editor (faza 6, stavka 6b), kako ih sudi sudija:
 * znakovi skretanja i zabrana ulaska na kraku, svjetla po manevru i zelena
 * dopunska strelica, ograničenje sa znaka (do prve raskrsnice) i u zoni,
 * puna linija, autobuska traka. Krst kao u `sudija.test.ts`: krakovi od
 * 150 m, ivica i ide od čvora i + 1 ka centru (0 istok, 1 jug, 2 zapad,
 * 3 sjever); OSM id ivice i je 2000 + i.
 */

const T = GRAD_SIRINA_TRAKE / 2;
const CVOROVI: Point[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 0, y: 150 },
  { x: -150, y: 0 },
  { x: 0, y: -150 },
];
const ISTOK = 0;
const JUG = 1;
const ZAPAD = 2;
const SJEVER = 3;

let brojac = 0;
const osnova = () => ({ id: `e${++brojac}`, autor: "test", datum: "2026-10-01T12:00:00Z" });
const overlay = (izmjene: Izmjena[]): Overlay => ({
  verzija: VERZIJA_OVERLAYA,
  grad: "test",
  licenca: LICENCA_OVERLAYA,
  ishodiste: { lat: 42.44, lon: 19.26 },
  izmjene,
});

/** Tačka na kraku `i`, `d` metara od centra; pravac ka centru (smjer ivice `a → b`). */
function naKraku(i: number, d = 20): SidroUlice {
  const k = CVOROVI[i + 1]!;
  const l = Math.hypot(k.x, k.y);
  return sidroUlice(2000 + i, { x: (k.x / l) * d, y: (k.y / l) * d }, { x: -k.x / l, y: -k.y / l });
}
const krak = (i: number): SidroKraka => ({ raskrsnica: { x: 0, y: 0 }, ulica: naKraku(i) });

function grad(izmjene: Izmjena[], ivice: Partial<TestIvica>[] = [], objekti: TestObjekat[] = [], zabrane: [string, number, number, number][] = [], zone: Zona[] = []) {
  const { paket } = testPaket(
    CVOROVI,
    [1, 2, 3, 4].map((a, i) => ({ a, b: 0, ...ivice[i] })),
    objekti,
    zabrane,
  );
  paket.n.ivOsm = Uint32Array.from([0, 1, 2, 3], (i) => 2000 + i);
  return svijetGrada(paket, overlay(izmjene), zone);
}

const luk = (cx: number, cy: number, r: number, od: number, do_: number, n = 12): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = od + ((do_ - od) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
const SA_JUGA_PRAVO: Point[] = [
  { x: T, y: 140 },
  { x: T, y: -140 },
];
const SA_JUGA_LIJEVO: Point[] = [{ x: T, y: 140 }, { x: T, y: 8 }, ...luk(-8, 8, 8 + T, 0, -Math.PI / 2), { x: -140, y: -T }];
const SA_JUGA_DESNO: Point[] = [{ x: T, y: 140 }, { x: T, y: 10 }, ...luk(10, 10, 10 - T, Math.PI, 1.5 * Math.PI), { x: 140, y: T }];

function vozi_(G: GradZaSudiju, put: Point[], brzina: number, o: { t0?: number; v0?: number; nivo?: Level; zmigavac?: (s: number) => "left" | "right" | null } = {}) {
  const p = putanja(put);
  const a = p.tacke[0]!;
  const b = p.tacke[1]!;
  const st: SlobodnoVozilo = { x: a.x, y: a.y, ugao: Math.atan2(b.y - a.y, b.x - a.x), v: o.v0 ?? brzina, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 0 };
  const s = noviSudija(o.nivo ?? 5);
  let t = o.t0 ?? 0;
  let sP = 0;
  const ogranicenja: { y: number; v: number }[] = [];
  while (t < (o.t0 ?? 0) + 120 && sP < p.duzina - 6) {
    sP = naPutanji(p, st.x, st.y, sP);
    korakSlobodno(G.povrsina, st, vozi(st, p, sP, { brzina, staniNa: null }));
    t += DT;
    sudi(G, s, st, t, o.zmigavac?.(sP) ?? null);
    ogranicenja.push({ y: st.y, v: s.ogranicenje });
  }
  return { s, vrste: s.prekrsaji.map((x) => x.vrsta), ogranicenja };
}

/** Žmigavac za skretanje sa juga: od 60 m pred raskrsnicom do 10 m iza nje. */
const zmig = (strana: "left" | "right") => (s: number) => (s > 70 && s < 150 ? strana : null);

describe("editor: znakovi na kraku", () => {
  it("zabrana skretanja lijevo: lijevo je prekršaj, pravo i desno nisu", () => {
    const G = grad([{ ...osnova(), vrsta: "skretanje", krak: krak(JUG), znak: { vrsta: "zabrana", manevri: ["lijevo"] } }]).zaSudiju;
    const lijevo = vozi_(G, SA_JUGA_LIJEVO, 8, { zmigavac: zmig("left") });
    expect(lijevo.vrste).toEqual(["zabranaSkretanja"]);
    expect(lijevo.s.prekrsaji[0]!.detalji.znak).toBe("zabrana:lijevo");
    expect(vozi_(G, SA_JUGA_PRAVO, 8).vrste).toEqual([]);
    expect(vozi_(G, SA_JUGA_DESNO, 6, { zmigavac: zmig("right") }).vrste).toEqual([]);
  });

  it("obavezan smjer pravo ili desno: lijevo je prekršaj, i kartica kaže šta je dozvoljeno", () => {
    const G = grad([{ ...osnova(), vrsta: "skretanje", krak: krak(JUG), znak: { vrsta: "obavezno", manevri: ["pravo", "desno"] } }]).zaSudiju;
    const lijevo = vozi_(G, SA_JUGA_LIJEVO, 8, { zmigavac: zmig("left") });
    expect(lijevo.s.prekrsaji.map((p) => p.detalji.znak)).toEqual(["obavezno:pravo,desno"]);
    expect(vozi_(G, SA_JUGA_DESNO, 6, { zmigavac: zmig("right") }).vrste).toEqual([]);
  });

  it("zabrana ulaska u krak: skretanje u njega je prekršaj sa svakog kraka", () => {
    const G = grad([{ ...osnova(), vrsta: "zabranaUlaska", krak: krak(ZAPAD) }]).zaSudiju;
    const lijevo = vozi_(G, SA_JUGA_LIJEVO, 8, { zmigavac: zmig("left") });
    expect(lijevo.s.prekrsaji.map((p) => p.detalji.znak)).toEqual(["zabranaUlaska"]);
    expect(vozi_(G, SA_JUGA_PRAVO, 8).vrste).toEqual([]);
  });

  it("znak `null` u editoru briše zabranu iz OSM-a sa tog kraka", () => {
    const osmZabrana: [string, number, number, number] = ["no_left_turn", JUG, 0, ZAPAD];
    const samoOsm = grad([], [], [], [osmZabrana]).zaSudiju;
    expect(vozi_(samoOsm, SA_JUGA_LIJEVO, 8, { zmigavac: zmig("left") }).vrste).toEqual(["zabranaSkretanja"]);
    const ispravljeno = grad([{ ...osnova(), vrsta: "skretanje", krak: krak(JUG), znak: null }], [], [], [osmZabrana]).zaSudiju;
    expect(vozi_(ispravljeno, SA_JUGA_LIJEVO, 8, { zmigavac: zmig("left") }).vrste).toEqual([]);
  });
});

describe("editor: svjetla po manevru", () => {
  // Faza 0 (40 s): jug i sjever samo pravo i desno (svjetla sa strelicom).
  // Faza 1 (20 s): jug lijevo (zaštićeno lijevo).
  // Faza 2 (40 s): istok i zapad; za jug zelena dopunska strelica desno.
  const G = grad([
    {
      ...osnova(),
      vrsta: "semafor",
      raskrsnica: { x: 0, y: 0 },
      plan: {
        faze: [
          { zeleno: 40, kraci: [JUG, SJEVER].map((i) => ({ krak: krak(i), manevri: ["pravo" as const, "desno" as const] })), strelice: [], pjesaci: [] },
          { zeleno: 20, kraci: [{ krak: krak(JUG), manevri: ["lijevo"] }], strelice: [], pjesaci: [] },
          { zeleno: 40, kraci: [ISTOK, ZAPAD].map((i) => ({ krak: krak(i), manevri: null })), strelice: [{ krak: krak(JUG), manevri: ["desno"] }], pjesaci: [] },
        ],
        zuto: 3,
        sveCrveno: 2,
        pomak: 0,
      },
    },
  ]).zaSudiju;
  // Auto sa juga stiže do linije za ~13 s pri 10 m/s.
  const FAZA0 = 0;
  const FAZA2 = 40 + 5 + 20 + 5;

  it("zeleno za pravo i desno: pravo prolazi, lijevo je crveno — sudi se po stvarnom pravcu", () => {
    expect(vozi_(G, SA_JUGA_PRAVO, 10, { t0: FAZA0 }).vrste).toEqual([]);
    const lijevo = vozi_(G, SA_JUGA_LIJEVO, 9, { t0: FAZA0, zmigavac: zmig("left") });
    expect(lijevo.vrste).toEqual(["redLight"]);
    expect(lijevo.s.prekrsaji[0]!.detalji).toEqual({ svjetlo: "crveno", manevar: "lijevo" });
  });

  it("zelena dopunska strelica: desno na crveno smije, pravo ne", () => {
    expect(vozi_(G, SA_JUGA_DESNO, 7, { t0: FAZA2, zmigavac: zmig("right") }).vrste).toEqual([]);
    expect(vozi_(G, SA_JUGA_PRAVO, 10, { t0: FAZA2 }).vrste).toEqual(["redLight"]);
  });
});

describe("editor: ograničenje brzine", () => {
  it("znak važi od mjesta znaka do prve raskrsnice, samo u svom smjeru", () => {
    // Znak 30 na južnom kraku, 100 m od centra, za vožnju ka centru.
    const s = grad([{ ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naKraku(JUG, 100), brzina: 30 }]);
    const v = vozi_(s.zaSudiju, SA_JUGA_PRAVO, 40 / 3.6);
    expect(v.vrste).toEqual(["speeding"]);
    const p = v.s.prekrsaji[0]!;
    expect(p.detalji.ogranicenje).toBe(30);
    expect(p.y).toBeLessThan(100);
    expect(p.y).toBeGreaterThan(0);
    // Brzinomjer: 50 prije znaka, 30 do raskrsnice, pa 50 iza nje.
    const na = (y: number) => v.ogranicenja.find((x) => x.y < y)!.v;
    expect([na(120), na(60), na(-60)]).toEqual([50, 30, 50]);
    // Suprotan smjer (od centra ka jugu) znak ne gleda.
    const nazad = vozi_(s.zaSudiju, [{ x: -T, y: -140 }, { x: -T, y: 140 }], 40 / 3.6);
    expect(nazad.vrste).toEqual([]);
  });

  it("zona sa ograničenjem: važi unutra, znak zone na ulazu i kraj zone na izlazu", () => {
    const zona: Zona = {
      id: "skola",
      ime: "Školska zona",
      poligon: [
        [-60, -120],
        [60, -120],
        [60, -40],
        [-60, -40],
      ],
      paleta: null,
      speedLimit: 30,
      pedestrianDensity: null,
      trafficDensity: null,
      handAuthored: true,
    };
    const s = grad([], [], [], [], [zona]);
    const v = vozi_(s.zaSudiju, SA_JUGA_PRAVO, 40 / 3.6);
    expect(v.vrste).toEqual(["speeding"]);
    expect(v.s.prekrsaji[0]!.y).toBeLessThan(-40);
    // Na sjevernom kraku (ivica 3 ide od sjevera ka centru): granice na 40 i 120 m od centra.
    const zn = s.zaSudiju.ogranicenja.znakoviZone.filter((z) => z.ivica === SJEVER).map((z) => `${z.vrsta}@${Math.round(z.s)}:${z.smjer}`);
    // Smjer 1 je od sjevera ka centru: ulazi u zonu na s = 30, izlazi na 110.
    expect(zn.sort()).toEqual(["krajZone@110:1", "krajZone@30:-1", "zona@110:-1", "zona@30:1"].sort());
  });
});

describe("editor: pune linije", () => {
  it("razdjelna puna cijelom dužinom: prelazak preko nje je prekršaj", () => {
    const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(JUG), linija: "puna" }]);
    // Sa desne trake preko osovine i nazad (dva prelaska), daleko od raskrsnice.
    const put: Point[] = [{ x: T, y: 140 }, { x: T, y: 120 }, { x: -1.5, y: 106 }, { x: -1.5, y: 100 }, { x: T, y: 86 }, { x: T, y: -140 }];
    expect(vozi_(s.zaSudiju, put, 6).vrste).toEqual(["crossingSolidLine", "crossingSolidLine"]);
    // Bez editora ista vožnja nije prekršaj (isprekidana linija, kratko lijevo).
    expect(vozi_(grad([]).zaSudiju, put, 6).vrste).toEqual([]);
  });

  it("puna samo pred raskrsnicom: prelazak daleko od nje nije prekršaj, blizu jeste", () => {
    const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(JUG), punaPrije: 40 }]);
    const daleko: Point[] = [{ x: T, y: 140 }, { x: T, y: 130 }, { x: -1.5, y: 116 }, { x: -1.5, y: 110 }, { x: T, y: 96 }, { x: T, y: -140 }];
    expect(vozi_(s.zaSudiju, daleko, 6).vrste).toEqual([]);
    // Oba prelaska u zadnjih 40 m pred raskrsnicom.
    const blizu: Point[] = [{ x: T, y: 140 }, { x: T, y: 42 }, { x: -1.5, y: 30 }, { x: -1.5, y: 26 }, { x: T, y: 14 }, { x: T, y: -140 }];
    expect(vozi_(s.zaSudiju, blizu, 6).vrste).toEqual(["crossingSolidLine", "crossingSolidLine"]);
  });
});

describe("editor: autobuska traka", () => {
  // Južni krak sa četiri trake, desna u smjeru ka centru autobuska.
  const S = 1.5 * GRAD_SIRINA_TRAKE;
  const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(JUG), busNaprijed: true }], [{}, { trake: 4 }]);

  it(`vožnja autobuskom trakom duže od ${GRAD_BUS_TRAJE} s je prekršaj`, () => {
    expect(vozi_(s.zaSudiju, [{ x: S, y: 140 }, { x: S, y: 20 }], 8).vrste).toEqual(["busLane"]);
  });

  it("susjednom trakom nije, ni kratkim prelaskom preko autobuske", () => {
    expect(vozi_(s.zaSudiju, [{ x: T, y: 140 }, { x: T, y: 20 }], 8).vrste).toEqual([]);
    // 12 m u autobuskoj traci pri 8 m/s je 1,5 s.
    const kratko: Point[] = [{ x: T, y: 140 }, { x: T, y: 110 }, { x: S, y: 100 }, { x: S, y: 88 }, { x: T, y: 78 }, { x: T, y: 20 }];
    expect(vozi_(s.zaSudiju, kratko, 8).vrste).toEqual([]);
  });
});
