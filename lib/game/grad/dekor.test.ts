import { readFileSync } from "node:fs";
import { join } from "node:path";
import { earcut } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  GRAD_DRVORED_RAZMAK,
  GRAD_PARKING_ZAUZETO,
  GRAD_RASVJETA_RAZMAK,
  GRAD_RASVJETA_VISINA,
  GRAD_SIRINA_TRAKE,
  GRAD_STABALA_NAJVISE,
  GRAD_STABLO_PO_POVRSINI,
  GRAD_TROTOAR,
} from "../sim/config";
import type { Point } from "../sim/types";
import { geometrijaDekora, type BojeDekora, type UlazDekora } from "./dekor";
import { krajeviLinija } from "./oznake";
import { prazniNizovi, type Paket } from "./paket";
import { naPovrsini, napraviPovrsinu } from "./povrsina";
import { KRST } from "./testMreza";
import type { Temena } from "./temena";
import type { Zgrada } from "./zgrade";

/**
 * Dekor — stavka 4c: drveće, rasvjeta, kontejneri, klupe, parking. Krst iz
 * `testMreza.ts` (ulice duž osa, centar u (0, 0)); površine i linije su u
 * jugoistočnom kvadrantu, daleko od ulica, osim kad test kaže drugačije.
 */
const JAVNO = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
const BOJE = (JSON.parse(readFileSync(join(JAVNO, "palete.json"), "utf8")) as { dekor: BojeDekora }).dekor;
const P = napraviPovrsinu(KRST);
const triangulisi = (r: number[]) => earcut(r);
const ODSJECI = krajeviLinija(KRST);

const kvadrat = (x: number, y: number, a: number): Point[] => [
  { x, y },
  { x: x + a, y },
  { x: x + a, y: y + a },
  { x, y: y + a },
];

/** Paket sa zadatim površinama i linijama. */
function paket(povrsine: { vrsta: string; oblik: Point[] }[], linije: { vrsta: string; tacke: Point[] }[]): Paket {
  const n = prazniNizovi();
  const vp = ["park", "suma", "parking", "trava"];
  const vl = ["drvored", "rijeka"];
  n.pvOd = new Uint32Array(povrsine.reduce((od, p) => [...od, od[od.length - 1]! + p.oblik.length], [0]));
  n.pvXY = new Float32Array(povrsine.flatMap((p) => p.oblik.flatMap((t) => [t.x, t.y])));
  n.pvVrsta = new Uint8Array(povrsine.map((p) => vp.indexOf(p.vrsta)));
  n.lnOd = new Uint32Array(linije.reduce((od, l) => [...od, od[od.length - 1]! + l.tacke.length], [0]));
  n.lnXY = new Float32Array(linije.flatMap((l) => l.tacke.flatMap((t) => [t.x, t.y])));
  n.lnVrsta = new Uint8Array(linije.map((l) => vl.indexOf(l.vrsta)));
  return { zaglavlje: { vrstePovrsina: vp, vrsteLinija: vl }, n } as unknown as Paket;
}

function ulaz(p: Paket, izmjene: Partial<UlazDekora> = {}): UlazDekora {
  return {
    paket: p,
    povrsina: P,
    povrsine: [0, p.n.pvVrsta.length],
    linije: [0, p.n.lnVrsta.length],
    ivice: [],
    zgrade: [],
    boje: BOJE,
    ...izmjene,
  };
}

/** Krošnje: grupe od 8 temena (osmougao) na istoj visini > 0. */
const krosnje = (t: Temena): Point[] => {
  const sredine: Point[] = [];
  for (let k = 0; k + 8 <= t.visina.length; k += 16) {
    let x = 0;
    let y = 0;
    for (let j = 0; j < 8; j++) {
      x += t.polozaj[2 * (k + j)]!;
      y += t.polozaj[2 * (k + j) + 1]!;
    }
    sredine.push({ x: x / 8, y: y / 8 });
  }
  return sredine;
};

