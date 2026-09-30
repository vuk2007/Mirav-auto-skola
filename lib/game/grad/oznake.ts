import {
  GRAD_CRTICA,
  GRAD_CRTICA_RAZMAK,
  GRAD_LINIJA_SIRINA,
  GRAD_LINIJE_OD_RASKRSNICE,
  GRAD_SIRINA_TRAKE,
  GRAD_STRELICA_DUZINA,
  GRAD_STRELICA_OD_KRAJA,
  GRAD_ZEBRA_DO_ULICE,
  GRAD_ZEBRA_DUBINA,
  GRAD_ZEBRA_PRUGA,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Ivica, Mreza } from "./mreza";
import { najblizaOsa, type Povrsina } from "./povrsina";

/**
 * Oznake na kolovozu (faza 6, stavka 4b): linije traka, strelice iz OSM
 * `turn:lanes`, zebre na obilježenim prelazima. Sve je poligon u metrima
 * svijeta; crtač ih samo oboji bijelo, jednom po tile-u.
 *
 * Linije su isprekidane: puna linija je pravilo (zabrana prelaska), a OSM je
 * ne zna — nju dodaje editor (stavka 6). Stop-linije nisu ovdje nego u stavci
 * 5, iz istog modela raskrsnice po kojem se i sudi: nacrtano i suđeno moraju
 * biti jedno.
 */

export type Poligon = Point[];

// ── gdje linije staju: raskrsnice ──────────────────────────────────────────

/**
 * Za svaku ivicu: koliko metara od početka (`a`) i od kraja (`b`) linije ne
 * idu, jer je tu raskrsnica — preko pola najšire druge ulice koja se u tom
 * čvoru sastaje. Čvor sa dvije ulice (nastavak iste) nije raskrsnica.
 */
export function krajeviLinija(m: Mreza): Float32Array {
  const od = new Float32Array(2 * m.ivice.length);
  for (let c = 0; c < m.cvorovi.length; c++) {
    const kraci: { ivica: number; kraj: 0 | 1; pola: number }[] = [];
    for (const i of m.izCvora[c] ?? []) {
      const iv = m.ivice[i]!;
      if (!iv.vozna) continue;
      if (iv.a === c) kraci.push({ ivica: i, kraj: 0, pola: iv.sirina / 2 });
      if (iv.b === c) kraci.push({ ivica: i, kraj: 1, pola: iv.sirina / 2 });
    }
    if (kraci.length < 3) continue;
    for (const k of kraci) {
      let pola = 0;
      for (const d of kraci) if (d !== k) pola = Math.max(pola, d.pola);
      od[2 * k.ivica + k.kraj] = pola + GRAD_LINIJE_OD_RASKRSNICE;
    }
  }
  return od;
}

// ── pomoćno: tačke duž ivice, sa bočnim pomakom ─────────────────────────────

/** Segment ivice u kojem je `s` (od `a`), i pomak unutar njega. */
function naSegmentu(iv: Ivica, s: number): { k: number; t: number } {
  let k = 0;
  while (k + 2 < iv.tacke.length && iv.cum[k + 1]! < s) k += 1;
  const duz = iv.cum[k + 1]! - iv.cum[k]!;
  return { k, t: duz > 0 ? (s - iv.cum[k]!) / duz : 0 };
}

/** Jedinični pravac segmenta `k` i desno od njega (`y` na jug). */
function pravacSegmenta(iv: Ivica, k: number): { h: Point; d: Point } {
  const a = iv.tacke[k]!;
  const b = iv.tacke[k + 1]!;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const h = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  return { h, d: { x: -h.y, y: h.x } };
}

/**
 * Traka (pravougaonici) duž ivice od `s0` do `s1`, pomaknuta `o` metara udesno
 * (u smjeru `a → b`), široka `sirina`. Po jedan pravougaonik na svakom
 * segmentu koji preseče — na krivini se linija lomi zajedno sa ulicom.
 */
