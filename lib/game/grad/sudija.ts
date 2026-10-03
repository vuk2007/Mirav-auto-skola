import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BRZINA_TRAJE,
  GRAD_BUS_TRAJE,
  GRAD_CEKA_NA_ULAZ,
  GRAD_IZLAZ_POTVRDA,
  GRAD_LIJEVO_TRAJE,
  GRAD_PRILAZ_DO,
  GRAD_PUNA_POSLIJE_PROMJENE,
  GRAD_SIRINA_TRAKE,
  GRAD_PRSTEN_IZLAZ,
  GRAD_PRSTEN_RUB,
  GRAD_PRSTEN_SREDINA,
  GRAD_SKRETANJE_UGAO,
  GRAD_STAJALISTE_DUZINA,
  INDICATOR_OFF_AFTER,
  LINE_CROSS_TOL,
  GRAD_STAJANJE_TRAJE,
  GRAD_SUDIJA_DO_ULICE,
  GRAD_SUPROTNO_BRZINA,
  GRAD_SUPROTNO_TRAJE,
  GRAD_TOLERANCIJA_BRZINE,
  GRAD_ZEBRA_DUBINA,
  GRAD_ZEBRA_VRSTE,
  STOP_HOLD,
  STOP_ZONE,
  STOPPED_SPEED,
  YELLOW_COMMIT_TTC,
  type Level,
} from "../sim/config";
import type { Point } from "../sim/types";
import { manevarIzUgla, manevarKrakova, pravacKraja, ugaoSkretanja, type Ivica, type Manevar, type Mreza } from "./mreza";
import { BEZ, type Paket } from "./paket";
import { najblizaOsa, oseBlizu, type OsaBlizu, type Povrsina } from "./povrsina";
import {
  prekrsenaZabrana,
  svjetlo,
  svjetloPoManevru,
  zabranaKraka,
  zelenaStrelica,
  type Krak,
  type Raskrsnice,
  type Svjetlo,
  type Zabrana,
} from "./raskrsnica";
import { napraviOgranicenja, ogranicenjeNa, type Ogranicenja } from "./brzine";
import { linijeSaVrstom, pojasBusa, produzeci, punaNa, type Produzeci } from "./linije";
import type { Zona } from "./overlay";
import { headingAt, pointAt } from "../sim/geometry";
import type { SlobodnoVozilo } from "./slobodno";

/**
 * Sudija u gradu (faza 6, stavka 5d): prati igrača korak po korak i prijavljuje
 * prekršaje po istom modelu raskrsnice po kojem se znakovi i semafori crtaju.
 * Svaki prekršaj ima jedno pravilo i ono se igraču kaže.
 *
 * Ovdje su pravila koja važe i kad je igrač sam na ulici: crveno i žuto, STOP,
 * pogrešan smjer, zabrana skretanja, polukružno okretanje, brzina, lijeva
 * strana, zaustavljanje gdje se ne smije — i ono što dodaje editor (stavka
 * 6): znakovi skretanja i zabrane ulaska na kraku, svjetla po manevru, pune
 * linije, autobuska traka, ograničenje sa znaka i u zoni. Prednost prema drugima (stavka 7) i
 * pješaci (stavka 8) dolaze sa njima.
 *
 * Odluke korisnika (2026-09-30): zaustavljanje 2 s na zebri / u raskrsnici /
 * na stajalištu; U-okret zabranjen u jednosmjernoj, na mostu, u tunelu i u
 * raskrsnici sa semaforom; lijevom stranom dvosmjerne ulice najviše 3 s.
 * Odluke 2026-10-01: autobuskom trakom najviše 3 s (prolazak i ulazak radi
 * skretanja nisu prekršaj); ograničenje u zoni se sudi uz znak zone.
 */

export type VrstaGradskogPrekrsaja =
  | "redLight"
  | "stopSign"
  | "wrongWay"
  | "zabranaSkretanja"
  | "polukruzno"
  | "speeding"
  | "wrongSide"
  | "parkingViolation"
  | "indicatorMissing"
  | "indicatorWrong"
  | "indicatorLate"
  | "indicatorLeftOn"
  | "wrongLaneForTurn"
  | "laneDisciplineRoundabout"
  | "crossingSolidLine"
  | "busLane";

export interface GradskiPrekrsaj {
  vrsta: VrstaGradskogPrekrsaja;
  ozbiljnost: "fail" | "minor";
  /** Vrijeme simulacije [s]. */
  t: number;
  /** Gdje je auto bio. */
  x: number;
  y: number;
  /** Pojedinosti za karticu: ograničenje i brzina, vrsta zabrane, gdje je stao… */
  detalji: Record<string, string | number>;
}

/** Sve što sudija zna o gradu — gradi se jednom po vožnji. */
export interface GradZaSudiju {
  /** Paket (poslije overlay-a) — objekti pravila: znakovi uz ulicu, zebre, stajališta. */
  paket: Paket;
  mreza: Mreza;
  povrsina: Povrsina;
  raskrsnice: Raskrsnice;
  zabrane: Map<string, Zabrana[]>;
  odsjeci: Float32Array;
  /** Obilježene zebre po ivici: `s` sredine zebre. */
  zebre: Map<number, number[]>;
  /** Stajališta po ivici: `s` sredine i strana (+1 desno od `a → b`). */
  stajalista: Map<number, { s: number; strana: 1 | -1 }[]>;
  /**
   * Raskrsnica duža od kratkog kraka preliva se na ivicu iza njega (preko
   * čvora koji nije raskrsnica): ključ `2·ivica + kraj` (0 = `a`, 1 = `b`),
   * vrijednost raskrsnica i koliko metara od tog kraja ivice je još njena.
   */
  preliv: Map<number, { r: number; d: number }>;
  /** Ograničenja brzine: znak, zona, OSM, naselje (`brzine.ts`). */
  ogranicenja: Ogranicenja;
  /** Za pune linije pred raskrsnicom: produžeci ivica do raskrsnica i do promjene traka (`linije.ts`). */
  produzeci: Produzeci;
}

export function gradZaSudiju(
  paket: Paket,
  povrsina: Povrsina,
  raskrsnice: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  odsjeci: Float32Array,
  zone: readonly Zona[] = [],
): GradZaSudiju {
  const n = paket.n;
  const z = paket.zaglavlje;
  const zebre = new Map<number, number[]>();
  const stajalista = new Map<number, { s: number; strana: 1 | -1 }[]>();
  const kodovi = new Set(GRAD_ZEBRA_VRSTE.map((v) => z.stringovi.indexOf(v)).filter((k) => k >= 0));
  for (let o = 0; o < n.obVrsta.length; o++) {
    const vrsta = z.vrsteObjekata[n.obVrsta[o]!];
    if (vrsta === "crossing" && kodovi.has(n.obPodatak[o]!) && n.obIvica[o] !== BEZ) {
      zebre.set(n.obIvica[o]!, [...(zebre.get(n.obIvica[o]!) ?? []), n.obS[o]!]);
    } else if (vrsta === "bus_stop") {
      // Stajalište je u OSM-u tačka pored ulice (ili na njoj): veže se za
      // najbližu ulicu, na strani na kojoj je tačka.
      const osa = najblizaOsa(povrsina, n.obXY[2 * o]!, n.obXY[2 * o + 1]!, GRAD_SUDIJA_DO_ULICE + 6);
      if (!osa) continue;
      const l = stajalista.get(osa.ivica) ?? [];
      l.push({ s: osa.s, strana: osa.bok >= 0 ? 1 : -1 });
      stajalista.set(osa.ivica, l);
    }
  }
  const m = povrsina.mreza;
  return {
    paket,
    mreza: m,
    povrsina,
    raskrsnice,
    zabrane,
    odsjeci,
    zebre,
    stajalista,
    preliv: prelivi(m, raskrsnice, odsjeci),
    ogranicenja: napraviOgranicenja(paket, m, zone),
    produzeci: produzeci(m, odsjeci),
  };
}

const MANEVRI: readonly Manevar[] = ["lijevo", "pravo", "desno", "polukruzno"];