describe("dekor: drveće", () => {
  it("drvored: stablo na svakih GRAD_DRVORED_RAZMAK metara, sa sjenkom", () => {
    const p = paket([], [{ vrsta: "drvored", tacke: [{ x: 30, y: 30 }, { x: 70, y: 30 }] }]);
    const { dekor, sjene } = geometrijaDekora(ulaz(p), triangulisi);
    const broj = Math.floor(40 / GRAD_DRVORED_RAZMAK) + 1;
    // Po stablu: krošnja i vrh (2 × 8 temena); sjenka: 8 temena.
    expect(dekor.visina.length).toBe(broj * 16);
    expect(sjene.visina.length).toBe(broj * 8);
    expect([...sjene.visina].every((h) => h === 0)).toBe(true);
    expect([...dekor.visina].every((h) => h > 0)).toBe(true);
  });

  it("drvored ucrtan uz sam ivičnjak se odmiče na trotoar, ne na kolovoz", () => {
    const x = GRAD_SIRINA_TRAKE - 0.5; // na kolovozu južnog kraka
    const p = paket([], [{ vrsta: "drvored", tacke: [{ x, y: 30 }, { x, y: 70 }] }]);
    const { dekor } = geometrijaDekora(ulaz(p), triangulisi);
    const stabla = krosnje(dekor);
    expect(stabla.length).toBeGreaterThan(0);
    for (const c of stabla) {
      expect(naPovrsini(P, c.x, c.y)).toBe(false);
      expect(c.x).toBeCloseTo(GRAD_SIRINA_TRAKE + GRAD_TROTOAR, 4);
    }
  });

  it("park: stabla u parku, ni na ulici ni u kući, uvijek ista", () => {
    const park = kvadrat(20, 20, 60);
    const kuca: Zgrada = {
      osnova: kvadrat(40, 40, 15),
      visina: 6.6,
      spratova: 2,
      procijenjena: true,
      grupa: "kuca",
      krov: "#b5563d",
      zid: "#e8dcc6",
      detalj: "#8b5a4a",
      sjeme: 1,
    };
    const p = paket([{ vrsta: "park", oblik: park }], []);
    const a = geometrijaDekora(ulaz(p, { zgrade: [kuca] }), triangulisi);
    const stabla = krosnje(a.dekor);
    const ocekivano = (60 * 60) / GRAD_STABLO_PO_POVRSINI.park!;
    // Ćelije koje pokrivaju kuću ostaju prazne; ostatak je blizu gustine.
    expect(stabla.length).toBeGreaterThan(ocekivano * 0.6);
    expect(stabla.length).toBeLessThan(ocekivano * 1.3);
    for (const c of stabla) {
      expect(c.x > 20 && c.x < 80 && c.y > 20 && c.y < 80).toBe(true);
      expect(c.x > 40 && c.x < 55 && c.y > 40 && c.y < 55).toBe(false);
    }
    expect(geometrijaDekora(ulaz(p, { zgrade: [kuca] }), triangulisi)).toEqual(a);
  });

  it("šuma veća od granice: najviše GRAD_STABALA_NAJVISE stabala po tile-u", () => {
    const p = paket([{ vrsta: "suma", oblik: kvadrat(10, 10, 800) }], []);
    const { dekor } = geometrijaDekora(ulaz(p), triangulisi);
    expect(dekor.visina.length / 16).toBe(GRAD_STABALA_NAJVISE);
  });
});

describe("dekor: uz ulice", () => {
  it("rasvjeta na trotoaru, na svakih GRAD_RASVJETA_RAZMAK, stub do GRAD_RASVJETA_VISINA", () => {
    const iv = KRST.ivice[0]!;
    const { dekor } = geometrijaDekora(
      ulaz(paket([], []), { ivice: [{ iv, odA: ODSJECI[0]!, odB: ODSJECI[1]! }] }),
      triangulisi,
    );
    // Svjetiljka je prizma od visine stuba do 0,2 m više: gornja temena
    // (4 zida × 2 + krov 4 = 12) su tačno na toj visini, i nigdje drugo.
    const vrh = Math.fround(GRAD_RASVJETA_VISINA + 0.2);
    const svjetiljki = [...dekor.visina].filter((h) => h === vrh).length / 12;
    // Ulica široka 8,5 m: rasvjeta samo sa desne strane, od pola razmaka.
    const kraj = 100 - ODSJECI[1]! - 2;
    let ocekivano = 0;
    for (let d = GRAD_RASVJETA_RAZMAK / 2; d < kraj; d += GRAD_RASVJETA_RAZMAK) ocekivano += 1;
    expect(svjetiljki).toBe(ocekivano);
    for (let k = 0; k < dekor.polozaj.length; k += 2) {
      // Ništa od dekora nije na kolovozu osim krakova svjetiljki (visoko iznad njega).
      if (dekor.visina[k / 2]! < GRAD_RASVJETA_VISINA) {
        expect(naPovrsini(P, dekor.polozaj[k]!, dekor.polozaj[k + 1]!)).toBe(false);
      }
    }
  });
});

describe("dekor: parking", () => {
  it("auti cijeli na parkingu, zauzetost blizu GRAD_PARKING_ZAUZETO", () => {
    const oblik = kvadrat(20, 20, 50);
    const { dekor } = geometrijaDekora(ulaz(paket([{ vrsta: "parking", oblik }], [])), triangulisi);
    for (let k = 0; k < dekor.polozaj.length; k += 2) {
      const x = dekor.polozaj[k]!;
      const y = dekor.polozaj[k + 1]!;
      expect(x >= 20 - 1e-3 && x <= 70 + 1e-3 && y >= 20 - 1e-3 && y <= 70 + 1e-3).toBe(true);
    }
    // Auto: prizma (4 zida × 4 + krov 4) i vjetrobran (4) = 24 temena.
    const auta = dekor.visina.length / 24;
    expect(Number.isInteger(auta)).toBe(true);
    // Blok od 16 m: 3 bloka × 2 reda × 19 mjesta u 50 m; dio ne stane uz ivicu.
    const mjesta = 3 * 2 * Math.floor(50 / 2.6);
    expect(auta).toBeGreaterThan(mjesta * GRAD_PARKING_ZAUZETO * 0.5);
    expect(auta).toBeLessThan(mjesta * GRAD_PARKING_ZAUZETO * 1.4);
  });
});
