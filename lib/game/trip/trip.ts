/**
 * Tok putovanja kroz Crnu Goru.
 *
 * Čista logika, bez Reacta i bez crtanja — kao i `shift/session.ts`. Ovdje
 * stoji sve što se ne smije provjeravati klikanjem: koji su pravci ponuđeni,
 * šta se dešava na kraju puta, koje se znamenitosti računaju kao viđene i koje
 * sjeme dobija koja dionica.
 *
 * Putovanje nema ni život ni bodove. Dok pravila nisu napravljena, jedini
 * neuspjeh je sudar, a on ne oduzima ništa osim vremena: ista dionica se vozi
 * ponovo, sa istim sjemenom, pa je i druga vožnja ista situacija.
 */

import { CITY_JUNCTIONS_MAX, CITY_JUNCTIONS_MIN } from "../sim/config";
import { rng } from "../sim/geometry";
import type { Landmark } from "../road/landmarks";
import { landmarksAtNode, landmarksOnEdge } from "../road/landmarks";
import {
  type Putokaz,
  type RoadEdge,
  type RoadNode,
  edgeById,
  nodeById,
  otherEnd,
  putokazi,
} from "../road/roadGraph";
import { dionica } from "../road/segment";
import type { Scenario } from "../sim/types";

export interface TripState {
  seed: number;
  /** Čvor u kojem se putnik nalazi. */
  at: string;
  /** Čvor iz kojeg je došao; `null` na polasku. */
  from: string | null;
  /** Koliko je dionica prevezeno. */
  legs: number;
  /** Pređeni kilometri po karti, ne po dionici koja se vozi. */
  km: number;
  /** Čvorovi po redu prvog dolaska, uključujući polazni. */
  visited: string[];
  /** Znamenitosti koje su ostale iza — svaka se broji jednom. */
  seen: string[];
  /**
   * Ivice koje su prevezene, u bilo kom smjeru.
   *
   * Postoji zbog karte: „gdje sam bio" je pitanje puteva, ne gradova. Bez
   * ovoga bi karta mogla samo da oboji čvorove, pa se ne bi vidjelo kojim se
   * putem između njih išlo.
   */
  driven: string[];
  /** Da li su sezonski putevi prohodni. */
  ljeto: boolean;
}

export function startTrip(at: string, seed: number, ljeto = true): TripState {
  return { seed, at, from: null, legs: 0, km: 0, visited: [at], seen: [], driven: [], ljeto };
}

/** Šta putokaz nudi odavde. */
export function smjerovi(state: TripState): Putokaz {
  return putokazi(state.at, { odakle: state.from, ljeto: state.ljeto });
}

/** Da li se ivica vozi unatrag, od `b` prema `a`. */
export const obrnuto = (state: TripState, edge: RoadEdge): boolean => state.at === edge.b;

/**
 * Sjeme jedne dionice.
 *
 * Zavisi od putovanja, rednog broja dionice i same ivice — pa je ponovljena
 * vožnja poslije sudara ista situacija, a ista ivica u drugom putovanju nije.
 */
