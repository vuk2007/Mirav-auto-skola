import {
  DT,
  GRAD_PJ_BOCNO,
  GRAD_PJ_BRZINA_DO,
  GRAD_PJ_BRZINA_OD,
  GRAD_PJ_CILJ_DO,
  GRAD_PJ_CILJ_OD,
  GRAD_PJ_BLOKIRAN,
  GRAD_PJ_PROPUSTA,
  GRAD_PJ_PROPUSTA_DO,
  GRAD_PJ_GUSTINA_ZONE_PODRAZUMIJEVANO,
  GRAD_PJ_NAMJERA,
  GRAD_PJ_NESTAJE,
  GRAD_PJ_PO_GUSTINI_ZONE,
  GRAD_SKOLA_KRUG,
  GRAD_SKOLA_UZ,
  GRAD_SKOLA_UZ_UDIO,
  GRAD_PJ_POCETAK_OD,
  GRAD_PJ_POJAVA_DO,
  GRAD_PJ_POJAVA_OD,
  GRAD_PJ_POJAVA_RITAM,
  GRAD_PJ_POLUPRECNIK,
  GRAD_PJ_STRPLJENJE,
  GRAD_PJ_VAN_PUTA,
  GRAD_PJ_VAN_REZERVA,
  GRAD_PJ_VAN_ZEBRE_SIRINA,
  GRAD_PJ_VAN_ZEBRE_UDIO,
  GRAD_PJ_VAN_OD_ZEBRE,
  GRAD_VOZAC_USPORENJE,
  GRAD_ZEBRA_DUBINA,
} from "../sim/config";
import { pointAt, rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import { krajNastave } from "./dan";
import { najblizaOsa } from "./povrsina";
import type { SvijetGrada } from "./svijet";
import {
  mrezaPjesaka,
  najbliziTrotoar,
  naVezi,
  dosegnuti,
  rutaDo,
  stazeUKrugu,
  svjetloPjesaka,
  vezaNaStazi,
  type KorakPjesaka,
  type MrezaPjesaka,
  type Prelaz,
} from "./trotoari";

/**
 * Pješaci u gradu (faza 6, stavka 8): agenti po trotoarima, svaki sa ciljem
 * — stajalište, škola, javna zgrada, ili ulica dalje. Idu pješačkom mrežom
 * (`trotoari.ts`) i kolovoz prelaze na zebri i semaforu.
 *
 * Na zebri pješak stane na ivičnjak i tu se vidi da će preći (namjera, bar
 * `GRAD_PJ_NAMJERA`), pa stupi na kolovoz kad ga nijedno vozilo ne ugrožava.
 * Na semaforu kreće na zeleno, ako do kraja zelenog stigne preći.
 *
 * Pojavljuju se oko igrača kao i vozila: na početku svuda, kasnije van kadra
 * (`GRAD_PJ_POJAVA_OD`), i nestaju kad stignu ili kad se igrač udalji.
 * Koliko ih je: gustina zone (`pedestrianDensity`) × doba dana (`gustina`).
 */

/** Vozilo kako ga vidi pješak: tijelo i brzina. */
export interface VoziloZaPjesaka {
  id: number;
  x: number;
  y: number;
  ugao: number;
  v: number;
  duzina: number;
  sirina: number;
  /**
   * Stoji zbog pješaka (drugi vozači znaju zašto stoje); kod igrača se ne zna
   * — tada se gleda da li stoji tik pred zebrom.
   */
  cekaPjesaka?: boolean;
}

export interface Pjesak {
  id: number;
  x: number;
  y: number;
  /** Pravac hoda [rad]. */
  ugao: number;
  /** Brzina sada i željena brzina hoda [m/s]. */
  v: number;
  brzina: number;
  boja: number;
  /** Ruta: veze mreže redom; `k` je tekuća, `d` pređeno na njoj [m]. */
  put: KorakPjesaka[];
  k: number;
  d: number;
  /** Hoda trotoarom, čeka na ivičnjaku pred prelazom, ili je na prelazu. */
  stanje: "hoda" | "ceka" | "prelazi";
  /** Od kad stoji na ivičnjaku [s]; `null` kad ne čeka. */
  cekaOd: number | null;
  /** Prelaz koji čeka ili prelazi (indeks u `prelazi`); −1 inače. */
  prelaz: number;
  /** Ukupno pređeno [m] — korak noge u crtežu. */
  predjeno: number;
  /** Bočno od sredine trotoara, desno [m] — svoj, da se ne stapaju. */
  bocno: number;
  rodjen: number;
  /**
   * Prelazak van zebre (nivo ≥ 4): na vezi `k` rute kad pređe `d` metara,
   * od tačke `a` (trotoar) do `b` (trotoar preko puta); `u` — pređeno od `a`.
   */
  vanZebre: { k: number; d: number; a: Point; b: Point; u: number } | null;
  /** Od kad mu vozilo stoji na putu na trotoaru (stavka 8c); `null` kad ne stoji. */
  blokiranOd?: number | null;
  /** Stoji pred ivičnjakom i propušta vozilo koje dugo čeka (prelaz; stavka 8c). */
  propusta?: number;
}

export interface MetrikaPjesaka {
  pojavljeno: number;
  stiglo: number;
  udaljilo: number;
  preslo: number;
  /** Prešlo van zebre, i odustalo od prelaza (čekali predugo). */
  van: number;
  odustalo: number;
}

export interface Pjesaci {
  svijet: SvijetGrada;
  mreza: MrezaPjesaka;
  lista: Pjesak[];
  t: number;
  slucajno: () => number;
  sljedeciId: number;
  zadnjaPojava: number;
  popunjeno: boolean;
  /** Udio broja pješaka zone [0–1]: doba dana (zonu dodaje `ciljniBrojPjesaka`). */
  gustina: number;
  /** Gustina pješaka van zona (0–3); mjerilo postavlja 3 (`?debug=1&pjesaci=3`). */
  gustinaVanZona: number;
  zone: { poligon: Point[]; minX: number; minY: number; maxX: number; maxY: number; gustina: number }[];
  /** Ciljevi: čvor mreže i tačka (stajališta, škole, javne zgrade). */
  ciljevi: { cvor: number; x: number; y: number }[];
  /** Škole (sredine površina i zgrada škola iz OSM-a): oko njih se završava nastava. */
  skole: Point[];
  /**
   * Sat igre (stavka 8d); `null` — bez dnevnog ciklusa (fuzz, testovi). Na
   * kraju nastave (`krajNastave`) oko škole je najviše pješaka.
   */
  sat: number | null;
  metrika: MetrikaPjesaka;
  /** Nivo vožnje: na 4 i 5 pješaci (rijetko) prelaze i van zebre. */
  nivo: number;
  /**
   * Prelaz bez semafora pred kojim vozilo čeka pješake: od kada (stavka 8c,
   * vidi `GRAD_PJ_PROPUSTA`) i kad je zadnji put viđeno.
   */
  vozilaCekaju: Map<number, { od: number; zadnje: number }>;
}

const PALETA_PJESAKA = 8;

/** Tačka u poligonu (zraka nadesno). */
function uPoligonu(p: Point, poligon: readonly Point[]): boolean {
  let unutra = false;
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const a = poligon[i]!;
    const b = poligon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) unutra = !unutra;
  }
  return unutra;
}

