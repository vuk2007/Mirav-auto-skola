import {
  GRAD_OVERLAY_ZEBRA,
  GRAD_PUNA_PRIJE_NAJVISE,
  GRAD_SIDRO_CVOR,
  GRAD_SIDRO_PRELAZ,
  GRAD_SIDRO_ULICE,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Manevar, Mreza } from "./mreza";
import {
  BEZ,
  IVICA_BUS_NAPRIJED,
  IVICA_BUS_NAZAD,
  IVICA_UKLONJENA,
  IVICA_VOZNA,
  IVICA_ZATVORENA,
  LINIJA_BEZ,
  LINIJA_DVOSTRUKA,
  LINIJA_ISPREKIDANA,
  LINIJA_PUNA,
  type Nizovi,
  type Paket,
} from "./paket";

/**
 * Overlay grada (faza 6, stavka 6): ručne izmjene preko OSM podataka, koje
 * pravi editor. OSM fajlovi se nikad ne mijenjaju — overlay se primjenjuje
 * na paket pri učitavanju, i ima prednost u svakom polju koje dira.
 *
 * Izmjena se ne veže za indeks ivice ili čvora (oni se mijenjaju sa svakim
 * novim paketom iz OSM-a) nego za SIDRO: tačku, OSM id puta i pravac. Pri
 * učitavanju se sidro veže za najbližu ulicu tog puta; izmjena čije se sidro
 * ne može vezati je „nevezana" — ne primjenjuje se, a editor je pokazuje.
 *
 * Primjena ide u dva sloja:
 *  1. `primijeniNaPaket` — paket u paket: geometrija (čvor, nova ulica,
 *     uklanjanje), dionica (smjer, trake, strelice, linije, bus traka,
 *     zatvorena), pješački prelazi i znakovi uz ulicu;
 *  2. `pravilaOverlaya` — nad mrežom novog paketa: kontrola sa kraka (STOP,
 *     trougao, glavni put), planovi semafora, znakovi skretanja i zabrane
 *     ulaska — to ide u model raskrsnice (`napraviRaskrsnice`).
 *
 * Podaci su pod ODbL kao i OSM iz kojeg su izvedeni.
 */

export const VERZIJA_OVERLAYA = 1;
export const LICENCA_OVERLAYA = "ODbL 1.0 — izmjene preko podataka © OpenStreetMap saradnici";

// ── sidra ────────────────────────────────────────────────────────────────

export interface SidroCvora {
  x: number;
  y: number;
}

/**
 * Mjesto na ulici: tačka na njoj, OSM id puta (0 za ulicu iz overlay-a) i
 * pravac duž ulice (jedinični vektor) — po njemu se zna „naprijed".
 */
export interface SidroUlice {
  osm: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
}

/** Krak raskrsnice: čvor u kojem ulica dodiruje raskrsnicu, i tačka na toj ulici. */
export interface SidroKraka {
  raskrsnica: SidroCvora;
  ulica: SidroUlice;
}

/**
 * Broj kakav ostaje isti kroz JSON: zaokružen, i nikad `-0` (JSON ga piše kao
 * 0, pa sačuvano ne bi bilo jednako učitanom).
 */
const okruglo = (x: number, korak: number) => Math.round(x / korak) * korak + 0;

/** Tačka zaokružena na centimetar — tako je editor upisuje. */
export function tackaOverlaya(p: Point): Point {
  return { x: okruglo(p.x, 0.01), y: okruglo(p.y, 0.01) };
}

/** Sidro ulice kako ga editor upisuje: tačka na centimetar, pravac na 1/10 000. */
export function sidroUlice(osm: number, p: Point, h: Point): SidroUlice {
  const l = Math.hypot(h.x, h.y) || 1;
  return { osm, ...tackaOverlaya(p), hx: okruglo(h.x / l, 1e-4), hy: okruglo(h.y / l, 1e-4) };
}

// ── izmjene ──────────────────────────────────────────────────────────────

/** Kontrola ulaska sa kraka: znak STOP, trougao, glavni put, ili bez znaka (pravilo desne strane). */
export type KontrolaOverlaya = "stop" | "ustupi" | "glavni" | "desna";

/** Znak skretanja na kraku: zabrana nekih manevara, ili obavezan smjer (dozvoljeni su samo navedeni). */
export interface ZnakSkretanja {
  vrsta: "zabrana" | "obavezno";
  manevri: Manevar[];
}

/** Znakovi uz ulicu, u smjeru vožnje — ne na kraku raskrsnice. */
export type ZnakNaUlici =
  | "brzina"
  | "krajGlavnog"
  | "zabranaPreticanja"
  | "krajZabranePreticanja"
  | "skolskaZona"
  | "djeca";

export const ZNAKOVI_NA_ULICI: readonly ZnakNaUlici[] = [
  "brzina",
  "krajGlavnog",
  "zabranaPreticanja",
  "krajZabranePreticanja",
  "skolskaZona",
  "djeca",
];

export interface FazaOverlaya {
  /** Trajanje zelenog [s]. */
  zeleno: number;
  /** Krakovi sa zelenim: za sve manevre (`null`), ili samo za navedene (svjetlo sa strelicom). */
  kraci: { krak: SidroKraka; manevri: Manevar[] | null }[];
  /** Zelena dopunska strelica: kretanje u njenom pravcu, uz ustupanje, dok je glavno svjetlo crveno. */
  strelice: { krak: SidroKraka; manevri: Manevar[] }[];
  /** Zeleno za pješake preko ovih krakova (stavka 8). */
  pjesaci: SidroKraka[];
}

export interface PlanOverlaya {
  faze: FazaOverlaya[];
  /** Žuto i „sve crveno" poslije svake faze [s]. */
  zuto: number;
  sveCrveno: number;
  /** Pomak ciklusa [s] — zeleni talas: susjedni semafori bulevara pomaknuti za vrijeme vožnje između njih. */
  pomak: number;
}

/** Polja dionice — sva neobavezna: overlay mijenja samo ono što navede. Pravac je pravac sidra. */
export interface PoljaDionice {
  /** `oba`: dvosmjerna; `naprijed`/`nazad`: jednosmjerna u pravcu sidra / suprotno. */
  smjer?: "oba" | "naprijed" | "nazad";
  trakeNaprijed?: number;
  trakeNazad?: number;
  /** Strelice po trakama (OSM `turn:lanes`, lijevo nadesno), u pravcu sidra i suprotno. */
  skretanjaNaprijed?: string;
  skretanjaNazad?: string;
  /** Krajnja desna traka je autobuska. */
  busNaprijed?: boolean;
  busNazad?: boolean;
  /** Razdjelna linija smjerova. */
  linija?: "isprekidana" | "puna" | "dvostruka" | "bez";
  /** Metara pune razdjelne linije pred raskrsnicom na oba kraja. */
  punaPrije?: number;
  /** Metara punih linija između traka istog smjera pred raskrsnicom. */
  trakePrije?: number;
  /** Gradilište / zatvoreno za auta (`true`), ili otvoreno za vožnju (`false`). */
  zatvorena?: boolean;
  ime?: string;
  klasa?: string;
}

