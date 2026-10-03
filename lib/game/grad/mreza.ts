import {
  CAR_WIDTH,
  GRAD_NAJUZA_ULICA,
  GRAD_POLUKRUZNO_UGAO,
  GRAD_SKRETANJE_UGAO,
  GRAD_SIRINA_TRAKE,
  GRAD_TRAKE_PO_KLASI,
} from "../sim/config";
import { cumulative, pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import {
  IVICA_BUS_NAPRIJED,
  IVICA_BUS_NAZAD,
  IVICA_KRUZNI,
  IVICA_MOST,
  IVICA_TUNEL,
  IVICA_UKLONJENA,
  IVICA_VOZNA,
  IVICA_ZATVORENA,
  LINIJA_BEZ,
  LINIJA_DVOSTRUKA,
  LINIJA_PUNA,
  type Paket,
} from "./paket";

/**
 * Mreža ulica grada, iz paketa: čvorovi (raskrsnice i krajevi ulica) i ivice
 * između njih.
 *
 * Ovo je prvi dio novog motora (faza 6): raskrsnica više nije šablon sa četiri
 * kraka nego čvor sa onoliko ulica koliko ih OSM kaže, pod stvarnim uglovima.
 */

export interface Ivica {
  i: number;
  a: number;
  b: number;
  /** Tačke od `a` do `b`, uključujući oba kraja. */
  tacke: Point[];
  cum: number[];
  duzina: number;
  klasa: string;
  /** 1: jednosmjerna od `a` ka `b`; -1: od `b` ka `a`; 0: dvosmjerna. */
  smjer: -1 | 0 | 1;
  /** Širina kolovoza [m] — iz broja traka, ili po klasi kad ga OSM nema. */
  sirina: number;
  /** Da li je broj traka iz OSM-a ili pretpostavljen po klasi. */
  trakePoznate: boolean;
  /**
   * Trake u smjeru `a → b` i `b → a`. Kad OSM ne kaže podjelu, dvosmjerna
   * ulica se dijeli na pola (neparan broj: jedna više u smjeru `a → b`). Ovo je
   * mjera za crtanje oznaka; pravila ne sude po pretpostavljenom broju.
   */
  trakeNaprijed: number;
  trakeNazad: number;
  /** `turn:lanes` u smjeru `a → b` i `b → a`, lijevo nadesno; prazno kad ih nema. */
  skretanjaNaprijed: string;
  skretanjaNazad: string;
  vozna: boolean;
  kruzni: boolean;
  /** Most ili tunel — tu je polukružno okretanje zabranjeno. */
  most: boolean;
  tunel: boolean;
  /**
   * Nivo ulice: OSM `layer`, a bez njega most +1, tunel −1, ostalo 0. Ulice
   * na različitim nivoima se ukrštaju bez raskrsnice — vozila na njima se ne
   * vide i ne sudaraju.
   */
  nivo: number;
  ime: string;
  /** Ograničenje iz OSM-a [km/h]; `null` kad ga nema. */
  brzina: number | null;
  /** OSM id puta od kojeg je ivica; 0 za ulicu koju je dodao overlay. */
  osm: number;
  /** Gradilište (overlay): crta se sa ogradom, ne vozi se. */
  zatvorena: boolean;
  /** Overlay ju je uklonio (greška u OSM-u): ne crta se, ne vozi se. */
  uklonjena: boolean;
  /** Krajnja desna traka u smjeru `a → b` (`naprijed`) / `b → a` je autobuska (overlay). */
  busNaprijed: boolean;
  busNazad: boolean;
  /** Razdjelna linija smjerova: iz overlay-a, inače isprekidana. */
  linija: "isprekidana" | "puna" | "dvostruka" | "bez";
  /** Metara pune razdjelne linije, i punih linija između traka, pred svakim krajem u raskrsnici (overlay). */
  punaPrije: number;
  trakePrije: number;
}

export interface Mreza {
  cvorovi: Point[];
  ivice: Ivica[];
  /** Ivice koje dodiruju čvor, po čvoru. */
  izCvora: number[][];
}

/** Širina kolovoza ivice [m] i broj traka po smjeru. */
function sirinaKolovoza(
  p: Paket,
  i: number,
  klasa: string,
): { sirina: number; poznate: boolean; naprijed: number; nazad: number } {
  const n = p.n;
  const poznato = n.ivTrake[i]! || n.ivTrakeNaprijed[i]! + n.ivTrakeNazad[i]!;
  const trake = poznato || GRAD_TRAKE_PO_KLASI[klasa] || 2;
  const smjer = n.ivSmjer[i]!;
  let naprijed: number;
  let nazad: number;
  if (smjer > 0) [naprijed, nazad] = [trake, 0];
  else if (smjer < 0) [naprijed, nazad] = [0, trake];
  else if (n.ivTrakeNaprijed[i]! > 0 && n.ivTrakeNazad[i]! > 0) [naprijed, nazad] = [n.ivTrakeNaprijed[i]!, n.ivTrakeNazad[i]!];
  else if (trake < 2) [naprijed, nazad] = [1, 1]; // uska dvosmjerna: po traka u svakom smjeru, bez linije
  else [naprijed, nazad] = [Math.ceil(trake / 2), Math.floor(trake / 2)];
  return { sirina: Math.max(GRAD_NAJUZA_ULICA, trake * GRAD_SIRINA_TRAKE), poznate: poznato > 0, naprijed, nazad };
}

export function napraviMrezu(p: Paket): Mreza {
  const n = p.n;
  const cvorovi: Point[] = [];
  for (let k = 0; k < n.cvXY.length; k += 2) cvorovi.push({ x: n.cvXY[k]!, y: n.cvXY[k + 1]! });
  const izCvora: number[][] = cvorovi.map(() => []);
  const ivice: Ivica[] = [];
  for (let i = 0; i < n.ivA.length; i++) {
    const tacke: Point[] = [];
    for (let k = n.ivOd[i]!; k < n.ivOd[i + 1]!; k++) tacke.push({ x: n.ivXY[2 * k]!, y: n.ivXY[2 * k + 1]! });
    const cum = cumulative(tacke);
    const klasa = p.zaglavlje.klase[n.ivKlasa[i]!] ?? "road";
    const { sirina, poznate, naprijed, nazad } = sirinaKolovoza(p, i, klasa);
    const smjer = n.ivSmjer[i]!;
    const zastavice = n.ivZastavice[i]!;
    const linija = n.ivLinija[i] ?? 0;
    ivice.push({
      i,
      a: n.ivA[i]!,
      b: n.ivB[i]!,
      tacke,
      cum,
      duzina: cum[cum.length - 1] ?? 0,
      klasa,
      smjer: smjer > 0 ? 1 : smjer < 0 ? -1 : 0,
      sirina,
      trakePoznate: poznate,
      trakeNaprijed: naprijed,
      trakeNazad: nazad,
      skretanjaNaprijed: p.zaglavlje.stringovi[n.ivTrakeSkretanja[i]!] ?? "",
      skretanjaNazad: p.zaglavlje.stringovi[n.ivTrakeSkretanjaNazad[i]!] ?? "",
      vozna: (zastavice & IVICA_VOZNA) !== 0,
      kruzni: (zastavice & IVICA_KRUZNI) !== 0,
      most: (zastavice & IVICA_MOST) !== 0,
      tunel: (zastavice & IVICA_TUNEL) !== 0,
      nivo: (n.ivSloj[i] ?? 0) !== 0 ? n.ivSloj[i]! : (zastavice & IVICA_MOST) !== 0 ? 1 : (zastavice & IVICA_TUNEL) !== 0 ? -1 : 0,
      ime: p.zaglavlje.stringovi[n.ivIme[i]!] ?? "",
      brzina: n.ivBrzina[i]! > 0 ? n.ivBrzina[i]! : null,
      osm: n.ivOsm[i] ?? 0,
      zatvorena: (zastavice & IVICA_ZATVORENA) !== 0,
      uklonjena: (zastavice & IVICA_UKLONJENA) !== 0,
      busNaprijed: (zastavice & IVICA_BUS_NAPRIJED) !== 0,
      busNazad: (zastavice & IVICA_BUS_NAZAD) !== 0,
      linija: linija === LINIJA_PUNA ? "puna" : linija === LINIJA_DVOSTRUKA ? "dvostruka" : linija === LINIJA_BEZ ? "bez" : "isprekidana",
      punaPrije: n.ivPunaPrije[i] ?? 0,
      trakePrije: n.ivTrakePrije[i] ?? 0,
    });
    izCvora[n.ivA[i]!]!.push(i);
    if (n.ivB[i]! !== n.ivA[i]!) izCvora[n.ivB[i]!]!.push(i);
  }
  return { cvorovi, ivice, izCvora };
}

/**
 * Poprečni položaj u kojem se ulazi u ulicu [m od osovine, + je desno]: sredina
 * desne trake na dvosmjernoj ulici, sredina kolovoza na jednosmjernoj. Tako se
 * vozi i bez pravila — pravilo o traci dolazi u stavci 5.
 */
export function pocetniBok(iv: Ivica): number {
  if (iv.smjer !== 0) return 0;
  return Math.min(iv.sirina / 4, iv.sirina / 2 - CAR_WIDTH / 2);
}

/** Najveći poprečni pomak auta na ulici — da ostane na kolovozu [m]. */
export function najveciBok(iv: Ivica): number {
  return Math.max(0, iv.sirina / 2 - CAR_WIDTH / 2);
}

/** Najbliža vozna ivica tački, i mjesto na njoj — za start vožnje. */
export function najblizaIvica(m: Mreza, p: Point): { ivica: number; s: number; daljina: number } | null {
  let naj: { ivica: number; s: number; daljina: number } | null = null;
  for (const iv of m.ivice) {
    if (!iv.vozna) continue;
    for (let k = 0; k + 1 < iv.tacke.length; k++) {
      const a = iv.tacke[k]!;
      const b = iv.tacke[k + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
      const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
      if (!naj || d < naj.daljina) naj = { ivica: iv.i, s: iv.cum[k]! + Math.sqrt(l2) * t, daljina: d };
    }
  }
  return naj;
}

/**
 * Pravac vožnje po ivici blizu njenog kraja: na ulazu u čvor (`naKraju`) ili na
 * izlazu iz njega — mjeren do tačke nekoliko metara dalje, a ne po prvom
 * segmentu (OSM zna imati tačku na pola metra od čvora). `smjer` 1 je `a → b`.
 *
 * Po ovome i sudija i bot određuju manevar u raskrsnici — lijevo, pravo,
 * desno — iz rasporeda ulica, ne iz ugla auta: skretanje je izlazak na drugi
 * krak, koliko god auto zaokrenuo.
 */
export function pravacKraja(iv: Ivica, smjer: 1 | -1, naKraju: boolean): Point {
  const d = Math.min(8, iv.duzina / 2);
  const sA = smjer === 1 ? (naKraju ? iv.duzina - d : 0) : naKraju ? d : iv.duzina;
  const sB = smjer === 1 ? (naKraju ? iv.duzina : d) : naKraju ? 0 : iv.duzina - d;
  const a = pointAt(iv.tacke, iv.cum, sA);
  const b = pointAt(iv.tacke, iv.cum, sB);
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/** Ugao skretanja [°] sa pravca `od` na `do_`; pozitivan je udesno (`y` na jug). */
export function ugaoSkretanja(od: Point, do_: Point): number {
  return (Math.atan2(od.x * do_.y - od.y * do_.x, od.x * do_.x + od.y * do_.y) * 180) / Math.PI;
}

export type Manevar = "lijevo" | "pravo" | "desno" | "polukruzno";

/**
 * Manevar iz rasporeda ulica: sa ivice `ulazna` koja u raskrsnicu ulazi preko
 * čvora `cvorUlaza`, na ivicu `izlazna` koja iz nje izlazi preko `cvorIzlaza`.
 * Ovim pravilom sude sudija i bot, i po njemu overlay pretvara znak („zabrana
 * skretanja lijevo") u izlaze koje zabranjuje — pa znak znači tačno ono za šta
 * se sudi.
 */
export function manevarKrakova(ulazna: Ivica, cvorUlaza: number, izlazna: Ivica, cvorIzlaza: number): Manevar {
  const ugao = ugaoSkretanja(
    pravacKraja(ulazna, ulazna.b === cvorUlaza ? 1 : -1, true),
    pravacKraja(izlazna, izlazna.a === cvorIzlaza ? 1 : -1, false),
  );
  return manevarIzUgla(ugao);
}

/** Manevar po uglu skretanja [°]: preko `GRAD_POLUKRUZNO_UGAO` je polukružno. */
export function manevarIzUgla(ugao: number): Manevar {
  return Math.abs(ugao) > GRAD_POLUKRUZNO_UGAO
    ? "polukruzno"
    : ugao > GRAD_SKRETANJE_UGAO
      ? "desno"
      : ugao < -GRAD_SKRETANJE_UGAO
        ? "lijevo"
        : "pravo";
}