/** Čvor mreže na trotoaru najbližem tački (kraj veze), do `do_` [m]. */
function cvorBlizu(mp: MrezaPjesaka, x: number, y: number, do_: number): number {
  const t = najbliziTrotoar(mp, x, y, do_);
  if (!t) return -1;
  const vi = vezaNaStazi(mp, t.staza, t.u);
  if (vi < 0) return -1;
  const v = mp.veze[vi]!;
  return Math.abs(t.u - v.u0) <= Math.abs(v.u1 - t.u) ? v.a : v.b;
}

/** Škole iz OSM-a: sredine površina škola i zgrada škola (bez dvije bliže od 60 m). */
function skoleGrada(sv: SvijetGrada): Point[] {
  const out: Point[] = [];
  const n = sv.paket.n;
  const z = sv.paket.zaglavlje;
  const dodaj = (xy: ArrayLike<number>, od: number, do_: number) => {
    if (do_ <= od) return;
    let sx = 0;
    let sy = 0;
    for (let k = od; k < do_; k++) {
      sx += xy[2 * k]!;
      sy += xy[2 * k + 1]!;
    }
    const p = { x: sx / (do_ - od), y: sy / (do_ - od) };
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 60)) out.push(p);
  };
  const skola = z.vrstePovrsina.indexOf("skola");
  for (let i = 0; i + 1 < n.pvOd.length; i++) if (n.pvVrsta[i] === skola) dodaj(n.pvXY, n.pvOd[i]!, n.pvOd[i + 1]!);
  const zgrada = z.vrsteZgrada.indexOf("school");
  for (let i = 0; i + 1 < n.zgOd.length; i++) if (n.zgVrsta[i] === zgrada) dodaj(n.zgXY, n.zgOd[i]!, n.zgOd[i + 1]!);
  return out;
}

/** Škola do `GRAD_SKOLA_KRUG` m od tačke, a sad je kraj nastave (stavka 8d). */
function skolaSeZavrsava(pj: Pjesaci, p: Point): boolean {
  if (pj.sat === null || !krajNastave(pj.sat)) return false;
  return pj.skole.some((s) => Math.hypot(s.x - p.x, s.y - p.y) <= GRAD_SKOLA_KRUG);
}

/** Ciljevi pješaka iz OSM-a: stajališta, škole (površine) i javne zgrade (sa imenom). */
function ciljeviGrada(sv: SvijetGrada, mp: MrezaPjesaka): { cvor: number; x: number; y: number }[] {
  const out: { cvor: number; x: number; y: number }[] = [];
  const dodaj = (x: number, y: number, do_: number) => {
    const c = cvorBlizu(mp, x, y, do_);
    if (c >= 0 && !out.some((o) => o.cvor === c)) out.push({ cvor: c, x: mp.cx[c]!, y: mp.cy[c]! });
  };
  const n = sv.paket.n;
  const z = sv.paket.zaglavlje;
  const stajaliste = z.vrsteObjekata.indexOf("bus_stop");
  for (let o = 0; o < n.obVrsta.length; o++) if (n.obVrsta[o] === stajaliste) dodaj(n.obXY[2 * o]!, n.obXY[2 * o + 1]!, 25);
  const skola = z.vrstePovrsina.indexOf("skola");
  for (let i = 0; i + 1 < n.pvOd.length; i++) {
    if (n.pvVrsta[i] !== skola) continue;
    let sx = 0;
    let sy = 0;
    const od = n.pvOd[i]!;
    const do_ = n.pvOd[i + 1]!;
    for (let k = od; k < do_; k++) {
      sx += n.pvXY[2 * k]!;
      sy += n.pvXY[2 * k + 1]!;
    }
    if (do_ > od) dodaj(sx / (do_ - od), sy / (do_ - od), 80);
  }
  for (let i = 0; i + 1 < n.zgOd.length; i++) {
    if (!n.zgIme[i]) continue;
    const od = n.zgOd[i]!;
    const do_ = n.zgOd[i + 1]!;
    let sx = 0;
    let sy = 0;
    for (let k = od; k < do_; k++) {
      sx += n.zgXY[2 * k]!;
      sy += n.zgXY[2 * k + 1]!;
    }
    if (do_ > od) dodaj(sx / (do_ - od), sy / (do_ - od), 40);
  }
  return out;
}