export interface Zona {
  id: string;
  ime: string;
  /** Tjemena `[x, y]` u lokalnim metrima paketa (kao šablon zona); prazan dok zona nije nacrtana. */
  poligon: [number, number][];
  paleta: string | null;
  speedLimit: number | null;
  pedestrianDensity: number | null;
  trafficDensity: number | null;
  handAuthored: boolean;
}

export interface Zadatak {
  id: string;
  ime: string;
  vrsta: "odDo" | "ispitna";
  start: SidroUlice;
  cilj: SidroUlice;
  /** Obavezne tačke, redom. */
  tacke: SidroUlice[];
  /** Manevri na ruti (ispitna vožnja): parkiranje, polukružno, kretanje uz uspon. */
  manevri: { vrsta: "parkiranje" | "polukruzno" | "uspon"; mjesto: SidroUlice }[];
}

interface Osnova {
  id: string;
  autor: string;
  /** ISO datum i vrijeme izmjene. */
  datum: string;
  napomena?: string;
}

export type Izmjena = Osnova &
  (
    | { vrsta: "kontrola"; krak: SidroKraka; kontrola: KontrolaOverlaya }
    | { vrsta: "skretanje"; krak: SidroKraka; znak: ZnakSkretanja | null }
    | { vrsta: "zabranaUlaska"; krak: SidroKraka }
    | { vrsta: "semafor"; raskrsnica: SidroCvora; plan: PlanOverlaya | null }
    | { vrsta: "znak"; znak: ZnakNaUlici; mjesto: SidroUlice; brzina: number | null }
    | ({ vrsta: "dionica"; ulica: SidroUlice } & PoljaDionice)
    | { vrsta: "prelaz"; mjesto: SidroUlice; ukloni: boolean }
    | { vrsta: "cvor"; cvor: SidroCvora; na: Point }
    | { vrsta: "novaUlica"; tacke: Point[]; klasa: string; ime: string; smjer: 0 | 1; trake: number }
    | { vrsta: "ukloniUlicu"; ulica: SidroUlice }
    | { vrsta: "zona"; zona: Zona }
    | { vrsta: "zadatak"; zadatak: Zadatak }
  );

export type VrstaIzmjene = Izmjena["vrsta"];

export interface Overlay {
  verzija: number;
  grad: string;
  licenca: string;
  /** Ishodište lokalnih metara paketa za koji su sidra — mora biti isto kao u paketu. */
  ishodiste: { lat: number; lon: number };
  izmjene: Izmjena[];
}

/** Izmjena koja se nije mogla primijeniti, i zašto — editor je pokazuje. */
export interface Nevezana {
  id: string;
  vrsta: VrstaIzmjene;
  razlog: string;
}

export function prazanOverlay(grad: string, ishodiste: { lat: number; lon: number }): Overlay {
  return { verzija: VERZIJA_OVERLAYA, grad, licenca: LICENCA_OVERLAYA, ishodiste, izmjene: [] };
}

// ── čitanje i pisanje ────────────────────────────────────────────────────

class GreskaOverlaya extends Error {}

function provjeri(uslov: unknown, gdje: string, sta: string): asserts uslov {
  if (!uslov) throw new GreskaOverlaya(`overlay: ${gdje}: ${sta}`);
}

const jeBroj = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const jeTekst = (x: unknown): x is string => typeof x === "string";
const jeObjekat = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const MANEVRI: readonly Manevar[] = ["lijevo", "pravo", "desno", "polukruzno"];

function provjeriTacku(x: unknown, gdje: string): void {
  provjeri(jeObjekat(x) && jeBroj(x.x) && jeBroj(x.y), gdje, "tačka mora imati brojeve x i y");
}
function provjeriSidroUlice(x: unknown, gdje: string): void {
  provjeriTacku(x, gdje);
  const o = x as Record<string, unknown>;
  provjeri(jeBroj(o.osm) && o.osm >= 0 && jeBroj(o.hx) && jeBroj(o.hy), gdje, "sidro ulice mora imati osm, hx, hy");
}
function provjeriSidroKraka(x: unknown, gdje: string): void {
  provjeri(jeObjekat(x), gdje, "krak nije objekat");
  provjeriTacku(x.raskrsnica, `${gdje}.raskrsnica`);
  provjeriSidroUlice(x.ulica, `${gdje}.ulica`);
}
function provjeriManevre(x: unknown, gdje: string): void {
  provjeri(Array.isArray(x) && x.length > 0 && x.every((m) => MANEVRI.includes(m as Manevar)), gdje, "manevri su lijevo/pravo/desno/polukruzno");
}