/** Prilaz raskrsnici sa kontrolisanog kraka — dok se ne pređe stop-linija. */
interface Prilaz {
  kljuc: string;
  r: number;
  k: number;
  /** Stop-linija: tačka na osovini kraka i pravac vožnje ka raskrsnici tu. */
  linija: Point;
  pravac: Point;
  /** Nos auta do stop-linije u prošlom koraku [m]; negativno je preko. */
  doLinije: number;
  stajao: number;
  svjetlo: Svjetlo | null;
  /** Kad je upaljeno žuto: da li je auto tada bio preblizu da stane. */
  zutoPrekasno: boolean;
  /**
   * Krak sa svjetlom po manevru (strelice): svjetlo i odluka na žuto za
   * svaki manevar posebno — sudi se kad se zna kuda je auto otišao.
   */
  poManevru: Record<Manevar, { svjetlo: Svjetlo | null; zutoPrekasno: boolean }> | null;
}

type Strana = "left" | "right";

/** Prolaz kroz raskrsnicu: odakle je auto ušao. */
interface Prolaz {
  r: number;
  ivica: number;
  cvor: number;
  pravac: Point;
  /** Žmigavac kad je auto ulazio u raskrsnicu, i prvi upaljen tek unutra. */
  zmigavacNaUlazu: Strana | null;
  upaljenUnutra: Strana | null;
  /** Strelice trake iz koje je ušao; `null` bez strelica. */
  strelice: string[] | null;
  /**
   * Izlazni krak: prva ivica na kojoj je auto kad izađe iz raskrsnice — ne ona
   * na kojoj je kad se izlaz potvrdi (kratak krak je tada već iza njega).
   */
  izlaz: OsaBlizu | null;
  /**
   * Ivica kojom je auto napustio ulazni čvor ka drugom čvoru iste raskrsnice
   * (unutrašnja, slip-traka); `null` dok je nema. Strelice ulazne trake važe
   * za taj čvor. Bira se na izlazu (`prviKorakProlaza`): kod čvora se auto
   * nađe i na asfaltu susjedne ivice, pa prva viđena nije uvijek prava.
   */
  prviKorak: number | null;
  /** Ivice iz ulaznog čvora ka drugom čvoru raskrsnice, i u koliko koraka je auto bio na svakoj. */
  prviKoraci: Map<number, number>;
  /** Pređeni put auta kad je prolaz počeo. */
  predjenoUlaz: number;
}

export interface Sudija {
  prekrsaji: GradskiPrekrsaj[];
  /** Za dijagnozu: svaki prolaz kroz raskrsnicu kako ga sudija vidi. */
  dnevnik?: (prolaz: { r: number; ulaz: number; izlaz: number; manevar: string; t: number }) => void;
  /** Ulazak u raskrsnicu `r` (početak prolaza) — za bota, koji po tome pali žmigavac. */
  naUlazu?: (r: number) => void;
  /** Žmigavac u prošlom koraku. */
  zmigavac: Strana | null;
  /** Poslije skretanja: strana žmigavca koji treba ugasiti, i pređeno od izlaska [m]. */
  poslijeSkretanja: { strana: Strana; predjeno: number } | null;
  /**
   * Vožnja kroz prsten kružnog toka: ulazni krak (ivica i čvor u raskrsnici
   * ulaska), i traka na sredini svake ivice prstena sa dvije trake.
   */
  prsten: {
    ulazIvica: number;
    ulazCvor: number;
    /** Strelice trake na prilazu — u kružnom toku opisuju izlaz iz prstena. */
    strelice: string[] | null;
    /** Traka na sredini ivice prstena, i pređeni put auta tada. */
    uzorci: { traka: "unutra" | "spolja"; predjeno: number }[];
    sredine: Set<number>;
  } | null;
  nivo: Level;
  prilaz: Prilaz | null;
  prolaz: Prolaz | null;
  /** Strelice trake u kojoj je auto bio u prošlom koraku van raskrsnice. */
  traka: string[] | null;
  /** Ulica na kojoj je auto (praćenje, vidi `ulicaAuta`). */
  ivicaAuta: number | null;
  /** Ivica i smjer u prošlom koraku (van raskrsnice). */
  ivica: number | null;
  smjer: 1 | -1;
  suprotnoT: number;
  suprotnoIvica: number | null;
  brzinaT: number;
  brzinaPrijavljena: boolean;
  lijevoT: number;
  lijevoPrijavljeno: boolean;
  stojiT: number;
  stojiPrijavljeno: boolean;
  /**
   * Stop-linija pređena kod svjetla po manevru: za koje manevre je tada bilo
   * crveno (ili kasno žuto) — sudi se na izlazu iz te raskrsnice.
   */
  crvenoPoManevru: { r: number; krsi: Partial<Record<Manevar, Svjetlo>> } | null;
  /** Tijelo auta preko pune linije u prošlom koraku (prijava jednom po prelasku). */
  punaPreko: boolean;
  busT: number;
  busPrijavljen: boolean;
  /** Ograničenje u prošlom koraku [km/h] — isto kao na brzinomjeru. */
  ogranicenje: number;
}

export function noviSudija(nivo: Level): Sudija {
  return {
    prekrsaji: [],
    zmigavac: null,
    poslijeSkretanja: null,
    prsten: null,
    nivo,
    prilaz: null,
    prolaz: null,
    traka: null,
    ivicaAuta: null,
    ivica: null,
    smjer: 1,
    suprotnoT: 0,
    suprotnoIvica: null,
    brzinaT: 0,
    brzinaPrijavljena: false,
    lijevoT: 0,
    lijevoPrijavljeno: false,
    stojiT: 0,
    stojiPrijavljeno: false,
    crvenoPoManevru: null,
    punaPreko: false,
    busT: 0,
    busPrijavljen: false,
    ogranicenje: 0,
  };
}

/**
 * Raskrsnica u kojoj je auto čija je sredina na `s` na ivici, ili `null`. Auto
 * je u raskrsnici dok je ijedan njegov dio u njoj — sredina bliže od odsjeka
 * linija plus pola auta. Bez toga bi polukružno, kojem sredina na trenutak
 * izviri na susjedni krak, izgledalo kao izlazak pravo.
 */
function raskrsnicaNa(g: GradZaSudiju, ivica: number, s: number, dodatno = 0): number | null {
  const iv = g.mreza.ivice[ivica]!;
  const ra = g.raskrsnice.uCvoru[iv.a]!;
  const rb = g.raskrsnice.uCvoru[iv.b]!;
  if (ra >= 0 && ra === rb && g.raskrsnice.lista[ra]!.unutrasnje.includes(ivica)) return ra;
  const pola = CAR_LENGTH / 2 + dodatno;
  if (ra >= 0 && s < g.odsjeci[2 * ivica]! + pola) return ra;
  if (rb >= 0 && iv.duzina - s < g.odsjeci[2 * ivica + 1]! + pola) return rb;
  const pa = g.preliv.get(2 * ivica);
  if (pa && s < pa.d + pola) return pa.r;
  const pb = g.preliv.get(2 * ivica + 1);
  if (pb && iv.duzina - s < pb.d + pola) return pb.r;
  return null;
}

/**
 * Prelivi raskrsnica preko kratkih krakova: odsječak kraka duži od same ivice
 * nastavlja se na sljedeću ivicu iza čvora sa dvije vozne ulice (nastavak iste
 * ulice) — i dalje, dok ne ponestane. Auto je u raskrsnici dok mu je sredina
 * bliže od odsječka plus pola auta (i plus potvrda izlaska): preliv ide i
 * na ivicu do koje dopire samo to, sa negativnim `d` — inače bi zona imala
 * rupu na čvoru između dvije kratke ivice.
 */
