/**
 * Gradska kičma: ulice kroz grad, od ulaza do izlaza.
 *
 * Geometrija ivice grafa završava u tački na koju je čvor prilijepljen, negdje
 * u centru, i sljedeća ivica odatle kreće. Grad u ruti zato nije dionica nego
 * TAČKA — kroz Cetinje se ne prolazi, njega se samo dodirne. Kičma je ono što
 * tu nedostaje.
 *
 * Ovdje je samo oblik podatka, njegova provjera i traženje puta kroz njega.
 * Fajlove pravi `npm run osm:kicme`; koordinate su metri UTM 34N, kao i svuda
 * u `public/data/osm/`.
 */

import type { Point } from "../sim/types";

/** Ulaz u grad — po jedan za svaku ivicu grafa koja u njega vodi. */
export interface KicmaUlaz {
  /** `id` ivice grafa kojoj ovaj ulaz pripada. */
  ivica: string;
  /** Čvor na drugom kraju te ivice. */
  ka: string;
  /** Čvor kičme na kojem ivica prestaje a grad počinje. */
  cvorOSM: number;
  /** Koliko se metara ivice odsijeca sa kraja koji je u gradu. */
  odKraja: number;
  /** Koliko je metara prilaza dijelila sa najbližom drugom ivicom. */
  zajednicko: number;
  /**
   * Ulaz je zaustavljen granicom udaljenosti, a ne razdvajanjem.
   *
   * Znači da se ova ivica ni na dva i po kilometra od centra nije odvojila od
   * ostalih — dvije ivice stvarno ulaze u grad istom ulicom.
   */
  ogranicen?: true;
  x: number;
  y: number;
}

export interface KicmaCvor {
  id: number;
  x: number;
  y: number;
  /** Kružni tok. */
  kt?: 1;
}

export interface KicmaIvica {
  a: number;
  b: number;
  /** Osovina ulice, `[x, y]` u metrima. */
  g: [number, number][];
}

export interface Kicma {
  cvor: string;
  ime: string;
  centar: [number, number];
  poluprecnik: number;
  /** Da li je izbor ulica kroz grad potvrdio čovjek. */
  rucnoPotvrdjena: boolean;
  ulazi: KicmaUlaz[];
  cvorovi: KicmaCvor[];
  ivice: KicmaIvica[];
}

/**
 * Provjera oblika pročitanog fajla.
 *
 * Isti razlog kao kod geometrije ivica: fajlove pravi skripta koja se pokreće
 * ručno, pa je bolje da se stariji ili nepotpun fajl vidi odmah nego da grad
 * tiho ostane bez ulica.
 */
export function parseKicma(raw: unknown): Kicma | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.cvor !== "string" || typeof v.ime !== "string") return null;
  if (!Array.isArray(v.centar) || v.centar.length !== 2) return null;
  if (!Array.isArray(v.ulazi) || !Array.isArray(v.cvorovi) || !Array.isArray(v.ivice)) return null;
  for (const i of v.ivice as KicmaIvica[]) {
    if (typeof i?.a !== "number" || typeof i?.b !== "number") return null;
    if (!Array.isArray(i.g) || i.g.length < 2) return null;
  }
  return raw as Kicma;
}

/** Ulaz koji pripada datoj ivici grafa; `undefined` ako ga nema. */
export const ulazZaIvicu = (kicma: Kicma, ivica: string): KicmaUlaz | undefined =>
  kicma.ulazi.find((u) => u.ivica === ivica);

/**
 * Put kroz grad, od jednog ulaza do drugog.
 *
 * Kičma je mali graf pa je i traženje malo: obična pretraga u širinu po broju
 * ulica. Vraća se geometrija spojena u jednu poliliniju, u smjeru vožnje.
 *
 * `null` znači da puta nema. To se dešava i kad su oba ulaza ISTI čvor — dvije
 * ivice koje u grad ulaze istom ulicom nemaju šta da povežu, i to nije greška
 * nego osobina podatka; vidi `KicmaUlaz.ogranicen`.
 */
export function krozGrad(kicma: Kicma, od: number, doK: number): Point[] | null {
  if (od === doK) return null;

  const susjedi = new Map<number, { drugi: number; ivica: KicmaIvica }[]>();
  for (const i of kicma.ivice) {
    if (!susjedi.has(i.a)) susjedi.set(i.a, []);
    if (!susjedi.has(i.b)) susjedi.set(i.b, []);
    susjedi.get(i.a)!.push({ drugi: i.b, ivica: i });
    susjedi.get(i.b)!.push({ drugi: i.a, ivica: i });
  }

  const odakle = new Map<number, { prethodni: number; ivica: KicmaIvica }>();
  const vidjeni = new Set([od]);
  const red = [od];
  while (red.length > 0) {
    const cvor = red.shift()!;
    if (cvor === doK) break;
    for (const veza of susjedi.get(cvor) ?? []) {
      if (vidjeni.has(veza.drugi)) continue;
      vidjeni.add(veza.drugi);
      odakle.set(veza.drugi, { prethodni: cvor, ivica: veza.ivica });
      red.push(veza.drugi);
    }
  }
  if (!vidjeni.has(doK)) return null;

  // Unazad od cilja, pa se okrene — svaka ulica se pri tom okrene u smjer vožnje.
  const komadi: Point[][] = [];
  let m = doK;
  while (m !== od) {
    const korak = odakle.get(m);
    if (!korak) return null;
    const tacke = korak.ivica.g.map(([x, y]) => ({ x, y }));
    komadi.push(korak.ivica.b === m ? tacke : tacke.reverse());
    m = korak.prethodni;
  }
  komadi.reverse();

  const out: Point[] = [];
  for (const komad of komadi) {
    // Zajednička tačka dvije uzastopne ulice se ne upisuje dvaput.
    for (const p of out.length === 0 ? komad : komad.slice(1)) out.push(p);
  }
  return out.length >= 2 ? out : null;
}