export function noviPjesaci(svijet: SvijetGrada, sjeme: number, gustina = 1): Pjesaci {
  const mp = mrezaPjesaka(svijet);
  const zone = svijet.zone
    .filter((z) => z.pedestrianDensity !== null && z.poligon.length >= 3)
    .map((z) => {
      const poligon = z.poligon.map(([x, y]) => ({ x, y }));
      return {
        poligon,
        minX: Math.min(...poligon.map((t) => t.x)),
        minY: Math.min(...poligon.map((t) => t.y)),
        maxX: Math.max(...poligon.map((t) => t.x)),
        maxY: Math.max(...poligon.map((t) => t.y)),
        gustina: z.pedestrianDensity!,
      };
    });
  return {
    svijet,
    mreza: mp,
    lista: [],
    t: 0,
    slucajno: rng(sjeme ^ 0x5eed),
    sljedeciId: 1,
    zadnjaPojava: -Infinity,
    popunjeno: false,
    gustina,
    gustinaVanZona: GRAD_PJ_GUSTINA_ZONE_PODRAZUMIJEVANO,
    zone,
    ciljevi: ciljeviGrada(svijet, mp),
    skole: skoleGrada(svijet),
    sat: null,
    metrika: { pojavljeno: 0, stiglo: 0, udaljilo: 0, preslo: 0, van: 0, odustalo: 0 },
    nivo: 5,
    vozilaCekaju: new Map(),
  };
}

/** Gustina pješaka zone u kojoj je tačka (editor, 0–3); van zona `gustinaVanZona`. */
export function gustinaPjesakaZone(pj: Pjesaci, p: Point): number {
  let g = pj.gustinaVanZona;
  for (const z of pj.zone) {
    if (p.x < z.minX || p.x > z.maxX || p.y < z.minY || p.y > z.maxY) continue;
    if (uPoligonu(p, z.poligon)) g = z.gustina;
  }
  return Math.max(0, Math.min(GRAD_PJ_PO_GUSTINI_ZONE.length - 1, Math.round(g)));
}

/**
 * Koliko pješaka treba oko igrača sada: po gustini zone × doba dana. Na kraju
 * nastave oko škole gustina je najveća (stavka 8d).
 */
export function ciljniBrojPjesaka(pj: Pjesaci, fokus: Point): number {
  const g = skolaSeZavrsava(pj, fokus) ? GRAD_PJ_PO_GUSTINI_ZONE.length - 1 : gustinaPjesakaZone(pj, fokus);
  return Math.round(GRAD_PJ_PO_GUSTINI_ZONE[g]! * pj.gustina);
}

// ── prelaz: smije li se stupiti na kolovoz ─────────────────────────────────

/**
 * Gdje vozilo siječe prelaz, ako ide ka njemu: razdaljina od nosa do bliže
 * ivice zebre [m] (negativno — već je na njoj), ili `null` kad ga ne siječe.
 * Pravac vožnje se produži do linije prelaza. Vozilo koje skreće ka prelazu
 * a pravcem ga (još) ne siječe — ide uz liniju prelaza, ili pored zebre —
 * vidi se po blizini: razdaljina od nosa do zebre, dok je u vožnji bliže od
 * zaustavnog puta (u krivini se ne zna kuda će; pješak ga ne čeka dugo).
 */
export function doPrelaza(o: VoziloZaPjesaka, p: Prelaz): number | null {
  const hx = Math.cos(o.ugao);
  const hy = Math.sin(o.ugao);
  // Linija prelaza: od `a` do `b`; normala na nju je pravac ulice.
  const ux = (p.b.x - p.a.x) / p.duzina;
  const uy = (p.b.y - p.a.y) / p.duzina;
  const nx = -uy;
  const ny = ux;
  const dn = (o.x - p.a.x) * nx + (o.y - p.a.y) * ny;
  const hn = hx * nx + hy * ny;
  const pola = GRAD_ZEBRA_DUBINA / 2;
  const duz = (o.duzina / 2) * Math.abs(hn) + (o.sirina / 2) * Math.sqrt(Math.max(0, 1 - hn * hn));
  // Tijelo već preko linije prelaza (u pojasu zebre).
  if (Math.abs(dn) <= pola + duz) {
    const w = (o.x - p.a.x) * ux + (o.y - p.a.y) * uy;
    return w >= -1 && w <= p.duzina + 1 ? -1 : null;
  }
  // Pravcem ne siječe prelaz: možda skreće ka njemu (vidi gore).
  const blizu = (): number | null => {
    if (o.v < 0.5) return null;
    const nosX = o.x + hx * (o.duzina / 2);
    const nosY = o.y + hy * (o.duzina / 2);
    const w = (nosX - p.a.x) * ux + (nosY - p.a.y) * uy;
    const n = (nosX - p.a.x) * nx + (nosY - p.a.y) * ny;
    const d = Math.hypot(w - Math.min(Math.max(w, 0), p.duzina), Math.max(0, Math.abs(n) - pola));
    return d < (o.v * o.v) / (2 * GRAD_VOZAC_USPORENJE) + 1 ? d : null;
  };
  // Udaljava se od linije: nije mu na putu.
  if (Math.abs(hn) >= 0.2 && Math.sign(dn) === Math.sign(hn)) return null;
  if (Math.abs(hn) < 0.2) return blizu();
  const t = Math.abs(dn) / Math.abs(hn);
  const w = (o.x + hx * t - p.a.x) * ux + (o.y + hy * t - p.a.y) * uy;
  if (w < -2 || w > p.duzina + 2) return blizu();
  return Math.max(0, Math.abs(dn) - pola - duz) / Math.abs(hn);
}