function prelivi(m: Mreza, r: Raskrsnice, odsjeci: Float32Array): Map<number, { r: number; d: number }> {
  const out = new Map<number, { r: number; d: number }>();
  for (const iv of m.ivice) {
    if (!iv.vozna) continue;
    for (const kraj of [0, 1] as const) {
      const rs = r.uCvoru[kraj === 0 ? iv.a : iv.b]!;
      if (rs < 0) continue;
      let ostatak = odsjeci[2 * iv.i + kraj]! - iv.duzina;
      let ivica = iv;
      let cvor = kraj === 0 ? iv.b : iv.a;
      while (ostatak > -(CAR_LENGTH / 2 + GRAD_IZLAZ_POTVRDA) && r.uCvoru[cvor]! < 0) {
        const dalje = (m.izCvora[cvor] ?? []).filter((j) => m.ivice[j]!.vozna && j !== ivica.i);
        if (dalje.length !== 1) break;
        const sl = m.ivice[dalje[0]!]!;
        const k = sl.a === cvor ? 0 : 1;
        const kljuc = 2 * sl.i + k;
        if ((out.get(kljuc)?.d ?? -Infinity) < ostatak) out.set(kljuc, { r: rs, d: ostatak });
        ostatak -= sl.duzina;
        ivica = sl;
        cvor = k === 0 ? sl.b : sl.a;
      }
    }
  }
  return out;
}

/**
 * Ivica između raskrsnica `od` i `do_` (po jedan kraj u svakoj): `zelja` ako
 * jeste takva, inače prva takva; `zelja` kad je nema.
 */
function spojnaIvica(g: GradZaSudiju, od: number, do_: number, zelja: number): number {
  const u = g.raskrsnice.uCvoru;
  const spaja = (i: number) => {
    const iv = g.mreza.ivice[i]!;
    return iv.vozna && ((u[iv.a] === od && u[iv.b] === do_) || (u[iv.b] === od && u[iv.a] === do_));
  };
  if (spaja(zelja)) return zelja;
  for (const c of g.raskrsnice.lista[od]!.cvorovi) {
    for (const i of g.mreza.izCvora[c] ?? []) if (spaja(i)) return i;
  }
  // Raskrsnice spaja lanac kroz čvor koji nije raskrsnica (kratka spojnica
  // pa komad do druge): izlaz iz prve je krak PRVE do kojeg se od željene
  // ivice stiže unazad — ne ivica pod autom, čiji kraj u prvoj i nije.
  for (const smjer of [1, -1] as const) {
    const k = krakKaRaskrsnici(g, zelja, smjer, od);
    if (k) return k.ivica;
  }
  return zelja;
}

/** Put od čvora do čvora kroz unutrašnje ivice raskrsnice: niz [ivica, čvor iza nje]. */
function putKrozRaskrsnicu(g: GradZaSudiju, r: number, od: number, do_: number): [number, number][] {
  if (od === do_) return [];
  const unutra = g.raskrsnice.lista[r]!.unutrasnje;
  const prethodni = new Map<number, [number, number]>([[od, [-1, -1]]]);
  const red = [od];
  while (red.length > 0) {
    const c = red.shift()!;
    if (c === do_) break;
    for (const i of unutra) {
      const iv = g.mreza.ivice[i]!;
      const drugi = iv.a === c ? iv.b : iv.b === c ? iv.a : -1;
      if (drugi < 0 || prethodni.has(drugi)) continue;
      prethodni.set(drugi, [i, c]);
      red.push(drugi);
    }
  }
  const put: [number, number][] = [];
  for (let c = do_; c !== od; ) {
    const p = prethodni.get(c);
    if (!p || p[0] < 0) return [];
    put.unshift([p[0], c]);
    c = p[1];
  }
  return put;
}

function prijavi(
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  vrsta: VrstaGradskogPrekrsaja,
  detalji: Record<string, string | number> = {},
  ozbiljnost: "fail" | "minor" = "fail",
): void {
  s.prekrsaji.push({ vrsta, ozbiljnost, t, x: st.x, y: st.y, detalji });
}

/**
 * Stop-linija kraka kao na slici: tačka na osovini kraka `stopD` od
 * raskrsnice, i pravac vožnje ka raskrsnici na tom mjestu. Linija je poprečna
 * na taj pravac.
 */
export function stopLinija(g: { mreza: Mreza }, k: Krak): { linija: Point; pravac: Point } {
  const iv = g.mreza.ivice[k.ivica]!;
  const sE = k.kraj === 1 ? iv.duzina - k.stopD! : k.stopD!;
  const h = headingAt(iv.tacke, iv.cum, sE);
  return { linija: pointAt(iv.tacke, iv.cum, sE), pravac: k.kraj === 1 ? h : { x: -h.x, y: -h.y } };
}

/**
 * Koliko je nos auta pred stop-linijom [m], mjereno duž pravca kraka;
 * negativno — prešao je. Ne zavisi od toga na kojoj je ivici auto: u
 * krivini ispred linije projekcija na osovinu bi auto u unutrašnjoj traci
 * „pomakla" naprijed.
 */
function nosDoLinije(st: SlobodnoVozilo, linija: Point, pravac: Point): number {
  const nx = st.x + Math.cos(st.ugao) * (CAR_LENGTH / 2);
  const ny = st.y + Math.sin(st.ugao) * (CAR_LENGTH / 2);
  return -((nx - linija.x) * pravac.x + (ny - linija.y) * pravac.y);
}

/**
 * Krak raskrsnice `r` do kojeg vodi vožnja po ivici `ivica` u smjeru `smjer`:
 * ta ivica ako joj je kraj u `r`, ili sljedeća niz ulicu kroz čvorove koji
 * nisu raskrsnice. `null` kad ulica ne vodi u `r`.
 */
function krakKaRaskrsnici(g: GradZaSudiju, ivica: number, smjer: 1 | -1, r: number): { ivica: number; cvor: number } | null {
  let e = ivica;
  let sm = smjer;
  for (let korak = 0; korak < 10; korak++) {
    const iv = g.mreza.ivice[e]!;
    const cvor = sm === 1 ? iv.b : iv.a;
    if (g.raskrsnice.uCvoru[cvor] === r) return { ivica: e, cvor };
    if (g.raskrsnice.uCvoru[cvor]! >= 0) return null;
    const dalje = (g.mreza.izCvora[cvor] ?? []).filter((j) => j !== e && g.mreza.ivice[j]!.vozna);
    if (dalje.length !== 1) return null;
    e = dalje[0]!;
    sm = g.mreza.ivice[e]!.a === cvor ? 1 : -1;
  }
  return null;
}

/**
 * Kontrolisani krak (sa stop-linijom) ispred auta: na kraju ivice na kojoj je,
 * ili dalje niz istu ulicu kroz čvorove koji nisu raskrsnice, do
 * `GRAD_PRILAZ_DO` metara. `doKraja` je put od sredine auta do kraja kraka u
 * raskrsnici.
 */
function krakIspred(g: GradZaSudiju, ivica: number, gleda: 1 | -1, sNaIvici: number): { r: number; k: number; doKraja: number } | null {
  let e = ivica;
  let smjer = gleda;
  let iv = g.mreza.ivice[e]!;
  let doKraja = smjer === 1 ? iv.duzina - sNaIvici : sNaIvici;
  for (let korak = 0; korak < 30 && doKraja <= GRAD_PRILAZ_DO; korak++) {
    const kr = g.raskrsnice.krakIvice.get(`${e}:${smjer === 1 ? 1 : 0}`);
    if (kr) {
      const k = g.raskrsnice.lista[kr[0]]!.kraci[kr[1]]!;
      return k.ulaz && k.stopD !== null ? { r: kr[0], k: kr[1], doKraja } : null;
    }
    const cvor = smjer === 1 ? iv.b : iv.a;
    if (g.raskrsnice.uCvoru[cvor]! >= 0) return null;
    // Nastavak iste ulice: tačno jedna druga vozna ivica u čvoru.
    const dalje = (g.mreza.izCvora[cvor] ?? []).filter((j) => j !== e && g.mreza.ivice[j]!.vozna);
    if (dalje.length !== 1) return null;
    e = dalje[0]!;
    iv = g.mreza.ivice[e]!;
    smjer = iv.a === cvor ? 1 : -1;
    doKraja += iv.duzina;
  }
  return null;
}

