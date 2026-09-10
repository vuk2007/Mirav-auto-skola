/**
 * Okolina puta: iz stvarnih koordinata u sabijene.
 *
 * Tile-ovi u `public/data/osm/tiles/` nose more, jezera, rijeke, šume, njive i
 * naselja — sve u METRIMA STVARNE Crne Gore. Put se pod nogama sabija, i to
 * neravnomjerno: prave deset puta, krivine tri i po. Ako bi se okolina crtala
 * po stvarnim koordinatama, more bi ostalo kilometrima od obalnog puta.
 *
 * KAKO SE POVRŠINE PRENOSE — I ZAŠTO NE KAO POLIGONI
 *
 * Prva verzija je preslikavala obris svake površine tačku po tačku i bočno ga
 * ograničavala na pojas. Rezultat je bio niz sitnih trouglova razbacanih pored
 * puta: površina koja pojas samo dodirne sabije se u krpicu, a njen „položaj duž
 * puta" se za daleke tačke odredi po najbližoj tački osovine — a to za
 * kilometar daljine ne znači ništa.
 *
 * Sa vozačkog mjesta se ionako ne vidi oblik šume nego ŠTA JE S KOJE STRANE.
 * Zato se okolina prenosi kao dvije trake, lijeva i desna: duž puta se u
 * pravilnim razmacima pipne šta stvarno leži pored njega, i to se oboji. More
 * ostaje uz obalni put, Morača uz magistralu, a šuma tamo gdje je i bila.
 *
 * Linije — obala, rijeka, sporedna ulica — prenose se onako kako jesu, jer one
 * put stvarno sijeku ili idu uz njega; samo se odsijeca ono što je van pojasa.
 */

import { OKOLINA_POJAS, OKOLINA_RESETKA } from "../sim/config";
import type { Point } from "../sim/types";
import type { Ruta, RutaDionica } from "./ruta";

/** Pojava kakva stoji u tile-u: koordinate su metri UTM 34N. */
export interface TilePojava {
  /** Vrsta: `voda`, `suma`, `njiva`, `vinograd`, `naselje`, `industrija`, `obala`, `rijeka`, `put`. */
  k: string;
  /** Rang puta, kad je pojava put. */
  r?: string;
  /** Kružni tok. */
  kt?: 1;
  /** Zatvorena površina. */
  p?: 1;
  g: [number, number][];
}

/** Linijska pojava preslikana u koordinate rute. */
export interface OkolinaLinija {
  k: string;
  r?: string;
  tacke: Point[];
}

/** Komad trake pored puta: šta leži lijevo i desno na dionici `[odS, doS]`. */
export interface OkolinaTraka {
  odS: number;
  doS: number;
  /** Vrsta površine, ili `null` kad tamo nema ničega upisanog. */
  lijevo: string | null;
  desno: string | null;
}

export interface Okolina {
  trake: OkolinaTraka[];
  linije: OkolinaLinija[];
}

/** Gdje na ruti leži tačka iz prirode. */
interface Mjesto {
  s: number;
  /** Bočni odmak od osovine [m]; pozitivno je vozačeva lijeva strana. */
  bok: number;
  daljina: number;
}

interface Uzorak {
  /** Tačka na stvarnoj osovini. */
  p: Point;
  /** Pređeni put po ruti na tom mjestu [m]. */
  s: number;
  /** Jedinični vektor smjera vožnje, u stvarnim koordinatama. */
  smjer: Point;
}

/**
 * Veza između stvarnih i sabijenih koordinata rute.
 *
 * `uRutu` traži gdje na ruti leži tačka iz prirode, `izRute` radi obrnuto —
 * daje mjesto u prirodi za dati pređeni put. Oboje ide preko iste rešetke nad
 * stvarnom osovinom; bez nje bi se za svaku tačku pretraživalo trideset hiljada
 * uzoraka.
 */
export interface Preslikavanje {
  uRutu(p: Point): Mjesto | null;
  izRute(s: number): Uzorak | null;
  uzoraka: number;
}

/** Mjesto na ruti za dati pređeni put po STVARNOJ osovini dionice. */
function naRuti(d: RutaDionica, sTrim: number): number {
  const svoja = Math.max(1, d.sabijeno.duzina - d.skinuto);
  const razmjera = (d.doS - d.odS) / svoja;
  const naDionici = d.sabijeno.uSabijeni(d.skinutoStvarno + sTrim) - d.skinuto;
  return Math.min(d.doS, Math.max(d.odS, d.odS + naDionici * razmjera));
}

