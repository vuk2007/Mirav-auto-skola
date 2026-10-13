/**
 * Autobuske linije na mreži igre (faza 6, stavka 8c).
 *
 * Sirove linije (`public/data/grad/linije/<grad>.json`, `scripts/osm/linijeGrada.mjs`)
 * su ulice-članovi OSM relacija `route=bus` i njihova stajališta. U OSM-u
 * relacije nijesu uredne — članovi i stajališta van reda, obje varijante trase u
 * jednoj — pa se linija ne slaže u jednu putanju od kraja do kraja, nego je:
 *
 *  - **koridor**: ivice mreže uz koje idu ulice-članovi linije (oba smjera iste
 *    linije zajedno, `GRAD_BUS_KORIDOR_UDIO`),
 *  - **stajališta**: platforme linije, bez redoslijeda.
 *
 * Autobus (`voznjaLinijom`) vozi dionicu koridora blizu igrača: A*-om po mreži
 * (`ruta`, ista pravila kao za svako vozilo), uz `GRAD_BUS_VAN_KORIDORA` puta
 * skuplje ivice van koridora — tako drži ulice linije, a rupe u OSM relaciji
 * premošćava najkraćim putem. Staje na stajalištima linije pored kojih prođe
 * sa platformom desno (vidi `saobracaj.ts`).
 *
 * Grad bez linija u OSM-u: autobusi po bulevarima (`linijeBulevarima`), staju na
 * `bus_stop` objektima uz njih.
 */
import {
  GRAD_BUS_DIONICA,
  GRAD_BUS_KORIDOR_DO,
  GRAD_BUS_KORIDOR_UDIO,
  GRAD_BUS_PRETRAGA,
  GRAD_BUS_UZORAK,
  GRAD_BUS_VAN_KORIDORA,
} from "../sim/config";
import type { Point } from "../sim/types";
import { ruta, ZA_BOTA, type Korak } from "./botGrad";
import type { Ivica } from "./mreza";
import { oseBlizu } from "./povrsina";
import type { SvijetGrada } from "./svijet";

/** Sadržaj `linije/<grad>.json`. */
export interface SiroveLinije {
  grad: string;
  datum: string | null;
  licenca: string;
  linije: SirovaLinija[];
}

export interface SirovaLinija {
  /** Id OSM relacije. */
  id: number;
  ref: string;
  ime: string;
  od: string | null;
  do: string | null;
  /** Ulice-članovi, složene koliko se dalo (red nije pouzdan). */
  dijelovi: [number, number][][];
  /** Platforme stajališta (red nije pouzdan). */
  stajalista: [number, number][];
}

export interface LinijaAutobusa {
  /** Broj linije („10"), ili prazno za autobuse po bulevarima. */
  ref: string;
  /** Ivice koridora, uzlazno. */
  ivice: number[];
  koridor: Set<number>;
  /** Platforme stajališta linije. */
  stajalista: Point[];
}

const kes = new WeakMap<SvijetGrada, Map<SiroveLinije | null, LinijaAutobusa[]>>();

/**
 * Linije grada na mreži igre (po broju linije, oba smjera zajedno) — računa se
 * jednom po svijetu i sirovim podacima. Bez podataka (`null`, ili nijedna
 * linija nije na mreži): autobusi po bulevarima.
 */
export function linijeAutobusa(sv: SvijetGrada, sirove: SiroveLinije | null): LinijaAutobusa[] {
  let poSirovim = kes.get(sv);
  if (!poSirovim) {
    poSirovim = new Map();
    kes.set(sv, poSirovim);
  }
  let l = poSirovim.get(sirove);
  if (!l) {
    const poRef = new Map<string, SirovaLinija[]>();
    for (const x of sirove?.linije ?? []) poRef.set(x.ref, [...(poRef.get(x.ref) ?? []), x]);
    l = [];
    for (const [ref, smjerovi] of [...poRef].sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))) {
      const koridor = new Set<number>();
      for (const x of smjerovi) for (const i of koridorLinije(sv, x)) koridor.add(i);
      if (koridor.size === 0) continue;
      const stajalista: Point[] = [];
      for (const x of smjerovi) {
        for (const [px, py] of x.stajalista) {
          if (!stajalista.some((q) => Math.hypot(q.x - px, q.y - py) < 5)) stajalista.push({ x: px, y: py });
        }
      }
      l.push({ ref, ivice: [...koridor].sort((a, b) => a - b), koridor, stajalista });
    }
    if (l.length === 0) l = linijeBulevarima(sv);
    poSirovim.set(sirove, l);
  }
  return l;
}

/** Klase ulica kojima idu autobusi kad grad nema linije u OSM-u. */
const BULEVARI = new Set(["trunk", "primary", "secondary"]);