/**
 * Auto čeka na ulaz u raskrsnicu ispred: nos mu je pred mjestom čekanja kraka
 * (`cekaD` — stop-linija, ili ivica raskrsnice ispred zebre), do
 * `GRAD_CEKA_NA_ULAZ` metara. Tako čeka i kad ustupa na kraku bez znaka — to
 * nije zaustavljanje na stajalištu (stavka 7).
 */
function cekaNaUlaz(g: GradZaSudiju, ivica: number, gleda: 1 | -1, sNaIvici: number, st: SlobodnoVozilo): boolean {
  let e = ivica;
  let smjer = gleda;
  let iv = g.mreza.ivice[e]!;
  let doKraja = smjer === 1 ? iv.duzina - sNaIvici : sNaIvici;
  for (let korak = 0; korak < 10 && doKraja <= GRAD_PRILAZ_DO; korak++) {
    const kr = g.raskrsnice.krakIvice.get(`${e}:${smjer === 1 ? 1 : 0}`);
    if (kr) {
      const k = g.raskrsnice.lista[kr[0]]!.kraci[kr[1]]!;
      if (!k.ulaz) return false;
      const { linija, pravac } = stopLinija(g, { ...k, stopD: k.cekaD });
      const d = nosDoLinije(st, linija, pravac);
      return d >= -0.5 && d <= GRAD_CEKA_NA_ULAZ;
    }
    const cvor = smjer === 1 ? iv.b : iv.a;
    if (g.raskrsnice.uCvoru[cvor]! >= 0) return false;
    const dalje = (g.mreza.izCvora[cvor] ?? []).filter((j) => j !== e && g.mreza.ivice[j]!.vozna);
    if (dalje.length !== 1) return false;
    e = dalje[0]!;
    iv = g.mreza.ivice[e]!;
    smjer = iv.a === cvor ? 1 : -1;
    doKraja += iv.duzina;
  }
  return false;
}

/**
 * Na kojoj je ulici auto. Najbliža osovina nije dovoljna: dvije kolovozne
 * trake bulevara, proširene, gotovo se dodiruju, pa bi auto uz spoljnu ivicu
 * svoje trake bio bliži osovini suprotne. Zato: ulica na kojoj je auto bio
 * ostaje dok je auto na njenom asfaltu; inače, od ulica na čijem je asfaltu,
 * ona čiji pravac se najbolje slaže sa autom; inače najbliža.
 */
function ulicaAuta(g: GradZaSudiju, s: Sudija, st: SlobodnoVozilo): { osa: OsaBlizu; smijeNegdje: boolean } | null {
  const ose = oseBlizu(g.povrsina, st.x, st.y, GRAD_SUDIJA_DO_ULICE);
  if (ose.length === 0) return null;
  const naAsfaltu = ose.filter((o) => o.d <= o.pola + 0.5);
  // Stara ulica se drži samo dok je auto uz nju, ne iza njenog kraja: na
  // kratkoj ivici bi inače sudija „kasnio" za autom.
  const prosla =
    s.ivicaAuta === null
      ? undefined
      : naAsfaltu.find((o) => o.ivica === s.ivicaAuta && o.s > 0.3 && o.s < g.mreza.ivice[o.ivica]!.duzina - 0.3);
  const c = Math.cos(st.ugao);
  const sn = Math.sin(st.ugao);
  // Kretanje duž ose: kuda auto ide (rikverc je suprotno od kuda gleda).
  const znak = st.v >= 0 ? 1 : -1;
  const slaganje = (o: OsaBlizu) => Math.abs(o.pravac.x * c + o.pravac.y * sn);
  /** Da li se po osi smije u smjeru u kojem se auto kreće. */
  const dozvoljeno = (o: OsaBlizu) => {
    const smjer = g.mreza.ivice[o.ivica]!.smjer;
    return smjer === 0 || Math.sign((o.pravac.x * c + o.pravac.y * sn) * znak) === smjer;
  };
  let izbor: OsaBlizu;
  if (prosla) izbor = prosla;
  else if (naAsfaltu.length === 0) izbor = ose[0]!;
  else {
    // Najbolje poravnate ose na čijem je asfaltu auto. Prednost ima ona kojom
    // se u tom smjeru smije: proširene kolovozne trake bulevara se preklapaju,
    // i auto na svojoj traci zna biti bliže osovini suprotne. Inače najbliža.
    const poravnate = naAsfaltu.filter((o) => slaganje(o) > 0.8);
    const kandidati = poravnate.length > 0 ? poravnate : naAsfaltu;
    izbor = kandidati.find(dozvoljeno) ?? kandidati[0]!;
  }
  s.ivicaAuta = izbor.ivica;
  // Da li je auto na asfaltu neke poravnate ulice kojom se u tom smjeru smije
  // — tada nije „u suprotnom smjeru", ma koja osovina bila bliža.
  const smijeNegdje = naAsfaltu.some((o) => slaganje(o) > 0.8 && dozvoljeno(o));
  return { osa: izbor, smijeNegdje };
}

/**
 * Strelice trake u kojoj je auto, u smjeru vožnje — iz OSM `turn:lanes`, ali
 * samo kad broj traka odgovara ulici (isto kao crtanje strelica). `null` kad
 * strelica nema.
 */
function streliceTrake(iv: Ivica, gleda: 1 | -1, bok: number): string[] | null {
  const opis = gleda === 1 ? iv.skretanjaNaprijed : iv.skretanjaNazad;
  const svoje = gleda === 1 ? iv.trakeNaprijed : iv.trakeNazad;
  const n = iv.trakeNaprijed + iv.trakeNazad;
  if (!opis || n === 0 || iv.sirina < n * GRAD_SIRINA_TRAKE - 1e-6) return null;
  const po = opis.split("|");
  if (po.length !== svoje) return null;
  const traka = iv.sirina / n;
  // Svoje trake su desno u smjeru vožnje: od (pola − svoje × traka) do pola.
  const bokT = bok * gleda;
  const j = Math.max(0, Math.min(svoje - 1, Math.floor((bokT - (iv.sirina / 2 - svoje * traka)) / traka)));
  return po[j]!.split(";").map((x) => x.trim());
}

/** Da li strelice trake dozvoljavaju manevar. Traka bez strelice (`none`) je za pravo. */
function dozvoljava(strelice: string[], manevar: Manevar): boolean {
  return strelice.some((x) => {
    if (x === "" || x === "none" || x === "through" || x.startsWith("merge_to")) return manevar === "pravo";
    if (x.endsWith("left")) return manevar === "lijevo" || manevar === "polukruzno";
    if (x.endsWith("right")) return manevar === "desno";
    if (x === "reverse") return manevar === "polukruzno";
    return false;
  });
}

/**
 * Jedan korak suđenja, poslije koraka vožnje. `t` je vrijeme simulacije,
 * `zmigavac` je ono što je igrač upalio. `uKoloni`: auto stoji zato što je
 * vozilo tik ispred njega — zaustavio ga je saobraćaj (stavka 7).
 */