export function napraviPreslikavanje(ruta: Ruta): Preslikavanje {
  const resetka = new Map<string, Uzorak[]>();
  const redom: Uzorak[] = [];

  for (const d of ruta.dionice) {
    const t = d.stvarne;
    let preslo = 0;
    for (let i = 0; i < t.length; i++) {
      const p = t[i]!;
      if (i > 0) preslo += Math.hypot(p.x - t[i - 1]!.x, p.y - t[i - 1]!.y);
      const a = t[Math.max(0, i - 1)]!;
      const b = t[Math.min(t.length - 1, i + 1)]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const duz = Math.hypot(dx, dy) || 1;
      const uzorak: Uzorak = { p, s: naRuti(d, preslo), smjer: { x: dx / duz, y: dy / duz } };
      const kljuc = `${Math.floor(p.x / OKOLINA_RESETKA)}:${Math.floor(p.y / OKOLINA_RESETKA)}`;
      let cel = resetka.get(kljuc);
      if (!cel) {
        cel = [];
        resetka.set(kljuc, cel);
      }
      cel.push(uzorak);
      redom.push(uzorak);
    }
  }
  redom.sort((a, b) => a.s - b.s);

  const uRutu = (p: Point): Mjesto | null => {
    const cx = Math.floor(p.x / OKOLINA_RESETKA);
    const cy = Math.floor(p.y / OKOLINA_RESETKA);
    let najblizi: Uzorak | null = null;
    let najmanja = Infinity;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const u of resetka.get(`${cx + i}:${cy + j}`) ?? []) {
          const d2 = (u.p.x - p.x) ** 2 + (u.p.y - p.y) ** 2;
          if (d2 < najmanja) {
            najmanja = d2;
            najblizi = u;
          }
        }
      }
    }
    if (!najblizi) return null;
    const dx = p.x - najblizi.p.x;
    const dy = p.y - najblizi.p.y;
    // Lijevo od smjera vožnje je pozitivno, isto kao u `sim/road.ts`.
    return {
      s: najblizi.s,
      bok: dx * -najblizi.smjer.y + dy * najblizi.smjer.x,
      daljina: Math.sqrt(najmanja),
    };
  };

  const izRute = (s: number): Uzorak | null => {
    if (redom.length === 0) return null;
    let lo = 0;
    let hi = redom.length - 1;
    while (hi - lo > 1) {
      const sred = (lo + hi) >> 1;
      if (redom[sred]!.s <= s) lo = sred;
      else hi = sred;
    }
    return redom[lo]!;
  };

  return { uRutu, izRute, uzoraka: redom.length };
}

// ── površine ────────────────────────────────────────────────────────────────

/** Da li tačka pada unutar prstena. */
function unutra(prsten: readonly [number, number][], x: number, y: number): boolean {
  let u = false;
  for (let i = 0, j = prsten.length - 1; i < prsten.length; j = i++) {
    const [xi, yi] = prsten[i]!;
    const [xj, yj] = prsten[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) u = !u;
  }
  return u;
}

interface Povrsina {
  k: string;
  prsten: [number, number][];
  okvir: [number, number, number, number];
}

/** Rešetka nad površinama, da se za jednu tačku ne provjerava svaka od njih. */
function indeksPovrsina(povrsine: readonly Povrsina[]): Map<string, Povrsina[]> {
  const m = new Map<string, Povrsina[]>();
  for (const p of povrsine) {
    const x0 = Math.floor(p.okvir[0] / OKOLINA_RESETKA);
    const y0 = Math.floor(p.okvir[1] / OKOLINA_RESETKA);
    const x1 = Math.floor(p.okvir[2] / OKOLINA_RESETKA);
    const y1 = Math.floor(p.okvir[3] / OKOLINA_RESETKA);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const kljuc = `${x}:${y}`;
        let cel = m.get(kljuc);
        if (!cel) {
          cel = [];
          m.set(kljuc, cel);
        }
        cel.push(p);
      }
    }
  }
  return m;
}

/**
 * Redoslijed po kojem se bira šta se vidi kad se dvije površine preklope.
 *
 * Voda pobjeđuje sve: more i jezero su u OSM-u često nacrtani preko šume ili
 * naselja na obali, a s puta se vidi voda. Naselje pobjeđuje njivu iz istog
 * razloga — kuća zaklanja polje.
 */
const PRVENSTVO: Record<string, number> = {
  voda: 5,
  naselje: 4,
  industrija: 4,
  suma: 3,
  vinograd: 2,
  njiva: 1,
};

/** Na kojim se bočnim odmacima pipa šta leži pored puta [m]. */
const PIPANJE = [14, 26, 45];