/**
 * Vozilo ugrožava pješaka koji bi sad stupio na prelaz: već je na prelazu,
 * ili do njega stiže, a ne može da stane udobnim kočenjem (`GRAD_VOZAC_USPORENJE`)
 * prije njega — ili stiže dok bi pješak još bio na kolovozu.
 */
export function ugrozava(o: VoziloZaPjesaka, p: Prelaz, prelaziZa: number): boolean {
  const d = doPrelaza(o, p);
  if (d === null) return false;
  if (d < 0) return true;
  // Stoji pred zebrom (vozači staju `GRAD_STOP_ISPRED_ZEBRE`, ili tik pred
  // njom): ne ugrožava — čeka baš pješaka. Sa rezervom od metra pješak bi
  // čekao njega, a ono pješaka (stavka 8c).
  if (o.v < 0.1) return false;
  const zaustavni = (o.v * o.v) / (2 * GRAD_VOZAC_USPORENJE) + 1;
  if (d >= zaustavni) return false;
  return d / Math.max(o.v, 0.1) < prelaziZa + 1;
}

/**
 * Da li vozilo pred zebrom (bez semafora) čeka pješake duže od
 * `GRAD_PJ_PROPUSTA`: stoji, nosom do `GRAD_PJ_PROPUSTA_DO` m pred zebrom,
 * i čeka baš pješake (drugi vozači to znaju; igrač — stoji tik pred njom).
 * Vrijeme se vodi po prelazu (`Pjesaci.vozilaCekaju`).
 */
function propustaVozilo(pj: Pjesaci, p: Prelaz, vozila: readonly VoziloZaPjesaka[]): boolean {
  if (p.semafor) return false;
  const c = p.centar;
  const ceka = vozila.some((o) => {
    if (o.v >= 0.1 || o.cekaPjesaka === false) return false;
    if (Math.abs(o.x - c.x) > 30 || Math.abs(o.y - c.y) > 30) return false;
    const d = doPrelaza(o, p);
    return d !== null && d >= 0 && d <= GRAD_PJ_PROPUSTA_DO;
  });
  const z = pj.vozilaCekaju.get(p.id);
  if (!ceka) {
    pj.vozilaCekaju.delete(p.id);
    return false;
  }
  // Niko ga nije gledao (nema pješaka uz prelaz): brojanje počinje iznova.
  if (!z || pj.t - z.zadnje > 2 * DT) {
    pj.vozilaCekaju.set(p.id, { od: pj.t, zadnje: pj.t });
    return false;
  }
  z.zadnje = pj.t;
  return pj.t - z.od > GRAD_PJ_PROPUSTA;
}

/** Smije li pješak sada stupiti na prelaz (svjetlo, vozila). */
function smijePreci(pj: Pjesaci, x: Pjesak, p: Prelaz, vozila: readonly VoziloZaPjesaka[]): boolean {
  const prelaziZa = p.duzina / x.brzina;
  const s = svjetloPjesaka(pj.svijet, p, pj.t);
  if (s) {
    if (s.stanje !== "zeleno" || s.preostalo < prelaziZa + 1) return false;
  } else if (x.cekaOd === null || pj.t - x.cekaOd < GRAD_PJ_NAMJERA) {
    // Zebra: prvo se stane na ivičnjak i pokaže namjera.
    return false;
  }
  const c = p.centar;
  for (const o of vozila) {
    if (Math.abs(o.x - c.x) > 80 || Math.abs(o.y - c.y) > 80) continue;
    if (ugrozava(o, p, prelaziZa)) return false;
  }
  return true;
}

/** Vozilo je pješaku tik ispred (u pravcu hoda): korak dalje bi ga dotakao. */
function blokira(x: Pjesak, vozila: readonly VoziloZaPjesaka[]): boolean {
  const korak = 0.4;
  const t = { x: x.x + Math.cos(x.ugao) * korak, y: x.y + Math.sin(x.ugao) * korak };
  for (const o of vozila) {
    if (Math.abs(o.x - x.x) > 6 || Math.abs(o.y - x.y) > 6) continue;
    const tijelo = { x: o.x, y: o.y, ugao: o.ugao, duzina: o.duzina + 0.2, sirina: o.sirina + 0.2 };
    if (udaraPjesaka(tijelo, t) && !udaraPjesaka(tijelo, x)) return true;
  }
  return false;
}

/**
 * Smije li pješak van zebre stupiti na kolovoz: nijedno vozilo nije bliže od
 * `GRAD_PJ_VAN_PUTA` × udobni zaustavni put + `GRAD_PJ_VAN_REZERVA` (vozač ga
 * vidi na vrijeme), niti je na mjestu prelaska.
 */
function smijeVanZebre(van: { a: Point; b: Point }, vozila: readonly VoziloZaPjesaka[]): boolean {
  const duzina = Math.hypot(van.b.x - van.a.x, van.b.y - van.a.y);
  const p = { a: van.a, b: van.b, duzina } as Prelaz;
  for (const o of vozila) {
    if (Math.abs(o.x - van.a.x) > 120 || Math.abs(o.y - van.a.y) > 120) continue;
    const d = doPrelaza(o, p);
    if (d === null) continue;
    if (d < 0) return false;
    if (d < GRAD_PJ_VAN_PUTA * ((o.v * o.v) / (2 * GRAD_VOZAC_USPORENJE)) + GRAD_PJ_VAN_REZERVA) return false;
  }
  return true;
}

/**
 * Poslije prelaska van zebre: pješak je na trotoaru preko puta (`b`) — nova
 * ruta odatle do cilja do kojeg ima puta. Vraća `false` kad je nema (nestaje).
 */