export function sudi(
  g: GradZaSudiju,
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  zmigavac: Strana | null = null,
  uKoloni = false,
): void {
  s.zmigavac = zmigavac;
  const naUlici = ulicaAuta(g, s, st);
  if (!naUlici) return;
  const osa = naUlici.osa;
  const iv = g.mreza.ivice[osa.ivica]!;
  const glava = { x: Math.cos(st.ugao), y: Math.sin(st.ugao) };
  // Smjer auta duž ivice (kuda gleda), i kuda se stvarno kreće (rikverc).
  const gleda: 1 | -1 = glava.x * osa.pravac.x + glava.y * osa.pravac.y >= 0 ? 1 : -1;
  const krece: 1 | -1 = st.v >= 0 ? gleda : gleda === 1 ? -1 : 1;
  const r = raskrsnicaNa(g, osa.ivica, osa.s);
  // Izlaz iz raskrsnice važi tek kad je auto cijeli van nje i odmakao se
  // `GRAD_IZLAZ_POTVRDA` — manevar koji na trenutak zađe u susjedni krak
  // (polukružno) nije izlazak na taj krak.
  const josURaskrsnici = s.prolaz ? raskrsnicaNa(g, osa.ivica, osa.s, GRAD_IZLAZ_POTVRDA) === s.prolaz.r : false;

  // ── prilaz: stop-linija, crveno, žuto, STOP ─────────────────────────────
  // Kontrolisani krak se traži i dalje niz ulicu: krak ispred semafora je u
  // OSM-u često kratka ivica, a auto je još na prethodnoj.
  // I iz raskrsnice: stop-linija sljedeće može biti tik iza nje (krak između
  // njih je kratak), i prilaz mora početi prije nego što se upali žuto.
  const naprijed = krakIspred(g, osa.ivica, gleda, osa.s);
  const ispred = naprijed && naprijed.r !== r ? naprijed : null;
  if (s.prilaz) {
    const p = s.prilaz;
    const k = g.raskrsnice.lista[p.r]!.kraci[p.k]!;
    // Prilaz traje dok je taj krak ispred auta, ili dok je auto u raskrsnici.
    const traje = (ispred && ispred.r === p.r && ispred.k === p.k) || r === p.r;
    if (!traje) s.prilaz = null;
    else {
      const doLinije = nosDoLinije(st, p.linija, p.pravac);
      const rs = g.raskrsnice.lista[p.r]!;
      const sv = svjetlo(rs, p.k, t);
      const kasno = p.doLinije > 0 && p.doLinije / Math.max(st.v, 0.1) < YELLOW_COMMIT_TTC;
      if (sv === "zuto" && p.svjetlo === "zeleno") {
        // Žuto je upaljeno: da li je tada bilo kasno za zaustavljanje?
        p.zutoPrekasno = kasno;
      }
      if (p.poManevru) {
        for (const mv of MANEVRI) {
          const x = p.poManevru[mv];
          const svM = svjetlo(rs, p.k, t, mv);
          if (svM === "zuto" && x.svjetlo === "zeleno") x.zutoPrekasno = kasno;
          x.svjetlo = svM;
        }
      }
      if (doLinije >= 0 && doLinije <= STOP_ZONE && Math.abs(st.v) < STOPPED_SPEED) p.stajao += DT;
      if (p.doLinije > 0 && doLinije <= 0 && st.v > 0) {
        if (k.kontrola === "stop" && p.stajao < STOP_HOLD) {
          prijavi(s, st, t, "stopSign", { stajao: Number(p.stajao.toFixed(2)) });
        }
        if (k.kontrola === "semafor" && p.poManevru) {
          // Svjetlo zavisi od pravca: zapamti za koje je pravce bilo crveno
          // (zelena dopunska strelica dozvoljava svoj pravac) — sudi se na
          // izlazu iz raskrsnice, po stvarnom manevru.
          const krsi: Partial<Record<Manevar, Svjetlo>> = {};
          for (const mv of MANEVRI) {
            const x = p.poManevru[mv];
            if (zelenaStrelica(rs, p.k, t, mv)) continue;
            if (x.svjetlo === "crveno" || (x.svjetlo === "zuto" && !x.zutoPrekasno)) krsi[mv] = x.svjetlo;
          }
          s.crvenoPoManevru = { r: p.r, krsi };
        } else if (k.kontrola === "semafor" && (sv === "crveno" || (sv === "zuto" && !p.zutoPrekasno))) {
          prijavi(s, st, t, "redLight", { svjetlo: sv });
        }
      }
      p.doLinije = doLinije;
      p.svjetlo = sv;
    }
  }
  if (!s.prilaz && ispred) {
    const k = g.raskrsnice.lista[ispred.r]!.kraci[ispred.k]!;
    const { linija, pravac } = stopLinija(g, k);
    const doLinije = nosDoLinije(st, linija, pravac);
    if (doLinije > 0) {
      s.prilaz = {
        kljuc: `${k.ivica}:${k.kraj}`,
        r: ispred.r,
        k: ispred.k,
        linija,
        pravac,
        doLinije,
        stajao: 0,
        svjetlo: svjetlo(g.raskrsnice.lista[ispred.r]!, ispred.k, t),
        zutoPrekasno: false,
        poManevru: svjetloPoManevru(g.raskrsnice.lista[ispred.r]!, ispred.k)
          ? (Object.fromEntries(
              MANEVRI.map((mv) => [mv, { svjetlo: svjetlo(g.raskrsnice.lista[ispred.r]!, ispred.k, t, mv), zutoPrekasno: false }]),
            ) as Prilaz["poManevru"])
          : null,
      };
    }
  }

  // ── prolaz kroz raskrsnicu: zabrana skretanja, polukružno ────────────────
  if (r !== null && !s.prolaz && s.ivica !== null) {
    // Ulaz u raskrsnicu: krak je ivica kojom je auto dolazio, a ako ona ne
    // dodiruje raskrsnicu (kratak krak iza čvora bez raskrsnice), krak do kojeg
    // ona vodi. Ne ivica pod autom: u desnom skretanju auto siječe ugao i
    // bliži je osovini ulice u koju skreće.
    const krak = krakKaRaskrsnici(g, s.ivica, s.smjer, r) ?? {
      ivica: osa.ivica,
      cvor: g.raskrsnice.uCvoru[iv.b] === r && (g.raskrsnice.uCvoru[iv.a] !== r || gleda === 1) ? iv.b : iv.a,
    };
    s.prolaz = {
      r,
      ivica: krak.ivica,
      cvor: krak.cvor,
      pravac: glava,
      zmigavacNaUlazu: zmigavac,
      upaljenUnutra: null,
      strelice: s.traka,
      izlaz: null,
      prviKorak: null,
      prviKoraci: new Map(),
      predjenoUlaz: st.predjeno,
    };
    // Ulaskom u sljedeću raskrsnicu završava se obaveza gašenja žmigavca iz
    // prethodne: na ulazu se sudi žmigavac za ovu (i kroz raskrsnicu pravo).
    s.poslijeSkretanja = null;
    s.naUlazu?.(r);
  }
  if (s.prolaz && zmigavac && !s.prolaz.zmigavacNaUlazu && !s.prolaz.upaljenUnutra) s.prolaz.upaljenUnutra = zmigavac;
  // Iz raskrsnice pravo u drugu (čvorovi prstena, raskrsnice tik jedna uz
  // drugu): prolaz kroz prvu se završava ovdje, a počinje prolaz kroz drugu.
  if (r !== null && s.prolaz && r !== s.prolaz.r) {
    // Izlaz iz prve: ivica koja je spaja sa drugom — kratku auto često ni ne
    // „vidi", i već je na ivici iza druge.
    const izlaz = { ...osa, ivica: spojnaIvica(g, s.prolaz.r, r, s.prolaz.izlaz?.ivica ?? osa.ivica) };
    zavrsiProlaz(g, s, st, t, s.prolaz, izlaz, g.mreza.ivice[izlaz.ivica]!, glava);
    // Ulaz u drugu: krak do kojeg se od izlaza iz prve stiže niz ulicu (ista
    // spojna ivica, ili zadnja u lancu kroz čvorove koji nisu raskrsnice) —
    // ne ivica pod autom, koja može biti krak iza druge.
    const spojna = g.mreza.ivice[izlaz.ivica]!;
    const ulazU =
      krakKaRaskrsnici(g, spojna.i, g.raskrsnice.uCvoru[spojna.a] === s.prolaz.r ? 1 : -1, r) ??
      ({ ivica: osa.ivica, cvor: g.raskrsnice.uCvoru[iv.b] === r ? iv.b : iv.a } as const);
    s.prolaz = {
      r,
      ivica: ulazU.ivica,
      cvor: ulazU.cvor,
      pravac: glava,
      zmigavacNaUlazu: zmigavac,
      upaljenUnutra: null,
      strelice: null,
      izlaz: null,
      prviKorak: null,
      prviKoraci: new Map(),
      predjenoUlaz: st.predjeno,
    };
    // Žmigavac prethodnog skretanja: sudi se na ulazu u ovu raskrsnicu.
    s.poslijeSkretanja = null;
    s.naUlazu?.(r);
  }
  // Izlazni krak: zadnja ivica pod autom koja dodiruje raskrsnicu (ne
  // unutrašnja, ne ulazna — osim polukružnog, kad auto po njoj ide nazad).
  // Kratak krak je cijeli u raskrsnici, pa je auto pri izlasku već dalje.
  if (s.prolaz) {
    const rs = g.raskrsnice.lista[s.prolaz.r]!;
    const dodiruje = g.raskrsnice.uCvoru[iv.a] === s.prolaz.r || g.raskrsnice.uCvoru[iv.b] === s.prolaz.r;
    const nazad = osa.ivica === s.prolaz.ivica && glava.x * s.prolaz.pravac.x + glava.y * s.prolaz.pravac.y < -0.5;
    if (dodiruje && !rs.unutrasnje.includes(osa.ivica) && (osa.ivica !== s.prolaz.ivica || nazad)) s.prolaz.izlaz = osa;
    const drugi = iv.a === s.prolaz.cvor ? iv.b : iv.b === s.prolaz.cvor ? iv.a : -1;
    if (osa.ivica !== s.prolaz.ivica && drugi >= 0 && g.raskrsnice.uCvoru[drugi] === s.prolaz.r) {
      const k = s.prolaz.prviKoraci;
      k.set(osa.ivica, (k.get(osa.ivica) ?? 0) + 1);
      // Ona na kojoj je auto bio najduže (od jednakih, prva viđena).
      let naj: number | null = null;
      for (const [i, n] of k) if (naj === null || n > k.get(naj)!) naj = i;
      s.prolaz.prviKorak = naj;
    }
  }
  if (r === null && s.prolaz && !josURaskrsnici) {
    const p = s.prolaz;
    s.prolaz = null;
    // Izlazni krak: onaj do kojeg se od sadašnje ivice stiže unazad niz ulicu
    // (auto je sad van raskrsnice, pa je to nedvosmisleno — i kad je krak
    // kratak, pa auto na njemu nije ni bio). Zapamćeni samo kad lanca nema:
    // pri lijevom skretanju auto pređe i preko asfalta drugih krakova.
    // Ulica auta je tu ona čiji asfalt drži cijeli auto, pa tek najbliža osovina:
    // uski servisni put koji OSM crta preko kolovoza glavne ulice nije izlaz
    // auta koji vozi njenom desnom trakom.
    let izlaz = p.izlaz ?? osa;
    const c = Math.cos(st.ugao);
    const sn = Math.sin(st.ugao);
    const ose = oseBlizu(g.povrsina, st.x, st.y, GRAD_SUDIJA_DO_ULICE)
      .filter((o) => o.d + CAR_WIDTH / 2 <= o.pola + 0.3 && Math.abs(o.pravac.x * c + o.pravac.y * sn) > 0.8)
      .concat([osa]);
    for (const o of ose) {
      const gl = o.pravac.x * c + o.pravac.y * sn >= 0 ? 1 : -1;
      const krak = krakKaRaskrsnici(g, o.ivica, gl === 1 ? -1 : 1, p.r);
      if (krak) {
        izlaz = { ...o, ivica: krak.ivica };
        break;
      }
    }
    if (izlaz.ivica !== p.ivica || gleda !== s.smjer) {
      zavrsiProlaz(g, s, st, t, p, izlaz, g.mreza.ivice[izlaz.ivica]!, glava);
    }
  }

  // ── van raskrsnice: smjer, strana, most/tunel ───────────────────────────
  if (r === null && !s.prolaz) {
    // Polukružno na mostu ili u tunelu: ista ivica, auto se okrenuo.
    if (s.ivica === osa.ivica && gleda !== s.smjer && st.v > 0 && (iv.most || iv.tunel)) {
      prijavi(s, st, t, "polukruzno", { gdje: iv.most ? "most" : "tunel" });
    }
    // Pogrešan smjer u jednosmjernoj: kretanje suprotno od dozvoljenog.
    const dozvoljen = iv.smjer === 0 || iv.smjer === krece || naUlici.smijeNegdje;
    if (!dozvoljen && Math.abs(st.v) > GRAD_SUPROTNO_BRZINA) {
      s.suprotnoT += DT;
      if (s.suprotnoT >= GRAD_SUPROTNO_TRAJE && s.suprotnoIvica !== osa.ivica) {
        prijavi(s, st, t, "wrongWay", { ulica: iv.ime });
        s.suprotnoIvica = osa.ivica;
      }
    } else if (dozvoljen) {
      s.suprotnoT = 0;
      s.suprotnoIvica = null;
    }
    // Lijeva strana dvosmjerne ulice sa trakama u oba smjera: cijeli auto
    // lijevo od razdjelne linije smjerova duže od `GRAD_LIJEVO_TRAJE`. Linija
    // je između traka dva smjera (kao što se crta), ne na osovini: sa 3 + 1
    // trake je četvrt širine lijevo od nje.
    const nTraka = iv.trakeNaprijed + iv.trakeNazad;
    const imaStrane =
      iv.smjer === 0 && iv.trakeNaprijed > 0 && iv.trakeNazad > 0 && iv.sirina >= nTraka * GRAD_SIRINA_TRAKE - 1e-6;
    const bokUSmjeru = osa.bok * gleda;
    const razdjelnik = iv.sirina / 2 - ((gleda === 1 ? iv.trakeNaprijed : iv.trakeNazad) * iv.sirina) / Math.max(1, nTraka);
    // Uz čvor gdje se raspored traka mijenja (traka skretanja koja počinje
    // tamo gdje je bila susretna) trake se tek uspostavljaju — kao kod pune
    // linije, `GRAD_PUNA_POSLIJE_PROMJENE`: prelazak tu je kratko presijecanje.
    const pr = g.produzeci;
    const uzPromjenu =
      (pr.doPromjene[2 * iv.i] === 0 && osa.s < GRAD_PUNA_POSLIJE_PROMJENE) ||
      (pr.doPromjene[2 * iv.i + 1] === 0 && iv.duzina - osa.s < GRAD_PUNA_POSLIJE_PROMJENE);
    if (imaStrane && st.v > 0 && !uzPromjenu && bokUSmjeru < razdjelnik - CAR_WIDTH / 2) {
      s.lijevoT += DT;
      if (s.lijevoT >= GRAD_LIJEVO_TRAJE && !s.lijevoPrijavljeno) {
        prijavi(s, st, t, "wrongSide", { sekundi: GRAD_LIJEVO_TRAJE });
        s.lijevoPrijavljeno = true;
      }
    } else {
      s.lijevoT = 0;
      s.lijevoPrijavljeno = false;
    }
    // Poprečni poluobim auta na ulici: auto ukoso zauzima više od svoje širine.
    const sinA = Math.abs(glava.x * osa.pravac.y - glava.y * osa.pravac.x);
    const cosA = Math.abs(glava.x * osa.pravac.x + glava.y * osa.pravac.y);
    const pola = (CAR_LENGTH / 2) * sinA + (CAR_WIDTH / 2) * cosA;
    // Puna linija (editor): tijelo preko nje više od `LINE_CROSS_TOL` — kao na
    // otvorenom putu (`crossingSolidLine`). Jednom po prelasku.
    const puna =
      Math.abs(st.v) > STOPPED_SPEED
        ? linijeSaVrstom(iv).find((l) => pola - Math.abs(osa.bok - l.o) > LINE_CROSS_TOL && punaNa(iv, l, osa.s, g.produzeci))
        : undefined;
    if (puna && !s.punaPreko) prijavi(s, st, t, "crossingSolidLine", { ulica: iv.ime, linija: puna.vrsta, ivica: osa.ivica });
    s.punaPreko = !!puna;
    // Autobuska traka (editor): cijelo auto u njoj, u njenom smjeru, duže od
    // `GRAD_BUS_TRAJE` — prolazak preko nje i ulazak radi skretanja nisu
    // prekršaj (odluka korisnika).
    const bus = pojasBusa(iv, gleda);
    if (bus && st.v > STOPPED_SPEED && osa.bok - pola >= bus[0] - 0.3 && osa.bok + pola <= bus[1] + 0.3) {
      s.busT += DT;
      if (s.busT >= GRAD_BUS_TRAJE && !s.busPrijavljen) {
        prijavi(s, st, t, "busLane", { sekundi: GRAD_BUS_TRAJE });
        s.busPrijavljen = true;
      }
    } else {
      s.busT = 0;
      s.busPrijavljen = false;
    }
    s.ivica = osa.ivica;
    s.smjer = gleda;
    s.traka = streliceTrake(iv, gleda, osa.bok);
  }

  // ── kružni tok: traka u prstenu ─────────────────────────────────────────
  // Na sredini svake ivice prstena sa dvije (poznate) trake: lijevo od linije
  // traka je unutrašnja (centar prstena je lijevo od smjera vožnje), desno
  // spoljna. Sredina ivice je najdalje od priključaka, gdje se ulazi i izlazi.
  if (
    s.prsten &&
    iv.kruzni &&
    iv.trakePoznate &&
    iv.trakeNaprijed === 2 &&
    iv.trakeNazad === 0 &&
    (iv.smjer === 0 || iv.smjer === gleda) &&
    !s.prsten.sredine.has(osa.ivica) &&
    Math.abs(osa.s - iv.duzina / 2) < GRAD_PRSTEN_SREDINA
  ) {
    const bokT = osa.bok * gleda;
    if (Math.abs(bokT) > GRAD_PRSTEN_RUB) {
      s.prsten.uzorci.push({ traka: bokT < 0 ? "unutra" : "spolja", predjeno: st.predjeno });
      s.prsten.sredine.add(osa.ivica);
    }
  }

  // ── žmigavac ostavljen poslije skretanja ────────────────────────────────
  if (s.poslijeSkretanja && !s.prolaz) {
    s.poslijeSkretanja.predjeno += Math.abs(st.v) * DT;
    // Ugašen, ili se već najavljuje sljedeća raskrsnica: u redu.
    if (zmigavac !== s.poslijeSkretanja.strana || s.prilaz) s.poslijeSkretanja = null;
    else if (s.poslijeSkretanja.predjeno >= INDICATOR_OFF_AFTER) {
      prijavi(s, st, t, "indicatorLeftOn", { zmigavac }, "minor");
      s.poslijeSkretanja = null;
    }
  }

  // ── brzina ──────────────────────────────────────────────────────────────
  // U raskrsnici važi ograničenje ulice kojom je auto došao — ne poprečne,
  // čija osovina može biti najbliža.
  // Ulica kojom je auto došao: ulazni krak prolaza (pouzdano), ili zadnja ulica
  // van raskrsnice — tik pred raskrsnicom najbliža osovina zna biti poprečna.
  let ivB = osa.ivica;
  let smjerB: 1 | -1 = gleda;
  let sB = osa.s;
  if (r !== null && s.prolaz) {
    const ul = g.mreza.ivice[s.prolaz.ivica]!;
    ivB = ul.i;
    smjerB = ul.b === s.prolaz.cvor ? 1 : -1;
    sB = smjerB === 1 ? ul.duzina : 0;
  } else if (r !== null && s.ivica !== null) {
    ivB = s.ivica;
    smjerB = s.smjer;
    sB = s.smjer === 1 ? g.mreza.ivice[ivB]!.duzina : 0;
  }
  const ogranicenje = ogranicenjeNa(g.ogranicenja, g.mreza, g.raskrsnice, ivB, smjerB, sB).brzina;
  s.ogranicenje = ogranicenje;
  const kmh = Math.abs(st.v) * 3.6;
  if (kmh > ogranicenje + GRAD_TOLERANCIJA_BRZINE[s.nivo]) {
    s.brzinaT += DT;
    if (s.brzinaT >= GRAD_BRZINA_TRAJE && !s.brzinaPrijavljena) {
      prijavi(s, st, t, "speeding", { brzina: Math.round(kmh), ogranicenje });
      s.brzinaPrijavljena = true;
    }
  } else {
    s.brzinaT = 0;
    // Prijava se obnavlja tek kad se vrati ispod ograničenja, ne tolerancije.
    if (kmh <= ogranicenje) s.brzinaPrijavljena = false;
  }

  // ── zaustavljanje: zebra, raskrsnica, stajalište ────────────────────────
  // Auto koje još nije krenulo (start vožnje) ne „zaustavlja se" nigdje.
  if (Math.abs(st.v) < STOPPED_SPEED && st.predjeno > CAR_LENGTH) {
    s.stojiT += DT;
    if (s.stojiT >= GRAD_STAJANJE_TRAJE && !s.stojiPrijavljeno) {
      // Ispred stop-linije se čeka — to nije zaustavljanje na zabranjenom mjestu.
      // Isto na mjestu čekanja kraka bez linije (ustupanje).
      const cekaNaLiniji =
        (s.prilaz !== null && s.prilaz.doLinije >= 0) || (r === null && cekaNaUlaz(g, osa.ivica, gleda, osa.s, st));
      const naZebri = (g.zebre.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z - osa.s) < GRAD_ZEBRA_DUBINA / 2 + CAR_LENGTH / 2 - 0.2,
      );
      const naStajalistu = (g.stajalista.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z.s - osa.s) < GRAD_STAJALISTE_DUZINA / 2 && Math.sign(osa.bok) === z.strana,
      );
      const gdje = r !== null ? "raskrsnica" : naZebri ? "zebra" : naStajalistu ? "stajaliste" : null;
      // Zaustavio ga je saobraćaj (kolona ispred) — nije prekršaj (odluka
      // korisnika 2026-09-30). Dok stoji u koloni, vrijeme se ne broji.
      if (uKoloni) s.stojiT = 0;
      else if (gdje && !cekaNaLiniji) {
        prijavi(s, st, t, "parkingViolation", { gdje });
        s.stojiPrijavljeno = true;
      }
    }
  } else {
    s.stojiT = 0;
    s.stojiPrijavljeno = false;
  }
}