function provjeriIzmjenu(x: unknown, i: number): void {
  const g = `izmjene[${i}]`;
  provjeri(jeObjekat(x), g, "nije objekat");
  provjeri(jeTekst(x.id) && x.id.length > 0, g, "nema id");
  provjeri(jeTekst(x.autor) && jeTekst(x.datum), g, "nema autora ili datum");
  switch (x.vrsta) {
    case "kontrola":
      provjeriSidroKraka(x.krak, `${g}.krak`);
      provjeri(["stop", "ustupi", "glavni", "desna"].includes(x.kontrola as string), g, "nepoznata kontrola");
      return;
    case "skretanje":
      provjeriSidroKraka(x.krak, `${g}.krak`);
      if (x.znak !== null) {
        provjeri(jeObjekat(x.znak) && (x.znak.vrsta === "zabrana" || x.znak.vrsta === "obavezno"), g, "znak skretanja");
        provjeriManevre(x.znak.manevri, `${g}.znak.manevri`);
      }
      return;
    case "zabranaUlaska":
      provjeriSidroKraka(x.krak, `${g}.krak`);
      return;
    case "semafor": {
      provjeriTacku(x.raskrsnica, `${g}.raskrsnica`);
      if (x.plan === null) return;
      const p = x.plan;
      provjeri(jeObjekat(p) && Array.isArray(p.faze) && p.faze.length > 0, g, "plan bez faza");
      provjeri(jeBroj(p.zuto) && p.zuto >= 0 && jeBroj(p.sveCrveno) && p.sveCrveno >= 0 && jeBroj(p.pomak), g, "žuto, sve crveno, pomak");
      (p.faze as unknown[]).forEach((f, j) => {
        const gf = `${g}.plan.faze[${j}]`;
        provjeri(jeObjekat(f) && jeBroj(f.zeleno) && f.zeleno > 0, gf, "zeleno mora biti pozitivno");
        provjeri(Array.isArray(f.kraci) && Array.isArray(f.strelice) && Array.isArray(f.pjesaci), gf, "kraci, strelice, pjesaci");
        (f.kraci as unknown[]).forEach((k, m) => {
          provjeri(jeObjekat(k), `${gf}.kraci[${m}]`, "nije objekat");
          provjeriSidroKraka(k.krak, `${gf}.kraci[${m}].krak`);
          if (k.manevri !== null) provjeriManevre(k.manevri, `${gf}.kraci[${m}].manevri`);
        });
        (f.strelice as unknown[]).forEach((k, m) => {
          provjeri(jeObjekat(k), `${gf}.strelice[${m}]`, "nije objekat");
          provjeriSidroKraka(k.krak, `${gf}.strelice[${m}].krak`);
          provjeriManevre(k.manevri, `${gf}.strelice[${m}].manevri`);
        });
        (f.pjesaci as unknown[]).forEach((k, m) => provjeriSidroKraka(k, `${gf}.pjesaci[${m}]`));
      });
      return;
    }
    case "znak":
      provjeri(ZNAKOVI_NA_ULICI.includes(x.znak as ZnakNaUlici), g, "nepoznat znak");
      provjeriSidroUlice(x.mjesto, `${g}.mjesto`);
      provjeri(x.znak === "brzina" ? jeBroj(x.brzina) && x.brzina > 0 : x.brzina === null, g, "brzina samo uz znak ograničenja");
      return;
    case "dionica": {
      provjeriSidroUlice(x.ulica, `${g}.ulica`);
      const trake = (v: unknown) => v === undefined || (jeBroj(v) && Number.isInteger(v) && v >= 0 && v <= 8);
      provjeri(x.smjer === undefined || ["oba", "naprijed", "nazad"].includes(x.smjer as string), g, "smjer");
      provjeri(trake(x.trakeNaprijed) && trake(x.trakeNazad), g, "trake 0–8");
      provjeri(x.skretanjaNaprijed === undefined || jeTekst(x.skretanjaNaprijed), g, "skretanjaNaprijed");
      provjeri(x.skretanjaNazad === undefined || jeTekst(x.skretanjaNazad), g, "skretanjaNazad");
      for (const k of ["busNaprijed", "busNazad", "zatvorena"]) {
        provjeri(x[k] === undefined || typeof x[k] === "boolean", g, `${k} mora biti da/ne`);
      }
      provjeri(x.linija === undefined || ["isprekidana", "puna", "dvostruka", "bez"].includes(x.linija as string), g, "linija");
      for (const k of ["punaPrije", "trakePrije"]) {
        const v = x[k];
        provjeri(v === undefined || (jeBroj(v) && v >= 0 && v <= GRAD_PUNA_PRIJE_NAJVISE), g, `${k} 0–${GRAD_PUNA_PRIJE_NAJVISE} m`);
      }
      provjeri(x.ime === undefined || jeTekst(x.ime), g, "ime");
      provjeri(x.klasa === undefined || (jeTekst(x.klasa) && x.klasa.length > 0), g, "klasa");
      return;
    }
    case "prelaz":
      provjeriSidroUlice(x.mjesto, `${g}.mjesto`);
      provjeri(typeof x.ukloni === "boolean", g, "ukloni mora biti da/ne");
      return;
    case "cvor":
      provjeriTacku(x.cvor, `${g}.cvor`);
      provjeriTacku(x.na, `${g}.na`);
      return;
    case "novaUlica":
      provjeri(Array.isArray(x.tacke) && x.tacke.length >= 2, g, "nova ulica ima bar dvije tačke");
      (x.tacke as unknown[]).forEach((t, j) => provjeriTacku(t, `${g}.tacke[${j}]`));
      provjeri(jeTekst(x.klasa) && x.klasa.length > 0 && jeTekst(x.ime), g, "klasa i ime");
      provjeri(x.smjer === 0 || x.smjer === 1, g, "smjer 0 ili 1");
      provjeri(jeBroj(x.trake) && Number.isInteger(x.trake) && x.trake >= 1 && x.trake <= 8, g, "trake 1–8");
      return;
    case "ukloniUlicu":
      provjeriSidroUlice(x.ulica, `${g}.ulica`);
      return;
    case "zona": {
      const z = x.zona;
      provjeri(jeObjekat(z) && jeTekst(z.id) && z.id.length > 0 && jeTekst(z.ime), g, "zona: id i ime");
      provjeri(Array.isArray(z.poligon), g, "zona: poligon");
      (z.poligon as unknown[]).forEach((t, j) =>
        provjeri(Array.isArray(t) && t.length === 2 && jeBroj(t[0]) && jeBroj(t[1]), `${g}.zona.poligon[${j}]`, "tjeme je [x, y]"),
      );
      provjeri(z.paleta === null || jeTekst(z.paleta), g, "zona: paleta");
      for (const k of ["speedLimit", "pedestrianDensity", "trafficDensity"]) {
        provjeri(z[k] === null || (jeBroj(z[k]) && (z[k] as number) >= 0), g, `zona: ${k}`);
      }
      provjeri(typeof z.handAuthored === "boolean", g, "zona: handAuthored");
      return;
    }
    case "zadatak": {
      const z = x.zadatak;
      provjeri(jeObjekat(z) && jeTekst(z.id) && jeTekst(z.ime), g, "zadatak: id i ime");
      provjeri(z.vrsta === "odDo" || z.vrsta === "ispitna", g, "zadatak: vrsta");
      provjeriSidroUlice(z.start, `${g}.zadatak.start`);
      provjeriSidroUlice(z.cilj, `${g}.zadatak.cilj`);
      provjeri(Array.isArray(z.tacke) && Array.isArray(z.manevri), g, "zadatak: tacke i manevri");
      (z.tacke as unknown[]).forEach((t, j) => provjeriSidroUlice(t, `${g}.zadatak.tacke[${j}]`));
      (z.manevri as unknown[]).forEach((m, j) => {
        provjeri(jeObjekat(m) && ["parkiranje", "polukruzno", "uspon"].includes(m.vrsta as string), g, `zadatak: manevri[${j}]`);
        provjeriSidroUlice(m.mjesto, `${g}.zadatak.manevri[${j}].mjesto`);
      });
      return;
    }
    default:
      provjeri(false, g, `nepoznata vrsta izmjene „${String(x.vrsta)}"`);
  }
}

/** Overlay iz JSON-a (već raščlanjenog), uz provjeru oblika svake izmjene. Greška kaže gdje. */
export function procitajOverlay(x: unknown): Overlay {
  provjeri(jeObjekat(x), "fajl", "nije JSON objekat");
  provjeri(x.verzija === VERZIJA_OVERLAYA, "verzija", `igra čita verziju ${VERZIJA_OVERLAYA}, fajl je ${String(x.verzija)}`);
  provjeri(jeTekst(x.grad) && jeTekst(x.licenca), "zaglavlje", "grad i licenca");
  provjeri(jeObjekat(x.ishodiste) && jeBroj(x.ishodiste.lat) && jeBroj(x.ishodiste.lon), "ishodiste", "lat i lon");
  provjeri(Array.isArray(x.izmjene), "izmjene", "nije niz");
  const ids = new Set<string>();
  (x.izmjene as unknown[]).forEach((iz, i) => {
    provjeriIzmjenu(iz, i);
    const id = (iz as { id: string }).id;
    provjeri(!ids.has(id), `izmjene[${i}]`, `id „${id}" se ponavlja`);
    ids.add(id);
  });
  return x as unknown as Overlay;
}