export function legSeed(state: TripState, edge: RoadEdge): number {
  let h = (state.seed ^ (state.legs * 0x9e3779b1)) >>> 0;
  for (let i = 0; i < edge.id.length; i++) {
    h ^= edge.id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Scenario dionice koja se sad vozi. */
export function dionicaZa(state: TripState, edge: RoadEdge): Scenario {
  return dionica(edge, legSeed(state, edge), obrnuto(state, edge));
}

/**
 * Znamenitosti jedne dionice: one uz put i one u mjestu u koje se stiže.
 *
 * Ono što je označeno kao `cardOnly` ne stoji uz put nego na planinskoj stazi,
 * pa se prolaskom ne vidi i ovdje se ne broji. Uz svoj čvor se i dalje vodi —
 * do njega se dolazi, ali se pored njega ne prolazi.
 */
export function znamenitosti(state: TripState, edge: RoadEdge): Landmark[] {
  const cilj = otherEnd(edge, state.at);
  return [
    ...landmarksOnEdge(edge.id, obrnuto(state, edge)),
    ...landmarksAtNode(cilj).filter((l) => !l.cardOnly),
  ];
}

/**
 * Gradska vožnja u mjestu u koje se stiže.
 *
 * Kroz opštinu se prolazi ulicom, dakle nizom raskrsnica. Čvorište i granični
 * prelaz nisu grad — tamo se samo bira pravac, odnosno okreće.
 *
 * Sjeme je izvedeno iz sjemena same dionice, pa je i gradska vožnja ista kad
 * se dionica ponovi poslije sudara.
 */
export function gradskaVoznja(
  state: TripState,
  edge: RoadEdge,
): { seed: number; count: number } {
  const cilj = nodeById(otherEnd(edge, state.at));
  const seed = (legSeed(state, edge) ^ 0x5bf03635) >>> 0;
  if (cilj?.kind !== "opstina") return { seed, count: 0 };
  const r = rng(seed);
  const raspon = CITY_JUNCTIONS_MAX - CITY_JUNCTIONS_MIN + 1;
  return { seed, count: CITY_JUNCTIONS_MIN + Math.floor(r() * raspon) };
}

/** Stanje poslije pređene dionice. */
export function stigao(state: TripState, edge: RoadEdge): TripState {
  const cilj = otherEnd(edge, state.at);
  const vidjeno = new Set(state.seen);
  for (const l of znamenitosti(state, edge)) vidjeno.add(l.id);
  return {
    ...state,
    at: cilj,
    from: state.at,
    legs: state.legs + 1,
    km: state.km + edge.km,
    visited: state.visited.includes(cilj) ? state.visited : [...state.visited, cilj],
    seen: [...vidjeno],
    driven: state.driven.includes(edge.id) ? state.driven : [...state.driven, edge.id],
  };
}

/** Čvor u kojem se putnik nalazi, ako uopšte postoji. */
export const gdjeSam = (state: TripState): RoadNode | undefined => nodeById(state.at);

/** Koliko je opština obiđeno — jedina brojka koja putovanje mjeri. */
export const opstina = (state: TripState): number =>
  state.visited.filter((id) => nodeById(id)?.kind === "opstina").length;

/**
 * Da li je stanje i dalje smisleno.
 *
 * Postoji zbog pamćenja: sačuvano putovanje može biti starije od izmjene u
 * grafu, pa se prije nastavka provjerava da čvorovi i veza još postoje. Bolje
 * ponuditi novo putovanje nego nastaviti iz čvora kojeg više nema.
 */
export function ispravno(state: TripState): boolean {
  if (!nodeById(state.at)) return false;
  if (state.from !== null && !nodeById(state.from)) return false;
  if (state.from !== null) {
    const veza = [...new Set([state.at, state.from])];
    if (veza.length === 2) {
      const ima = [`${state.from}--${state.at}`, `${state.at}--${state.from}`].some(
        (id) => edgeById(id) !== undefined,
      );
      if (!ima) return false;
    }
  }
  return (
    state.visited.every((id) => nodeById(id) !== undefined) &&
    state.driven.every((id) => edgeById(id) !== undefined)
  );
}

/**
 * Sačuvano putovanje iz skladišta.
 *
 * Provjerava se i oblik i smisao: u `localStorage` može stajati bilo šta —
 * ručno izmijenjeno, iz starije verzije, ili iz vremena kad je graf imao
 * drugačije čvorove. U svakom takvom slučaju je ispravno ponuditi novo
 * putovanje, a ne pokušavati da se stanje popravlja.
 */
export function parseTrip(raw: unknown): TripState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const niz = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((y) => typeof y === "string");
  if (
    typeof v.seed !== "number" ||
    typeof v.at !== "string" ||
    (v.from !== null && typeof v.from !== "string") ||
    typeof v.legs !== "number" ||
    typeof v.km !== "number" ||
    typeof v.ljeto !== "boolean" ||
    !niz(v.visited) ||
    !niz(v.seen) ||
    (v.driven !== undefined && !niz(v.driven))
  ) {
    return null;
  }
  const state: TripState = {
    seed: v.seed,
    at: v.at,
    from: (v.from as string | null) ?? null,
    legs: v.legs,
    km: v.km,
    visited: v.visited,
    seen: v.seen,
    // Putovanja sačuvana prije karte nemaju spisak pređenih puteva; prazan
    // spisak je tačan opis takvog stanja, pa se ne odbija zbog toga.
    driven: v.driven ?? [],
    ljeto: v.ljeto,
  };
  return ispravno(state) ? state : null;
}
