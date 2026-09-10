/**
 * Puna i isprekidana linija na sredini puta.
 *
 * OSM ne nosi oznake na kolovozu na koje bi se moglo osloniti, pa se zabrana
 * preticanja ne čita nego IZVODI iz onoga što o putu već znamo: iz krivina, iz
 * ograničenja brzine i iz mjesta na kojima put presijeca drugi put.
 *
 * Isti podatak koriste i sud i crtanje. Da se linija crta iz jednog računa a
 * sudi po drugom, igrač bi dobijao prekršaj tamo gdje na ekranu piše da smije —
 * a to je najgora vrsta greške u igri koja uči pravila.
 *
 * Sve je u SABIJENIM koordinatama, dakle u onome što se stvarno vozi; jedino
 * poluprečnik krivine dolazi iz stvarne geometrije, kao i tabla nad njom.
 */

import {
  NO_OVERTAKE_BEFORE_JUNCTION,
  NO_OVERTAKE_CURVE_LEAD,
  NO_OVERTAKE_RADIUS,
  SETTLEMENT_V,
} from "../sim/config";
import type { RoadCurve } from "../sim/types";

/** Dionica puta na kojoj je razdjelna linija puna. */
export interface Zabrana {
  from: number;
  to: number;
}

export interface ZabraneUlaz {
  duzina: number;
  krivine: readonly RoadCurve[];
  /** Ograničenje na mjestu `s`; po njemu se prepoznaje naselje. */
  vMaxNa?: (s: number) => number;
  /** Mjesta na kojima se ulazi u raskrsnicu ili u grad [m]. */
  raskrsnice?: readonly number[];
  /** Korak kojim se traži naselje [m]. Sitniji korak ne mijenja ishod. */
  korak?: number;
}

/**
 * Gdje je razdjelna linija puna.
 *
 * Vraća sređen i spojen niz: dionice se preklapaju (krivina pred raskrsnicom u
 * naselju je sve troje odjednom), a preklopljene zabrane bi se crtale jedna
 * preko druge i mjerile dvaput.
 */
export function zabraneNaPutu({
  duzina,
  krivine,
  vMaxNa,
  raskrsnice = [],
  korak = 20,
}: ZabraneUlaz): Zabrana[] {
  const sirove: Zabrana[] = [];

  // Krivine: puna linija pokriva luk i po `NO_OVERTAKE_CURVE_LEAD` sa svake
  // strane, jer se u krivinu ulazi ranije nego što ona počne.
  for (const k of krivine) {
    if (k.radius >= NO_OVERTAKE_RADIUS) continue;
    sirove.push({
      from: k.atS - k.arc / 2 - NO_OVERTAKE_CURVE_LEAD,
      to: k.atS + k.arc / 2 + NO_OVERTAKE_CURVE_LEAD,
    });
  }

  // Naselje: prepoznaje se po ograničenju, jer drugog podatka o naselju nema.
  if (vMaxNa) {
    let pocetak: number | null = null;
    for (let s = 0; s <= duzina + korak; s += korak) {
      const uNaselju = s <= duzina && vMaxNa(Math.min(s, duzina)) <= SETTLEMENT_V + 0.01;
      if (uNaselju && pocetak === null) pocetak = s;
      if (!uNaselju && pocetak !== null) {
        // Traži se po koraku, pa se prava ivica naselja nalazi negdje unutar
        // jednog koraka; zato se dionica proširi za korak na obje strane. Bolje
        // da puna linija počne dvadeset metara ranije nego da tabla „naselje"
        // stoji, a linija još nije počela.
        sirove.push({ from: pocetak - korak, to: s });
        pocetak = null;
      }
    }
  }

  // Raskrsnica: zabrana počinje prije nje i traje do nje.
  for (const s of raskrsnice) {
    sirove.push({ from: s - NO_OVERTAKE_BEFORE_JUNCTION, to: s });
  }

  return spoji(sirove, duzina);
}

/** Sređivanje: stezanje na dionicu, sortiranje i spajanje onoga što se dodiruje. */
export function spoji(niz: readonly Zabrana[], duzina: number): Zabrana[] {
  const stegnuto = niz
    .map((z) => ({ from: Math.max(0, Math.min(duzina, z.from)), to: Math.max(0, Math.min(duzina, z.to)) }))
    .filter((z) => z.to > z.from)
    .sort((a, b) => a.from - b.from);

  const out: Zabrana[] = [];
  for (const z of stegnuto) {
    const zadnja = out[out.length - 1];
    if (zadnja && z.from <= zadnja.to) zadnja.to = Math.max(zadnja.to, z.to);
    else out.push({ ...z });
  }
  return out;
}

/** Da li je na mjestu `s` razdjelna linija puna. */
export function zabranjeno(zabrane: readonly Zabrana[] | undefined, s: number): boolean {
  if (!zabrane) return false;
  // Zabrane su sređene, pa je binarna pretraga dovoljna i za rutu od trideset
  // kilometara — ovo se zove u svakom koraku simulacije.
  let lo = 0;
  let hi = zabrane.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const z = zabrane[mid]!;
    if (s < z.from) hi = mid - 1;
    else if (s > z.to) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Koliki dio dionice nosi punu liniju — za mjerenje, ne za igru. */
export function udioZabrane(zabrane: readonly Zabrana[], duzina: number): number {
  if (duzina <= 0) return 0;
  return zabrane.reduce((a, z) => a + (z.to - z.from), 0) / duzina;
}
