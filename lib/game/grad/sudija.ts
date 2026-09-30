import {
  CAR_LENGTH,
  CAR_WIDTH,
  DT,
  GRAD_BRZINA_PODRAZUMIJEVANA,
  GRAD_BRZINA_TRAJE,
  GRAD_IZLAZ_POTVRDA,
  GRAD_LIJEVO_TRAJE,
  GRAD_PRILAZ_DO,
  GRAD_SIRINA_TRAKE,
  GRAD_SKRETANJE_UGAO,
  GRAD_STAJALISTE_DUZINA,
  INDICATOR_OFF_AFTER,
  GRAD_STAJANJE_TRAJE,
  GRAD_SUDIJA_DO_ULICE,
  GRAD_SUDIJA_NEODLUCNO,
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
import { pravacKraja, ugaoSkretanja, type Ivica, type Mreza } from "./mreza";
import { BEZ, type Paket } from "./paket";
import { najblizaOsa, oseBlizu, type OsaBlizu, type Povrsina } from "./povrsina";
import { prekrsenaZabrana, svjetlo, type Krak, type Raskrsnice, type Svjetlo, type Zabrana } from "./raskrsnica";
import { headingAt, pointAt } from "../sim/geometry";
import type { SlobodnoVozilo } from "./slobodno";

/**
 * Sudija u gradu (faza 6, stavka 5d): prati igrača korak po korak i prijavljuje
 * prekršaje po istom modelu raskrsnice po kojem se znakovi i semafori crtaju.
 * Svaki prekršaj ima jedno pravilo i ono se igraču kaže.
 *
 * Ovdje su pravila koja važe i kad je igrač sam na ulici: crveno i žuto, STOP,
 * pogrešan smjer, zabrana skretanja, polukružno okretanje, brzina, lijeva
 * strana, zaustavljanje gdje se ne smije. Prednost prema drugima (stavka 7) i
 * pješaci (stavka 8) dolaze sa njima.
 *
 * Odluke korisnika (2026-09-30): zaustavljanje 2 s na zebri / u raskrsnici /
 * na stajalištu; U-okret zabranjen u jednosmjernoj, na mostu, u tunelu i u
 * raskrsnici sa semaforom; lijevom stranom dvosmjerne ulice najviše 3 s.
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
  | "wrongLaneForTurn";

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
  mreza: Mreza;
  povrsina: Povrsina;
  raskrsnice: Raskrsnice;
  zabrane: Map<string, Zabrana[]>;
  odsjeci: Float32Array;
  /** Obilježene zebre po ivici: `s` sredine zebre. */
  zebre: Map<number, number[]>;
  /** Stajališta po ivici: `s` sredine i strana (+1 desno od `a → b`). */
  stajalista: Map<number, { s: number; strana: 1 | -1 }[]>;
}

export function gradZaSudiju(
  paket: Paket,
  povrsina: Povrsina,
  raskrsnice: Raskrsnice,
  zabrane: Map<string, Zabrana[]>,
  odsjeci: Float32Array,
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
  return { mreza: povrsina.mreza, povrsina, raskrsnice, zabrane, odsjeci, zebre, stajalista };
}

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
}

export interface Sudija {
  prekrsaji: GradskiPrekrsaj[];
  /** Za dijagnozu: svaki prolaz kroz raskrsnicu kako ga sudija vidi. */
  dnevnik?: (prolaz: { r: number; ulaz: number; izlaz: number; manevar: string; t: number }) => void;
  /** Žmigavac u prošlom koraku. */
  zmigavac: Strana | null;
  /** Poslije skretanja: strana žmigavca koji treba ugasiti, i pređeno od izlaska [m]. */
  poslijeSkretanja: { strana: Strana; predjeno: number } | null;
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
}