function rutaOdTacke(pj: Pjesaci, x: Pjesak, b: Point): boolean {
  const mp = pj.mreza;
  const t = najbliziTrotoar(mp, b.x, b.y, 3);
  if (!t) return false;
  const vi = vezaNaStazi(mp, t.staza, t.u);
  if (vi < 0) return false;
  const v = mp.veze[vi]!;
  const naprijed = pj.slucajno() < 0.5;
  const kraj = naprijed ? v.b : v.a;
  const stablo = dosegnuti(mp, kraj, GRAD_PJ_CILJ_DO);
  const daleki = [...stablo.entries()].filter(([, e]) => e.g >= GRAD_PJ_CILJ_OD).map(([c]) => c);
  if (daleki.length === 0) return false;
  x.put = [{ veza: vi, od: naprijed ? v.a : v.b }, ...rutaDo(mp, stablo, daleki[Math.floor(pj.slucajno() * daleki.length)]!)];
  x.k = 0;
  x.d = Math.max(0, Math.min(v.duzina, naprijed ? t.u - v.u0 : v.u1 - t.u));
  return true;
}

/**
 * Okreće se: vozilo mu stoji na putu (na trotoaru preko kojeg vozilo zalazi u
 * oštroj krivini, ili na rubu kolovoza) — vraća se istom vezom i ide drugim
 * ciljem, bez nje. Inače bi vozilo čekalo pješaka, a pješak vozilo.
 */
function okreni(pj: Pjesaci, x: Pjesak): boolean {
  const mp = pj.mreza;
  const korak = x.put[x.k]!;
  const v = mp.veze[korak.veza]!;
  const stablo = dosegnuti(mp, korak.od, GRAD_PJ_CILJ_DO, korak.veza);
  const daleki = [...stablo.entries()].filter(([, e]) => e.g >= GRAD_PJ_CILJ_OD / 2).map(([c]) => c);
  if (daleki.length === 0) return false;
  const ruta = rutaDo(mp, stablo, daleki[Math.floor(pj.slucajno() * daleki.length)]!);
  if (ruta.length === 0) return false;
  const drugi = korak.od === v.a ? v.b : v.a;
  x.put = [{ ...korak, od: drugi }, ...ruta];
  x.k = 0;
  x.d = Math.max(0, v.duzina - x.d);
  // Bočni pomak je desno od smjera hoda: okrenut, bio bi preko puta (i
  // skočio bi u vozilo koje mu stoji na putu) — ostaje gdje je.
  x.bocno = -x.bocno;
  x.vanZebre = null;
  x.blokiranOd = null;
  return true;
}

/** Odustaje od prelaza na koji predugo čeka: nova ruta sa ivičnjaka, bez tog prelaza. */
function odustani(pj: Pjesaci, x: Pjesak): boolean {
  const mp = pj.mreza;
  const korak = x.put[x.k]!;
  const stablo = dosegnuti(mp, korak.od, GRAD_PJ_CILJ_DO, korak.veza);
  const daleki = [...stablo.entries()].filter(([, e]) => e.g >= GRAD_PJ_CILJ_OD / 2).map(([c]) => c);
  if (daleki.length === 0) return false;
  const ruta = rutaDo(mp, stablo, daleki[Math.floor(pj.slucajno() * daleki.length)]!);
  if (ruta.length === 0) return false;
  x.put = ruta;
  x.k = 0;
  x.d = 0;
  // Prelazak van zebre bio je na staroj ruti.
  x.vanZebre = null;
  return true;
}

// ── korak ──────────────────────────────────────────────────────────────────

function postaviPozu(pj: Pjesaci, x: Pjesak): void {
  const van = x.vanZebre;
  if (van && x.stanje !== "hoda" && x.k === van.k) {
    // Van zebre: pravo preko kolovoza, od `a` ka `b`.
    const l = Math.hypot(van.b.x - van.a.x, van.b.y - van.a.y) || 1;
    const f = Math.min(1, van.u / l);
    x.x = van.a.x + (van.b.x - van.a.x) * f;
    x.y = van.a.y + (van.b.y - van.a.y) * f;
    x.ugao = Math.atan2(van.b.y - van.a.y, van.b.x - van.a.x);
    return;
  }
  const korak = x.put[x.k]!;
  const v = pj.mreza.veze[korak.veza]!;
  const p = naVezi(pj.mreza, v, korak.od, x.d);
  x.x = p.x - p.hy * x.bocno;
  x.y = p.y + p.hx * x.bocno;
  x.ugao = Math.atan2(p.hy, p.hx);
}

/**
 * Jedan korak (`DT`) svih pješaka oko tačke `fokus` (igrač). `vozila` su
 * tijela vozila (drugi i igrač) — pješak ne stupa na prelaz ispred vozila koje
 * ga ugrožava.
 */