/**
 * Žmigavac kroz raskrsnicu, kao u fazi 5: za skretanje mora biti upaljen na
 * pravu stranu najkasnije kad auto uđe u raskrsnicu (`indicatorMissing`,
 * `indicatorWrong`, a upaljen tek unutra `indicatorLate`); za vožnju pravo ne
 * smije biti upaljen (blag). U kružnom toku se ovdje sudi samo izlazak iz
 * prstena (desni); ulazak zavisi od izlaza na koji se ide.
 */
function sudiZmigavac(
  g: GradZaSudiju,
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  p: Prolaz,
  manevar: Manevar,
  izasaoNaPrsten: boolean,
): void {
  const r = g.raskrsnice.lista[p.r]!;
  if (r.kruzni && izasaoNaPrsten) return;
  // Izlazak iz prstena: samo kad se dolazi iz prstena. Kroz raskrsnicu
  // kružnog toka mimo prstena (dva kraka bez dodira sa njim) sudi se kao
  // kroz običnu.
  const izPrstena = r.kruzni && g.mreza.ivice[p.ivica]!.kruzni;
  const trazeno: Strana | null = izPrstena ? "right" : manevar === "desno" ? "right" : manevar === "pravo" ? null : "left";
  const kruzni = izPrstena ? 1 : 0;
  if (trazeno === null) {
    if (p.zmigavacNaUlazu) prijavi(s, st, t, "indicatorWrong", { manevar, zmigavac: p.zmigavacNaUlazu }, "minor");
    return;
  }
  if (p.zmigavacNaUlazu === trazeno) {
    // Ispravno.
  } else if (p.zmigavacNaUlazu) prijavi(s, st, t, "indicatorWrong", { manevar, zmigavac: p.zmigavacNaUlazu, kruzni });
  else if (p.upaljenUnutra === trazeno) prijavi(s, st, t, "indicatorLate", { manevar, kruzni });
  else prijavi(s, st, t, "indicatorMissing", { manevar, kruzni });
  s.poslijeSkretanja = { strana: trazeno, predjeno: 0 };
}