function trakaDuz(iv: Ivica, s0: number, s1: number, o: number, sirina: number, izlaz: Poligon[]): void {
  if (s1 - s0 < 0.05) return;
  const { k: k0 } = naSegmentu(iv, s0);
  const { k: k1 } = naSegmentu(iv, s1);
  for (let k = k0; k <= k1; k++) {
    const d0 = Math.max(s0, iv.cum[k]!);
    const d1 = Math.min(s1, iv.cum[k + 1]!);
    if (d1 - d0 < 0.05) continue;
    const { h, d } = pravacSegmenta(iv, k);
    const a = iv.tacke[k]!;
    const p0 = { x: a.x + h.x * (d0 - iv.cum[k]!), y: a.y + h.y * (d0 - iv.cum[k]!) };
    const p1 = { x: a.x + h.x * (d1 - iv.cum[k]!), y: a.y + h.y * (d1 - iv.cum[k]!) };
    const l = o - sirina / 2;
    const r = o + sirina / 2;
    izlaz.push([
      { x: p0.x + d.x * l, y: p0.y + d.y * l },
      { x: p1.x + d.x * l, y: p1.y + d.y * l },
      { x: p1.x + d.x * r, y: p1.y + d.y * r },
      { x: p0.x + d.x * r, y: p0.y + d.y * r },
    ]);
  }
}

// ── linije traka ────────────────────────────────────────────────────────────

/**
 * Pomaci linija između traka od osovine [m, + je desno u smjeru `a → b`].
 * Trake u smjeru `b → a` su lijevo. Ulica uža od onoga što njene trake traže
 * (jednotračna dvosmjerna, `GRAD_NAJUZA_ULICA`) nema linija.
 */