export function korakPjesaka(pj: Pjesaci, fokus: Point, vozila: readonly VoziloZaPjesaka[]): void {
  const mp = pj.mreza;
  const ukloni = new Set<number>();
  // Vrijeme čekanja vozila pred prelazima uz koje ima pješaka (i onih koji ga
  // propuštaju): vodi se svaki korak, ne samo kad neko stigne na ivičnjak.
  const uzPrelaz = new Set<number>();
  for (const x of pj.lista) {
    if (x.prelaz >= 0) uzPrelaz.add(x.prelaz);
    if (x.propusta !== undefined) uzPrelaz.add(x.propusta);
  }
  for (const id of [...uzPrelaz].sort((a, b) => a - b)) propustaVozilo(pj, mp.prelazi[id]!, vozila);
  for (const x of pj.lista) {
    let ostalo = x.brzina * DT;
    x.v = 0;
    // Van zebre: stao je na ivičnjak (čeka da vozila prođu), ili prelazi.
    const van = x.vanZebre;
    if (van && x.k === van.k && x.d >= van.d - 1e-9) {
      if (x.stanje === "hoda") {
        x.stanje = "ceka";
        x.cekaOd = pj.t;
        x.prelaz = -1;
      }
      if (x.stanje === "ceka") {
        if (pj.t - x.cekaOd! > GRAD_PJ_STRPLJENJE) {
          x.vanZebre = null;
          x.stanje = "hoda";
          x.cekaOd = null;
        } else if (smijeVanZebre(van, vozila)) {
          x.stanje = "prelazi";
          x.cekaOd = null;
        }
      }
      if (x.stanje === "prelazi" && !blokira(x, vozila)) {
        const l = Math.hypot(van.b.x - van.a.x, van.b.y - van.a.y);
        const dalje = Math.min(ostalo, l - van.u);
        van.u += dalje;
        x.predjeno += dalje;
        x.v = dalje / DT;
        if (van.u >= l - 1e-9) {
          pj.metrika.van += 1;
          x.vanZebre = null;
          x.stanje = "hoda";
          if (!rutaOdTacke(pj, x, van.b)) ukloni.add(x.id);
        }
      }
      if (x.k < x.put.length && !ukloni.has(x.id)) postaviPozu(pj, x);
      continue;
    }
    while (ostalo > 0 && x.k < x.put.length) {
      const korak = x.put[x.k]!;
      const v = mp.veze[korak.veza]!;
      if (v.prelaz >= 0 && x.stanje !== "prelazi") {
        // Vozilo pred zebrom već dugo čeka pješake (`GRAD_PJ_PROPUSTA`), a
        // oni pristižu jedan za drugim: ko tek stiže, ne staje na ivičnjak
        // (ne pokazuje namjeru) dok vozilo ne prođe — inače ono čeka
        // beskonačno (stavka 8c).
        if (x.stanje === "hoda" && propustaVozilo(pj, mp.prelazi[v.prelaz]!, vozila)) {
          x.propusta = v.prelaz;
          break;
        }
        x.propusta = undefined;
        // Na ivičnjaku pred prelazom: čeka dok ne smije.
        if (x.stanje !== "ceka") {
          x.stanje = "ceka";
          x.cekaOd = pj.t;
          x.prelaz = v.prelaz;
        }
        if (!smijePreci(pj, x, mp.prelazi[v.prelaz]!, vozila)) {
          // Predugo čeka (vozila stoje na zebri, ili se semafor ne mijenja):
          // ide drugim putem.
          if (pj.t - x.cekaOd! > GRAD_PJ_STRPLJENJE) {
            pj.metrika.odustalo += 1;
            x.stanje = "hoda";
            x.cekaOd = null;
            x.prelaz = -1;
            if (!odustani(pj, x)) ukloni.add(x.id);
          }
          break;
        }
        x.stanje = "prelazi";
        x.cekaOd = null;
      }
      // Na kolovozu se ne ulazi u vozilo (stoji na zebri, ili je tek stiglo):
      // pješak tada stane i sačeka. Ni na trotoaru (vozilo zalazi na njega u
      // oštroj krivini): stane, a kad vozilo predugo stoji — okreće se.
      if (blokira(x, vozila)) {
        if (x.stanje === "hoda") {
          x.blokiranOd ??= pj.t;
          if (pj.t - x.blokiranOd > GRAD_PJ_BLOKIRAN && !okreni(pj, x)) ukloni.add(x.id);
        }
        break;
      }
      x.blokiranOd = null;
      const dalje = Math.min(ostalo, v.duzina - x.d);
      x.d += dalje;
      x.predjeno += dalje;
      x.v += dalje / DT;
      ostalo -= dalje;
      if (x.d >= v.duzina - 1e-9) {
        if (v.prelaz >= 0) {
          pj.metrika.preslo += 1;
          x.prelaz = -1;
        }
        x.stanje = "hoda";
        x.k += 1;
        x.d = 0;
      }
    }
    if (x.k < x.put.length) postaviPozu(pj, x);
  }
  pj.t += DT;
  // Stigli, i oni daleko od igrača, nestaju.
  pj.lista = pj.lista.filter((x) => {
    if (x.k >= x.put.length || ukloni.has(x.id)) {
      pj.metrika.stiglo += 1;
      return false;
    }
    if (Math.hypot(x.x - fokus.x, x.y - fokus.y) > GRAD_PJ_NESTAJE) {
      pj.metrika.udaljilo += 1;
      return false;
    }
    return true;
  });
  pojavi(pj, fokus, vozila);
}

function pojavi(pj: Pjesaci, fokus: Point, vozila: readonly VoziloZaPjesaka[]): void {
  const cilj = ciljniBrojPjesaka(pj, fokus);
  if (pj.lista.length >= cilj) {
    pj.popunjeno = true;
    return;
  }
  if (pj.popunjeno && pj.t - pj.zadnjaPojava < GRAD_PJ_POJAVA_RITAM) return;
  const odjednom = pj.popunjeno ? 1 : cilj - pj.lista.length;
  const odR = pj.popunjeno ? GRAD_PJ_POJAVA_OD : GRAD_PJ_POCETAK_OD;
  // Trotoari u prstenu (sredina staze).
  const prsten = trotoariUKrugu(pj.mreza, fokus, odR, GRAD_PJ_POJAVA_DO);
  if (prsten.length === 0) return;
  // Kraj nastave (stavka 8d): dio pješaka izlazi iz škole — trotoari uz nju,
  // i dalje u prstenu (ne pojavljuju se igraču pred očima).
  let uzSkolu: number[] = [];
  if (skolaSeZavrsava(pj, fokus)) {
    const uPrstenu = new Set(prsten);
    const vidjen = new Set<number>();
    for (const s of pj.skole) {
      if (Math.hypot(s.x - fokus.x, s.y - fokus.y) > GRAD_PJ_POJAVA_DO + GRAD_SKOLA_UZ) continue;
      for (const k of trotoariUKrugu(pj.mreza, s, 0, GRAD_SKOLA_UZ)) {
        if (uPrstenu.has(k) && !vidjen.has(k)) {
          vidjen.add(k);
          uzSkolu.push(k);
        }
      }
    }
    uzSkolu = uzSkolu.sort((a, b) => a - b);
  }
  for (let k = 0; k < odjednom; k++) {
    const x = noviPjesak(pj, uzSkolu.length > 0 && pj.slucajno() < GRAD_SKOLA_UZ_UDIO ? uzSkolu : prsten, vozila);
    if (!x) continue;
    pj.lista.push(x);
    pj.metrika.pojavljeno += 1;
    pj.zadnjaPojava = pj.t;
  }
  pj.popunjeno = true;
}