/**
 * Dvotračni kružni tok (`laneDisciplineRoundabout`): unutrašnja traka je za
 * lijevo i puni krug, spoljna za desno i pravo. Manevar je od ulaznog kraka
 * do izlaznog, po uglu kao svuda (`GRAD_SKRETANJE_UGAO`, `GRAD_POLUKRUZNO_UGAO`);
 * sudi se pri izlasku iz prstena, po trakama zabilježenim u njemu.
 */
function sudiPrsten(g: GradZaSudiju, s: Sudija, st: SlobodnoVozilo, t: number, p: Prolaz, ulazna: Ivica, iv: Ivica, cvorIzlaza: number): void {
  if (!ulazna.kruzni && iv.kruzni) {
    s.prsten = { ulazIvica: p.ivica, ulazCvor: p.cvor, strelice: p.strelice, uzorci: [], sredine: new Set() };
    return;
  }
  if (!ulazna.kruzni || iv.kruzni || !s.prsten) return;
  const pr = s.prsten;
  s.prsten = null;
  const ul = g.mreza.ivice[pr.ulazIvica]!;
  const manevar = manevarKrakova(ul, pr.ulazCvor, iv, cvorIzlaza);
  const treba = manevar === "lijevo" || manevar === "polukruzno" ? "unutra" : "spolja";
  // Uzorci od ulaska u raskrsnicu izlaza (uz `GRAD_PRSTEN_IZLAZ` prije) se ne
  // broje: tu auto iz unutrašnje trake već prelazi ka izlazu.
  const pogresna = pr.uzorci.find((x) => x.traka !== treba && x.predjeno < p.predjenoUlaz - GRAD_PRSTEN_IZLAZ);
  if (pogresna) prijavi(s, st, t, "laneDisciplineRoundabout", { manevar, traka: pogresna.traka });
  if (pr.strelice && !dozvoljava(pr.strelice, manevar)) {
    prijavi(s, st, t, "wrongLaneForTurn", { manevar, strelice: pr.strelice.join(";") });
  }
}