/** Overlay u tekst fajla: JSON sa uvlačenjem, da se izmjene čitaju u git diff-u. */
export function zapisiOverlay(o: Overlay): string {
  return `${JSON.stringify(o, null, 2)}\n`;
}

/** Da li overlay pripada paketu: ista sidra imaju smisla samo u istom koordinatnom sistemu. */
export function provjeriIshodiste(o: Overlay, p: Paket): void {
  const i = p.zaglavlje.ishodiste;
  if (!i) return;
  provjeri(
    Math.abs(i.lat - o.ishodiste.lat) < 1e-9 && Math.abs(i.lon - o.ishodiste.lon) < 1e-9,
    "ishodiste",
    `overlay je za ishodište ${o.ishodiste.lat},${o.ishodiste.lon}, paket ima ${i.lat},${i.lon}`,
  );
}

// ── vezivanje sidara ─────────────────────────────────────────────────────

/** Ono što vezivanje sidra treba od mreže — ista funkcija radi nad paketom u izradi i nad gotovom mrežom. */
export interface PogledMreze {
  cvorovi: Point[];
  ivice: { a: number; b: number; tacke: Point[]; osm: number; vozna: boolean; uklonjena: boolean }[];
  izCvora: number[][];
}

/** Najbliža tačka izlomljene linije: rastojanje, `s` od početka i pravac segmenta. */
function naLiniji(tacke: Point[], p: Point): { d: number; s: number; hx: number; hy: number } {
  let naj = { d: Infinity, s: 0, hx: 1, hy: 0 };
  let s0 = 0;
  for (let k = 0; k + 1 < tacke.length; k++) {
    const a = tacke[k]!;
    const b = tacke[k + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    const t = l > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (l * l))) : 0;
    const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
    if (d < naj.d) naj = { d, s: s0 + l * t, hx: l > 0 ? dx / l : 1, hy: l > 0 ? dy / l : 0 };
    s0 += l;
  }
  return naj;
}

/**
 * Ivice po OSM id-u puta — da sidro ne pretražuje cijelu mrežu. Pamti se po
 * mreži i broju ivica: kad sloj 1 doda ili podijeli ivicu, indeks se pravi
 * ponovo.
 */
const indeksi = new WeakMap<PogledMreze, { n: number; po: Map<number, number[]> }>();
function iviceOsm(m: PogledMreze, osm: number): number[] {
  let x = indeksi.get(m);
  if (!x || x.n !== m.ivice.length) {
    const po = new Map<number, number[]>();
    m.ivice.forEach((iv, i) => {
      const l = po.get(iv.osm);
      if (l) l.push(i);
      else po.set(iv.osm, [i]);
    });
    x = { n: m.ivice.length, po };
    indeksi.set(m, x);
  }
  return x.po.get(osm) ?? [];
}

/**
 * Ivica za sidro ulice: najbliža ivica istog OSM puta (ili bilo koja, za
 * ulicu iz overlay-a), ne dalja od `GRAD_SIDRO_ULICE`. `naprijed`: da li je
 * pravac sidra niz ivicu (`a → b`).
 */
export function vezaniUlica(m: PogledMreze, sidro: SidroUlice): { ivica: number; s: number; naprijed: boolean } | null {
  let naj: { ivica: number; s: number; naprijed: boolean; d: number } | null = null;
  const kandidati = sidro.osm !== 0 ? iviceOsm(m, sidro.osm) : m.ivice.map((_, i) => i);
  for (const i of kandidati) {
    const iv = m.ivice[i]!;
    if (iv.uklonjena) continue;
    const n = naLiniji(iv.tacke, sidro);
    if (n.d <= GRAD_SIDRO_ULICE && (!naj || n.d < naj.d)) {
      naj = { ivica: i, s: n.s, naprijed: n.hx * sidro.hx + n.hy * sidro.hy >= 0, d: n.d };
    }
  }
  return naj && { ivica: naj.ivica, s: naj.s, naprijed: naj.naprijed };
}

/** Čvor za sidro: najbliži, ne dalji od `GRAD_SIDRO_CVOR`. */
export function vezaniCvor(m: PogledMreze, sidro: SidroCvora): number | null {
  let naj = -1;
  let d = GRAD_SIDRO_CVOR;
  m.cvorovi.forEach((c, i) => {
    const di = Math.hypot(c.x - sidro.x, c.y - sidro.y);
    if (di <= d && (m.izCvora[i]?.length ?? 0) > 0) {
      d = di;
      naj = i;
    }
  });
  return naj >= 0 ? naj : null;
}

/** Krak za sidro: ivica i njen kraj (0 = `a`, 1 = `b`) u čvoru raskrsnice. Ključ kao u `Raskrsnice.krakIvice`. */
export function vezaniKrak(m: PogledMreze, sidro: SidroKraka): { ivica: number; kraj: 0 | 1; cvor: number } | null {
  const u = vezaniUlica(m, sidro.ulica);
  if (!u) return null;
  const iv = m.ivice[u.ivica]!;
  const c = vezaniCvor(m, sidro.raskrsnica);
  if (c !== null && (iv.a === c || iv.b === c)) return { ivica: u.ivica, kraj: iv.b === c ? 1 : 0, cvor: c };
  // Čvor se pomjerio ili je ivica podijeljena: kraj bliži sidru raskrsnice.
  const pa = m.cvorovi[iv.a]!;
  const pb = m.cvorovi[iv.b]!;
  const da = Math.hypot(pa.x - sidro.raskrsnica.x, pa.y - sidro.raskrsnica.y);
  const db = Math.hypot(pb.x - sidro.raskrsnica.x, pb.y - sidro.raskrsnica.y);
  if (Math.min(da, db) > GRAD_SIDRO_ULICE) return null;
  return db < da ? { ivica: u.ivica, kraj: 1, cvor: iv.b } : { ivica: u.ivica, kraj: 0, cvor: iv.a };
}

// ── sloj 1: paket u paket ────────────────────────────────────────────────

interface RadnaIvica {
  a: number;
  b: number;
  tacke: Point[];
  klasa: number;
  smjer: number;
  trake: number;
  naprijed: number;
  nazad: number;
  brzina: number;
  zastavice: number;
  sloj: number;
  ime: number;
  skretanja: number;
  skretanjaNazad: number;
  osm: number;
  linija: number;
  punaPrije: number;
  trakePrije: number;
  // za `PogledMreze`:
  vozna: boolean;
  uklonjena: boolean;
}

