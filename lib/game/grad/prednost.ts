import { polygonsOverlap, rectCorners } from "../sim/geometry";
import type { Point } from "../sim/types";
import { manevarKrakova, type Manevar, type Mreza } from "./mreza";
import { svjetlo, zelenaStrelica, type Raskrsnica } from "./raskrsnica";

/**
 * Prvenstvo prolaza na raskrsnici grada (faza 6, stavka 7): ko kome ustupa,
 * na čvoru sa onoliko krakova koliko ih OSM kaže, pod stvarnim uglovima.
 *
 * Ovo je ista hijerarhija kao `whoYields` (`lib/simRules.ts`) po kojoj sude
 * ispitna pitanja i stari motor — test to provjerava na svim kombinacijama
 * krsta — samo što „desno" i „suprotno" nisu strane svijeta nego raspored
 * ulica: krak je sa desne strane kad bi skretanje na njega bilo desno
 * (`manevarKrakova`), suprotan kad bi to bilo „pravo".
 *
 * Odluke korisnika (2026-10-03): ko se polukružno okreće propušta svakoga;
 * ko se uključuje sa servisnog puta, parkinga ili iz dvorišta propušta sve na
 * ulici, i bez znaka; kad svako ima nekoga sa desne (zastoj), kreće onaj ko
 * najduže čeka — to rješava saobraćaj (`saobracaj.ts`), ne ovo pravilo.
 */

/** Kontrola ulaska za jednog učesnika, u trenutku odluke. */
export type KontrolaUcesnika =
  | "zeleno"
  | "zuto"
  | "crveno"
  /** Crveno, ali gori zelena dopunska strelica za njegov pravac (ispitno pitanje 374). */
  | "strelica"
  | "glavni"
  | "ustupi"
  | "stop"
  /** Bez znakova: pravilo desne strane. */
  | "desna";

export interface UcesnikPrednosti {
  /** Krak ulaska i krak izlaska (indeksi u `kraci` raskrsnice). */
  ulaz: number;
  izlaz: number;
  manevar: Manevar;
  kontrola: KontrolaUcesnika;
  /** Već je u prstenu kružnog toka (ulazi sa kružne ivice). */
  uPrstenu: boolean;
  /**
   * Izlazi iz prstena iz unutrašnje trake dvotračnog kružnog toka — presijeca
   * spoljnu traku, pa propušta vozila u prstenu (vidi `koUstupa`).
   */
  izUnutrasnje?: boolean;
  /** Uključuje se sa servisnog puta, parkinga ili iz dvorišta. */
  ukljucivanje: boolean;
  /** Vozilo pod pratnjom (stavka 8). */
  hitno?: boolean;
}

/**
 * Nivo prvenstva — manji ide ranije; `null` ne prolazi (crveno, žuto). Kao
 * `priorityTier`: semafor i znaci, `ustupi` i STOP su isti nivo (razlikuju
 * se po ponašanju). Dopunska strelica pušta uz ustupanje — nivo znaka.
 */
export function nivoPrvenstva(k: KontrolaUcesnika): number | null {
  switch (k) {
    case "zeleno":
    case "glavni":
    case "desna":
      return 0;
    case "strelica":
    case "ustupi":
    case "stop":
      return 1;
    case "zuto":
    case "crveno":
      return null;
  }
}

/** Kako se sa kraka `od` vidi krak `ka`: skretanjem na njega bi se išlo lijevo, pravo ili desno. */
export function stranaKraka(m: Mreza, r: Raskrsnica, od: number, ka: number): Manevar {
  const a = r.kraci[od]!;
  const b = r.kraci[ka]!;
  return manevarKrakova(m.ivice[a.ivica]!, a.cvor, m.ivice[b.ivica]!, b.cvor);
}

/** Manevar sa kraka `ulaz` na krak `izlaz`; isti krak je polukružno. */
export function manevarKroz(m: Mreza, r: Raskrsnica, ulaz: number, izlaz: number): Manevar {
  return ulaz === izlaz ? "polukruzno" : stranaKraka(m, r, ulaz, izlaz);
}

/**
 * Kontrola ulaska sa kraka `k` za manevar `manevar` u trenutku `t`: svjetlo
 * (i ono sa strelicom za taj pravac), dopunska strelica, ili znak.
 */
export function kontrolaUcesnika(r: Raskrsnica, k: number, t: number, manevar: Manevar): KontrolaUcesnika {
  const krak = r.kraci[k]!;
  if (krak.kontrola !== "semafor") return krak.kontrola;
  const sv = svjetlo(r, k, t, manevar) ?? "crveno";
  if (sv !== "zeleno" && zelenaStrelica(r, k, t, manevar)) return "strelica";
  return sv;
}

/**
 * Ko od dvojice ustupa: `"a"`, `"b"`, ili `null` kad pravilo ne odlučuje
 * (oba lijevo iz suprotnih krakova, oba se okreću…). Da li im se putanje
 * uopšte sijeku, ovo ne gleda — to je `sukobPutanja`.
 */
