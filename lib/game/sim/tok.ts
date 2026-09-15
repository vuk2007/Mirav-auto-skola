/**
 * Saobraćaj na otvorenom putu kao TOK, a ne kao spisak vozila.
 *
 * Do sada se saobraćaj pravio unaprijed: raspored je govorio kad se koje vozilo
 * pojavljuje, računato kao da igrač vozi tačno po ograničenju. Igrač tako ne
 * vozi, pa je gustina zavisila od njegove vožnje — kad bi stao, susretna vozila
 * su se i dalje rađala istim ritmom na mjestu koje se ne pomjera, i zbijala se.
 *
 * Susretni tok ima izvor na daljoj ivici prozora, dva kilometra ispred igrača
 * (`pustiTok` u `world.ts`). Izvor pamti zamišljeno mjesto posljednjeg vozila
 * koje je pustio, i to mjesto se kreće brzinom tog vozila. Kad se između njega i
 * ivice otvori praznina veća od sljedeće izvučene, izvor pušta novo vozilo. Tako
 * gustina ne zavisi od toga kako igrač vozi: susretni tok teče i dok on stoji.
 *
 * Naš smjer se tako ne može voditi, jer ga igrač ne mimoilazi nego sustiže.
 * Izmjereno, sa istim izvorima na obje ivice prozora: ruta Budva — Kolašin,
 * treći nivo, vozač koji ne pretiče — sa jednim sjemenom je ispred njega u
 * prosjeku bilo 12,9 vozila, sa drugim 3,2. Ko ne pretiče, vozi iza najsporijeg
 * vozila; ono što je brže ode, a ništa novo ne stiže. Zato se naš smjer drži
 * BROJA: kad u prozoru fali vozilo, ubaci se u najveću prazninu ispred igrača,
 * van kadra i van dometa oznake, kao da je ušlo sa sporednog puta; kad ih je
 * previše, skloni se ono najdalje, isto van dometa (`regulisiNasSmjer`).
 *
 * Sve što se izvlači za jedno vozilo — vrsta, brzina, razmak — izvlači se iz
 * sjemena, izvora i rednog broja, a ne iz jednog generatora redom. Sedamnaesto
 * susretno vozilo je zato uvijek isto, bez obzira na to kojim su se redom izvori
 * javljali.
 */

import {
  BRZINA_VRSTE,
  KAMION_ISPRED,
  KAMION_NAJKRACA,
  KAMION_PLANINA,
  KAMION_RAZMAK,
  KOLONA_ODSTOJANJE,
  KOLONA_PO_NIVOU,
  MJESAVINA,
  PRAZNINA_MAX,
  PRAZNINA_MIN,
  SAOBRACAJ_PROZOR,
  SAOBRACAJ_U_PROZORU,
  VOZILA,
  type Level,
} from "./config";
import { rng } from "./geometry";
import type { DionicaToka, VrstaVozila } from "./types";

/** Odakle je vozilo toka: susretni tok, naš smjer, zagarantovani kamion. Slovo ide i u `id`. */
export type IzvorSlovo = "s" | "n" | "k";

/**
 * Tipična brzina vozila u toku, kao dio ograničenja.
 *
 * Služi samo za razmak unutar kolone: on se zadaje u sekundama, a mjesto novog
 * vozila se računa u metrima, prije nego što se zna koliko će ono stvarno voziti.
 */
const TIPICAN_UDIO = 0.92;

/** Brzina kojom tok tipično vozi na mjestu `x` [m/s]. */
export function tipicnaBrzina(dionice: readonly DionicaToka[], x: number): number {
  return dionicaToka(dionice, x).vMax * TIPICAN_UDIO;
}

/** Generator za jedno vozilo toka — uvijek isti za isto sjeme, izvor i redni broj. */
export function izvlacenje(seed: number, izvor: IzvorSlovo, k: number): () => number {
  let h = Math.imul((seed ^ 0x2545f491) >>> 0, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ izvor.charCodeAt(0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (k + 0x165667b1), 0xc2b2ae35) >>> 0;
  return rng((h ^ (h >>> 15)) >>> 0);
}

/** Dionica toka na mjestu `x`: posljednja koja počinje prije njega. */
export function dionicaToka(dionice: readonly DionicaToka[], x: number): DionicaToka {
  let lo = 0;
  let hi = dionice.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dionice[mid]!.od <= x) lo = mid;
    else hi = mid - 1;
  }
  return dionice[lo]!;
}

/** Najniže ograničenje na dijelu puta između `a` i `b` [m/s]. */
export function najmanjeOgranicenje(dionice: readonly DionicaToka[], a: number, b: number): number {
  const od = Math.min(a, b);
  const doK = Math.max(a, b);
  let najmanje = dionicaToka(dionice, a).vMax;
  for (const d of dionice) {
    if (d.do < od || d.od > doK) continue;
    najmanje = Math.min(najmanje, d.vMax);
  }
  return najmanje;
}

/** Vrsta vozila za dionicu, iz jednog izvučenog broja u [0, 1). */
export function vrstaZa(put: DionicaToka["vrsta"], u: number): VrstaVozila {
  const spisak = MJESAVINA[put];
  const ukupno = spisak.reduce((a, [, udio]) => a + udio, 0);
  let prag = u * ukupno;
  for (const [vrsta, udio] of spisak) {
    if (prag < udio) return vrsta;
    prag -= udio;
  }
  return spisak[spisak.length - 1]![0];
}