/**
 * Gdje na ruti pješak pređe ulicu van zebre: sredina prve veze na trotoaru
 * dvosmjerne ulice do `GRAD_PJ_VAN_ZEBRE_SIRINA`, sa trotoarom i preko puta,
 * dalje od zebre od `GRAD_PJ_VAN_OD_ZEBRE`; `null` kad takve nema.
 */
function mjestoVanZebre(pj: Pjesaci, x: Pjesak): Pjesak["vanZebre"] {
  const mp = pj.mreza;
  const m = pj.svijet.mreza;
  for (let k = 1; k < x.put.length; k++) {
    const korak = x.put[k]!;
    const v = mp.veze[korak.veza]!;
    if (v.staza < 0 || v.duzina < 12) continue;
    const st = mp.staze[v.staza]!;
    if (st.vrsta !== "strana") continue;
    const iv = m.ivice[st.ivica]!;
    if (iv.smjer !== 0 || iv.sirina > GRAD_PJ_VAN_ZEBRE_SIRINA) continue;
    const preko = mp.straneIvica[2 * st.ivica + (st.strana === 1 ? 1 : 0)]!;
    if (preko < 0) continue;
    const d = v.duzina / 2;
    const a = naVezi(mp, v, korak.od, d);
    const osa = najblizaOsa(pj.svijet.povrsina, a.x, a.y, iv.sirina);
    if (!osa || osa.ivica !== st.ivica) continue;
    if (mp.prelazi.some((p) => Math.hypot(p.centar.x - osa.tacka.x, p.centar.y - osa.tacka.y) < GRAD_PJ_VAN_OD_ZEBRE)) continue;
    const b = { x: 2 * osa.tacka.x - a.x, y: 2 * osa.tacka.y - a.y };
    const t = najbliziTrotoar(mp, b.x, b.y, 1.5);
    if (!t || t.staza !== preko) continue;
    return { k, d, a: { x: a.x, y: a.y }, b, u: 0 };
  }
  return null;
}

/** Trotoari (vidi `MrezaPjesaka.trotoari`) čija je sredina `od`–`do_` [m] od tačke. */
function trotoariUKrugu(mp: MrezaPjesaka, c: Point, od: number, do_: number): number[] {
  const out: number[] = [];
  const vidjen = new Set<number>();
  for (const k of stazeUKrugu(mp, c, do_)) {
    if (vidjen.has(k)) continue;
    vidjen.add(k);
    const st = mp.staze[k]!;
    if (st.vrsta !== "strana" || st.srednja || st.duzina <= 5) continue;
    const p = pointAt(st.tacke, st.cum, st.duzina / 2);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d >= od && d <= do_) out.push(k);
  }
  return out.sort((a, b) => a - b);
}