export function noviSudija(nivo: Level): Sudija {
  return {
    prekrsaji: [],
    zmigavac: null,
    poslijeSkretanja: null,
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
  return null;
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
    // Najbolje poravnate ose na čijem je asfaltu auto. Kad su dvije skoro
    // jednako blizu (proširene kolovozne trake bulevara se preklapaju), prednost
    // ima ona kojom se u tom smjeru smije; kad je jedna jasno bliža, ona.
    const poravnate = naAsfaltu.filter((o) => slaganje(o) > 0.8);
    const kandidati = poravnate.length > 0 ? poravnate : naAsfaltu;
    const najbliza = kandidati[0]!;
    const skoroJednako = kandidati.filter((o) => o.d - najbliza.d < GRAD_SUDIJA_NEODLUCNO);
    izbor = skoroJednako.find(dozvoljeno) ?? najbliza;
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

type Manevar = "lijevo" | "pravo" | "desno" | "polukruzno";

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
 * `zmigavac` je ono što je igrač upalio.
 */
export function sudi(g: GradZaSudiju, s: Sudija, st: SlobodnoVozilo, t: number, zmigavac: Strana | null = null): void {
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
  const ispred = r === null ? krakIspred(g, osa.ivica, gleda, osa.s) : null;
  if (s.prilaz) {
    const p = s.prilaz;
    const k = g.raskrsnice.lista[p.r]!.kraci[p.k]!;
    // Prilaz traje dok je taj krak ispred auta, ili dok je auto u raskrsnici.
    const traje = (ispred && ispred.r === p.r && ispred.k === p.k) || r === p.r;
    if (!traje) s.prilaz = null;
    else {
      const doLinije = nosDoLinije(st, p.linija, p.pravac);
      const sv = svjetlo(g.raskrsnice.lista[p.r]!, p.k, t);
      if (sv === "zuto" && p.svjetlo === "zeleno") {
        // Žuto je upaljeno: da li je tada bilo kasno za zaustavljanje?
        p.zutoPrekasno = p.doLinije > 0 && p.doLinije / Math.max(st.v, 0.1) < YELLOW_COMMIT_TTC;
      }
      if (doLinije >= 0 && doLinije <= STOP_ZONE && Math.abs(st.v) < STOPPED_SPEED) p.stajao += DT;
      if (p.doLinije > 0 && doLinije <= 0 && st.v > 0) {
        if (k.kontrola === "stop" && p.stajao < STOP_HOLD) {
          prijavi(s, st, t, "stopSign", { stajao: Number(p.stajao.toFixed(2)) });
        }
        if (k.kontrola === "semafor" && (sv === "crveno" || (sv === "zuto" && !p.zutoPrekasno))) {
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
    };
  }
  if (s.prolaz && zmigavac && !s.prolaz.zmigavacNaUlazu && !s.prolaz.upaljenUnutra) s.prolaz.upaljenUnutra = zmigavac;
  // Iz raskrsnice pravo u drugu (čvorovi prstena, raskrsnice tik jedna uz
  // drugu): prolaz kroz prvu se završava ovdje, a počinje prolaz kroz drugu.
  if (r !== null && s.prolaz && r !== s.prolaz.r) {
    const izlaz = s.prolaz.izlaz ?? osa;
    zavrsiProlaz(g, s, st, t, s.prolaz, izlaz, g.mreza.ivice[izlaz.ivica]!, glava);
    s.prolaz = {
      r,
      ivica: osa.ivica,
      cvor: g.raskrsnice.uCvoru[iv.b] === r ? iv.b : iv.a,
      pravac: glava,
      zmigavacNaUlazu: zmigavac,
      upaljenUnutra: null,
      strelice: null,
      izlaz: null,
    };
  }
  // Izlazni krak: zadnja ivica pod autom koja dodiruje raskrsnicu (ne
  // unutrašnja, ne ulazna — osim polukružnog, kad auto po njoj ide nazad).
  // Kratak krak je cijeli u raskrsnici, pa je auto pri izlasku već dalje.
  if (s.prolaz) {
    const rs = g.raskrsnice.lista[s.prolaz.r]!;
    const dodiruje = g.raskrsnice.uCvoru[iv.a] === s.prolaz.r || g.raskrsnice.uCvoru[iv.b] === s.prolaz.r;
    const nazad = osa.ivica === s.prolaz.ivica && glava.x * s.prolaz.pravac.x + glava.y * s.prolaz.pravac.y < -0.5;
    if (dodiruje && !rs.unutrasnje.includes(osa.ivica) && (osa.ivica !== s.prolaz.ivica || nazad)) s.prolaz.izlaz = osa;
  }
  if (r === null && s.prolaz && !josURaskrsnici) {
    const p = s.prolaz;
    s.prolaz = null;
    // Izlazni krak: zapamćen, ili (kad auto nikad nije bio na njemu — kratak
    // krak) krak do kojeg se od sadašnje ivice stiže unazad niz ulicu.
    let izlaz = p.izlaz ?? osa;
    if (!p.izlaz) {
      const krak = krakKaRaskrsnici(g, osa.ivica, gleda === 1 ? -1 : 1, p.r);
      if (krak) izlaz = { ...osa, ivica: krak.ivica };
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
    // lijevo od osovine duže od `GRAD_LIJEVO_TRAJE`.
    const imaStrane =
      iv.smjer === 0 &&
      iv.trakeNaprijed > 0 &&
      iv.trakeNazad > 0 &&
      iv.sirina >= (iv.trakeNaprijed + iv.trakeNazad) * GRAD_SIRINA_TRAKE - 1e-6;
    const bokUSmjeru = osa.bok * gleda;
    if (imaStrane && st.v > 0 && bokUSmjeru < -CAR_WIDTH / 2) {
      s.lijevoT += DT;
      if (s.lijevoT >= GRAD_LIJEVO_TRAJE && !s.lijevoPrijavljeno) {
        prijavi(s, st, t, "wrongSide", { sekundi: GRAD_LIJEVO_TRAJE });
        s.lijevoPrijavljeno = true;
      }
    } else {
      s.lijevoT = 0;
      s.lijevoPrijavljeno = false;
    }
    s.ivica = osa.ivica;
    s.smjer = gleda;
    s.traka = streliceTrake(iv, gleda, osa.bok);
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
  const ulicaBrzine = r !== null && s.ivica !== null ? g.mreza.ivice[s.ivica]! : iv;
  const ogranicenje = ulicaBrzine.brzina ?? GRAD_BRZINA_PODRAZUMIJEVANA;
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
      const cekaNaLiniji = s.prilaz !== null && s.prilaz.doLinije >= 0;
      const naZebri = (g.zebre.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z - osa.s) < GRAD_ZEBRA_DUBINA / 2 + CAR_LENGTH / 2 - 0.2,
      );
      const naStajalistu = (g.stajalista.get(osa.ivica) ?? []).some(
        (z) => Math.abs(z.s - osa.s) < GRAD_STAJALISTE_DUZINA / 2 && Math.sign(osa.bok) === z.strana,
      );
      const gdje = r !== null ? "raskrsnica" : naZebri ? "zebra" : naStajalistu ? "stajaliste" : null;
      if (gdje && !cekaNaLiniji) {
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
  const trazeno: Strana | null = r.kruzni ? "right" : manevar === "desno" ? "right" : manevar === "pravo" ? null : "left";
  const kruzni = r.kruzni ? 1 : 0;
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
  const cvorIzlaza = g.raskrsnice.uCvoru[iv.a] === p.r ? iv.a : iv.b;
  const put = putKrozRaskrsnicu(g, p.r, p.cvor, cvorIzlaza);
  const koraci: [number, number, number][] = [];
  let od = p.ivica;
  let cvor = p.cvor;
  for (const [i, c] of put) {
    koraci.push([od, cvor, i]);
    od = i;
    cvor = c;
  }
  koraci.push([od, cvor, osa.ivica]);
  for (const [a, c, b] of koraci) {
    const z = prekrsenaZabrana(g.zabrane, a, c, b);
    if (z) {
      prijavi(s, st, t, "zabranaSkretanja", { znak: z.vrsta });
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
  const manevar: Manevar =
    okrenuo && osa.ivica === p.ivica
      ? "polukruzno"
      : ugao > GRAD_SKRETANJE_UGAO
        ? "desno"
        : ugao < -GRAD_SKRETANJE_UGAO
          ? "lijevo"
          : "pravo";
  s.dnevnik?.({ r: p.r, ulaz: p.ivica, izlaz: osa.ivica, manevar, t });
  sudiZmigavac(g, s, st, t, p, manevar, iv.kruzni);
  // Traka za skretanje: strelice trake iz koje je ušao moraju dozvoljavati manevar.
  if (p.strelice && !dozvoljava(p.strelice, manevar)) {
    prijavi(s, st, t, "wrongLaneForTurn", { manevar, strelice: p.strelice.join(";") });
  }
  if (okrenuo && osa.ivica === p.ivica && g.raskrsnice.lista[p.r]!.plan) {
    prijavi(s, st, t, "polukruzno", { gdje: "semafor" });
  }
}