interface RadniObjekat {
  x: number;
  y: number;
  vrsta: number;
  podatak: number;
  ivica: number;
  s: number;
  cvor: number;
}

/** Paket rastavljen u nizove JS objekata — da se izmjene lako primijene, pa ponovo sastavi. */
class Radni implements PogledMreze {
  cvorovi: Point[];
  ivice: RadnaIvica[];
  izCvora: number[][];
  objekti: RadniObjekat[];
  zabrane: { vrsta: number; od: number; cvor: number; do_: number }[];
  stringovi: string[];
  klase: string[];
  vrsteObjekata: string[];
  private kodStringa: Map<string, number>;
  private p: Paket;

  // Polje `p` je napisano izričito: Node-ov TypeScript (QA skripte) ne čita
  // `constructor(private p)`.
  constructor(p: Paket) {
    this.p = p;
    const n = p.n;
    const z = p.zaglavlje;
    this.stringovi = [...z.stringovi];
    this.kodStringa = new Map(this.stringovi.map((s, i) => [s, i]));
    this.klase = [...z.klase];
    this.vrsteObjekata = [...(z.vrsteObjekata ?? [])];
    this.cvorovi = [];
    for (let k = 0; k < n.cvXY.length; k += 2) this.cvorovi.push({ x: n.cvXY[k]!, y: n.cvXY[k + 1]! });
    this.ivice = [];
    for (let i = 0; i < n.ivA.length; i++) {
      const tacke: Point[] = [];
      for (let k = n.ivOd[i]!; k < n.ivOd[i + 1]!; k++) tacke.push({ x: n.ivXY[2 * k]!, y: n.ivXY[2 * k + 1]! });
      const zastavice = n.ivZastavice[i]!;
      this.ivice.push({
        a: n.ivA[i]!,
        b: n.ivB[i]!,
        tacke,
        klasa: n.ivKlasa[i]!,
        smjer: n.ivSmjer[i]!,
        trake: n.ivTrake[i]!,
        naprijed: n.ivTrakeNaprijed[i]!,
        nazad: n.ivTrakeNazad[i]!,
        brzina: n.ivBrzina[i]!,
        zastavice,
        sloj: n.ivSloj[i]!,
        ime: n.ivIme[i]!,
        skretanja: n.ivTrakeSkretanja[i]!,
        skretanjaNazad: n.ivTrakeSkretanjaNazad[i]!,
        osm: n.ivOsm[i]!,
        linija: n.ivLinija[i] ?? 0,
        punaPrije: n.ivPunaPrije[i] ?? 0,
        trakePrije: n.ivTrakePrije[i] ?? 0,
        vozna: (zastavice & IVICA_VOZNA) !== 0,
        uklonjena: (zastavice & IVICA_UKLONJENA) !== 0,
      });
    }
    this.izCvora = this.cvorovi.map(() => []);
    this.ivice.forEach((iv, i) => {
      this.izCvora[iv.a]!.push(i);
      if (iv.b !== iv.a) this.izCvora[iv.b]!.push(i);
    });
    this.objekti = [];
    for (let o = 0; o < n.obVrsta.length; o++) {
      this.objekti.push({
        x: n.obXY[2 * o]!,
        y: n.obXY[2 * o + 1]!,
        vrsta: n.obVrsta[o]!,
        podatak: n.obPodatak[o]!,
        ivica: n.obIvica[o]!,
        s: n.obS[o]!,
        cvor: n.obCvor[o]!,
      });
    }
    this.zabrane = [];
    for (let r = 0; r < n.rsOd.length; r++) {
      this.zabrane.push({ vrsta: n.rsVrsta[r]!, od: n.rsOd[r]!, cvor: n.rsCvor[r]!, do_: n.rsDo[r]! });
    }
  }

  string(s: string): number {
    let k = this.kodStringa.get(s);
    if (k === undefined) {
      k = this.stringovi.length;
      this.stringovi.push(s);
      this.kodStringa.set(s, k);
    }
    return k;
  }

  klasa(ime: string): number {
    let k = this.klase.indexOf(ime);
    if (k < 0) {
      k = this.klase.length;
      this.klase.push(ime);
    }
    return k;
  }

  vrstaObjekta(ime: string): number {
    let k = this.vrsteObjekata.indexOf(ime);
    if (k < 0) {
      k = this.vrsteObjekata.length;
      this.vrsteObjekata.push(ime);
    }
    return k;
  }

  /** Vozni krajevi u čvoru — raskrsnica je čvor sa tri i više. */
  krajeva(c: number): number {
    let k = 0;
    for (const i of this.izCvora[c] ?? []) {
      const iv = this.ivice[i]!;
      if (iv.vozna) k += iv.a === iv.b ? 2 : 1;
    }
    return k;
  }

  zastavica(i: number, z: number, da: boolean): void {
    const iv = this.ivice[i]!;
    iv.zastavice = da ? iv.zastavice | z : iv.zastavice & ~z;
    iv.vozna = (iv.zastavice & IVICA_VOZNA) !== 0;
    iv.uklonjena = (iv.zastavice & IVICA_UKLONJENA) !== 0;
  }

  noviCvor(p: Point): number {
    this.cvorovi.push({ x: p.x, y: p.y });
    this.izCvora.push([]);
    return this.cvorovi.length - 1;
  }

  /**
   * Dijeli ivicu `i` u tački `s` od `a`: `i` ostaje od `a` do novog čvora, nova
   * ivica (ista svojstva) od njega do `b`. Objekti i zabrane prelaze na nju.
   */
  podijeli(i: number, s: number): number {
    const iv = this.ivice[i]!;
    const prvi: Point[] = [iv.tacke[0]!];
    const drugi: Point[] = [];
    let s0 = 0;
    let tacka: Point = iv.tacke[0]!;
    let uDrugom = false;
    for (let k = 0; k + 1 < iv.tacke.length; k++) {
      const a = iv.tacke[k]!;
      const b = iv.tacke[k + 1]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (!uDrugom && s0 + l >= s) {
        const t = l > 0 ? (s - s0) / l : 0;
        tacka = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        prvi.push(tacka);
        drugi.push(tacka);
        uDrugom = true;
        if (t < 1) drugi.push(b);
      } else if (uDrugom) drugi.push(b);
      else prvi.push(b);
      s0 += l;
    }
    const c = this.noviCvor(tacka);
    const nova: RadnaIvica = { ...iv, a: c, tacke: drugi };
    const j = this.ivice.length;
    this.ivice.push(nova);
    this.izCvora[iv.b] = this.izCvora[iv.b]!.map((x) => (x === i ? j : x));
    iv.tacke = prvi;
    const stariB = iv.b;
    iv.b = c;
    this.izCvora[c]!.push(i, j);
    for (const o of this.objekti) {
      if (o.ivica === i && o.s > s) {
        o.ivica = j;
        o.s -= s;
      }
    }
    for (const z of this.zabrane) {
      if (z.od === i && z.cvor === stariB) z.od = j;
      if (z.do_ === i && z.cvor === stariB) z.do_ = j;
    }
    return c;
  }