/**
 * Dokle se traži obalna linija kad ispod tačke nema nijedne površine [m].
 *
 * More u OpenStreetMap-u NIJE poligon nego se podrazumijeva iz obalne linije:
 * `natural=coastline` je usmjeren tako da je kopno lijevo, a more desno. Zbog
 * toga uz obalni put nema nijedne `voda` površine — izmjereno, Bar — Ulcinj ih
 * ima nula, iako se cijelim putem vozi uz more. Ovdje se to nadoknađuje:
 * tačka koja je desno od najbliže obalne linije je u moru.
 */
const DOMET_OBALE = 300;

/**
 * Dokle se linija smatra samim kolovozom po kojem se vozi [m].
 *
 * Kolovoz je nešto preko osam metara, pa je pola njega četiri; šest metara
 * hvata i mala razilaženja između uprošćene linije iz tile-a i sabijene
 * osovine.
 */
const SVOJ_PUT = 6;

export interface OkolinaOpcije {
  /** Na koliko metara se uzima uzorak duž puta. */
  korak?: number;
}

/**
 * Šta leži pored puta, lijevo i desno, duž cijele rute.
 *
 * Duž puta se u koraku pipne nekoliko bočnih odmaka i uzme ono što tamo stvarno
 * jest. Uzastopni jednaki uzorci se spajaju u jednu traku, pa ih na ruti od
 * osamnaest kilometara ostane nekoliko stotina, a ne nekoliko hiljada.
 */
export function trakeOkoline(
  ruta: Ruta,
  pres: Preslikavanje,
  povrsine: readonly Povrsina[],
  obale: readonly (readonly [number, number][])[] = [],
  { korak = 12 }: OkolinaOpcije = {},
): OkolinaTraka[] {
  const indeks = indeksPovrsina(povrsine);

  // Obalni segmenti se indeksiraju kao i površine: bez toga se za svaku pipnutu
  // tačku prolazi kroz svih šest hiljada segmenata, i račun sa četiri skoči na
  // osamdeset milisekundi.
  const obalaIndeks = new Map<string, [number, number, number, number][]>();
  const upisi = (kljuc: string, seg: [number, number, number, number]) => {
    let cel = obalaIndeks.get(kljuc);
    if (!cel) {
      cel = [];
      obalaIndeks.set(kljuc, cel);
    }
    cel.push(seg);
  };
  const domet = Math.ceil(DOMET_OBALE / OKOLINA_RESETKA);
  for (const linija of obale) {
    for (let i = 1; i < linija.length; i++) {
      const [ax, ay] = linija[i - 1]!;
      const [bx, by] = linija[i]!;
      const x0 = Math.floor(Math.min(ax, bx) / OKOLINA_RESETKA) - domet;
      const x1 = Math.floor(Math.max(ax, bx) / OKOLINA_RESETKA) + domet;
      const y0 = Math.floor(Math.min(ay, by) / OKOLINA_RESETKA) - domet;
      const y1 = Math.floor(Math.max(ay, by) / OKOLINA_RESETKA) + domet;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) upisi(`${x}:${y}`, [ax, ay, bx, by]);
      }
    }
  }

  /** Da li je tačka na morskoj strani najbliže obalne linije. */
  const uMoru = (x: number, y: number): boolean => {
    const cel = obalaIndeks.get(
      `${Math.floor(x / OKOLINA_RESETKA)}:${Math.floor(y / OKOLINA_RESETKA)}`,
    );
    if (!cel) return false;
    let najmanja = DOMET_OBALE * DOMET_OBALE;
    let desno = false;
    for (const [ax, ay, bx, by] of cel) {
      const dx = bx - ax;
      const dy = by - ay;
      const kv = dx * dx + dy * dy;
      if (kv === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / kv));
      const d2 = (x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2;
      if (d2 >= najmanja) continue;
      najmanja = d2;
      // Kopno je lijevo od smjera linije, more desno.
      desno = (x - ax) * dy - (y - ay) * dx > 0;
    }
    return najmanja < DOMET_OBALE * DOMET_OBALE && desno;
  };
  const nadji = (x: number, y: number): string | null => {
    const cel = indeks.get(`${Math.floor(x / OKOLINA_RESETKA)}:${Math.floor(y / OKOLINA_RESETKA)}`);
    if (!cel) return null;
    let najbolja: string | null = null;
    for (const p of cel) {
      if (x < p.okvir[0] || x > p.okvir[2] || y < p.okvir[1] || y > p.okvir[3]) continue;
      if (najbolja !== null && (PRVENSTVO[p.k] ?? 0) <= (PRVENSTVO[najbolja] ?? 0)) continue;
      if (unutra(p.prsten, x, y)) najbolja = p.k;
    }
    return najbolja;
  };

  const out: OkolinaTraka[] = [];
  for (let s = 0; s < ruta.duzina; s += korak) {
    const u = pres.izRute(s);
    if (!u) continue;
    const lijevoNorm = { x: -u.smjer.y, y: u.smjer.x };
    const strana = (znak: 1 | -1): string | null => {
      for (const odmak of PIPANJE) {
        const x = u.p.x + lijevoNorm.x * odmak * znak;
        const y = u.p.y + lijevoNorm.y * odmak * znak;
        const k = nadji(x, y);
        if (k) return k;
        if (uMoru(x, y)) return "voda";
      }
      return null;
    };
    const lijevo = strana(1);
    const desno = strana(-1);
    const zadnja = out[out.length - 1];
    if (zadnja && zadnja.lijevo === lijevo && zadnja.desno === desno) {
      zadnja.doS = Math.min(ruta.duzina, s + korak);
      continue;
    }
    out.push({ odS: s, doS: Math.min(ruta.duzina, s + korak), lijevo, desno });
  }
  return out;
}

