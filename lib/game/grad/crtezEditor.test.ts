import { describe, expect, it } from "vitest";
import { GRAD_SIRINA_TRAKE } from "../sim/config";
import type { Point } from "../sim/types";
import { LICENCA_OVERLAYA, VERZIJA_OVERLAYA, sidroUlice, type Izmjena, type Overlay, type SidroKraka, type SidroUlice, type Zona } from "./overlay";
import { linijeIvice, natpisiBusa, ogradaZatvorene } from "./oznake";
import { svijetGrada } from "./svijet";
import { testPaket, type TestIvica } from "./testMreza";

/**
 * Crtež onoga što postavlja editor (stavka 6b): šta se sudi, to se i vidi.
 * Krst kao u `sudijaEditor.test.ts` (krakovi 150 m, ivica i ka centru, OSM
 * id 2000 + i): 0 istok, 1 jug, 2 zapad, 3 sjever.
 */

const CVOROVI: Point[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 0, y: 150 },
  { x: -150, y: 0 },
  { x: 0, y: -150 },
];
let brojac = 0;
const osnova = () => ({ id: `c${++brojac}`, autor: "test", datum: "2026-10-01T12:00:00Z" });
const overlay = (izmjene: Izmjena[]): Overlay => ({ verzija: VERZIJA_OVERLAYA, grad: "test", licenca: LICENCA_OVERLAYA, ishodiste: { lat: 42.44, lon: 19.26 }, izmjene });
function naKraku(i: number, d = 20): SidroUlice {
  const k = CVOROVI[i + 1]!;
  const l = Math.hypot(k.x, k.y);
  return sidroUlice(2000 + i, { x: (k.x / l) * d, y: (k.y / l) * d }, { x: -k.x / l, y: -k.y / l });
}
const krak = (i: number): SidroKraka => ({ raskrsnica: { x: 0, y: 0 }, ulica: naKraku(i) });
function grad(izmjene: Izmjena[], ivice: Partial<TestIvica>[] = [], zone: Zona[] = []) {
  const { paket } = testPaket(CVOROVI, [1, 2, 3, 4].map((a, i) => ({ a, b: 0, ...ivice[i] })));
  paket.n.ivOsm = Uint32Array.from([0, 1, 2, 3], (i) => 2000 + i);
  return svijetGrada(paket, overlay(izmjene), zone);
}
const vrste = (s: ReturnType<typeof grad>) => s.crtez.znakovi.map((z) => z.vrsta).sort();

describe("crtež: znakovi iz editora", () => {
  it("znak skretanja: zabrana po znak za pravac, obavezan smjer jedan znak", () => {
    const s = grad([
      { ...osnova(), vrsta: "skretanje", krak: krak(1), znak: { vrsta: "zabrana", manevri: ["polukruzno", "lijevo"] } },
      { ...osnova(), vrsta: "skretanje", krak: krak(0), znak: { vrsta: "obavezno", manevri: ["desno", "pravo"] } },
      { ...osnova(), vrsta: "skretanje", krak: krak(2), znak: { vrsta: "obavezno", manevri: ["desno"] } },
    ]);
    expect(vrste(s)).toEqual(expect.arrayContaining(["no_left_turn", "no_u_turn", "obavezno:pravo,desno", "only_right_turn"]));
  });

  it("zabrana ulaska, glavni put, znakovi uz ulicu, zatvorena ulica", () => {
    const s = grad([
      { ...osnova(), vrsta: "zabranaUlaska", krak: krak(2) },
      { ...osnova(), vrsta: "kontrola", krak: krak(0), kontrola: "glavni" },
      { ...osnova(), vrsta: "kontrola", krak: krak(1), kontrola: "ustupi" },
      { ...osnova(), vrsta: "znak", znak: "brzina", mjesto: naKraku(1, 100), brzina: 30 },
      { ...osnova(), vrsta: "znak", znak: "djeca", mjesto: naKraku(1, 80), brzina: null },
      { ...osnova(), vrsta: "dionica", ulica: naKraku(3), zatvorena: true },
    ]);
    const v = vrste(s);
    expect(v).toEqual(expect.arrayContaining(["zabranaUlaska", "glavni", "ustupi", "brzina:30", "djeca"]));
    expect(v.filter((x) => x === "zabranaSaobracaja")).toHaveLength(2);
    // Znakovi su na trotoaru, ne na kolovozu: znak ograničenja desno od vožnje ka centru (istok).
    const brzina = s.crtez.znakovi.find((z) => z.vrsta === "brzina:30")!;
    expect(brzina.x).toBeGreaterThan(GRAD_SIRINA_TRAKE);
    expect(Math.abs(brzina.y - 100)).toBeLessThan(0.5);
    expect(s.crtez.znakovi.find((z) => z.vrsta === "brzina:30")!.izveden).toBe(false);
  });

  it("zona: znak zone na ulazu i kraj zone na izlazu, izvedeni", () => {
    const zona: Zona = {
      id: "z",
      ime: "Z",
      poligon: [[-60, -120], [60, -120], [60, -40], [-60, -40]],
      paleta: null,
      speedLimit: 30,
      pedestrianDensity: null,
      trafficDensity: null,
      handAuthored: true,
    };
    const s = grad([], [], [zona]);
    const zn = s.crtez.znakovi.filter((z) => z.vrsta.startsWith("zona") || z.vrsta.startsWith("krajZone"));
    expect(zn.map((z) => z.vrsta).sort()).toEqual(["krajZone:30", "krajZone:30", "zona:30", "zona:30"]);
    expect(zn.every((z) => z.izveden)).toBe(true);
  });
});