export function linijeTraka(iv: Ivica): number[] {
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (n < 2 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return [];
  const traka = iv.sirina / n;
  const pomaci: number[] = [];
  for (let k = 1; k < n; k++) pomaci.push(-iv.sirina / 2 + k * traka);
  return pomaci;
}

/** Isprekidane linije traka ivice, bez dijela u raskrsnicama. */
export function linijeIvice(iv: Ivica, odA: number, odB: number): Poligon[] {
  const izlaz: Poligon[] = [];
  const s1 = iv.duzina - odB;
  if (s1 - odA < GRAD_CRTICA) return izlaz;
  for (const o of linijeTraka(iv)) {
    // Crtice počinju od raskrsnice na početku, pa je raspored isti u oba
    // smjera vožnje i ne zavisi od toga gdje je tile.
    for (let s = odA; s < s1; s += GRAD_CRTICA + GRAD_CRTICA_RAZMAK) {
      trakaDuz(iv, s, Math.min(s + GRAD_CRTICA, s1), o, GRAD_LINIJA_SIRINA, izlaz);
    }
  }
  return izlaz;
}

// ── strelice ────────────────────────────────────────────────────────────────

/** Oblici strelica u ravni trake: `u` duž vožnje od repa, `w` udesno [m]. */
const STRELICE: Record<string, readonly (readonly [number, number])[][]> = (() => {
  const L = GRAD_STRELICA_DUZINA;
  const vrat = L * 0.64;
  const pravo: [number, number][][] = [
    [
      [0, -0.15],
      [vrat, -0.15],
      [vrat, 0.15],
      [0, 0.15],
    ],
    [
      [vrat, -0.6],
      [L, 0],
      [vrat, 0.6],
    ],
  ];
  // Skretanje: kraći vrat, pa krak u stranu sa glavom. Za desno se `w` obrće.
  const lakat = L * 0.5;
  const lijevo: [number, number][][] = [
    [
      [0, -0.15],
      [lakat + 0.15, -0.15],
      [lakat + 0.15, 0.15],
      [0, 0.15],
    ],
    [
      [lakat - 0.15, -0.95],
      [lakat + 0.15, -0.95],
      [lakat + 0.15, -0.15],
      [lakat - 0.15, -0.15],
    ],
    [
      [lakat - 0.6, -0.95],
      [lakat, -1.6],
      [lakat + 0.6, -0.95],
    ],
  ];
  const desno = lijevo.map((p) => p.map(([u, w]) => [u, -w] as [number, number]).reverse());
  return {
    through: pravo,
    left: lijevo,
    slight_left: lijevo,
    sharp_left: lijevo,
    right: desno,
    slight_right: desno,
    sharp_right: desno,
  };
})();

/**
 * Strelice iz `turn:lanes` na kraju ivice, u svakoj traci koja ih ima. Kad OSM
 * navede drugačiji broj traka nego što ulica ima, strelica nema — ne pogađa se
 * koja traka je koja.
 */
export function streliceIvice(iv: Ivica, odA: number, odB: number): Poligon[] {
  const izlaz: Poligon[] = [];
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (n === 0 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return izlaz;
  const traka = iv.sirina / n;
  for (const naprijed of [true, false]) {
    const opis = naprijed ? iv.skretanjaNaprijed : iv.skretanjaNazad;
    const trake = naprijed ? iv.trakeNaprijed : iv.trakeNazad;
    if (!opis) continue;
    const po = opis.split("|");
    if (po.length !== trake) continue;
    // Vrh strelice je `GRAD_STRELICA_OD_KRAJA` prije kraja linija, u smjeru vožnje.
    const vrh = naprijed ? iv.duzina - odB - GRAD_STRELICA_OD_KRAJA : odA + GRAD_STRELICA_OD_KRAJA;
    const rep = naprijed ? vrh - GRAD_STRELICA_DUZINA : vrh + GRAD_STRELICA_DUZINA;
    if (Math.min(vrh, rep) < odA + 1 || Math.max(vrh, rep) > iv.duzina - odB - 1) continue;
    const { k, t } = naSegmentu(iv, rep);
    const { h, d } = pravacSegmenta(iv, k);
    const a = iv.tacke[k]!;
    const b = iv.tacke[k + 1]!;
    const baza = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    // U smjeru vožnje: naprijed je `h`, desno `d`; unazad oba obrnuta.
    const hv = naprijed ? h : { x: -h.x, y: -h.y };
    const dv = naprijed ? d : { x: -d.x, y: -d.y };
    po.forEach((traka_, j) => {
      // Pomak sredine trake od osovine, u smjeru `a → b`: trake unaprijed su
      // desno od trakâ unazad; `j` ide s lijeva nadesno onome ko vozi.
      const o = naprijed
        ? -iv.sirina / 2 + (iv.trakeNazad + j + 0.5) * traka
        : -iv.sirina / 2 + (iv.trakeNazad - j - 0.5) * traka;
      const c = { x: baza.x + d.x * o, y: baza.y + d.y * o };
      for (const vrsta of traka_.split(";")) {
        for (const oblik of STRELICE[vrsta.trim()] ?? []) {
          izlaz.push(oblik.map(([u, w]) => ({ x: c.x + hv.x * u + dv.x * w, y: c.y + hv.y * u + dv.y * w })));
        }
      }
    });
  }
  return izlaz;
}

// ── zebre ───────────────────────────────────────────────────────────────────

/**
 * Zebra na prelazu u (`x`, `y`): pruge duž ulice, preko cijelog kolovoza.
 * Prazno kad čvor prelaza nije na voznoj ulici (prelaz preko biciklističke
 * staze, ili pješačka staza koja se ne dodiruje sa ulicom).
 */
export function zebra(p: Povrsina, x: number, y: number): Poligon[] {
  const osa = najblizaOsa(p, x, y, GRAD_ZEBRA_DO_ULICE);
  if (!osa) return [];
  const { tacka: c, pravac: h, pola } = osa;
  const d = { x: -h.y, y: h.x };
  const izlaz: Poligon[] = [];
  const u0 = -GRAD_ZEBRA_DUBINA / 2;
  const u1 = GRAD_ZEBRA_DUBINA / 2;
  const korak = 2 * GRAD_ZEBRA_PRUGA;
  // Pruge simetrično oko osovine, sa po pola razmaka do ivičnjaka.
  const pruga = Math.floor((2 * pola) / korak);
  const pocetak = -(pruga * korak) / 2 + GRAD_ZEBRA_PRUGA / 2;
  for (let k = 0; k < pruga; k++) {
    const w0 = pocetak + k * korak;
    const w1 = w0 + GRAD_ZEBRA_PRUGA;
    izlaz.push(
      (
        [
          [u0, w0],
          [u1, w0],
          [u1, w1],
          [u0, w1],
        ] as const
      ).map(([u, w]) => ({ x: c.x + h.x * u + d.x * w, y: c.y + h.y * u + d.y * w })),
    );
  }
  return izlaz;
}