// ── linije ──────────────────────────────────────────────────────────────────

/** Tačka na sabijenoj osovini rute, sa smjerom. */
function naOsovini(ruta: Ruta, s: number): { p: Point; smjer: Point } {
  const korak = ruta.duzina / Math.max(1, ruta.tacke.length - 1);
  const i = Math.min(ruta.tacke.length - 1, Math.max(0, Math.round(s / korak)));
  const a = ruta.tacke[Math.max(0, i - 1)]!;
  const b = ruta.tacke[Math.min(ruta.tacke.length - 1, i + 1)]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const duz = Math.hypot(dx, dy) || 1;
  return { p: ruta.tacke[i]!, smjer: { x: dx / duz, y: dy / duz } };
}

/**
 * Linijske pojave preslikane u koordinate rute.
 *
 * Odsijeca se ono što je van pojasa, pa se linija cijepa na komade — rijeka
 * koja put samo presiječe ostane kratak potez preko njega, a ne linija koja
 * bježi u beskraj.
 */
export function preslikajLinije(
  ruta: Ruta,
  pres: Preslikavanje,
  linije: readonly TilePojava[],
): OkolinaLinija[] {
  const out: OkolinaLinija[] = [];
  for (const pojava of linije) {
    let tekuca: Point[] = [];
    let naOsi = 0;
    let svih = 0;
    const zatvori = () => {
      // Put koji cijelim potezom leži NA osovini je onaj kojim se vozi: on je
      // već nacrtan, sa trakama i ivičnim linijama. Bez ovoga se preko njega
      // nacrta još jedna siva traka i kolovoz izgleda udvojeno.
      const svoj = pojava.k === "put" && svih > 0 && naOsi / svih > 0.7;
      if (tekuca.length >= 2 && !svoj) {
        out.push({ k: pojava.k, ...(pojava.r ? { r: pojava.r } : {}), tacke: tekuca });
      }
      tekuca = [];
      naOsi = 0;
      svih = 0;
    };
    for (const [x, y] of pojava.g) {
      const m = pres.uRutu({ x, y });
      if (!m || Math.abs(m.bok) > OKOLINA_POJAS || m.daljina > OKOLINA_POJAS) {
        zatvori();
        continue;
      }
      svih += 1;
      if (Math.abs(m.bok) < SVOJ_PUT) naOsi += 1;
      const os = naOsovini(ruta, m.s);
      tekuca.push({
        x: os.p.x + -os.smjer.y * m.bok,
        y: os.p.y + os.smjer.x * m.bok,
      });
    }
    zatvori();
  }
  return out;
}

/**
 * Razvrstaj pojave iz tile-a i prenesi ih na rutu.
 *
 * Površine idu u trake, linije se preslikavaju kakve jesu. Vraća se sve
 * zajedno, jer se i crta zajedno.
 */
export function preslikajTile(
  ruta: Ruta,
  pres: Preslikavanje,
  pojave: readonly TilePojava[],
): { povrsine: Povrsina[]; obale: [number, number][][]; linije: OkolinaLinija[] } {
  const povrsine: Povrsina[] = [];
  const obale: [number, number][][] = [];
  const linije: TilePojava[] = [];
  for (const p of pojave) {
    if (p.k === "obala") obale.push(p.g);
    if (p.p === 1) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of p.g) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      povrsine.push({ k: p.k, prsten: p.g, okvir: [minX, minY, maxX, maxY] });
    } else {
      linije.push(p);
    }
  }
  return { povrsine, obale, linije: preslikajLinije(ruta, pres, linije) };
}

export type { Povrsina };