/**
 * Izlaz iz raskrsnice na ivicu `osa`: zabrana skretanja (i kroz unutrašnje
 * ivice), manevar po promjeni pravca, žmigavac, traka za skretanje,
 * polukružno na semaforu.
 */
function zavrsiProlaz(
  g: GradZaSudiju,
  s: Sudija,
  st: SlobodnoVozilo,
  t: number,
  p: Prolaz,
  osa: OsaBlizu,
  iv: Ivica,
  glava: Point,
): void {
  // Izlaz: ivica i njen kraj u raskrsnici.
  // Kraj izlazne ivice u raskrsnici; kad ga nema (izlaz određen kroz lanac),
  // kraj bliži njenom centru — ne bilo koji, inače bi se pravac izlaza obrnuo.
  const rs0 = g.raskrsnice.lista[p.r]!;
  const blize = (c: number) => Math.hypot(g.mreza.cvorovi[c]!.x - rs0.centar.x, g.mreza.cvorovi[c]!.y - rs0.centar.y);
  const cvorIzlaza =
    g.raskrsnice.uCvoru[iv.a] === p.r ? iv.a : g.raskrsnice.uCvoru[iv.b] === p.r ? iv.b : blize(iv.a) <= blize(iv.b) ? iv.a : iv.b;
  // Put kroz raskrsnicu: prvom ivicom kojom je auto stvarno napustio ulazni
  // čvor (slip-traka nije unutrašnja ivica), pa unutrašnjim do izlaza.
  let put: [number, number][];
  if (p.prviKorak !== null && cvorIzlaza !== p.cvor) {
    const prvi = g.mreza.ivice[p.prviKorak]!;
    const drugi = prvi.a === p.cvor ? prvi.b : prvi.a;
    put = [[p.prviKorak, drugi], ...putKrozRaskrsnicu(g, p.r, drugi, cvorIzlaza)];
  } else put = putKrozRaskrsnicu(g, p.r, p.cvor, cvorIzlaza);
  const koraci: [number, number, number][] = [];
  let od = p.ivica;
  let cvor = p.cvor;
  for (const [i, c] of put) {
    koraci.push([od, cvor, i]);
    od = i;
    cvor = c;
  }
  koraci.push([od, cvor, osa.ivica]);
  let zabranjeno = false;
  for (const [a, c, b] of koraci) {
    const z = prekrsenaZabrana(g.zabrane, a, c, b);
    if (z) {
      prijavi(s, st, t, "zabranaSkretanja", { znak: z.vrsta });
      zabranjeno = true;
      break;
    }
  }
  // Manevar iz rasporeda ulica: pravac ulaznog kraka ka čvoru i izlaznog od
  // čvora (isto kao bot). Polukružno: izlaz nazad na isti krak.
  const okrenuo = glava.x * p.pravac.x + glava.y * p.pravac.y < -0.5;
  const ulazna = g.mreza.ivice[p.ivica]!;
  const ugao = ugaoSkretanja(
    pravacKraja(ulazna, ulazna.b === p.cvor ? 1 : -1, true),
    pravacKraja(iv, iv.a === cvorIzlaza ? 1 : -1, false),
  );
  // Polukružno je i okret preko razdjelnog pojasa bulevara: drugi krak, ali
  // pravac skoro suprotan.
  const manevar: Manevar = okrenuo && osa.ivica === p.ivica ? "polukruzno" : manevarIzUgla(ugao);
  // Znak iz editora na ulaznom kraku (zabrana, obavezan smjer), ili zabrana
  // ulaska u izlazni krak — za cijelu raskrsnicu, od kraka do kraka.
  if (!zabranjeno) {
    const ulaz = `${p.ivica}:${ulazna.b === p.cvor ? 1 : 0}`;
    const izlaz = `${osa.ivica}:${iv.a === cvorIzlaza ? 0 : 1}`;
    const znak = zabranaKraka(g.raskrsnice, ulaz, izlaz, manevar);
    if (znak) prijavi(s, st, t, "zabranaSkretanja", { znak });
  }
  // Svjetlo po manevru: je li za ovaj pravac bilo crveno?
  if (s.crvenoPoManevru && s.crvenoPoManevru.r === p.r) {
    const sv = s.crvenoPoManevru.krsi[manevar];
    if (sv) prijavi(s, st, t, "redLight", { svjetlo: sv, manevar });
    s.crvenoPoManevru = null;
  }
  s.dnevnik?.({ r: p.r, ulaz: p.ivica, izlaz: osa.ivica, manevar, t });
  sudiZmigavac(g, s, st, t, p, manevar, iv.kruzni);
  sudiPrsten(g, s, st, t, p, ulazna, iv, cvorIzlaza);
  // Traka za skretanje: strelice trake iz koje je ušao moraju dozvoljavati
  // manevar. Kad auto iz ulaznog čvora ide drugom čvoru iste raskrsnice
  // ivicom koja nije njena unutrašnja (slip-traka za desno), strelice važe za
  // taj prvi čvor — manevar na tu ivicu. Kroz bulevar (unutrašnje ivice)
  // strelice opisuju cijeli manevar.
  let manevarStrelica = manevar;
  const rs = g.raskrsnice.lista[p.r]!;
  if (cvorIzlaza !== p.cvor && p.prviKorak !== null && !rs.unutrasnje.includes(p.prviKorak) && manevar !== "polukruzno") {
    const prvi = g.mreza.ivice[p.prviKorak]!;
    const u1 = ugaoSkretanja(pravacKraja(ulazna, ulazna.b === p.cvor ? 1 : -1, true), pravacKraja(prvi, prvi.a === p.cvor ? 1 : -1, false));
    manevarStrelica = u1 > GRAD_SKRETANJE_UGAO ? "desno" : u1 < -GRAD_SKRETANJE_UGAO ? "lijevo" : "pravo";
  }
  // Na ulazu u kružni tok strelice prilaza opisuju izlaz iz prstena — sude se
  // pri izlasku (`sudiPrsten`).
  const uPrsten = iv.kruzni && !ulazna.kruzni;
  if (p.strelice && !uPrsten && !dozvoljava(p.strelice, manevarStrelica)) {
    prijavi(s, st, t, "wrongLaneForTurn", { manevar: manevarStrelica, strelice: p.strelice.join(";") });
  }
  if (manevar === "polukruzno" && g.raskrsnice.lista[p.r]!.plan) {
    prijavi(s, st, t, "polukruzno", { gdje: "semafor" });
  }
}