/** Grad bez linija u OSM-u: jedna „linija" — bulevari, i `bus_stop` objekti uz njih. */
function linijeBulevarima(sv: SvijetGrada): LinijaAutobusa[] {
  const ivice = sv.mreza.ivice.filter((iv) => ZA_BOTA(iv) && BULEVARI.has(iv.klasa)).map((iv) => iv.i);
  if (ivice.length === 0) return [];
  const n = sv.paket.n;
  const vrsta = sv.paket.zaglavlje.vrsteObjekata.indexOf("bus_stop");
  const stajalista: Point[] = [];
  for (let o = 0; o < n.obVrsta.length; o++) if (n.obVrsta[o] === vrsta) stajalista.push({ x: n.obXY[2 * o]!, y: n.obXY[2 * o + 1]! });
  return [{ ref: "", ivice, koridor: new Set(ivice), stajalista }];
}

/** Ivice (vozne) uz koje idu ulice-članovi linije. */
export function koridorLinije(sv: SvijetGrada, linija: SirovaLinija): Set<number> {
  const { povrsina, mreza } = sv;
  const pogodaka = new Map<number, number>();
  for (const dio of linija.dijelovi) {
    for (let k = 1; k < dio.length; k++) {
      const [ax, ay] = dio[k - 1]!;
      const [bx, by] = dio[k]!;
      const l = Math.hypot(bx - ax, by - ay);
      if (l === 0) continue;
      const ux = (bx - ax) / l;
      const uy = (by - ay) / l;
      for (let s = 0; s < l; s += GRAD_BUS_UZORAK) {
        for (const ob of oseBlizu(povrsina, ax + ux * s, ay + uy * s, 15)) {
          if (ob.d > ob.pola + GRAD_BUS_KORIDOR_DO) continue;
          if (Math.abs(ob.pravac.x * ux + ob.pravac.y * uy) < 0.7) continue;
          pogodaka.set(ob.ivica, (pogodaka.get(ob.ivica) ?? 0) + 1);
        }
      }
    }
  }
  const koridor = new Set<number>();
  for (const [i, n] of pogodaka) {
    const iv = mreza.ivice[i]!;
    if (ZA_BOTA(iv) && (n * GRAD_BUS_UZORAK) / Math.max(iv.duzina, GRAD_BUS_UZORAK) >= GRAD_BUS_KORIDOR_UDIO) koridor.add(i);
  }
  return koridor;
}

/**
 * Vožnja linijom od koraka `od` (ivica koridora): do nasumične ivice koridora
 * ispred, na `GRAD_BUS_DIONICA` metara vazdušne linije, u smjeru koji se od
 * početka udaljava — A*-om sa skupljim ivicama van koridora. `null` kad u
 * nekoliko pokušaja nema rute.
 */
export function voznjaLinijom(sv: SvijetGrada, linija: LinijaAutobusa, od: Korak, slucajno: () => number): Korak[] | null {
  const { mreza, raskrsnice, zabrane } = sv;
  const cijena = (iv: Ivica) => (linija.koridor.has(iv.i) ? 1 : GRAD_BUS_VAN_KORIDORA);
  const ivOd = mreza.ivice[od.ivica]!;
  const p = sredina(ivOd);
  const k0 = mreza.cvorovi[od.smjer === 1 ? ivOd.a : ivOd.b]!;
  const k1 = mreza.cvorovi[od.smjer === 1 ? ivOd.b : ivOd.a]!;
  const h = { x: k1.x - k0.x, y: k1.y - k0.y };
  const [dmin, dmax] = GRAD_BUS_DIONICA;
  const ciljevi: Korak[] = [];
  for (const i of linija.ivice) {
    const iv = mreza.ivice[i]!;
    const q = sredina(iv);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < dmin || d > dmax || dx * h.x + dy * h.y <= 0) continue;
    // Smjer ivice koji vodi dalje od početka.
    const a = mreza.cvorovi[iv.a]!;
    const b = mreza.cvorovi[iv.b]!;
    const smjer: 1 | -1 = (b.x - a.x) * dx + (b.y - a.y) * dy >= 0 ? 1 : -1;
    if (iv.smjer !== 0 && iv.smjer !== smjer) continue;
    ciljevi.push({ ivica: i, smjer });
  }
  for (let pokusaj = 0; pokusaj < 4 && ciljevi.length > 0; pokusaj++) {
    const cilj = ciljevi[Math.floor(slucajno() * ciljevi.length)]!;
    const put = ruta(mreza, raskrsnice, zabrane, od, cilj, GRAD_BUS_PRETRAGA, ZA_BOTA, cijena);
    if (put) return put;
  }
  return null;
}

const sredina = (iv: Ivica): Point => iv.tacke[Math.floor(iv.tacke.length / 2)]!;
