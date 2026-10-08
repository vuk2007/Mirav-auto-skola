import { describe, expect, it } from "vitest";
import { CAR_LENGTH, CAR_WIDTH, DT, GRAD_PARK_OD_RASKRSNICE, GRAD_PARK_OD_ZEBRE, GRAD_PARK_PRILAZ, GRAD_PARK_RAZMAK } from "../sim/config";
import { polygonsOverlap, rectCorners } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { Zona } from "./overlay";
import { dovoljnoSiroka, doMjesta, mjestoNa, slobodno, uliceZaParkiranje, ZONA_OBILASKA } from "./parkiranje";
import { ciljniBroj, dodajVozilo, korakSaobracaja, noviSaobracaj, parkirani, ZA_NPC, type Npc, type Saobracaj } from "./saobracaj";
import { svijetGrada } from "./svijet";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";

/**
 * Krst kao u `saobracaj.test.ts`: centar (0, 0), krakovi 150 m; ivica i ide od
 * kraja kraka ka centru — 0 istok, 1 jug, 2 zapad, 3 sjever (y na jug).
 */
function krst(klase: string[] = ["residential", "residential", "residential", "residential"], objekti: TestObjekat[] = [], zone: Zona[] = []) {
  const cvorovi: Point[] = [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 0, y: 150 },
    { x: -150, y: 0 },
    { x: 0, y: -150 },
  ];
  const ivice: TestIvica[] = [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0, klasa: klase[i] }));
  const { paket } = testPaket(cvorovi, ivice, objekti);
  return svijetGrada(paket, null, zone);
}

/** Sa istoka na zapad: ka centru ivicom 0, pa od centra ivicom 2 (smjer −1). */
const ISTOK_ZAPAD = [
  { ivica: 0, smjer: 1 as const },
  { ivica: 2, smjer: -1 as const },
];

function vozi(sb: Saobracaj, sekundi: number, poKoraku?: () => void) {
  sb.popunjeno = true;
  sb.gustina = 0;
  for (let t = 0; t < sekundi; t += DT) {
    korakSaobracaja(sb, { x: 0, y: 0 }, null);
    poKoraku?.();
  }
}

/** Vozilo koje parkira na zapadnom kraku, `s` ivice 2 (od zapadnog kraja). */
function parkira(sb: Saobracaj, s: number): Npc {
  const n = dodajVozilo(sb, ISTOK_ZAPAD, 8)!;
  const u = sb.uliceParkiranja.find((x) => x.ivica === 2 && x.smjer === -1)!;
  const z = mjestoNa(sb.svijet, u, s, n.id, n.boja);
  expect(doMjesta(n.plan, z)).toBe(true);
  n.mjesto = z;
  sb.mjesta.push(z);
  return n;
}