  /**
   * Dionica: ivica `i` i nastavak kroz čvorove koji nisu raskrsnice (tačno dva
   * vozna kraja), u oba smjera. Uz svaku ivicu: da li ide u pravcu prve.
   */
  dionica(i: number): { ivica: number; naprijed: boolean }[] {
    const izlaz = [{ ivica: i, naprijed: true }];
    const vidjeno = new Set([i]);
    for (const [pocetak, naprijed] of [
      [this.ivice[i]!.b, true],
      [this.ivice[i]!.a, false],
    ] as const) {
      let c = pocetak;
      let od = i;
      for (;;) {
        if (this.krajeva(c) !== 2) break;
        const dalje = (this.izCvora[c] ?? []).find((x) => x !== od && this.ivice[x]!.vozna && !vidjeno.has(x));
        if (dalje === undefined) break;
        const iv = this.ivice[dalje]!;
        // Niz pravac prve ivice: sljedeća počinje u `c`. Unazad: završava se u `c`.
        izlaz.push({ ivica: dalje, naprijed: naprijed ? iv.a === c : iv.b === c });
        vidjeno.add(dalje);
        od = dalje;
        c = iv.a === c ? iv.b : iv.a;
      }
    }
    return izlaz;
  }

  /** Tile objekta, kao u skripti koja pravi paket. */
  private tile(x: number, y: number): number {
    const z = this.p.zaglavlje;
    const tx = Math.min(z.tileovaX - 1, Math.max(0, Math.floor((x - z.okvir.minX) / z.tile)));
    const ty = Math.min(z.tileovaY - 1, Math.max(0, Math.floor((y - z.okvir.minY) / z.tile)));
    return ty * z.tileovaX + tx;
  }

  sastavi(): Paket {
    const n: Nizovi = { ...this.p.n };
    n.cvXY = new Float32Array(this.cvorovi.flatMap((c) => [c.x, c.y]));
    const iv = this.ivice;
    n.ivA = Uint32Array.from(iv, (e) => e.a);
    n.ivB = Uint32Array.from(iv, (e) => e.b);
    const od = new Uint32Array(iv.length + 1);
    iv.forEach((e, i) => (od[i + 1] = od[i]! + e.tacke.length));
    n.ivOd = od;
    n.ivXY = new Float32Array(iv.flatMap((e) => e.tacke.flatMap((t) => [t.x, t.y])));
    n.ivKlasa = Uint8Array.from(iv, (e) => e.klasa);
    n.ivSmjer = Int8Array.from(iv, (e) => e.smjer);
    n.ivTrake = Uint8Array.from(iv, (e) => e.trake);
    n.ivTrakeNaprijed = Uint8Array.from(iv, (e) => e.naprijed);
    n.ivTrakeNazad = Uint8Array.from(iv, (e) => e.nazad);
    n.ivBrzina = Uint8Array.from(iv, (e) => e.brzina);
    n.ivZastavice = Uint8Array.from(iv, (e) => e.zastavice);
    n.ivSloj = Int8Array.from(iv, (e) => e.sloj);
    n.ivIme = Uint16Array.from(iv, (e) => e.ime);
    n.ivTrakeSkretanja = Uint16Array.from(iv, (e) => e.skretanja);
    n.ivTrakeSkretanjaNazad = Uint16Array.from(iv, (e) => e.skretanjaNazad);
    n.ivOsm = Uint32Array.from(iv, (e) => e.osm);
    n.ivLinija = Uint8Array.from(iv, (e) => e.linija);
    n.ivPunaPrije = Uint8Array.from(iv, (e) => e.punaPrije);
    n.ivTrakePrije = Uint8Array.from(iv, (e) => e.trakePrije);
    // Objekti su u paketu poređani po tile-u (`obTileOd`); redoslijed unutar
    // tile-a ostaje kakav je bio.
    const z = this.p.zaglavlje;
    const brojTileova = z.tileovaX * z.tileovaY;
    if (brojTileova > 0) {
      const sa = this.objekti.map((o, i) => ({ o, i, t: this.tile(o.x, o.y) }));
      sa.sort((x, y) => x.t - y.t || x.i - y.i);
      const tileOd = new Uint32Array(brojTileova + 1);
      for (const { t } of sa) tileOd[t + 1]! += 1;
      for (let t = 0; t < brojTileova; t++) tileOd[t + 1]! += tileOd[t]!;
      n.obTileOd = tileOd;
      this.objekti = sa.map((x) => x.o);
    }
    const ob = this.objekti;
    n.obXY = new Float32Array(ob.flatMap((o) => [o.x, o.y]));
    n.obVrsta = Uint8Array.from(ob, (o) => o.vrsta);
    n.obPodatak = Uint16Array.from(ob, (o) => o.podatak);
    n.obIvica = Uint32Array.from(ob, (o) => o.ivica);
    n.obS = Float32Array.from(ob, (o) => o.s);
    n.obCvor = Uint32Array.from(ob, (o) => o.cvor);
    const rs = this.zabrane;
    n.rsVrsta = Uint16Array.from(rs, (r) => r.vrsta);
    n.rsOd = Uint32Array.from(rs, (r) => r.od);
    n.rsCvor = Uint32Array.from(rs, (r) => r.cvor);
    n.rsDo = Uint32Array.from(rs, (r) => r.do_);
    if (this.stringovi.length > 65535) throw new Error("overlay: previše stringova za paket");
    return {
      zaglavlje: { ...this.p.zaglavlje, stringovi: this.stringovi, klase: this.klase, vrsteObjekata: this.vrsteObjekata },
      n,
    };
  }
}

/** Vrste izmjena koje mijenjaju paket (sloj 1). Ostale idu u model raskrsnice ili su podatak za druge stavke. */
const SLOJ_PAKETA: ReadonlySet<VrstaIzmjene> = new Set(["cvor", "ukloniUlicu", "novaUlica", "dionica", "prelaz", "znak"]);

/**
 * Sloj 1: izmjene geometrije, dionica, prelaza i znakova uz ulicu — novi
 * paket. Izmjene idu redom kojim su u overlay-u; svaka se veže za stanje
 * poslije prethodnih (dionica na ulici koju je dodala ranija izmjena).
 * Paket bez takvih izmjena se vraća isti.
 */
