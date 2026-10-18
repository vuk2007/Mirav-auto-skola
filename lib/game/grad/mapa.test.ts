import { describe, expect, it } from "vitest";
import { GRAD_ZEBRA_DUBINA, GRAD_ZEBRA_PRUGA } from "../sim/config";
import type { Point } from "../sim/types";
import { zebraPrelaza } from "./oznake";
import { napraviPovrsinu } from "./povrsina";
import { svijetGrada } from "./svijet";
import { kruzniTok, testPaket } from "./testMreza";
import { mrezaPjesaka, type Prelaz } from "./trotoari";

/**
 * Provjera mape (faza 6, poslije stavke 9c): kružni tok kao krug, ostrvo bez
 * zasjeka, zebra jedna po prelazu i samo na asfaltu.
 */
describe("kružni tok kao krug", () => {
  const prsten = (mreza: ReturnType<typeof testPaket>["mreza"]) => mreza.ivice.filter((e) => e.kruzni);

  it("čvorovi i tačke prstena na istom poluprečniku; krak završava u pomjerenom čvoru", () => {
    const { cvorovi, ivice } = kruzniTok(60);
    // OSM prsten nije savršen: jedan čvor 4 m dalje.
    cvorovi[2] = { x: cvorovi[2]!.x * (64 / 60), y: cvorovi[2]!.y * (64 / 60) };
    const { mreza } = testPaket(cvorovi, ivice);
    const tacke = prsten(mreza).flatMap((e) => e.tacke);
    const centar = { x: tacke.reduce((a, p) => a + p.x, 0) / tacke.length, y: tacke.reduce((a, p) => a + p.y, 0) / tacke.length };
    const r = tacke.map((p) => Math.hypot(p.x - centar.x, p.y - centar.y));
    expect(Math.max(...r) - Math.min(...r)).toBeLessThan(0.05);
    // Luk, ne tetiva: više tačaka od dvije.
    expect(prsten(mreza).every((e) => e.tacke.length > 2)).toBe(true);
    // Krak sa čvora 2 (ivica 9: od 9 do 2) završava tačno u čvoru.
    const krak = mreza.ivice[9]!;
    expect(krak.tacke.at(-1)).toEqual(mreza.cvorovi[2]);
  });

  it("izdužen prsten (elipsa) se ne dira", () => {
    const { cvorovi, ivice } = kruzniTok(60);
    for (const k of [0, 1, 7]) cvorovi[k] = { x: cvorovi[k]!.x * 2, y: cvorovi[k]!.y };
    const prije = cvorovi.slice(0, 8).map((p) => ({ ...p }));
    const { mreza } = testPaket(cvorovi, ivice);
    for (let k = 0; k < 8; k++) {
      expect(mreza.cvorovi[k]!.x).toBeCloseTo(prije[k]!.x, 3);
      expect(mreza.cvorovi[k]!.y).toBeCloseTo(prije[k]!.y, 3);
    }
  });

  it("između dvije ivice prstena nema zasjeka ugla (ne štrči u ostrvo)", () => {
    const { cvorovi, ivice } = kruzniTok(20);
    const { mreza } = testPaket(cvorovi, ivice);
    const p = napraviPovrsinu(mreza);
    expect(p.uglovi.some((u) => mreza.ivice[u.ivice[0]]!.kruzni && mreza.ivice[u.ivice[1]]!.kruzni)).toBe(false);
    // Uglovi između kraka i prstena ostaju.
    expect(p.uglovi.length).toBeGreaterThan(0);
  });
});

describe("zebre", () => {
  it("dva OSM čvora istog prelaza, pet metara jedan od drugog duž ulice: jedan prelaz", () => {
    const cvorovi: Point[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ];
    const zebra = (s: number) => ({ vrsta: "crossing" as const, podatak: "zebra", ivica: 0, s });
    const jedna = svijetGrada(testPaket(cvorovi, [{ a: 0, b: 1 }], [zebra(150)]).paket, null, []);
    const dvije = svijetGrada(testPaket(cvorovi, [{ a: 0, b: 1 }], [zebra(150), zebra(155)]).paket, null, []);
    const daleko = svijetGrada(testPaket(cvorovi, [{ a: 0, b: 1 }], [zebra(150), zebra(180)]).paket, null, []);
    expect(mrezaPjesaka(jedna).prelazi).toHaveLength(1);
    expect(mrezaPjesaka(dvije).prelazi).toHaveLength(1);
    expect(mrezaPjesaka(daleko).prelazi).toHaveLength(2);
  });

  it("pruge samo na asfaltu duž prelaza (preko razdjelnog pojasa ih nema)", () => {
    // Prelaz od (0,0) do (0,20), ulica ide duž x: dva kolovoza, 1–8 i 11–18 m.
    const p: Prelaz = {
      id: 0,
      cvorA: 0,
      cvorB: 1,
      a: { x: 0, y: 0 },
      b: { x: 0, y: 20 },
      centar: { x: 0, y: 10 },
      pravac: { x: 1, y: 0 },
      ivica: 0,
      s: 0,
      ivice: [],
      duzina: 20,
      semafor: null,
      pojasevi: [
        { ivica: 0, w0: 1, w1: 8, wOsa: 4.5, dvosmjerna: false },
        { ivica: 1, w0: 11, w1: 18, wOsa: 14.5, dvosmjerna: false },
      ],
    };
    const pruge = zebraPrelaza(p);
    expect(pruge.length).toBe(2 * Math.floor(7 / (2 * GRAD_ZEBRA_PRUGA)));
    for (const pr of pruge) {
      const ys = pr.map((t) => t.y);
      const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
      expect((lo >= 1 - 1e-9 && hi <= 8 + 1e-9) || (lo >= 11 - 1e-9 && hi <= 18 + 1e-9)).toBe(true);
      const xs = pr.map((t) => t.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(GRAD_ZEBRA_DUBINA, 6);
    }
  });
});