describe("parkiranje uz desni ivičnjak (stavka 7e)", () => {
  it("parkira se samo gdje ulica ostaje dovoljno široka", () => {
    const sv = krst();
    const iv = sv.mreza.ivice[0]!;
    // Stambena 1+1 (8,5 m): parkiran auto i onaj koji ga obilazi staju u svoju polovinu.
    expect(dovoljnoSiroka(iv)).toBe(true);
    // Uska dvosmjerna (4,5 m): ne.
    expect(dovoljnoSiroka({ ...iv, sirina: 4.5 })).toBe(false);
    // Dvosmjerna sa dvije trake po smjeru: ne (parkirani bi zatvarao traku).
    expect(dovoljnoSiroka({ ...iv, sirina: 17, trakeNaprijed: 2, trakeNazad: 2 })).toBe(false);
    // Jednosmjerna 4,5 m sa jednom trakom: auto prolazi pored parkiranog uz rezervu.
    expect(dovoljnoSiroka({ ...iv, smjer: 1, sirina: 4.5, trakeNaprijed: 1, trakeNazad: 0 })).toBe(true);
    expect(dovoljnoSiroka({ ...iv, smjer: 1, sirina: 4.2, trakeNaprijed: 1, trakeNazad: 0 })).toBe(false);
  });

  it("samo stambene i sporedne ulice, bar 15 m od raskrsnice i zebre", () => {
    const sv = krst(["primary", "residential", "residential", "residential"], [{ vrsta: "crossing", podatak: "zebra", ivica: 2, s: 60 }]);
    const ulice = uliceZaParkiranje(sv, ZA_NPC);
    expect(ulice.some((u) => u.ivica === 0)).toBe(false);
    const u = ulice.find((x) => x.ivica === 2 && x.smjer === -1)!;
    // Kraj ivice u centru je raskrsnica: parkirani je cijeli bar 15 m od nje.
    const odsjek = sv.zaSudiju.odsjeci[2 * 2 + 1]!;
    expect(150 - odsjek - (u.do_ + CAR_LENGTH / 2)).toBeGreaterThanOrEqual(GRAD_PARK_OD_RASKRSNICE - 1e-6);
    // Zebra na 60 m: ne bliže od 15 m (bliži kraj auta).
    expect(slobodno(sv, u, 60 + GRAD_PARK_OD_ZEBRE + CAR_LENGTH / 2 - 0.5, [])).toBe(false);
    expect(slobodno(sv, u, 60 + GRAD_PARK_OD_ZEBRE + CAR_LENGTH / 2 + 0.5, [])).toBe(true);
  });

  it("vozilo parkira uz desni ivičnjak i ostaje parkirano; drugo ga obilazi u svojoj polovini ulice", () => {
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    const prvi = parkira(sb, 70);
    vozi(sb, 40);
    expect(sb.metrika.parkiralo).toBe(1);
    expect(sb.npc.includes(prvi)).toBe(false);
    const [p] = parkirani(sb);
    // Zapadni krak, vožnja na zapad: desno je sjever (y < 0); auto uz ivičnjak.
    const iv = sv.mreza.ivice[2]!;
    expect(p!.y).toBeLessThan(0);
    expect(-p!.y + CAR_WIDTH / 2).toBeGreaterThan(iv.sirina / 2 - 0.5);
    expect(-p!.y + CAR_WIDTH / 2).toBeLessThanOrEqual(iv.sirina / 2);
    expect(Math.abs(p!.x - (-150 + 70))).toBeLessThan(1.5);

    // Drugo vozilo istom rutom prolazi pored.
    const drugi = dodajVozilo(sb, ISTOK_ZAPAD, 8)!;
    const parkiran = rectCorners({ x: p!.x, y: p!.y }, { x: Math.cos(p!.ugao), y: Math.sin(p!.ugao) }, CAR_LENGTH, CAR_WIDTH);
    let dodir = false;
    let najblize = Infinity;
    let preslo = false;
    vozi(sb, 40, () => {
      if (!sb.npc.includes(drugi) || drugi.x > 0) return;
      const ja = rectCorners({ x: drugi.x, y: drugi.y }, { x: Math.cos(drugi.ugao), y: Math.sin(drugi.ugao) }, CAR_LENGTH, CAR_WIDTH);
      if (polygonsOverlap(ja, parkiran)) dodir = true;
      if (Math.abs(drugi.x - p!.x) < CAR_LENGTH) najblize = Math.min(najblize, Math.abs(drugi.y - p!.y));
      // Cijelo tijelo ostaje u svojoj polovini (y < 0 — sjeverna strana).
      if (drugi.y + CAR_WIDTH / 2 > 0) preslo = true;
    });
    expect(dodir).toBe(false);
    expect(preslo).toBe(false);
    // Pored njega 0,4 m između karoserija; dok se tek izmiče, bar 0,25.
    expect(najblize).toBeGreaterThan(CAR_WIDTH + 0.25);
    expect(sb.metrika.zastoja).toBe(0);
    // Drugi je stigao do kraja rute (nije stao iza parkiranog).
    expect(sb.npc.includes(drugi), `${drugi.x.toFixed(1)},${drugi.y.toFixed(1)} s=${drugi.s.toFixed(1)}/${drugi.plan.put.duzina.toFixed(1)} v=${drugi.v.toFixed(2)} ${JSON.stringify(drugi.razlog)}`).toBe(false);
  });

  it("naspram parkiranog i tik uz njega se ne parkira", () => {
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    parkira(sb, 70);
    const ista = sb.uliceParkiranja.find((x) => x.ivica === 2 && x.smjer === -1)!;
    const suprotna = sb.uliceParkiranja.find((x) => x.ivica === 2 && x.smjer === 1)!;
    // Na istoj strani: prilaz ivičnjaku počinje iza parkiranog.
    const razmak = CAR_LENGTH + GRAD_PARK_PRILAZ + GRAD_PARK_RAZMAK;
    expect(slobodno(sv, ista, 70 + razmak - 0.5, sb.mjesta)).toBe(false);
    expect(slobodno(sv, ista, 70 + razmak + 0.5, sb.mjesta)).toBe(true);
    expect(slobodno(sv, ista, 70 - razmak + 0.5, sb.mjesta)).toBe(false);
    expect(slobodno(sv, suprotna, 75, sb.mjesta)).toBe(false);
    // Zone obilaska (vidi `ZONA_OBILASKA`) se ne preklapaju.
    expect(slobodno(sv, suprotna, 70 + 2 * ZONA_OBILASKA + 0.5, sb.mjesta)).toBe(true);
    expect(slobodno(sv, suprotna, 70 + 2 * ZONA_OBILASKA - 0.5, sb.mjesta)).toBe(false);
  });
});

describe("gustina saobraćaja po zoni (stavka 7e)", () => {
  const kvadrat = (gustina: number): Zona => ({
    id: "z",
    ime: "z",
    poligon: [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ],
    paleta: null,
    speedLimit: null,
    pedestrianDensity: null,
    trafficDensity: gustina,
    handAuthored: true,
  });

  it("broj vozila po gustini zone igrača × nivo i doba (`gustina`); van zona 25", () => {
    for (const [g, broj] of [
      [0, 0],
      [1, 25],
      [2, 33],
      [3, 40],
    ] as const) {
      const sb = noviSaobracaj(krst(undefined, [], [kvadrat(g)]), 1, 1);
      expect(ciljniBroj(sb, { x: 0, y: 0 })).toBe(broj);
      expect(ciljniBroj(sb, { x: 120, y: 0 })).toBe(25);
    }
    const sb = noviSaobracaj(krst(undefined, [], [kvadrat(3)]), 1, 0.5);
    expect(ciljniBroj(sb, { x: 0, y: 0 })).toBe(20);
  });
});