export function primijeniNaPaket(p: Paket, o: Overlay): { paket: Paket; nevezane: Nevezana[] } {
  const izmjene = o.izmjene.filter((iz) => SLOJ_PAKETA.has(iz.vrsta));
  if (izmjene.length === 0) return { paket: p, nevezane: [] };
  const r = new Radni(p);
  const nevezane: Nevezana[] = [];
  const nevezana = (iz: Izmjena, razlog: string) => nevezane.push({ id: iz.id, vrsta: iz.vrsta, razlog });

  for (const iz of izmjene) {
    switch (iz.vrsta) {
      case "cvor": {
        const c = vezaniCvor(r, iz.cvor);
        if (c === null) {
          nevezana(iz, "nema čvora na tom mjestu");
          break;
        }
        r.cvorovi[c] = { x: iz.na.x, y: iz.na.y };
        for (const i of r.izCvora[c] ?? []) {
          const iv = r.ivice[i]!;
          if (iv.a === c) iv.tacke[0] = { ...iz.na };
          if (iv.b === c) iv.tacke[iv.tacke.length - 1] = { ...iz.na };
        }
        for (const ob of r.objekti) {
          if (ob.cvor === c) {
            ob.x = iz.na.x;
            ob.y = iz.na.y;
          }
        }
        break;
      }
      case "ukloniUlicu": {
        const u = vezaniUlica(r, iz.ulica);
        if (!u) {
          nevezana(iz, "nema ulice na tom mjestu");
          break;
        }
        r.zastavica(u.ivica, IVICA_UKLONJENA, true);
        r.zastavica(u.ivica, IVICA_VOZNA, false);
        break;
      }
      case "novaUlica": {
        // Krajevi: postojeći čvor u blizini, ili tačka na postojećoj ulici (ona
        // se dijeli), ili novi čvor (slijepa ulica).
        const kraj = (t: Point): number => {
          const c = vezaniCvor(r, t);
          if (c !== null) return c;
          let naj = -1;
          let s = 0;
          let d = GRAD_SIDRO_CVOR;
          for (let i = 0; i < r.ivice.length; i++) {
            if (!r.ivice[i]!.vozna) continue;
            const n = naLiniji(r.ivice[i]!.tacke, t);
            if (n.d <= d) [naj, s, d] = [i, n.s, n.d];
          }
          return naj >= 0 ? r.podijeli(naj, s) : r.noviCvor(t);
        };
        const a = kraj(iz.tacke[0]!);
        const b = kraj(iz.tacke[iz.tacke.length - 1]!);
        const tacke = [r.cvorovi[a]!, ...iz.tacke.slice(1, -1), r.cvorovi[b]!].map((t) => ({ x: t.x, y: t.y }));
        const i = r.ivice.length;
        r.ivice.push({
          a,
          b,
          tacke,
          klasa: r.klasa(iz.klasa),
          smjer: iz.smjer,
          trake: iz.trake,
          naprijed: 0,
          nazad: 0,
          brzina: 0,
          zastavice: IVICA_VOZNA,
          sloj: 0,
          ime: r.string(iz.ime),
          skretanja: 0,
          skretanjaNazad: 0,
          osm: 0,
          linija: 0,
          punaPrije: 0,
          trakePrije: 0,
          vozna: true,
          uklonjena: false,
        });
        r.izCvora[a]!.push(i);
        if (b !== a) r.izCvora[b]!.push(i);
        break;
      }
      case "dionica": {
        const u = vezaniUlica(r, iz.ulica);
        if (!u) {
          nevezana(iz, "nema ulice na tom mjestu");
          break;
        }
        // Pravac sidra na prvoj ivici; ostale ivice dionice po tome kako se nastavljaju.
        for (const { ivica, naprijed } of r.dionica(u.ivica)) {
          primijeniDionicu(r, ivica, naprijed === u.naprijed, iz);
        }
        break;
      }
      case "prelaz": {
        const u = vezaniUlica(r, iz.mjesto);
        if (!u) {
          nevezana(iz, "nema ulice na tom mjestu");
          break;
        }
        const prelaz = r.vrstaObjekta("crossing");
        if (iz.ukloni) {
          const prije = r.objekti.length;
          r.objekti = r.objekti.filter((ob) => !(ob.vrsta === prelaz && ob.ivica === u.ivica && Math.abs(ob.s - u.s) <= GRAD_SIDRO_PRELAZ));
          if (r.objekti.length === prije) nevezana(iz, "nema prelaza na tom mjestu");
        } else {
          r.objekti.push({ x: iz.mjesto.x, y: iz.mjesto.y, vrsta: prelaz, podatak: r.string(GRAD_OVERLAY_ZEBRA), ivica: u.ivica, s: u.s, cvor: BEZ });
        }
        break;
      }
      case "znak": {
        const u = vezaniUlica(r, iz.mjesto);
        if (!u) {
          nevezana(iz, "nema ulice na tom mjestu");
          break;
        }
        // Znak važi u smjeru vožnje, kao OSM `direction=forward|backward`
        // (smjer puta, a to je smjer ivice `a → b`).
        r.objekti.push({
          x: iz.mjesto.x,
          y: iz.mjesto.y,
          vrsta: r.vrstaObjekta("znak"),
          podatak: r.string(podatakZnaka(iz.znak, u.naprijed, iz.brzina)),
          ivica: u.ivica,
          s: u.s,
          cvor: BEZ,
        });
        break;
      }
      default:
        break;
    }
  }
  return { paket: r.sastavi(), nevezane };
}

/** `obPodatak` znaka uz ulicu: „vrsta|forward|vrijednost". */
export function podatakZnaka(znak: ZnakNaUlici, naprijed: boolean, brzina: number | null): string {
  return `${znak}|${naprijed ? "forward" : "backward"}|${brzina ?? ""}`;
}

/** Obrnuto od `podatakZnaka`; `null` kad podatak nije znak uz ulicu. */
export function procitajZnak(podatak: string): { znak: ZnakNaUlici; naprijed: boolean; brzina: number | null } | null {
  const [znak, smjer, brzina] = podatak.split("|");
  if (!ZNAKOVI_NA_ULICI.includes(znak as ZnakNaUlici) || (smjer !== "forward" && smjer !== "backward")) return null;
  return { znak: znak as ZnakNaUlici, naprijed: smjer === "forward", brzina: brzina ? Number(brzina) : null };
}

