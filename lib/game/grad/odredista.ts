/**
 * Odredišta (faza 6, stavka 9): imenovani javni objekti do kojih se vozi u
 * zadacima („Vožnja od–do": Klinički centar, Tehnička škola, Delta City…) i
 * znamenitosti (pasoš, stavka 9f). Iz OSM-a dolaze ime, vrsta i središte
 * (`scripts/osm/upitiGrad.mjs`, upit `odredista`); u paketu su objekti vrste
 * `odrediste` sa podatkom „kategorija|ime".
 *
 * Svako odredište je vezano za najbližu ulicu kojom auto smije voziti — tu je
 * cilj vožnje (ulaz), jer se do same zgrade ne vozi.
 */
import { GRAD_ODREDISTE_DO_ULICE } from "../sim/config";
import type { Point } from "../sim/types";
import { ZA_BOTA } from "./botGrad";
import { oseBlizu } from "./povrsina";
import type { SvijetGrada } from "./svijet";

export type KategorijaOdredista =
  | "skola"
  | "zdravlje"
  | "ustanova"
  | "kultura"
  | "bogomolja"
  | "stanica"
  | "sport"
  | "trgovina"
  | "znamenitost";

export const KATEGORIJE_ODREDISTA: readonly KategorijaOdredista[] = [
  "skola",
  "zdravlje",
  "ustanova",
  "kultura",
  "bogomolja",
  "stanica",
  "sport",
  "trgovina",
  "znamenitost",
];

/** Javna zdravstvena ustanova po imenu — privatne klinike i laboratorije su firme (odjeljak 10). */
const JAVNO_ZDRAVLJE = /^(centralni )?dom zdravlja|^klini[cč]ki centar|^klinik[ae] za|^infektivna klinika|^institut za|^zavod za|^hitna pomo[cć]|^crveni krst/i;
/** Škola po imenu (ne kurs ni firma za obuku). */
const SKOLA = /[sš]kol|gimnazij|fakultet|univerzitet|^o[sš]\b|^ju\b/i;
/** Sportski objekat po imenu (ne teretana ni spa centar). */
const SPORT = /sportski centar|bazen|dvorana|hala/i;

/** Kategorija iz OSM oznaka; `null` — nije odredište (ili je firma, odjeljak 10). */
export function kategorijaOdredista(t: Record<string, string | undefined>): KategorijaOdredista | null {
  const a = t.amenity ?? "";
  const ime = t.name ?? "";
  if (["school", "college", "university"].includes(a)) return SKOLA.test(ime) ? "skola" : null;
  if (["hospital", "clinic"].includes(a)) return JAVNO_ZDRAVLJE.test(ime) ? "zdravlje" : null;
  if (["townhall", "courthouse", "police", "fire_station", "library"].includes(a)) return "ustanova";
  if (["theatre", "arts_centre"].includes(a) || t.tourism === "museum") return "kultura";
  if (a === "place_of_worship") return "bogomolja";
  if (a === "bus_station" || t.railway === "station") return "stanica";
  if (t.leisure === "stadium") return "sport";
  if (t.leisure === "sports_centre") return !a && SPORT.test(ime) ? "sport" : null;
  if (t.shop === "mall" || a === "marketplace") return "trgovina";
  if (t.tourism === "attraction" || t.historic) return "znamenitost";
  return null;
}

/** Podatak objekta u paketu. */
export const zapisiOdrediste = (k: KategorijaOdredista, ime: string) => `${k}|${ime.trim()}`;

export function procitajOdrediste(podatak: string): { kategorija: KategorijaOdredista; ime: string } | null {
  const i = podatak.indexOf("|");
  if (i < 0) return null;
  const kategorija = podatak.slice(0, i) as KategorijaOdredista;
  const ime = podatak.slice(i + 1).trim();
  return KATEGORIJE_ODREDISTA.includes(kategorija) && ime ? { kategorija, ime } : null;
}

export interface Odrediste {
  /** Redni broj u spisku grada — stabilan za isti paket. */
  id: number;
  ime: string;
  kategorija: KategorijaOdredista;
  /** Središte objekta (iz OSM-a). */
  tacka: Point;
  /** Ulaz: tačka na osovini najbliže vozne ulice, ivica i metara od njenog početka. */
  ulaz: Point;
  ivica: number;
  s: number;
}

/**
 * Odredišta grada, po imenu (isto ime dva puta — jedno, prvo nađeno), samo
 * ona sa voznom ulicom do `GRAD_ODREDISTE_DO_ULICE` m. Poređana po imenu.
 * Duple (tačka i zgrada istog objekta) uklanja već priprema paketa.
 */
export function odredistaGrada(sv: SvijetGrada): Odrediste[] {
  const { paket, povrsina, mreza } = sv;
  const z = paket.zaglavlje;
  const n = paket.n;
  const vrsta = z.vrsteObjekata.indexOf("odrediste");
  if (vrsta < 0) return [];
  const vidjena = new Set<string>();
  const out: Omit<Odrediste, "id">[] = [];
  for (let i = 0; i < n.obVrsta.length; i++) {
    if (n.obVrsta[i] !== vrsta) continue;
    const o = procitajOdrediste(z.stringovi[n.obPodatak[i]!] ?? "");
    if (!o) continue;
    const kljuc = o.ime.toLocaleLowerCase("sr");
    if (vidjena.has(kljuc)) continue;
    const tacka = { x: n.obXY[2 * i]!, y: n.obXY[2 * i + 1]! };
    const osa = oseBlizu(povrsina, tacka.x, tacka.y, GRAD_ODREDISTE_DO_ULICE)
      .filter((x) => ZA_BOTA(mreza.ivice[x.ivica]!))
      .sort((a, b) => a.d - b.d)[0];
    if (!osa) continue;
    vidjena.add(kljuc);
    out.push({ ime: o.ime, kategorija: o.kategorija, tacka, ulaz: osa.tacka, ivica: osa.ivica, s: osa.s });
  }
  return out.sort((a, b) => a.ime.localeCompare(b.ime, "sr")).map((x, id) => ({ ...x, id }));
}