describe("crtež: semafor iz editora", () => {
  it("glave na istom stubu: svjetla sa strelicama i dopunska strelica", () => {
    const s = grad([
      {
        ...osnova(),
        vrsta: "semafor",
        raskrsnica: { x: 0, y: 0 },
        plan: {
          faze: [
            { zeleno: 30, kraci: [{ krak: krak(1), manevri: ["desno", "pravo"] }, { krak: krak(3), manevri: null }], strelice: [], pjesaci: [] },
            { zeleno: 15, kraci: [{ krak: krak(1), manevri: ["lijevo"] }], strelice: [], pjesaci: [] },
            { zeleno: 30, kraci: [krak(0), krak(2)].map((k) => ({ krak: k, manevri: null })), strelice: [{ krak: krak(1), manevri: ["desno"] }], pjesaci: [] },
          ],
          zuto: 3,
          sveCrveno: 2,
          pomak: 0,
        },
      },
    ]);
    const r = s.raskrsnice.lista[0]!;
    const jug = r.kraci.findIndex((k) => k.ivica === 1);
    const glave = s.crtez.semafori.filter((x) => x.krak === jug).map((x) => [x.manevri?.join(",") ?? "glavno", x.dopunska, x.pomak]);
    expect(glave).toEqual([
      ["pravo,desno", false, 0],
      ["lijevo", false, 1],
      ["desno", true, 2],
    ]);
    const sjever = r.kraci.findIndex((k) => k.ivica === 3);
    expect(s.crtez.semafori.filter((x) => x.krak === sjever).map((x) => x.manevri)).toEqual([null]);
  });
});

describe("crtež: linije i autobuska traka", () => {
  /** Ukupna dužina obojenih poligona duž ivice na pomaku `o` (linija širine do 0,5 m). */
  const duzinaNa = (p: Point[][], o: number) =>
    p
      .filter((q) => q.every((t) => Math.abs(t.x - o) < 0.5))
      .reduce((s, q) => s + Math.max(...q.map((t) => t.y)) - Math.min(...q.map((t) => t.y)), 0);

  it("razdjelna: puna cijelom dužinom, dvostruka su dvije, bez linije nema ništa", () => {
    const isprekidana = grad([]);
    const iv0 = isprekidana.mreza.ivice[1]!;
    const od = (s: typeof isprekidana) => [s.odsjeci[2]!, s.odsjeci[3]!, s.zaSudiju.produzeci] as const;
    const osnovno = duzinaNa(linijeIvice(iv0, ...od(isprekidana)), 0);
    const puna = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), linija: "puna" }]);
    const ukupno = puna.mreza.ivice[1]!.duzina - puna.odsjeci[2]! - puna.odsjeci[3]!;
    expect(duzinaNa(linijeIvice(puna.mreza.ivice[1]!, ...od(puna)), 0)).toBeCloseTo(ukupno, 3);
    expect(osnovno).toBeLessThan(ukupno * 0.7);
    const dvostruka = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), linija: "dvostruka" }]);
    expect(linijeIvice(dvostruka.mreza.ivice[1]!, ...od(dvostruka)).length).toBe(2 * linijeIvice(puna.mreza.ivice[1]!, ...od(puna)).length);
    const bez = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), linija: "bez" }]);
    expect(linijeIvice(bez.mreza.ivice[1]!, ...od(bez))).toEqual([]);
  });

  it("puna pred raskrsnicom: zadnjih N m je puno, dalje isprekidano", () => {
    const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), punaPrije: 40 }]);
    const iv = s.mreza.ivice[1]!;
    const p = linijeIvice(iv, s.odsjeci[2]!, s.odsjeci[3]!, s.zaSudiju.produzeci);
    // Južni krak ide od (0, 150) ka centru: zadnjih 40 m pred ivicom raskrsnice su y ∈ [odB, odB + 40].
    const odB = s.odsjeci[3]!;
    const u = (y0: number, y1: number) => duzinaNa(p.filter((q) => q.every((t) => t.y >= y0 - 1e-6 && t.y <= y1 + 1e-6)), 0);
    expect(u(odB, odB + 40)).toBeCloseTo(40, 3);
    expect(u(odB + 41, 150)).toBeLessThan(0.7 * (150 - odB - 41));
  });

  it("autobuska traka: natpis BUS u njoj, i ništa bez nje", () => {
    const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), busNaprijed: true }], [{}, { trake: 4 }]);
    const iv = s.mreza.ivice[1]!;
    const natpis = natpisiBusa(iv, s.odsjeci[2]!, s.odsjeci[3]!);
    expect(natpis.length).toBeGreaterThan(20);
    // Svi u krajnjoj desnoj traci (ka centru = sjever; desno je istok): x ∈ [W/2 − traka, W/2].
    expect(natpis.every((q) => q.every((t) => t.x > iv.sirina / 2 - GRAD_SIRINA_TRAKE - 0.01 && t.x < iv.sirina / 2 + 0.01))).toBe(true);
    expect(natpisiBusa(grad([], [{}, { trake: 4 }]).mreza.ivice[1]!, 0, 0)).toEqual([]);
  });

  it("zatvorena ulica: ograda na oba kraja, crvene i bijele pruge", () => {
    const s = grad([{ ...osnova(), vrsta: "dionica", ulica: naKraku(1), zatvorena: true }]);
    const { crvene, bijele } = ogradaZatvorene(s.mreza.ivice[1]!, 0, 0);
    expect([crvene.length, bijele.length]).toEqual([6, 6]);
  });
});
