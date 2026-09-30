import {
  CAR_WIDTH,
  GRAD_NAJUZA_ULICA,
  GRAD_SIRINA_TRAKE,
  GRAD_TRAKE_PO_KLASI,
} from "../sim/config";
import { cumulative } from "../sim/geometry";
import type { Point } from "../sim/types";
import { IVICA_KRUZNI, IVICA_VOZNA, type Paket } from "./paket";

/**
 * Mreža ulica grada, iz paketa: čvorovi (raskrsnice i krajevi ulica) i ivice
 * između njih.
 *
 * Ovo je prvi dio novog motora (faza 6): raskrsnica više nije šablon sa četiri
 * kraka nego čvor sa onoliko ulica koliko ih OSM kaže, pod stvarnim uglovima.
 */

export interface Ivica {
  i: number;
  a: number;
  b: number;
  /** Tačke od `a` do `b`, uključujući oba kraja. */
  tacke: Point[];
  cum: number[];
  duzina: number;
  klasa: string;
  /** 1: jednosmjerna od `a` ka `b`; -1: od `b` ka `a`; 0: dvosmjerna. */
  smjer: -1 | 0 | 1;
  /** Širina kolovoza [m] — iz broja traka, ili po klasi kad ga OSM nema. */
  sirina: number;
  /** Da li je broj traka iz OSM-a ili pretpostavljen po klasi. */
  trakePoznate: boolean;
  vozna: boolean;
  kruzni: boolean;
  ime: string;
  /** Ograničenje iz OSM-a [km/h]; `null` kad ga nema. */
  brzina: number | null;
}

export interface Mreza {
  cvorovi: Point[];
  ivice: Ivica[];
  /** Ivice koje dodiruju čvor, po čvoru. */
  izCvora: number[][];
}

/** Širina kolovoza ivice [m]. */
function sirinaKolovoza(p: Paket, i: number, klasa: string): { sirina: number; poznate: boolean } {
  const n = p.n;
  const poznato = n.ivTrake[i]! || n.ivTrakeNaprijed[i]! + n.ivTrakeNazad[i]!;
  const trake = poznato || GRAD_TRAKE_PO_KLASI[klasa] || 2;
  return { sirina: Math.max(GRAD_NAJUZA_ULICA, trake * GRAD_SIRINA_TRAKE), poznate: poznato > 0 };
}

export function napraviMrezu(p: Paket): Mreza {
  const n = p.n;
  const cvorovi: Point[] = [];
  for (let k = 0; k < n.cvXY.length; k += 2) cvorovi.push({ x: n.cvXY[k]!, y: n.cvXY[k + 1]! });
  const izCvora: number[][] = cvorovi.map(() => []);
  const ivice: Ivica[] = [];
  for (let i = 0; i < n.ivA.length; i++) {
    const tacke: Point[] = [];
    for (let k = n.ivOd[i]!; k < n.ivOd[i + 1]!; k++) tacke.push({ x: n.ivXY[2 * k]!, y: n.ivXY[2 * k + 1]! });
    const cum = cumulative(tacke);
    const klasa = p.zaglavlje.klase[n.ivKlasa[i]!] ?? "road";
    const { sirina, poznate } = sirinaKolovoza(p, i, klasa);
    const smjer = n.ivSmjer[i]!;
    ivice.push({
      i,
      a: n.ivA[i]!,
      b: n.ivB[i]!,
      tacke,
      cum,
      duzina: cum[cum.length - 1] ?? 0,
      klasa,
      smjer: smjer > 0 ? 1 : smjer < 0 ? -1 : 0,
      sirina,
      trakePoznate: poznate,
      vozna: (n.ivZastavice[i]! & IVICA_VOZNA) !== 0,
      kruzni: (n.ivZastavice[i]! & IVICA_KRUZNI) !== 0,
      ime: p.zaglavlje.stringovi[n.ivIme[i]!] ?? "",
      brzina: n.ivBrzina[i]! > 0 ? n.ivBrzina[i]! : null,
    });
    izCvora[n.ivA[i]!]!.push(i);
    if (n.ivB[i]! !== n.ivA[i]!) izCvora[n.ivB[i]!]!.push(i);
  }
  return { cvorovi, ivice, izCvora };
}

/**
 * Poprečni položaj u kojem se ulazi u ulicu [m od osovine, + je desno]: sredina
 * desne trake na dvosmjernoj ulici, sredina kolovoza na jednosmjernoj. Tako se
 * vozi i bez pravila — pravilo o traci dolazi u stavci 5.
 */
export function pocetniBok(iv: Ivica): number {
  if (iv.smjer !== 0) return 0;
  return Math.min(iv.sirina / 4, iv.sirina / 2 - CAR_WIDTH / 2);
}

/** Najveći poprečni pomak auta na ulici — da ostane na kolovozu [m]. */
export function najveciBok(iv: Ivica): number {
  return Math.max(0, iv.sirina / 2 - CAR_WIDTH / 2);
}

/** Najbliža vozna ivica tački, i mjesto na njoj — za start vožnje. */
export function najblizaIvica(m: Mreza, p: Point): { ivica: number; s: number; daljina: number } | null {
  let naj: { ivica: number; s: number; daljina: number } | null = null;
  for (const iv of m.ivice) {
    if (!iv.vozna) continue;
    for (let k = 0; k + 1 < iv.tacke.length; k++) {
      const a = iv.tacke[k]!;
      const b = iv.tacke[k + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
      const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
      if (!naj || d < naj.daljina) naj = { ivica: iv.i, s: iv.cum[k]! + Math.sqrt(l2) * t, daljina: d };
    }
  }
  return naj;
}