function noviPjesak(pj: Pjesaci, prsten: readonly number[], vozila: readonly VoziloZaPjesaka[]): Pjesak | null {
  const mp = pj.mreza;
  const sl = pj.slucajno;
  for (let pokusaj = 0; pokusaj < 6; pokusaj++) {
    const staza = prsten[Math.floor(sl() * prsten.length)]!;
    const veze = mp.vezeStaze[staza]!;
    if (veze.length === 0) continue;
    const vi = veze[Math.floor(sl() * veze.length)]!;
    const v = mp.veze[vi]!;
    const naprijed = sl() < 0.5;
    const od = naprijed ? v.a : v.b;
    const kraj = naprijed ? v.b : v.a;
    const d0 = sl() * v.duzina;
    // Cilj: stajalište, škola ili javna zgrada (pola puta), inače trotoar
    // `GRAD_PJ_CILJ_OD`–`DO` od mjesta pojave.
    const px = mp.cx[kraj]!;
    const py = mp.cy[kraj]!;
    const uDometu = (cx: number, cy: number) => {
      const d = Math.hypot(cx - px, cy - py);
      return d >= GRAD_PJ_CILJ_OD && d <= GRAD_PJ_CILJ_DO;
    };
    // Cilj samo tamo do čega ima puta (mrežom do `GRAD_PJ_CILJ_DO`): pola
    // puta stajalište, škola ili javna zgrada, inače bilo koji čvor dalje od
    // `GRAD_PJ_CILJ_OD`.
    const stablo = dosegnuti(mp, kraj, GRAD_PJ_CILJ_DO);
    let ciljCvor = -1;
    if (sl() < 0.5) {
      const ciljevi = pj.ciljevi.filter((c) => uDometu(c.x, c.y) && stablo.has(c.cvor));
      if (ciljevi.length > 0) ciljCvor = ciljevi[Math.floor(sl() * ciljevi.length)]!.cvor;
    }
    if (ciljCvor < 0) {
      const daleki = [...stablo.entries()].filter(([, e]) => e.g >= GRAD_PJ_CILJ_OD).map(([c]) => c);
      if (daleki.length === 0) continue;
      ciljCvor = daleki[Math.floor(sl() * daleki.length)]!;
    }
    const ruta = rutaDo(mp, stablo, ciljCvor);
    if (ruta.length === 0) continue;
    const x: Pjesak = {
      id: pj.sljedeciId++,
      x: 0,
      y: 0,
      ugao: 0,
      v: 0,
      brzina: GRAD_PJ_BRZINA_OD + sl() * (GRAD_PJ_BRZINA_DO - GRAD_PJ_BRZINA_OD),
      boja: Math.floor(sl() * PALETA_PJESAKA),
      put: [{ veza: vi, od }, ...ruta],
      k: 0,
      d: d0,
      stanje: "hoda",
      cekaOd: null,
      prelaz: -1,
      predjeno: sl() * 10,
      bocno: GRAD_PJ_BOCNO * (0.5 + 0.5 * sl()),
      rodjen: pj.t,
      vanZebre: null,
    };
    // Nivo 4 i 5: rijetko ko pređe ulicu van zebre (zadatak, odjeljak 6).
    if (pj.nivo >= 4 && sl() < GRAD_PJ_VAN_ZEBRE_UDIO) x.vanZebre = mjestoVanZebre(pj, x);
    // Na prelaz se ne pojavljuje: počinje na trotoaru.
    if (v.prelaz >= 0) continue;
    postaviPozu(pj, x);
    if (pj.lista.some((o) => Math.hypot(o.x - x.x, o.y - x.y) < 2 * GRAD_PJ_POLUPRECNIK)) continue;
    // Ni u vozilu, ni tik uz njega (staza na oštroj krivini zalazi na
    // kolovoz, a vozilo i na trotoar; stavka 8c).
    const uVozilu = vozila.some(
      (o) =>
        Math.abs(o.x - x.x) < o.duzina &&
        Math.abs(o.y - x.y) < o.duzina &&
        udaraPjesaka({ x: o.x, y: o.y, ugao: o.ugao, duzina: o.duzina + 1, sirina: o.sirina + 1 }, x),
    );
    if (uVozilu) continue;
    return x;
  }
  return null;
}

/** Gdje je pješak na prelazu `p` (od `a` ka `b` [m]) i kuda ide (+1 ka `b`). */
export function naPrelazu(pj: Pjesaci, x: Pjesak, p: Prelaz): { w: number; smjer: 1 | -1 } {
  const ux = (p.b.x - p.a.x) / p.duzina;
  const uy = (p.b.y - p.a.y) / p.duzina;
  const w = (x.x - p.a.x) * ux + (x.y - p.a.y) * uy;
  const korak = x.put[x.k];
  return { w, smjer: korak && korak.od === p.cvorB ? -1 : 1 };
}

/**
 * Pješaci zbog kojih vozilo mora stati pred prelazom `p` (stavka 8, odluka
 * korisnika 2026-10-08), za vozilo čija je polovina ulice `polovina` (vidi
 * `polovinaUlice`):
 *  - `naPrelazu`: na kolovozu prelaza je i još nije prešao tu polovinu
 *    (pješak koji ju je prešao i udaljava se ne zaustavlja vozilo);
 *  - `cekaju`: stoji na ivičnjaku uz prelaz i pokazuje namjeru — na prelazu
 *    sa semaforom samo dok za pješake gori zeleno. Da li je vozilo tada moglo
 *    udobno stati, odlučuje pozivalac (drugi vozač — sada; sudija — kad je
 *    pješak stao na ivičnjak).
 */
export function pjesaciSaPrednoscu(pj: Pjesaci, p: Prelaz, polovina: readonly [number, number]): { naPrelazu: Pjesak[]; cekaju: Pjesak[] } {
  const na: Pjesak[] = [];
  const cekaju: Pjesak[] = [];
  const svjetlo = p.semafor ? svjetloPjesaka(pj.svijet, p, pj.t) : null;
  for (const x of pj.lista) {
    if (x.prelaz !== p.id) continue;
    if (x.stanje === "prelazi") {
      const { w, smjer } = naPrelazu(pj, x, p);
      const r = GRAD_PJ_POLUPRECNIK;
      if ((smjer === 1 && w <= polovina[1] + r) || (smjer === -1 && w >= polovina[0] - r)) na.push(x);
    } else if (x.stanje === "ceka" && (!svjetlo || svjetlo.stanje === "zeleno")) cekaju.push(x);
  }
  return { naPrelazu: na, cekaju };
}

/** Pješaci za crtanje i za sudar: tijelo i hod. */
export function tijelaPjesaka(pj: Pjesaci): { id: number; x: number; y: number; ugao: number; boja: number; korak: number; stoji: boolean }[] {
  return pj.lista.map((x) => ({ id: x.id, x: x.x, y: x.y, ugao: x.ugao, boja: x.boja, korak: x.predjeno, stoji: x.v < 0.05 }));
}

/** Da li tijelo vozila (pravougaonik) dodiruje pješaka. */
export function udaraPjesaka(o: { x: number; y: number; ugao: number; duzina: number; sirina: number }, x: { x: number; y: number }): boolean {
  const hx = Math.cos(o.ugao);
  const hy = Math.sin(o.ugao);
  const dx = x.x - o.x;
  const dy = x.y - o.y;
  const duz = Math.abs(dx * hx + dy * hy) - o.duzina / 2;
  const pop = Math.abs(-dx * hy + dy * hx) - o.sirina / 2;
  const r = GRAD_PJ_POLUPRECNIK;
  if (duz > r || pop > r) return false;
  if (duz <= 0 || pop <= 0) return true;
  return duz * duz + pop * pop <= r * r;
}
