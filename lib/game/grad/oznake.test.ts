import { describe, expect, it } from "vitest";
import {
  GRAD_CRTICA,
  GRAD_CRTICA_RAZMAK,
  GRAD_LINIJE_OD_RASKRSNICE,
  GRAD_SIRINA_TRAKE,
  GRAD_ZEBRA_DUBINA,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Ivica } from "./mreza";
import { krajeviLinija, linijeIvice, linijeTraka, streliceIvice, zebra } from "./oznake";
import { naPovrsini, napraviPovrsinu } from "./povrsina";
import { KRST, mreza as testMreza } from "./testMreza";

/**
 * Oznake na kolovozu — stavka 4b. Krst iz `testMreza.ts`: centar (0, 0), ivica
 * 0 dolazi sa juga (od y = 100 do 0), ulice sa dvije trake.
 */
const P = napraviPovrsinu(KRST);
const JUG = KRST.ivice[0]!;
const ODSJECI = krajeviLinija(KRST);
const TRAKA = GRAD_SIRINA_TRAKE;

/** Ista ivica, sa drugačijim trakama. */
const sa = (izmjene: Partial<Ivica>): Ivica => ({ ...JUG, ...izmjene });
const sredina = (p: Point[]) => ({ x: p.reduce((s, t) => s + t.x, 0) / p.length, y: p.reduce((s, t) => s + t.y, 0) / p.length });

describe("oznake: gdje linije staju", () => {
  it("u raskrsnici nema linija; slijepi kraj ulice ih ima do kraja", () => {
    // Ivica 0 ide od juga (a, slijepi kraj) do centra (b, raskrsnica sa četiri kraka).
    expect(ODSJECI[0]).toBe(0);
    expect(ODSJECI[1]).toBeCloseTo(TRAKA + GRAD_LINIJE_OD_RASKRSNICE, 6);
  });
});

describe("oznake: odvojak pod oštrim uglom", () => {
  it("raskrsnica na odvojku počinje tek kad kolovoz odvojka izađe sa asfalta glavne ulice", () => {
    // Glavna ulica istok–zapad kroz čvor 0; odvojak pod 20° od istočnog kraka.
    const u = (20 * Math.PI) / 180;
    const m = testMreza(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: -100, y: 0 },
        { x: 100 * Math.cos(u), y: 100 * Math.sin(u) },
      ],
      [
        [0, 1],
        [2, 0],
        [0, 3],
      ],
    );
    const od = krajeviLinija(m);
    const odvojak = m.ivice[2]!;
    const d = od[2 * 2 + 0]!;
    // Pod pravim uglom bi bilo pola glavne + 1 m; pod 20° mnogo više.
    expect(d).toBeGreaterThan(2 * (TRAKA + GRAD_LINIJE_OD_RASKRSNICE));
    const h = { x: Math.cos(u), y: Math.sin(u) };
    const n = { x: -h.y, y: h.x };
    for (const w of [-odvojak.sirina / 2, 0, odvojak.sirina / 2]) {
      const q = { x: h.x * d + n.x * w, y: h.y * d + n.y * w };
      // Udaljenost od osovine glavne (y = 0) je bar pola glavne + 1 m.
      expect(Math.abs(q.y)).toBeGreaterThanOrEqual(TRAKA + GRAD_LINIJE_OD_RASKRSNICE - 0.01);
    }
  });
});

describe("oznake: linije traka", () => {
  it("dvosmjerna sa dvije trake: jedna linija, na osovini", () => {
    expect(linijeTraka(JUG)).toEqual([0]);
  });

  it("bulevar sa po dvije trake: tri linije", () => {
    const b = sa({ trakeNaprijed: 2, trakeNazad: 2, sirina: 4 * TRAKA });
    expect(linijeTraka(b)).toEqual([-TRAKA, 0, TRAKA]);
  });

  it("uska dvosmjerna (jedna traka širine) i jednotračna jednosmjerna: bez linija", () => {
    expect(linijeTraka(sa({ trakeNaprijed: 1, trakeNazad: 1, sirina: 4.5 }))).toEqual([]);
    expect(linijeTraka(sa({ trakeNaprijed: 1, trakeNazad: 0, sirina: 4.5 }))).toEqual([]);
  });

  it("crtice su isprekidane, na asfaltu, i staju pred raskrsnicom", () => {
    const crtice = linijeIvice(JUG, ODSJECI[0]!, ODSJECI[1]!);
    const kraj = TRAKA + GRAD_LINIJE_OD_RASKRSNICE;
    // Od y = 100 do y = kraj, crtica na svakih GRAD_CRTICA + GRAD_CRTICA_RAZMAK.
    expect(crtice).toHaveLength(Math.ceil((100 - kraj) / (GRAD_CRTICA + GRAD_CRTICA_RAZMAK)));
    for (const c of crtice) {
      for (const t of c) {
        expect(naPovrsini(P, t.x, t.y)).toBe(true);
        expect(t.y).toBeGreaterThanOrEqual(kraj - 1e-4);
      }
    }
  });
});

describe("oznake: strelice", () => {
  const dvije = sa({ trakeNaprijed: 2, trakeNazad: 0, sirina: 2 * TRAKA, skretanjaNaprijed: "left|through;right" });

  it("strelica u svakoj traci, u njenoj sredini, pred raskrsnicom", () => {
    const s = streliceIvice(dvije, 0, TRAKA + GRAD_LINIJE_OD_RASKRSNICE);
    // lijevo: 3 dijela; pravo: 2; desno: 3.
    expect(s).toHaveLength(8);
    // Ivica ide na sjever, pa je lijeva traka zapadno (x < 0), desna istočno.
    const lijeva = s.slice(0, 3).map(sredina);
    const desna = s.slice(3).map(sredina);
    for (const c of lijeva) expect(c.x).toBeLessThan(0);
    for (const c of desna) expect(c.x).toBeGreaterThan(0);
    // Krak lijeve strelice ide na zapad od njene trake, desne na istok.
    expect(Math.min(...s[2]!.map((t) => t.x))).toBeLessThan(-TRAKA / 2 - 1);
    expect(Math.max(...s[7]!.map((t) => t.x))).toBeGreaterThan(TRAKA / 2 + 1);
  });

  it("kad OSM navede drugačiji broj traka od ulice — nema strelica", () => {
    expect(streliceIvice(sa({ ...dvije, skretanjaNaprijed: "left|through|right" }), 0, 0)).toEqual([]);
  });

  it("unazad: strelice u trakama lijevo od osovine, okrenute na jug", () => {
    const nazad = sa({ trakeNaprijed: 1, trakeNazad: 1, skretanjaNazad: "through" });
    const s = streliceIvice(nazad, ODSJECI[0]!, ODSJECI[1]!);
    expect(s).toHaveLength(2);
    const [vrat, glava] = s;
    expect(sredina(vrat!).x).toBeLessThan(0);
    // Glava je južnije od vrata: vozi se na jug.
    expect(sredina(glava!).y).toBeGreaterThan(sredina(vrat!).y);
  });
});

describe("oznake: zebre", () => {
  it("zebra preko cijelog kolovoza, pruge duž ulice", () => {
    const pruge = zebra(P, 0.4, 50);
    expect(pruge.length).toBeGreaterThanOrEqual(7);
    for (const p of pruge) {
      const ys = p.map((t) => t.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(GRAD_ZEBRA_DUBINA, 6);
      for (const t of p) expect(naPovrsini(P, t.x, t.y)).toBe(true);
    }
  });

  it("čvor prelaza daleko od vozne ulice nema zebru", () => {
    expect(zebra(P, 30, 30)).toEqual([]);
  });
});
