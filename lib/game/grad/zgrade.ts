import {
  GRAD_DETALJ_POVRSINA,
  GRAD_DETALJA_NAJVISE,
  GRAD_KROV,
  GRAD_SJENKA_DUZINA,
  GRAD_SJENKA_PRAVAC,
  GRAD_SPRAT,
  GRAD_SPRATOVI_PO_POVRSINI,
  GRAD_SPRATOVI_PO_VRSTI,
} from "../sim/config";
import { rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { Paket } from "./paket";
import { odmakniOdUlice, type Povrsina } from "./povrsina";

/**
 * Zgrade u GTA izgledu (faza 6, stavka 4): visina, paleta, i geometrija za
 * lažni 2.5D — zidovi, krov, detalji na krovu, sjenka.
 *
 * Ovdje nema crtanja: izlaz su nizovi temena koje crtač šalje grafičkom čipu
 * (`gradRenderer.ts`). Svako teme nosi i visinu; vertex shader onda pomjera
 * teme od sredine ekrana srazmjerno visini, pa zgrada „raste" ka kameri i
 * naginje se kako se kamera kreće — kao u GTA 1/2. Zato se geometrija gradi
 * jednom po tile-u, a ne u svakom kadru.
 *
 * Sve slučajno (boja, spratnost bez podatka, detalji) ide iz sjemena zgrade,
 * koje zavisi samo od njenog položaja: ista zgrada uvijek izgleda isto.
 */

// ── palete (podatak: public/data/grad/palete.json) ──────────────────────────

export interface Paleta {
  ime: string;
  krov: string[];
  zid: string[];
  detalj: string[];
}

/** Grupa zgrade po vrsti — bira paletu kad zgrada nije u nacrtanoj zoni. */
export type GrupaZgrade = "kuca" | "blok" | "poslovna" | "industrija" | "javna" | "ostalo";

export interface Palete {
  palete: Record<string, Paleta>;
  automatski: Record<GrupaZgrade, string>;
}

/** Zona iz `cityZones/<grad>.json` — ovdje treba samo poligon i paleta. */
export interface ZonaPalete {
  id: string;
  poligon: [number, number][];
  paleta: string | null;
}

const GRUPE: Record<string, GrupaZgrade> = {
  house: "kuca",
  detached: "kuca",
  terrace: "kuca",
  hut: "kuca",
  shed: "kuca",
  garage: "kuca",
  carport: "kuca",
  residential: "blok",
  apartments: "blok",
  dormitory: "blok",
  commercial: "poslovna",
  retail: "poslovna",
  supermarket: "poslovna",
  office: "poslovna",
  hotel: "poslovna",
  kiosk: "poslovna",
  industrial: "industrija",
  warehouse: "industrija",
  manufacture: "industrija",
  service: "industrija",
  garages: "industrija",
  greenhouse: "industrija",
  transformer_tower: "industrija",
  school: "javna",
  kindergarten: "javna",
  college: "javna",
  university: "javna",
  hospital: "javna",
  clinic: "javna",
  government: "javna",
  public: "javna",
  church: "javna",
  chapel: "javna",
  mosque: "javna",
  temple: "javna",
  train_station: "javna",
  clock_tower: "javna",
  sports_hall: "javna",
  stadium: "javna",
  grandstand: "javna",
};

/** Grupa zgrade: po vrsti iz OSM-a, a vrsta `yes` po spratnosti i površini. */
export function grupaZgrade(vrsta: string, spratova: number, povrsina: number): GrupaZgrade {
  const g = GRUPE[vrsta];
  if (g) return g;
  if (spratova <= 2 && povrsina < 250) return "kuca";
  if (spratova >= 4) return "blok";
  if (povrsina >= 2000) return "industrija";
  return "ostalo";
}

// ── pojedinačna zgrada ──────────────────────────────────────────────────────

/** Sjeme zgrade iz prve tačke osnove (na decimetar) — isto dok se zgrada ne pomjeri. */
export function sjemeZgrade(x: number, y: number): number {
  let h = Math.imul(Math.round(x * 10) | 0, 0x9e3779b1) ^ Math.imul(Math.round(y * 10) | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Površina prstena sa znakom: pozitivna kad se tačke ređaju u smjeru kazaljke (`y` na jug). */
export function povrsinaSaZnakom(t: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < t.length; i++) {
    const a = t[i]!;
    const b = t[(i + 1) % t.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Broj spratova po vrsti ili površini, kad ga OSM nema — pa ±1 po sjemenu. */
export function procijenjeniSpratovi(vrsta: string, povrsina: number, slucajno: () => number): number {
  let s = GRAD_SPRATOVI_PO_VRSTI[vrsta];
  if (s === undefined) s = GRAD_SPRATOVI_PO_POVRSINI.find(([do_]) => povrsina <= do_)![1];
  // Kuća od jednog sprata ostaje niska, ali visoki blokovi nisu svi isti.
  const odstupanje = Math.floor(slucajno() * 3) - 1;
  return Math.max(1, s + (s >= 2 ? odstupanje : 0));
}

export interface Zgrada {
  /** Osnova, u smjeru kazaljke, bez ponovljene posljednje tačke. */
  osnova: Point[];
  /** Visina do vrha krova [m]. */
  visina: number;
  spratova: number;
  /** Da li je visina procijenjena (OSM je nema). */
  procijenjena: boolean;
  grupa: GrupaZgrade;
  krov: string;
  zid: string;
  detalj: string;
  sjeme: number;
}

const uPoligonu = (t: readonly Point[], x: number, y: number): boolean => {
  let u = false;
  for (let i = 0, j = t.length - 1; i < t.length; j = i++) {
    const a = t[i]!;
    const b = t[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) u = !u;
  }
  return u;
};

/** Paleta zgrade: zona u kojoj joj je težište, ili po grupi. */
function paletaZa(palete: Palete, zone: readonly ZonaPalete[], grupa: GrupaZgrade, c: Point): Paleta {
  for (const z of zone) {
    if (!z.paleta || z.poligon.length < 3) continue;
    const t = z.poligon.map(([x, y]) => ({ x, y }));
    if (uPoligonu(t, c.x, c.y)) {
      const p = palete.palete[z.paleta];
      if (p) return p;
    }
  }
  return palete.palete[palete.automatski[grupa]] ?? Object.values(palete.palete)[0]!;
}

const izaberi = <T>(niz: readonly T[], r: () => number): T => niz[Math.floor(r() * niz.length) % niz.length]!;

/**
 * Zgrada `i` iz paketa: osnova odmaknuta od proširenih ulica, visina, paleta.
 * `null` za osnovu koja se ne može nacrtati (manje od tri tačke, nulta površina).
 */
export function zgrada(
  paket: Paket,
  i: number,
  povrsina: Povrsina | null,
  palete: Palete,
  zone: readonly ZonaPalete[],
): Zgrada | null {
  const n = paket.n;
  let osnova: Point[] = [];
  for (let k = n.zgOd[i]!; k < n.zgOd[i + 1]!; k++) osnova.push({ x: n.zgXY[2 * k]!, y: n.zgXY[2 * k + 1]! });
  if (osnova.length < 3) return null;
  const sjeme = sjemeZgrade(osnova[0]!.x, osnova[0]!.y);
  if (povrsina) osnova = osnova.map((p) => odmakniOdUlice(povrsina, p));
  let pov = povrsinaSaZnakom(osnova);
  if (Math.abs(pov) < 1) return null;
  if (pov < 0) {
    osnova.reverse();
    pov = -pov;
  }

  const r = rng(sjeme);
  const vrsta = paket.zaglavlje.vrsteZgrada[n.zgVrsta[i]!] ?? "yes";
  const visinaOsm = n.zgVisina[i]! / 10;
  const spratoviOsm = n.zgSpratovi[i]!;
  let spratova: number;
  let visina: number;
  let procijenjena = false;
  if (visinaOsm > 0) {
    visina = visinaOsm;
    spratova = Math.max(1, Math.round(visinaOsm / GRAD_SPRAT));
  } else if (spratoviOsm > 0) {
    spratova = spratoviOsm;
    visina = spratova * GRAD_SPRAT + GRAD_KROV;
  } else {
    spratova = procijenjeniSpratovi(vrsta, pov, r);
    visina = spratova * GRAD_SPRAT + GRAD_KROV;
    procijenjena = true;
  }
  const grupa = grupaZgrade(vrsta, spratova, pov);
  let cx = 0;
  let cy = 0;
  for (const p of osnova) {
    cx += p.x;
    cy += p.y;
  }
  const paleta = paletaZa(palete, zone, grupa, { x: cx / osnova.length, y: cy / osnova.length });
  return {
    osnova,
    visina,
    spratova,
    procijenjena,
    grupa,
    krov: izaberi(paleta.krov, r),
    zid: izaberi(paleta.zid, r),
    detalj: izaberi(paleta.detalj, r),
    sjeme,
  };
}

// ── geometrija za grafički čip ──────────────────────────────────────────────

/** Trouglovi prstena `[x0, y0, x1, y1, …]` → indeksi (Pixi `earcut`). */
export type Triangulacija = (ravno: number[]) => number[];

/**
 * Nizovi temena jednog sloja: položaj, visina (0 je tlo), boja (0–1) i indeksi
 * trouglova. Visina ide u shader, koji po njoj naginje teme.
 */
export interface Temena {
  polozaj: Float32Array;
  visina: Float32Array;
  boja: Float32Array;
  /**
   * Na zidu sa prozorima: metri duž zida od njegovog početka — shader po njima
   * i po visini crta prozore. `−1` za krov, detalje i zidove bez prozora.
   */
  zid: Float32Array;
  indeksi: Uint32Array;
}

class Graditelj {
  p: number[] = [];
  v: number[] = [];
  b: number[] = [];
  z: number[] = [];
  i: number[] = [];
  teme(x: number, y: number, h: number, boja: readonly [number, number, number], zid = -1): number {
    this.p.push(x, y);
    this.v.push(h);
    this.b.push(boja[0], boja[1], boja[2]);
    this.z.push(zid);
    return this.v.length - 1;
  }
  gotovo(): Temena {
    return {
      polozaj: new Float32Array(this.p),
      visina: new Float32Array(this.v),
      boja: new Float32Array(this.b),
      zid: new Float32Array(this.z),
      indeksi: new Uint32Array(this.i),
    };
  }
}

export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
const puta = (c: readonly [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Prizma: zidovi od visine `od` do `do_`, pa krov na `do_`. Zidovi se osvjetljavaju
 * po tome koliko gledaju ka suncu — strana u sjenci je tamnija. Sa `prozori`
 * zid nosi metre duž sebe, po kojima shader crta prozore.
 */
function prizma(
  g: Graditelj,
  osnova: readonly Point[],
  od: number,
  do_: number,
  zid: readonly [number, number, number],
  krov: readonly [number, number, number],
  triangulisi: Triangulacija,
  prozori = false,
): void {
  const n = osnova.length;
  for (let k = 0; k < n; k++) {
    const a = osnova[k]!;
    const b = osnova[(k + 1) % n]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    // Osnova ide u smjeru kazaljke (`y` na jug): spoljna normala je lijevo od ivice.
    const nx = dy / d;
    const ny = -dx / d;
    // Sunce sija suprotno od pravca sjenke.
    const kaSuncu = -(nx * GRAD_SJENKA_PRAVAC.x + ny * GRAD_SJENKA_PRAVAC.y);
    const boja = puta(zid, 0.68 + 0.22 * Math.max(0, kaSuncu));
    const z0 = prozori ? 0 : -1;
    const z1 = prozori ? d : -1;
    const i0 = g.teme(a.x, a.y, od, boja, z0);
    const i1 = g.teme(b.x, b.y, od, boja, z1);
    const i2 = g.teme(b.x, b.y, do_, boja, z1);
    const i3 = g.teme(a.x, a.y, do_, boja, z0);
    g.i.push(i0, i1, i2, i0, i2, i3);
  }
  const ravno: number[] = [];
  for (const p of osnova) ravno.push(p.x, p.y);
  const prvi = g.v.length;
  for (const p of osnova) g.teme(p.x, p.y, do_, krov);
  for (const t of triangulisi(ravno)) g.i.push(prvi + t);
}

/** Pravougaonik `sirina × duzina` oko (`x`, `y`), okrenut za `ugao`, u smjeru kazaljke. */
function pravougaonik(x: number, y: number, sirina: number, duzina: number, ugao: number): Point[] {
  const c = Math.cos(ugao);
  const s = Math.sin(ugao);
  return (
    [
      [-duzina / 2, -sirina / 2],
      [duzina / 2, -sirina / 2],
      [duzina / 2, sirina / 2],
      [-duzina / 2, sirina / 2],
    ] as const
  ).map(([u, w]) => ({ x: x + u * c - w * s, y: y + u * s + w * c }));
}

/** Vrste detalja na krovu po grupi: [širina, dužina, visina] u metrima. */
const DETALJI: Record<GrupaZgrade, readonly (readonly [number, number, number])[]> = {
  kuca: [[0.6, 0.6, 1.2]], // dimnjak
  blok: [
    [0.8, 1.0, 0.8], // klima
    [1.6, 1.6, 1.5], // rezervoar
    [2.4, 2.0, 2.2], // izlaz na krov
  ],
  poslovna: [
    [1.2, 1.6, 1.0],
    [0.8, 1.0, 0.8],
  ],
  industrija: [
    [1.4, 1.4, 1.2], // ventilacija
    [0.8, 1.0, 0.8],
  ],
  javna: [[0.8, 1.0, 0.8]],
  ostalo: [[0.8, 1.0, 0.8]],
};

/** Detalji na krovu — mjesta biraju sjeme; detalj mora cio da stane na krov. */
function detaljiKrova(z: Zgrada, pov: number): { oblik: Point[]; visina: number }[] {
  const r = rng(z.sjeme ^ 0x5bd1e995);
  const broj = Math.min(GRAD_DETALJA_NAJVISE, Math.floor(pov / GRAD_DETALJ_POVRSINA));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of z.osnova) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  // Detalji se ređaju uz najdužu ivicu, kao i zgrada.
  let ugao = 0;
  let najduza = 0;
  for (let k = 0; k < z.osnova.length; k++) {
    const a = z.osnova[k]!;
    const b = z.osnova[(k + 1) % z.osnova.length]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > najduza) {
      najduza = d;
      ugao = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  const izlaz: { oblik: Point[]; visina: number }[] = [];
  const vrste = DETALJI[z.grupa];
  for (let k = 0; k < broj; k++) {
    const [sirina, duzina, visina] = izaberi(vrste, r);
    // Nekoliko pokušaja da detalj stane; ako ne stane, preskače se.
    for (let pokusaj = 0; pokusaj < 6; pokusaj++) {
      const x = minX + r() * (maxX - minX);
      const y = minY + r() * (maxY - minY);
      const oblik = pravougaonik(x, y, sirina, duzina, ugao);
      if (oblik.every((p) => uPoligonu(z.osnova, p.x, p.y))) {
        izlaz.push({ oblik, visina });
        break;
      }
    }
  }
  return izlaz;
}

/**
 * Geometrija zgrada jednog tile-a: zidovi, krovovi i detalji u jednom nizu,
 * od najniže zgrade ka najvišoj — viša zgrada se naginje preko niže, pa se
 * crta posljednja. Unutar zgrade zidovi idu prije krova, koji prekrije
 * zadnje zidove.
 */
export function geometrijaZgrada(zgrade: readonly Zgrada[], triangulisi: Triangulacija): Temena {
  const g = new Graditelj();
  const redom = [...zgrade].sort((a, b) => a.visina - b.visina || a.sjeme - b.sjeme);
  for (const z of redom) {
    const krov = rgb(z.krov);
    // Hale i magacini su bez prozora; sve ostalo ih ima po spratovima.
    prizma(g, z.osnova, 0, z.visina, rgb(z.zid), krov, triangulisi, z.grupa !== "industrija");
    const boja = rgb(z.detalj);
    for (const d of detaljiKrova(z, povrsinaSaZnakom(z.osnova))) {
      prizma(g, d.oblik, z.visina, z.visina + d.visina, puta(boja, 0.85), boja, triangulisi);
    }
  }
  return g.gotovo();
}

/**
 * Sjenke zgrada jednog tile-a — na tlu, pa bez visine. Sjenka prizme je njena
 * osnova povučena u pravcu sjenke: osnova pomjerena za dužinu sjenke, i po
 * četvorougao za svaku ivicu. Dijelovi se preklapaju; crtač ih zato boji
 * punom bojom, a providnost daje cijelom sloju odjednom, da preklop ne bude
 * tamniji.
 */
export function geometrijaSjenki(zgrade: readonly Zgrada[], triangulisi: Triangulacija): Temena {
  const g = new Graditelj();
  const crna: [number, number, number] = [0, 0, 0];
  for (const z of zgrade) {
    const sx = GRAD_SJENKA_PRAVAC.x * z.visina * GRAD_SJENKA_DUZINA;
    const sy = GRAD_SJENKA_PRAVAC.y * z.visina * GRAD_SJENKA_DUZINA;
    const n = z.osnova.length;
    for (let k = 0; k < n; k++) {
      const a = z.osnova[k]!;
      const b = z.osnova[(k + 1) % n]!;
      const i0 = g.teme(a.x, a.y, 0, crna);
      const i1 = g.teme(b.x, b.y, 0, crna);
      const i2 = g.teme(b.x + sx, b.y + sy, 0, crna);
      const i3 = g.teme(a.x + sx, a.y + sy, 0, crna);
      g.i.push(i0, i1, i2, i0, i2, i3);
    }
    const ravno: number[] = [];
    for (const p of z.osnova) ravno.push(p.x + sx, p.y + sy);
    const prvi = g.v.length;
    for (let k = 0; k < n; k++) g.teme(ravno[2 * k]!, ravno[2 * k + 1]!, 0, crna);
    for (const t of triangulisi(ravno)) g.i.push(prvi + t);
  }
  return g.gotovo();
}