/**
 * Srednji razmak između dva uzastopna vozila istog smjera koji nivo traži [m].
 *
 * U prozoru se broje oba smjera, pa na jedan smjer ide polovina broja.
 */
export function srednjiRazmak(nivo: Level): number {
  const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[nivo];
  return SAOBRACAJ_PROZOR / ((najmanje + najvise) / 4);
}

/**
 * Sredina eksponencijalnog dijela praznine između kolona [m].
 *
 * Bira se tako da, zajedno sa razmacima unutar kolona, srednji razmak bude onaj
 * koji nivo traži. Praznina je odsječena na `PRAZNINA_MAX`, pa se sredina ne
 * može izraziti formulom nego se traži polovljenjem — očekivanje odsječene
 * praznine raste sa sredinom, pa polovljenje uvijek nađe rješenje.
 */
export function sredinaPraznine(nivo: Level, uKoloni: number): number {
  const q = 1 - 1 / KOLONA_PO_NIVOU[nivo];
  const trazeno = (srednjiRazmak(nivo) - q * uKoloni) / (1 - q) - PRAZNINA_MIN;
  const rep = PRAZNINA_MAX - PRAZNINA_MIN;
  const ocekivano = (mu: number) => mu * (1 - Math.exp(-rep / mu));
  if (trazeno <= 1) return 1;
  let lo = 1;
  let hi = rep * 50;
  if (ocekivano(hi) <= trazeno) return hi;
  for (let i = 0; i < 50; i++) {
    const mu = (lo + hi) / 2;
    if (ocekivano(mu) < trazeno) lo = mu;
    else hi = mu;
  }
  return (lo + hi) / 2;
}

/** Ono što se izvuče za jedno vozilo toka. */
export interface IzvucenoVozilo {
  vrsta: VrstaVozila;
  /** Koliki dio dozvoljene brzine drži. */
  udio: number;
  /** Najveća brzina bez obzira na ograničenje [m/s]; samo kamion na planini. */
  kapa: number | undefined;
  /** Razmak od prethodnog vozila istog izvora, od sredine do sredine [m]. */
  razmak: number;
}

/**
 * Jedno vozilo toka.
 *
 * `x` je mjesto PRETHODNOG vozila istog izvora: po dionici na kojoj je ono bira
 * se mješavina i razmak u koloni, jer se mjesto novog vozila tek računa iz tog
 * razmaka.
 */
export function izvuci(
  seed: number,
  dionice: readonly DionicaToka[],
  nivo: Level,
  izvor: IzvorSlovo,
  k: number,
  x: number,
  prethodnaDuzina: number,
): IzvucenoVozilo {
  const r = izvlacenje(seed, izvor, k);
  // Svi brojevi se izvlače uvijek i istim redom, bez obzira na to koji će se od
  // njih upotrijebiti — inače bi promjena jedne grane pomjerila sve ostale.
  const uVrsta = r();
  const uBrzina = r();
  const uKapa = r();
  const uKolona = r();
  const uOdstojanje = r();
  const uPraznina = r();

  const d = dionicaToka(dionice, x);
  const vrsta: VrstaVozila = izvor === "k" ? "kamion" : vrstaZa(d.vrsta, uVrsta);
  const [bLo, bHi] = BRZINA_VRSTE[vrsta];
  const kapa =
    vrsta === "kamion" && d.vrsta === "planinski"
      ? KAMION_PLANINA[0] + (KAMION_PLANINA[1] - KAMION_PLANINA[0]) * uKapa
      : undefined;

  // U koloni se vozi na odstojanju u sekundama, dakle brzinom kojom se tu vozi.
  const [oLo, oHi] = KOLONA_ODSTOJANJE;
  const brzina = Math.min(d.vMax * TIPICAN_UDIO, kapa ?? Infinity);
  const uKoloni =
    (prethodnaDuzina + VOZILA[vrsta].duzina) / 2 + brzina * (oLo + (oHi - oLo) * uOdstojanje);
  const tipicnoUKoloni = VOZILA.auto.duzina + d.vMax * TIPICAN_UDIO * ((oLo + oHi) / 2);
  const praznina =
    PRAZNINA_MIN +
    Math.min(
      PRAZNINA_MAX - PRAZNINA_MIN,
      -Math.log(1 - uPraznina) * sredinaPraznine(nivo, tipicnoUKoloni),
    );
  const uKolonu = uKolona < 1 - 1 / KOLONA_PO_NIVOU[nivo];
  return { vrsta, udio: bLo + (bHi - bLo) * uBrzina, kapa, razmak: uKolonu ? uKoloni : praznina };
}

/**
 * Mjesta na putu na kojima se ispred igrača pojavi kamion [m].
 *
 * Na svakoj planinskoj dionici dužoj od `KAMION_NAJKRACA`: prvi kad igrač na nju
 * zađe `KAMION_ISPRED` metara, pa po jedan na svakih `KAMION_RAZMAK`. Posljednji
 * mora stati prije kraja dionice, da se planinski kamion ne pojavi na magistrali
 * iza nje.
 */
export function zagarantovaniKamioni(dionice: readonly DionicaToka[]): number[] {
  const out: number[] = [];
  for (const d of dionice) {
    if (d.vrsta !== "planinski" || d.do - d.od < KAMION_NAJKRACA) continue;
    for (let x = d.od + KAMION_ISPRED; x + 2 * KAMION_ISPRED < d.do; x += KAMION_RAZMAK) out.push(x);
  }
  return out;
}