/** Polja dionice na jednu ivicu. `naprijed`: pravac sidra je `a → b` te ivice. */
function primijeniDionicu(r: Radni, i: number, naprijed: boolean, d: PoljaDionice): void {
  const iv = r.ivice[i]!;
  // Ono što overlay kaže „u pravcu sidra" je na ivici `a → b` ili `b → a`.
  const uSmjeru = <T>(sidro: T | undefined, suprotno: T | undefined): [T | undefined, T | undefined] =>
    naprijed ? [sidro, suprotno] : [suprotno, sidro];
  if (d.smjer !== undefined) {
    iv.smjer = d.smjer === "oba" ? 0 : (d.smjer === "naprijed") === naprijed ? 1 : -1;
  }
  const [tA, tB] = uSmjeru(d.trakeNaprijed, d.trakeNazad);
  if (tA !== undefined || tB !== undefined || d.smjer !== undefined) {
    // Broj traka po smjeru u paketu: jednosmjerna ima ukupan broj u `trake`
    // (kao OSM `lanes`), dvosmjerna i podjelu (`lanes:forward/backward`).
    const ua = tA ?? iv.naprijed;
    const ub = tB ?? iv.nazad;
    if (iv.smjer === 0) {
      if (ua > 0 && ub > 0) {
        iv.naprijed = ua;
        iv.nazad = ub;
        iv.trake = ua + ub;
      }
    } else {
      const u = iv.smjer === 1 ? (tA ?? 0) : (tB ?? 0);
      if (u > 0) iv.trake = u;
      iv.naprijed = 0;
      iv.nazad = 0;
    }
  }
  const [sA, sB] = uSmjeru(d.skretanjaNaprijed, d.skretanjaNazad);
  if (sA !== undefined) iv.skretanja = r.string(sA);
  if (sB !== undefined) iv.skretanjaNazad = r.string(sB);
  const [bA, bB] = uSmjeru(d.busNaprijed, d.busNazad);
  if (bA !== undefined) r.zastavica(i, IVICA_BUS_NAPRIJED, bA);
  if (bB !== undefined) r.zastavica(i, IVICA_BUS_NAZAD, bB);
  if (d.linija !== undefined) {
    iv.linija = { isprekidana: LINIJA_ISPREKIDANA, puna: LINIJA_PUNA, dvostruka: LINIJA_DVOSTRUKA, bez: LINIJA_BEZ }[d.linija];
  }
  if (d.punaPrije !== undefined) iv.punaPrije = Math.round(d.punaPrije);
  if (d.trakePrije !== undefined) iv.trakePrije = Math.round(d.trakePrije);
  if (d.zatvorena !== undefined) {
    r.zastavica(i, IVICA_ZATVORENA, d.zatvorena);
    r.zastavica(i, IVICA_VOZNA, !d.zatvorena);
  }
  if (d.ime !== undefined) iv.ime = r.string(d.ime);
  if (d.klasa !== undefined) iv.klasa = r.klasa(d.klasa);
}

// ── sloj 2: pravila raskrsnica ───────────────────────────────────────────

/** Plan semafora sa kracima kao ključevima „ivica:kraj". */
export interface PlanOverlayaVezan {
  faze: { zeleno: number; kraci: { kljuc: string; manevri: Manevar[] | null }[]; strelice: { kljuc: string; manevri: Manevar[] }[]; pjesaci: string[] }[];
  zuto: number;
  sveCrveno: number;
  pomak: number;
}

/** Izmjene raskrsnica, vezane za mrežu: ključ kraka je „ivica:kraj", kao u `Raskrsnice.krakIvice`. */
export interface PravilaOverlaya {
  kontrole: Map<string, { kontrola: KontrolaOverlaya; id: string }>;
  /** Po čvoru mreže (bilo kojem čvoru raskrsnice): plan, ili `null` — semafora nema. */
  semafori: Map<number, { plan: PlanOverlayaVezan | null; id: string }>;
  /** Znak skretanja na kraku ulaska; `null` uklanja i OSM zabrane sa tog kraka. */
  skretanja: Map<string, { znak: ZnakSkretanja | null; id: string }>;
  /** Zabrana ulaska u krak iz raskrsnice (znak na ušću, okrenut ka raskrsnici). */
  zabraneUlaska: Map<string, { id: string }>;
  nevezane: Nevezana[];
}

export const kljucKraka = (k: { ivica: number; kraj: 0 | 1 }) => `${k.ivica}:${k.kraj}`;

/** Sloj 2: izmjene raskrsnica vezane za mrežu (napravljenu od paketa poslije sloja 1). */
export function pravilaOverlaya(o: Overlay, m: Mreza): PravilaOverlaya {
  const pogled: PogledMreze = m;
  const izlaz: PravilaOverlaya = { kontrole: new Map(), semafori: new Map(), skretanja: new Map(), zabraneUlaska: new Map(), nevezane: [] };
  const nevezana = (iz: Izmjena, razlog: string) => izlaz.nevezane.push({ id: iz.id, vrsta: iz.vrsta, razlog });
  const krak = (s: SidroKraka) => {
    const k = vezaniKrak(pogled, s);
    return k ? kljucKraka(k) : null;
  };
  for (const iz of o.izmjene) {
    switch (iz.vrsta) {
      case "kontrola": {
        const k = krak(iz.krak);
        if (k) izlaz.kontrole.set(k, { kontrola: iz.kontrola, id: iz.id });
        else nevezana(iz, "nema kraka na tom mjestu");
        break;
      }
      case "skretanje": {
        const k = krak(iz.krak);
        if (k) izlaz.skretanja.set(k, { znak: iz.znak, id: iz.id });
        else nevezana(iz, "nema kraka na tom mjestu");
        break;
      }
      case "zabranaUlaska": {
        const k = krak(iz.krak);
        if (k) izlaz.zabraneUlaska.set(k, { id: iz.id });
        else nevezana(iz, "nema kraka na tom mjestu");
        break;
      }
      case "semafor": {
        const c = vezaniCvor(pogled, iz.raskrsnica);
        if (c === null) {
          nevezana(iz, "nema raskrsnice na tom mjestu");
          break;
        }
        if (!iz.plan) {
          izlaz.semafori.set(c, { plan: null, id: iz.id });
          break;
        }
        let nevezanKrak = false;
        const vezi = (s: SidroKraka) => {
          const k = krak(s);
          if (!k) nevezanKrak = true;
          return k ?? "";
        };
        const plan: PlanOverlayaVezan = {
          zuto: iz.plan.zuto,
          sveCrveno: iz.plan.sveCrveno,
          pomak: iz.plan.pomak,
          faze: iz.plan.faze.map((f) => ({
            zeleno: f.zeleno,
            kraci: f.kraci.map((x) => ({ kljuc: vezi(x.krak), manevri: x.manevri })),
            strelice: f.strelice.map((x) => ({ kljuc: vezi(x.krak), manevri: x.manevri })),
            pjesaci: f.pjesaci.map(vezi),
          })),
        };
        if (nevezanKrak) nevezana(iz, "neki krak plana nije na tom mjestu");
        else izlaz.semafori.set(c, { plan, id: iz.id });
        break;
      }
      default:
        break;
    }
  }
  return izlaz;
}

// ── zone ─────────────────────────────────────────────────────────────────

/** Zone grada: šablon (`cityZones/<grad>.json`), pa izmjene iz overlay-a po `id` — overlay ima prednost. */
export function zoneGrada(sablon: Zona[], o: Overlay): Zona[] {
  const po = new Map(sablon.map((z) => [z.id, z]));
  for (const iz of o.izmjene) if (iz.vrsta === "zona") po.set(iz.zona.id, iz.zona);
  return [...po.values()];
}

/** Zadaci iz overlay-a (stavka 9 ih vozi). */
export function zadaciGrada(o: Overlay): Zadatak[] {
  const po = new Map<string, Zadatak>();
  for (const iz of o.izmjene) if (iz.vrsta === "zadatak") po.set(iz.zadatak.id, iz.zadatak);
  return [...po.values()];
}