export function koUstupa(m: Mreza, r: Raskrsnica, a: UcesnikPrednosti, b: UcesnikPrednosti): "a" | "b" | null {
  // Vozilo pod pratnjom ima prvenstvo nad svima.
  if (Boolean(a.hitno) !== Boolean(b.hitno)) return a.hitno ? "b" : "a";
  // Ko je već u prstenu ima prvenstvo nad onim koji ulazi.
  if (a.uPrstenu !== b.uPrstenu) return a.uPrstenu ? "b" : "a";
  // U prstenu: izlaz iz unutrašnje trake presijeca spoljnu — propušta onoga
  // koji vozi spoljnom (izlazi ili nastavlja krug).
  if (a.uPrstenu && Boolean(a.izUnutrasnje) !== Boolean(b.izUnutrasnje)) return a.izUnutrasnje ? "a" : "b";

  const ta = nivoPrvenstva(a.kontrola);
  const tb = nivoPrvenstva(b.kontrola);
  if (ta === null && tb === null) return null;
  if (ta === null) return "a";
  if (tb === null) return "b";

  // Polukružno okretanje i uključivanje propuštaju sve (odluka korisnika).
  const aOkret = a.manevar === "polukruzno";
  const bOkret = b.manevar === "polukruzno";
  if (aOkret !== bOkret) return aOkret ? "a" : "b";
  if (a.ukljucivanje !== b.ukljucivanje) return a.ukljucivanje ? "a" : "b";

  if (ta !== tb) return ta > tb ? "a" : "b";

  // Isti nivo: pravilo desne strane, pa lijevo skretanje propušta susretne.
  if (a.ulaz !== b.ulaz) {
    if (stranaKraka(m, r, a.ulaz, b.ulaz) === "desno") return "a";
    if (stranaKraka(m, r, b.ulaz, a.ulaz) === "desno") return "b";
    if (a.manevar === "lijevo" && b.manevar !== "lijevo" && stranaKraka(m, r, a.ulaz, b.ulaz) === "pravo") return "a";
    if (b.manevar === "lijevo" && a.manevar !== "lijevo" && stranaKraka(m, r, b.ulaz, a.ulaz) === "pravo") return "b";
  }
  return null;
}

// ── sukob putanja ──────────────────────────────────────────────────────────

/** Gdje se dvije putanje prvi put približe: `s` duž svake [m], i da li poslije toga idu zajedno (spajanje). */
export interface Sukob {
  sa: number;
  sb: number;
  /**
   * Kraj zone sukoba na svakoj putanji: zadnje mjesto gdje se tijela još mogu
   * dodirnuti. Kod putanja koje se sijeku je to blizu `sa`/`sb`; kod onih koje
   * idu jedna preko druge (dva lijeva skretanja na pomjerenoj raskrsnici)
   * zona je dugačka, i „prošao je" znači tek iza njenog kraja.
   */
  ka: number;
  kb: number;
  /**
   * Početak zone sukoba na putanji `b` (najmanji `s` dodira). `sb` je mjesto
   * na `b` u prvom dodiru gledano duž `a`; kod putanja jedna preko druge u
   * suprotnim smjerovima to je kraj zone na `b`, ne početak.
   */
  pb: number;
  spajanje: boolean;
}

/**
 * Prvo mjesto na kojem se tijela dva vozila na putanjama `a` i `b` (tačke
 * redom vožnje) mogu dodirnuti: osovine bliže od `razmak`. `null` kad se
 * nigdje ne približe, ili kad počinju zajedno (ista traka — to je vožnja
 * jedan iza drugog, ne sukob). Kad jedno vozilo vozi iza drugog iste trake, a
 * prolazi im počinju na različitim mjestima, to po položaju vozila vidi
 * saobraćaj (`saobracaj.ts`).
 *
 * Spajanje (desno skretanje i pravo na isti izlaz) je sukob na mjestu gdje se
 * putanje sastaju; poslije njega idu zajedno.
 */
export function sukobPutanja(a: readonly Point[], b: readonly Point[], razmak: number, tijelo?: { duzina: number; sirina: number }): Sukob | null {
  if (a.length < 2 || b.length < 2) return null;
  const r2 = razmak * razmak;
  const blizu = (p: Point, q: Point) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < r2;
  // Ista traka na početku: niko nikome ne presijeca put.
  if (blizu(a[0]!, b[0]!)) return null;
  const pravac = (t: readonly Point[], i: number): Point => {
    const p = t[Math.max(0, i - 1)]!;
    const q = t[Math.min(t.length - 1, i + 1)]!;
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
  };
  // Sa tijelom: sukob je kad bi se tijela (pravougaonici u pravcu putanja)
  // preklopila — pod uglom se dodiruju i kad su osovine dalje od `razmak`,
  // a susjedne paralelne trake se ne dodiruju.
  const dodir = tijelo
    ? (i: number, j: number) => {
        const p = a[i]!;
        const q = b[j]!;
        if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 > (tijelo.duzina + 0.6) ** 2) return false;
        return polygonsOverlap(
          rectCorners(p, pravac(a, i), tijelo.duzina, tijelo.sirina),
          rectCorners(q, pravac(b, j), tijelo.duzina, tijelo.sirina),
        );
      }
    : (i: number, j: number) => blizu(a[i]!, b[j]!);
  let prvi: Sukob | null = null;
  let sa = 0;
  for (let i = 0; i < a.length; i++) {
    if (i > 0) sa += Math.hypot(a[i]!.x - a[i - 1]!.x, a[i]!.y - a[i - 1]!.y);
    let sb = 0;
    for (let j = 0; j < b.length; j++) {
      if (j > 0) sb += Math.hypot(b[j]!.x - b[j - 1]!.x, b[j]!.y - b[j - 1]!.y);
      if (!dodir(i, j)) continue;
      // Spajanje: i krajevi su blizu — dalje idu istom trakom.
      if (!prvi) prvi = { sa, sb, ka: sa, kb: sb, pb: sb, spajanje: blizu(a[a.length - 1]!, b[b.length - 1]!) };
      prvi.ka = Math.max(prvi.ka, sa);
      prvi.kb = Math.max(prvi.kb, sb);
      prvi.pb = Math.min(prvi.pb, sb);
    }
  }
  return prvi;
}
