import {
  GRAD_PJ_A_ZVIJEZDA,
  GRAD_PJ_CELIJA,
  GRAD_PJ_KLASE_BEZ,
  GRAD_PJ_NEVAZI_UDIO,
  GRAD_PJ_PRELAZ_CIJENA,
  GRAD_PJ_PRELAZ_PARALELNO,
  GRAD_STOP_ISPRED_ZEBRE,
  GRAD_VOZAC_USPORENJE,
  GRAD_ZEBRA_DUBINA,
  GRAD_PJ_PRELAZ_UZ_RASKRSNICU,
  GRAD_PJ_PRISTAJE,
  GRAD_PJ_REZERVA,
  GRAD_PJ_SEMAFOR_ZAVRSI,
  GRAD_PJ_SREDNJA_CIJENA,
  GRAD_PJ_UZORAK,
  GRAD_PJESACKI_SEMAFOR_PRELAZ,
  GRAD_TROTOAR,
  GRAD_UGAO_ZASJEK,
  GRAD_UGAO_ZASJEK_DO,
  GRAD_UGAO_ZASJEK_OD,
  GRAD_ZEBRA_DO_ULICE,
  GRAD_ZEBRA_VRSTE,
} from "../sim/config";
import { headingAt, pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { Ivica } from "./mreza";
import { svjetloZaPjesake, type SvjetloPjesaka } from "./pjesackiSemafor";
import { najblizaOsa, naKolovozu, oseBlizu } from "./povrsina";
import type { Raskrsnica } from "./raskrsnica";
import type { SvijetGrada } from "./svijet";

/**
 * Pješačka mreža grada (faza 6, stavka 8): trotoari uz ulice, uglovi
 * raskrsnica i prelazi preko kolovoza.
 *
 * Trotoar je ono što se i crta: traka `GRAD_TROTOAR` uz ivičnjak, sa obje
 * strane svake vozne ulice. Pješak hoda njegovom sredinom. Na kraju ulice
 * trotoar skreće iza ugla na trotoar susjedne ulice — tamo gdje je ivičnjak
 * zasječen, i pješak ide uz zasjek. Kolovoz prelazi samo na zebri (OSM
 * prelaz koji se crta kao zebra), i to preko cijelog asfalta između dva
 * trotoara: preko obje kolovozne trake bulevara kad je razdjelni pojas uzak.
 *
 * Strana ulice čiji je trotoar na asfaltu druge ulice (uzak razdjelni pojas,
 * ulice jedna uz drugu) nema trotoar. Razdjelnim pojasom bulevara pješak ide
 * samo kad mora (`GRAD_PJ_SREDNJA_CIJENA`).
 *
 * Sve što je ovdje izvedeno je iz istog svijeta po kojem se crta i sudi, pa
 * se gradi jednom po svijetu (`mrezaPjesaka`), tek kad zatreba.
 */

/** Komad pješačkog puta: trotoar jedne strane ulice, ili ugao između dva trotoara. */
export interface Staza {
  tacke: Point[];
  cum: number[];
  duzina: number;
  /** Trotoar strane ulice (`ivica`, `strana`) ili ugao. */
  vrsta: "strana" | "ugao";
  ivica: number;
  /** +1: desno od smjera `a → b` ivice, −1: lijevo. */
  strana: 1 | -1;
  /** Razdjelni pojas bulevara — put po njemu je skuplji. */
  srednja: boolean;
  /** Čvorovi mreže na početku i kraju staze. */
  c0: number;
  c1: number;
}

export type SemaforPrelaza =
  | { vrsta: "raskrsnica"; r: number; kraci: number[] }
  /** Pješački semafor na sredini ulice: indeks u `GradZaSudiju.pjesackiSemafori`. */
  | { vrsta: "sredina"; semafor: number };

/** Prelaz preko kolovoza: od trotoara do trotoara, preko zebre. */
export interface Prelaz {
  id: number;
  /** Krajevi na trotoarima (čvorovi mreže) i tačke tamo. */
  cvorA: number;
  cvorB: number;
  a: Point;
  b: Point;
  /** Sredina na osovini ulice zebre i pravac te ulice. */
  centar: Point;
  pravac: Point;
  ivica: number;
  s: number;
  /** Vozne ivice preko kojih prelaz ide, sa `s` mjesta prelaza na svakoj. */
  ivice: { ivica: number; s: number }[];
  duzina: number;
  semafor: SemaforPrelaza | null;
  /**
   * Kolovoz svake ivice duž prelaza (`w` od `a` ka `b` [m]): od–do, i gdje je
   * njena osovina. Polovina ulice vozila je dio svoje ivice do osovine
   * (dvosmjerna), ili cijela ivica (jednosmjerna) — vidi `polovinaUlice`.
   */
  pojasevi: { ivica: number; w0: number; w1: number; wOsa: number; dvosmjerna: boolean }[];
}

/**
 * Polovina ulice na prelazu `p` u kojoj je vozilo koje ga siječe u tački
 * `w` (od `a` ka `b`): `[od, do]` duž prelaza. Van svih kolovoza — cijeli prelaz.
 */
export function polovinaUlice(p: Prelaz, w: number): [number, number] {
  let naj: Prelaz["pojasevi"][number] | null = null;
  for (const x of p.pojasevi) {
    const d = w < x.w0 ? x.w0 - w : w > x.w1 ? w - x.w1 : 0;
    if (!naj || d < (w < naj.w0 ? naj.w0 - w : w > naj.w1 ? w - naj.w1 : 0)) naj = x;
  }
  if (!naj) return [0, p.duzina];
  if (!naj.dvosmjerna) return [naj.w0, naj.w1];
  return w < naj.wOsa ? [naj.w0, naj.wOsa] : [naj.wOsa, naj.w1];
}

/** Veza u mreži: komad staze između dva čvora, ili prelaz. */
export interface Veza {
  a: number;
  b: number;
  duzina: number;
  /** Cijena u ruti (dužina, uz kaznu za razdjelni pojas i prelaz). */
  cijena: number;
  /** Staza i dio nje (od `u0` kod `a` do `u1` kod `b`); −1 kod prelaza. */
  staza: number;
  u0: number;
  u1: number;
  /** Prelaz (indeks u `prelazi`); −1 kod staze. */
  prelaz: number;
}

export interface MrezaPjesaka {
  staze: Staza[];
  /** Položaj svakog čvora (NaN za čvor koji se ne koristi). */
  cx: Float64Array;
  cy: Float64Array;
  veze: Veza[];
  izCvora: number[][];
  /** Veze svake staze, redom duž nje. */
  vezeStaze: number[][];
  prelazi: Prelaz[];
  /** Staze po ćeliji `GRAD_PJ_CELIJA` — za pojavu i vezivanje prelaza. */
  celije: Map<number, number[]>;
  /** Trotoari (staze vrste „strana") — za pojavu pješaka. */
  trotoari: number[];
  /** Prelazi po ćeliji `GRAD_PJ_CELIJA` — za prelaze na putanji vozila. */
  prelaziCelije: Map<number, number[]>;
  /** Trotoar strane ivice: `2·ivica + (strana +1 ? 0 : 1)` → staza, ili −1. */
  straneIvica: Int32Array;
}

const kljucCelije = (cx: number, cy: number) => cx * 100003 + cy;
const celija = (v: number) => Math.floor(v / GRAD_PJ_CELIJA);

/** Da li ivica ima trotoar za pješake (vidi `GRAD_PJ_KLASE_BEZ`). */
export function pjesacka(iv: Ivica): boolean {
  return iv.vozna && !iv.tunel && !iv.uklonjena && !iv.zatvorena && iv.a !== iv.b && !GRAD_PJ_KLASE_BEZ.includes(iv.klasa);
}

function kumulativ(t: readonly Point[]): number[] {
  const cum = [0];
  for (let k = 1; k < t.length; k++) cum.push(cum[k - 1]! + Math.hypot(t[k]!.x - t[k - 1]!.x, t[k]!.y - t[k - 1]!.y));
  return cum;
}

/**
 * Linija pomaknuta za `d` [m] udesno od smjera tačaka (lijevo za negativno),
 * sa spojem pod uglom (miter, najviše dvostruko). Tačka čiji bi komad išao
 * unazad (unutrašnja strana oštre krivine) se izostavlja.
 */
export function pomaknuta(t: readonly Point[], d: number): Point[] {
  const n = t.length;
  const normala = (k: number) => {
    const dx = t[k + 1]!.x - t[k]!.x;
    const dy = t[k + 1]!.y - t[k]!.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  };
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    const n1 = k > 0 ? normala(k - 1) : null;
    const n2 = k < n - 1 ? normala(k) : null;
    let nx: number;
    let ny: number;
    let duz = d;
    if (n1 && n2) {
      nx = n1.x + n2.x;
      ny = n1.y + n2.y;
      const l = Math.hypot(nx, ny);
      if (l < 1e-6) {
        nx = n2.x;
        ny = n2.y;
      } else {
        nx /= l;
        ny /= l;
        duz = d / Math.max(0.5, nx * n2.x + ny * n2.y);
      }
    } else {
      const m = (n1 ?? n2)!;
      nx = m.x;
      ny = m.y;
    }
    out.push({ x: t[k]!.x + nx * duz, y: t[k]!.y + ny * duz });
  }
  // Komad pomaknute linije koji ide suprotno od osovine: petlja na unutrašnjoj
  // strani krivine — ta tačka se izostavlja.
  const cist: Point[] = [out[0]!];
  const izvor: number[] = [0];
  for (let k = 1; k < n; k++) {
    const p = cist[cist.length - 1]!;
    const o = t[izvor[izvor.length - 1]!]!;
    const q = out[k]!;
    if (k < n - 1 && (q.x - p.x) * (t[k]!.x - o.x) + (q.y - p.y) * (t[k]!.y - o.y) <= 0) continue;
    cist.push(q);
    izvor.push(k);
  }
  // Tjeme koje je ostalo bliže osovini nego `d` (kratak segment osovine
  // između dva zaokreta „progutan" na unutrašnjoj strani): na tačnu udaljenost
  // od najbližeg segmenta, na istoj strani — inače trotoar ide preko kolovoza.
  const ad = Math.abs(d);
  for (let prolaz = 0; prolaz < 2; prolaz++) {
    for (let i = 0; i < cist.length; i++) {
      const p = cist[i]!;
      let naj = { d2: Infinity, qx: 0, qy: 0, k: 0 };
      for (let k = 0; k < n - 1; k++) {
        const a = t[k]!;
        const b = t[k + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        const f = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        const qx = a.x + dx * f;
        const qy = a.y + dy * f;
        const d2 = (p.x - qx) ** 2 + (p.y - qy) ** 2;
        if (d2 < naj.d2) naj = { d2, qx, qy, k };
      }
      if (Math.sqrt(naj.d2) >= ad - 0.05) continue;
      const nm = normala(naj.k);
      cist[i] = { x: naj.qx + nm.x * d, y: naj.qy + nm.y * d };
    }
  }
  return cist;
}

/** Dio osovine ivice od `od` do `do_` [m od `a`], sa krajnjim tačkama tačno tu. */
function dioOsovine(iv: Ivica, od: number, do_: number): Point[] {
  const t: Point[] = [pointAt(iv.tacke, iv.cum, od)];
  for (let k = 0; k < iv.tacke.length; k++) {
    if (iv.cum[k]! > od + 0.05 && iv.cum[k]! < do_ - 0.05) t.push(iv.tacke[k]!);
  }
  t.push(pointAt(iv.tacke, iv.cum, do_));
  return t;
}

/** Kraj ulice u čvoru, gledano iz čvora napolje. */
interface KrajUlice {
  ivica: number;
  kraj: 0 | 1;
  /** Tačka kraja (čvor) i pravac napolje (tetiva do 8 m). */
  p: Point;
  u: Point;
  pola: number;
  /** Ugao položaja oko sredine grupe — redoslijed oko raskrsnice. */
  oko: number;
}

function krajUlice(iv: Ivica, kraj: 0 | 1, centar: Point): KrajUlice | null {
  const t = iv.tacke;
  const p = kraj === 0 ? t[0]! : t[t.length - 1]!;
  const d = Math.min(8, iv.duzina);
  let q = p;
  for (let k = 1; k < t.length; k++) {
    const i = kraj === 0 ? k : t.length - 1 - k;
    q = t[i]!;
    const s = kraj === 0 ? iv.cum[i]! : iv.duzina - iv.cum[i]!;
    if (s >= d) break;
  }
  const l = Math.hypot(q.x - p.x, q.y - p.y);
  if (l < 1e-6) return null;
  const u = { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
  const ox = p.x + u.x * 15 - centar.x;
  const oy = p.y + u.y * 15 - centar.y;
  return { ivica: iv.i, kraj, p, u, pola: iv.sirina / 2, oko: Math.atan2(oy, ox) };
}

/**
 * Strana trotoara „desno, gledano iz čvora napolje" kraja `kraj`: na kraju `a`
 * (napolje je `a → b`) to je desna strana ivice; na kraju `b` — lijeva.
 */
const desnoNapolje = (kraj: 0 | 1): 1 | -1 => (kraj === 0 ? 1 : -1);

/** Indeks strane: 0 desno (+1), 1 lijevo (−1). */
const si = (strana: 1 | -1) => (strana === 1 ? 0 : 1);
/** Čvor kraja strane: `4·ivica + 2·strana + kraj`. */
const cvorKraja = (ivica: number, strana: 1 | -1, kraj: 0 | 1) => 4 * ivica + 2 * si(strana) + kraj;

/**
 * Presjek linija `pA + t·uA` i `pB + s·uB`: `t` i `s`, ili `null` kad su
 * paralelne.
 */
function presjek(pA: Point, uA: Point, pB: Point, uB: Point): { t: number; s: number } | null {
  const det = -uA.x * uB.y + uA.y * uB.x;
  if (Math.abs(det) < 1e-6) return null;
  const rx = pB.x - pA.x;
  const ry = pB.y - pA.y;
  return { t: (-rx * uB.y + ry * uB.x) / det, s: (uA.x * ry - uA.y * rx) / det };
}

interface Ugao {
  /** Desno-napolje strana kraja A i lijevo-napolje strana kraja B. */
  A: KrajUlice;
  B: KrajUlice;
  /** Gdje trotoari počinju, od kraja ivice [m]. */
  odA: number;
  odB: number;
  /** Presjek sredina dva trotoara (oštar ugao bez zasjeka), kad postoji ispred čvorova. */
  tjeme: Point | null;
  /** Sredina grupe (čvor, ili sredina raskrsnice). */
  centar: Point;
}

/**
 * Uglovi u grupi krajeva ulica (čvor, ili sve krajeve raskrsnice od više
 * čvorova): redom oko sredine, svaki kraj sa sljedećim. Gdje je ivičnjak
 * zasječen (vidi `povrsina.ts`), trotoar počinje iza zasjeka; inače na
 * presjeku sredina trotoara. Ulica koja samo nastavlja (ugao skoro ravan) i
 * spoljna strana krivine: trotoar ide do samog čvora.
 */
function uglovi(krajevi: KrajUlice[], duzine: (i: number) => number, centar: Point): Ugao[] {
  if (krajevi.length < 2) return [];
  const redom = [...krajevi].sort((x, y) => x.oko - y.oko || x.ivica - y.ivica || x.kraj - y.kraj);
  const od = (GRAD_UGAO_ZASJEK_OD * Math.PI) / 180;
  const doU = (GRAD_UGAO_ZASJEK_DO * Math.PI) / 180;
  const out: Ugao[] = [];
  const T = GRAD_TROTOAR / 2;
  for (let k = 0; k < redom.length; k++) {
    const A = redom[k]!;
    const B = redom[(k + 1) % redom.length]!;
    let raspon = Math.atan2(B.u.y, B.u.x) - Math.atan2(A.u.y, A.u.x);
    while (raspon <= 0) raspon += 2 * Math.PI;
    while (raspon > 2 * Math.PI) raspon -= 2 * Math.PI;
    // Desna normala A (napolje), lijeva normala B.
    const nA = { x: -A.u.y, y: A.u.x };
    const nB = { x: B.u.y, y: -B.u.x };
    let odA = 0;
    let odB = 0;
    let tjeme: Point | null = null;
    if (raspon < Math.PI * (170 / 180)) {
      const pA = { x: A.p.x + nA.x * (A.pola + T), y: A.p.y + nA.y * (A.pola + T) };
      const x0 = presjek(pA, A.u, { x: B.p.x + nB.x * (B.pola + T), y: B.p.y + nB.y * (B.pola + T) }, B.u);
      if (x0 && x0.t > -2 && x0.s > -2 && x0.t < 30 && x0.s < 30) tjeme = { x: pA.x + A.u.x * x0.t, y: pA.y + A.u.y * x0.t };
      const zasjek = raspon >= od && raspon <= doU;
      const dA = zasjek ? A.pola : A.pola + T;
      const dB = zasjek ? B.pola : B.pola + T;
      const x = presjek(
        { x: A.p.x + nA.x * dA, y: A.p.y + nA.y * dA },
        A.u,
        { x: B.p.x + nB.x * dB, y: B.p.y + nB.y * dB },
        B.u,
      );
      if (x) {
        odA = x.t + (zasjek ? GRAD_UGAO_ZASJEK : 0);
        odB = x.s + (zasjek ? GRAD_UGAO_ZASJEK : 0);
      }
    }
    const najA = 0.45 * duzine(A.ivica);
    const najB = 0.45 * duzine(B.ivica);
    out.push({ A, B, odA: Math.max(0, Math.min(najA, odA)), odB: Math.max(0, Math.min(najB, odB)), tjeme, centar });
  }
  return out;
}

/**
 * Da li faza `i` plana raskrsnice daje zeleno pješacima preko krakova
 * `kraci`: nijedan od tih krakova tada nema zeleno (ni za neki manevar, ni
 * dopunsku strelicu) — vozila sa njih stoje. Plan iz editora koji kaže
 * „zeleno za pješake" važi kako kaže (uz isti uslov).
 */
function pjesaciUFazi(r: Raskrsnica, i: number, kraci: readonly number[]): boolean {
  const plan = r.plan!;
  const f = plan.faze[i]!;
  const vozila = new Set([...f.kraci, ...f.djelimicno.map((d) => d.krak), ...f.strelice.map((d) => d.krak)]);
  const ulazni = kraci.filter((k) => r.kraci[k]?.ulaz);
  if (ulazni.some((k) => vozila.has(k))) return false;
  if (plan.faze.some((x) => x.pjesaci.length > 0)) return kraci.some((k) => f.pjesaci.includes(k));
  return true;
}

function pjesackiURaskrsnici(r: Raskrsnica, kraci: readonly number[], t: number): SvjetloPjesaka {
  const plan = r.plan;
  if (!plan || plan.faze.length === 0) return { stanje: "crveno", preostalo: 0 };
  const blok = (i: number) => plan.faze[i]!.zeleno + plan.zuto + plan.sveCrveno;
  let u = (((t + plan.pomak) % plan.ciklus) + plan.ciklus) % plan.ciklus;
  let i = 0;
  while (i < plan.faze.length - 1 && u >= blok(i)) {
    u -= blok(i);
    i++;
  }
  if (!pjesaciUFazi(r, i, kraci)) return { stanje: "crveno", preostalo: 0 };
  // Zeleno traje kroz sve naredne faze koje ga daju; prije faze koja ga ne
  // daje, `GRAD_PJ_SEMAFOR_ZAVRSI` trepće.
  let preostalo = blok(i) - u;
  for (let k = 1; k < plan.faze.length; k++) {
    const j = (i + k) % plan.faze.length;
    if (!pjesaciUFazi(r, j, kraci)) break;
    preostalo += blok(j);
    if (k === plan.faze.length - 1) return { stanje: "zeleno", preostalo: Infinity };
  }
  if (plan.faze.length === 1) return { stanje: "zeleno", preostalo: Infinity };
  preostalo -= GRAD_PJ_SEMAFOR_ZAVRSI;
  return preostalo > 0 ? { stanje: "zeleno", preostalo } : { stanje: "zavrsi", preostalo: 0 };
}

/** Svjetlo za pješake na prelazu `p` u trenutku `t`; `null` kad prelaz nema semafor. */
export function svjetloPjesaka(sv: SvijetGrada, p: Prelaz, t: number): SvjetloPjesaka | null {
  const s = p.semafor;
  if (!s) return null;
  if (s.vrsta === "sredina") return svjetloZaPjesake(sv.zaSudiju.pjesackiSemafori[s.semafor]!, t);
  return pjesackiURaskrsnici(sv.raskrsnice.lista[s.r]!, s.kraci, t);
}

const mreze = new WeakMap<SvijetGrada, MrezaPjesaka>();

/** Pješačka mreža svijeta — gradi se pri prvom pozivu, pa se pamti. */
export function mrezaPjesaka(sv: SvijetGrada): MrezaPjesaka {
  let m = mreze.get(sv);
  if (!m) {
    m = napraviMrezuPjesaka(sv);
    mreze.set(sv, m);
  }
  return m;
}

export function napraviMrezuPjesaka(sv: SvijetGrada): MrezaPjesaka {
  const { mreza: m, povrsina, raskrsnice, odsjeci, paket } = sv;
  const T = GRAD_TROTOAR / 2;
  const ivice = m.ivice;
  // Asfalt koji pješak ne prelazi van zebre: kolovozi voznih ulica osim
  // onih bez trotoara (ušće servisnog puta se prelazi).
  // Uglovi raskrsnica se gledaju i uz vlastitu ulicu — osim uglova servisnog puta.
  const bezTrotoara = (i: number) => GRAD_PJ_KLASE_BEZ.includes(ivice[i]!.klasa);
  const kolovoz = (x: number, y: number, osim: (i: number) => boolean = () => false, rezerva = 0) =>
    naKolovozu(povrsina, x, y, (i) => osim(i) || bezTrotoara(i), rezerva, bezTrotoara);
  // Unutrašnje ivice raskrsnica (između čvorova bulevara) nemaju trotoar: u raskrsnici su.
  const unutrasnja = new Uint8Array(ivice.length);
  for (const r of raskrsnice.lista) for (const i of r.unutrasnje) unutrasnja[i] = 1;
  const hoda = (iv: Ivica) => pjesacka(iv) && !unutrasnja[iv.i];

  // ── uglovi: gdje trotoari počinju i koji se spajaju ──
  const odKraja = new Float64Array(4 * ivice.length);
  const spojevi: Ugao[] = [];
  const grupe: { krajevi: KrajUlice[]; centar: Point }[] = [];
  for (const r of raskrsnice.lista) {
    const krajevi: KrajUlice[] = [];
    for (const k of r.kraci) {
      const iv = ivice[k.ivica]!;
      if (!hoda(iv)) continue;
      const x = krajUlice(iv, k.kraj, r.centar);
      if (x) krajevi.push(x);
    }
    grupe.push({ krajevi, centar: r.centar });
  }
  for (let c = 0; c < m.cvorovi.length; c++) {
    if (raskrsnice.uCvoru[c]! >= 0) continue;
    const krajevi: KrajUlice[] = [];
    for (const i of m.izCvora[c] ?? []) {
      const iv = ivice[i]!;
      if (!hoda(iv)) continue;
      if (iv.a === c) {
        const x = krajUlice(iv, 0, m.cvorovi[c]!);
        if (x) krajevi.push(x);
      }
      if (iv.b === c) {
        const x = krajUlice(iv, 1, m.cvorovi[c]!);
        if (x) krajevi.push(x);
      }
    }
    grupe.push({ krajevi, centar: m.cvorovi[c]! });
  }
  for (const g of grupe) {
    for (const u of uglovi(g.krajevi, (i) => ivice[i]!.duzina, g.centar)) {
      const sA = desnoNapolje(u.A.kraj);
      const sB = -desnoNapolje(u.B.kraj) as 1 | -1;
      odKraja[cvorKraja(u.A.ivica, sA, u.A.kraj)] = u.odA;
      odKraja[cvorKraja(u.B.ivica, sB, u.B.kraj)] = u.odB;
      spojevi.push(u);
    }
  }

  // ── trotoari ──
  const staze: Staza[] = [];
  const stazaStrane = new Int32Array(2 * ivice.length).fill(-1);
  const cx = new Float64Array(4 * ivice.length).fill(NaN);
  const cy = new Float64Array(4 * ivice.length).fill(NaN);
  for (const iv of ivice) {
    if (!hoda(iv)) continue;
    for (const strana of [1, -1] as const) {
      // Unutrašnja strana prstena kružnog toka je ostrvo — tamo se ne hoda.
      if (iv.kruzni && strana !== (iv.smjer === -1 ? -1 : 1)) continue;
      let od = odKraja[cvorKraja(iv.i, strana, 0)]!;
      let do_ = iv.duzina - odKraja[cvorKraja(iv.i, strana, 1)]!;
      // Kraj trotoara koji je još na asfaltu (unutrašnja ivica raskrsnice
      // bulevara, susjedni krak pod oštrim uglom): trotoar počinje tek iza.
      const pola = strana * (iv.sirina / 2 + T);
      const naAsfaltu = (s: number) => {
        const p = pointAt(iv.tacke, iv.cum, s);
        const h = headingAt(iv.tacke, iv.cum, Math.min(s, iv.duzina));
        return kolovoz(p.x - h.y * pola, p.y + h.x * pola, (j) => j === iv.i, GRAD_PJ_REZERVA);
      };
      while (od < do_ && naAsfaltu(od)) od += 0.5;
      while (do_ > od && naAsfaltu(do_)) do_ -= 0.5;
      if (do_ - od < 0.5) {
        // Kratka ivica između dva ugla: trotoar je samo tačka (uglovi se dodiruju).
        const sr = Math.max(0, Math.min(iv.duzina, (od + do_) / 2));
        if (naAsfaltu(sr)) continue;
        od = do_ = sr;
      }
      const osa = do_ > od ? dioOsovine(iv, od, do_) : [pointAt(iv.tacke, iv.cum, od), pointAt(iv.tacke, iv.cum, od)];
      let tacke: Point[];
      if (do_ > od) tacke = pomaknuta(osa, strana * (iv.sirina / 2 + T));
      else {
        const h = headingAt(iv.tacke, iv.cum, od);
        const d = strana * (iv.sirina / 2 + T);
        const p = { x: osa[0]!.x - h.y * d, y: osa[0]!.y + h.x * d };
        tacke = [p, { ...p }];
      }
      const cum = kumulativ(tacke);
      const duzina = cum[cum.length - 1]!;
      // Na asfaltu druge ulice: nema trotoara.
      let losih = 0;
      let uzoraka = 0;
      for (let u = Math.min(1, duzina / 2); u <= duzina - Math.min(1, duzina / 2) + 1e-9; u += GRAD_PJ_UZORAK) {
        const p = pointAt(tacke, cum, u);
        uzoraka++;
        if (kolovoz(p.x, p.y, (j) => j === iv.i, GRAD_PJ_REZERVA)) losih++;
      }
      if (uzoraka > 0 && losih / uzoraka > GRAD_PJ_NEVAZI_UDIO) continue;
      // Razdjelni pojas bulevara: iza trotoara je (blizu) asfalt druge
      // kolovozne trake, paralelne ovoj.
      let srednja = false;
      if (iv.smjer !== 0) {
        const p = pointAt(tacke, cum, duzina / 2);
        const h = headingAt(tacke, cum, duzina / 2);
        const dalje = { x: p.x - h.y * strana * 4, y: p.y + h.x * strana * 4 };
        const tu = naKolovozu(povrsina, dalje.x, dalje.y, (k) => k === iv.i);
        if (tu) {
          const o = najblizaOsa(povrsina, dalje.x, dalje.y, 30);
          if (o && Math.abs(o.pravac.x * h.x + o.pravac.y * h.y) > 0.8) srednja = true;
        }
      }
      stazaStrane[2 * iv.i + si(strana)] = staze.length;
      const c0 = cvorKraja(iv.i, strana, 0);
      const c1 = cvorKraja(iv.i, strana, 1);
      staze.push({ tacke, cum, duzina, vrsta: "strana", ivica: iv.i, strana, srednja, c0, c1 });
      cx[c0] = tacke[0]!.x;
      cy[c0] = tacke[0]!.y;
      cx[c1] = tacke[tacke.length - 1]!.x;
      cy[c1] = tacke[tacke.length - 1]!.y;
    }
  }

  // ── uglovi kao staze ──
  for (const u of spojevi) {
    const sA = desnoNapolje(u.A.kraj);
    const sB = -desnoNapolje(u.B.kraj) as 1 | -1;
    if (stazaStrane[2 * u.A.ivica + si(sA)]! < 0 || stazaStrane[2 * u.B.ivica + si(sB)]! < 0) continue;
    const a = cvorKraja(u.A.ivica, sA, u.A.kraj);
    const b = cvorKraja(u.B.ivica, sB, u.B.kraj);
    const pa = { x: cx[a]!, y: cy[a]! };
    const pb = { x: cx[b]!, y: cy[b]! };
    // Ugao ne smije preko asfalta (treće ulice, raskrsnice): prava od kraja
    // do kraja, pa preko tjemena trotoara, pa preko tačke odmaknute od
    // sredine raskrsnice — prva koja ostaje na trotoaru.
    const slobodna = (t: readonly Point[]) => {
      for (let k = 1; k < t.length; k++) {
        const p = t[k - 1]!;
        const q = t[k]!;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        for (let w = k === 1 ? 0.5 : 0; w < d - (k === t.length - 1 ? 0.5 : 0); w += 0.5) {
          if (kolovoz(p.x + ((q.x - p.x) * w) / d, p.y + ((q.y - p.y) * w) / d)) return false;
        }
      }
      return true;
    };
    const kandidati: Point[][] = [[pa, pb]];
    if (u.tjeme) kandidati.push([pa, u.tjeme, pb]);
    const sx0 = (pa.x + pb.x) / 2;
    const sy0 = (pa.y + pb.y) / 2;
    const ox = sx0 - u.centar.x;
    const oy = sy0 - u.centar.y;
    const ol = Math.hypot(ox, oy);
    if (ol > 1e-6) for (let e = 1; e <= 6; e += 1) kandidati.push([pa, { x: sx0 + (ox / ol) * e, y: sy0 + (oy / ol) * e }, pb]);
    const tacke = kandidati.find(slobodna);
    if (!tacke) continue;
    const cum = kumulativ(tacke);
    const d = cum[cum.length - 1]!;
    if (d > 40) continue;
    // Čvorovi krajeva ugla su čvorovi krajeva trotoara (`a`, `b`).
    staze.push({ tacke, cum, duzina: d, vrsta: "ugao", ivica: -1, strana: 1, srednja: false, c0: a, c1: b });
  }

  // ── indeks staza ──
  const celije = new Map<number, number[]>();
  staze.forEach((st, k) => {
    const seen = new Set<number>();
    // Tačke duž svakog komada (ne samo tjemena): duga prava staza ima samo dva.
    const uzorci: Point[] = [];
    for (let j = 0; j < st.tacke.length; j++) {
      const p = st.tacke[j]!;
      uzorci.push(p);
      const q = st.tacke[j + 1];
      if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      for (let w = GRAD_PJ_CELIJA / 2; w < d; w += GRAD_PJ_CELIJA / 2) uzorci.push({ x: p.x + ((q.x - p.x) * w) / d, y: p.y + ((q.y - p.y) * w) / d });
    }
    for (const p of uzorci) {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const kl = kljucCelije(celija(p.x) + ox, celija(p.y) + oy);
          if (seen.has(kl)) continue;
          seen.add(kl);
          const l = celije.get(kl);
          if (l) l.push(k);
          else celije.set(kl, [k]);
        }
      }
    }
  });
  const najblizaStaza = (x: number, y: number, do_: number): { staza: number; u: number; d: number } | null => {
    let naj: { staza: number; u: number; d: number } | null = null;
    for (const k of celije.get(kljucCelije(celija(x), celija(y))) ?? []) {
      const st = staze[k]!;
      const pr = projekcijaNa(st.tacke, st.cum, x, y);
      if (pr.d <= do_ && (!naj || pr.d < naj.d - 1e-9 || (Math.abs(pr.d - naj.d) <= 1e-9 && k < naj.staza))) naj = { staza: k, u: pr.u, d: pr.d };
    }
    return naj;
  };

  // ── prelazi ──
  const z = paket.zaglavlje;
  const n = paket.n;
  const kodovi = new Set(GRAD_ZEBRA_VRSTE.map((v) => z.stringovi.indexOf(v)).filter((k) => k >= 0));
  const kodSemafora = z.stringovi.indexOf("traffic_signals");
  const vrstaPrelaza = z.vrsteObjekata.indexOf("crossing");
  // Krakovi semaforisanih raskrsnica po ivicama njihovog puta (`Krak.lanac`):
  // prelaz sa semaforom na tom putu, blizu raskrsnice, ide u njene faze.
  const krakPoIvici = new Map<number, { r: number; k: number; od: number; kraj: 0 | 1; odsjek: number }[]>();
  for (const r of raskrsnice.lista) {
    if (!r.plan) continue;
    r.kraci.forEach((k, j) => {
      for (const x of k.lanac) {
        const l = krakPoIvici.get(x.ivica) ?? [];
        l.push({ r: r.id, k: j, od: x.od, kraj: x.kraj, odsjek: odsjeci[2 * k.ivica + k.kraj]! });
        krakPoIvici.set(x.ivica, l);
      }
    });
  }
  const prelazi: Prelaz[] = [];
  const prikaci: { staza: number; u: number; cvor: number }[] = [];
  let sljedeciCvor = 4 * ivice.length;
  const dodatniX: number[] = [];
  const dodatniY: number[] = [];
  const noviCvor = (p: Point) => {
    dodatniX.push(p.x);
    dodatniY.push(p.y);
    return sljedeciCvor++;
  };
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrstaPrelaza || !kodovi.has(n.obPodatak[o]!)) continue;
    const osa = najblizaOsa(povrsina, n.obXY[2 * o]!, n.obXY[2 * o + 1]!, GRAD_ZEBRA_DO_ULICE);
    if (!osa) continue;
    if (GRAD_PJ_KLASE_BEZ.includes(ivice[osa.ivica]!.klasa)) continue;
    const c = osa.tacka;
    const h = osa.pravac;
    const nn = { x: -h.y, y: h.x };
    // Od sredine na obje strane do kraja asfalta — i preko uskog razdjelnog
    // pojasa (asfalt se nastavlja na manje od širine trotoara).
    // Asfalt u tački: 0 nema ga, 1 kolovoz ulice zebre ili njoj paralelne
    // (druga kolovozna traka bulevara), 2 nešto drugo (ulica koja se tu
    // priključuje, ugao raskrsnice) — tu prelaz staje: ne ide uzduž druge ulice.
    const asfalt = (x: number, y: number): 0 | 1 | 2 => {
      let ima = false;
      for (const ob of oseBlizu(povrsina, x, y, 15)) {
        if (ob.d > ob.pola || bezTrotoara(ob.ivica)) continue;
        if (Math.abs(ob.pravac.x * h.x + ob.pravac.y * h.y) > GRAD_PJ_PRELAZ_PARALELNO) return 1;
        ima = true;
      }
      return ima || kolovoz(x, y) ? 2 : 0;
    };
    const doIvice = (znak: 1 | -1) => {
      let w = 0;
      for (let k = 0; k < 200; k++) {
        const x = c.x + nn.x * znak * (w + 0.2);
        const y = c.y + nn.y * znak * (w + 0.2);
        const a0 = asfalt(x, y);
        if (a0 === 1) {
          w += 0.2;
          continue;
        }
        if (a0 === 2) break;
        // Asfalt paralelne kolovozne trake opet u širini trotoara: uzak
        // razdjelni pojas, prelazi se dalje.
        let dalje = -1;
        for (let e = 0.2; e <= GRAD_TROTOAR + 0.2; e += 0.2) {
          const a1 = asfalt(c.x + nn.x * znak * (w + 0.2 + e), c.y + nn.y * znak * (w + 0.2 + e));
          if (a1 === 2) break;
          if (a1 === 1) {
            dalje = e;
            break;
          }
        }
        if (dalje < 0) break;
        w += 0.2 + dalje;
      }
      return w;
    };
    const wP = doIvice(1);
    const wM = doIvice(-1);
    const a = { x: c.x - nn.x * (wM + T), y: c.y - nn.y * (wM + T) };
    const b = { x: c.x + nn.x * (wP + T), y: c.y + nn.y * (wP + T) };
    const duzina = Math.hypot(b.x - a.x, b.y - a.y);
    // Isti prelaz preko obje kolovozne trake (OSM ga ima na svakoj).
    const centar = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (
      prelazi.some((q) => {
        if (Math.abs(q.pravac.x * h.x + q.pravac.y * h.y) < 0.9) return false;
        const qc = { x: (q.a.x + q.b.x) / 2, y: (q.a.y + q.b.y) / 2 };
        if (Math.hypot(qc.x - centar.x, qc.y - centar.y) < 4 + Math.abs(q.duzina - duzina) / 2) return true;
        // Isti prelaz, čvor pomjeren duž ulice (po jedan na svakoj traci
        // bulevara, nekoliko metara jedan od drugog): blizu duž ulice, a
        // preko nje se preklapaju — dvije zebre bi stajale jedna uz drugu.
        const duz = Math.abs((qc.x - centar.x) * h.x + (qc.y - centar.y) * h.y);
        const preko = Math.abs((qc.x - centar.x) * nn.x + (qc.y - centar.y) * nn.y);
        return duz < 2 * GRAD_ZEBRA_DUBINA && preko < (q.duzina + duzina) / 2;
      })
    )
      continue;
    const sa = najblizaStaza(a.x, a.y, GRAD_PJ_PRISTAJE);
    const sb = najblizaStaza(b.x, b.y, GRAD_PJ_PRISTAJE);
    if (!sa || !sb || sa.staza === sb.staza) continue;
    // Ivice preko kojih ide.
    const preko: { ivica: number; s: number }[] = [];
    for (let w = 0; w <= duzina; w += 0.5) {
      const x = a.x + ((b.x - a.x) * w) / duzina;
      const y = a.y + ((b.y - a.y) * w) / duzina;
      for (const ob of oseBlizu(povrsina, x, y, 15)) {
        if (ob.d > ob.pola || GRAD_PJ_KLASE_BEZ.includes(ivice[ob.ivica]!.klasa)) continue;
        if (!preko.some((p) => p.ivica === ob.ivica)) preko.push({ ivica: ob.ivica, s: ob.s });
      }
    }
    if (preko.length === 0) continue;
    // Semafor: pješački na sredini ulice (OSM semafor uz prelaz, daleko od
    // raskrsnice — vidi `GRAD_PJESACKI_SEMAFOR_OD`), ili prelaz sa semaforom
    // uz krak semaforisane raskrsnice.
    let semafor: SemaforPrelaza | null = null;
    for (const p of preko) {
      const i = sv.zaSudiju.pjesackiSemafori.findIndex((x) => x.ivica === p.ivica && Math.abs(x.s - p.s) <= GRAD_PJESACKI_SEMAFOR_PRELAZ);
      if (i < 0) continue;
      semafor = { vrsta: "sredina", semafor: i };
      break;
    }
    if (!semafor && n.obPodatak[o] === kodSemafora) {
      // Najbliža semaforisana raskrsnica čiji je ovo krak (svi krakovi te
      // raskrsnice preko kojih prelaz ide).
      let naj = Infinity;
      for (const p of preko) {
        const iv = ivice[p.ivica]!;
        for (const x of krakPoIvici.get(p.ivica) ?? []) {
          const d = x.od + (x.kraj === 1 ? iv.duzina - p.s : p.s) - x.odsjek;
          if (d > GRAD_PJ_PRELAZ_UZ_RASKRSNICU) continue;
          if (semafor?.vrsta === "raskrsnica" && semafor.r === x.r) {
            if (!semafor.kraci.includes(x.k)) semafor.kraci.push(x.k);
            naj = Math.min(naj, d);
          } else if (d < naj) {
            semafor = { vrsta: "raskrsnica", r: x.r, kraci: [x.k] };
            naj = d;
          }
        }
      }
    }
    const id = prelazi.length;
    const cvorA = noviCvor(pointAt(staze[sa.staza]!.tacke, staze[sa.staza]!.cum, sa.u));
    const cvorB = noviCvor(pointAt(staze[sb.staza]!.tacke, staze[sb.staza]!.cum, sb.u));
    prikaci.push({ staza: sa.staza, u: sa.u, cvor: cvorA }, { staza: sb.staza, u: sb.u, cvor: cvorB });
    prelazi.push({
      id,
      cvorA,
      cvorB,
      a: { x: dodatniX[cvorA - 4 * ivice.length]!, y: dodatniY[cvorA - 4 * ivice.length]! },
      b: { x: dodatniX[cvorB - 4 * ivice.length]!, y: dodatniY[cvorB - 4 * ivice.length]! },
      centar: c,
      pravac: h,
      ivica: osa.ivica,
      s: osa.s,
      ivice: preko,
      duzina: 0,
      semafor,
      pojasevi: [],
    });
    const p = prelazi[id]!;
    p.duzina = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
    // Kolovozi duž prelaza (od `a` krajnjeg, na trotoaru).
    const pojas = new Map<number, { w0: number; w1: number; wOsa: number; dOsa: number }>();
    for (let w = 0; w <= p.duzina; w += 0.25) {
      const x = p.a.x + ((p.b.x - p.a.x) * w) / p.duzina;
      const y = p.a.y + ((p.b.y - p.a.y) * w) / p.duzina;
      for (const ob of oseBlizu(povrsina, x, y, 15)) {
        if (ob.d > ob.pola || GRAD_PJ_KLASE_BEZ.includes(ivice[ob.ivica]!.klasa)) continue;
        const e = pojas.get(ob.ivica);
        if (!e) pojas.set(ob.ivica, { w0: w, w1: w, wOsa: w, dOsa: ob.d });
        else {
          e.w1 = w;
          if (ob.d < e.dOsa) {
            e.dOsa = ob.d;
            e.wOsa = w;
          }
        }
      }
    }
    p.pojasevi = [...pojas.entries()]
      .map(([ivica, e]) => ({ ivica, w0: e.w0, w1: e.w1, wOsa: e.wOsa, dvosmjerna: ivice[ivica]!.smjer === 0 }))
      .sort((x, y) => x.w0 - y.w0 || x.ivica - y.ivica);
  }

  // ── veze ──
  const ukupno = sljedeciCvor;
  const sx = new Float64Array(ukupno).fill(NaN);
  const sy = new Float64Array(ukupno).fill(NaN);
  sx.set(cx);
  sy.set(cy);
  for (let k = 0; k < dodatniX.length; k++) {
    sx[4 * ivice.length + k] = dodatniX[k]!;
    sy[4 * ivice.length + k] = dodatniY[k]!;
  }
  const veze: Veza[] = [];
  const izCvora: number[][] = Array.from({ length: ukupno }, () => []);
  const dodajVezu = (v: Veza) => {
    izCvora[v.a]!.push(veze.length);
    izCvora[v.b]!.push(veze.length);
    veze.push(v);
  };
  const poStazi = new Map<number, { u: number; cvor: number }[]>();
  for (const p of prikaci) poStazi.set(p.staza, [...(poStazi.get(p.staza) ?? []), { u: p.u, cvor: p.cvor }]);
  const vezeStaze: number[][] = staze.map(() => []);
  staze.forEach((st, k) => {
    const tacke = [{ u: 0, cvor: st.c0 }, ...(poStazi.get(k) ?? []), { u: st.duzina, cvor: st.c1 }].sort((x, y) => x.u - y.u || x.cvor - y.cvor);
    const mnozilac = st.srednja ? GRAD_PJ_SREDNJA_CIJENA : 1;
    for (let j = 0; j + 1 < tacke.length; j++) {
      const p = tacke[j]!;
      const q = tacke[j + 1]!;
      const d = q.u - p.u;
      vezeStaze[k]!.push(veze.length);
      dodajVezu({ a: p.cvor, b: q.cvor, duzina: d, cijena: d * mnozilac, staza: k, u0: p.u, u1: q.u, prelaz: -1 });
    }
  });
  for (const p of prelazi) {
    dodajVezu({ a: p.cvorA, b: p.cvorB, duzina: p.duzina, cijena: p.duzina + GRAD_PJ_PRELAZ_CIJENA, staza: -1, u0: 0, u1: p.duzina, prelaz: p.id });
  }
  const trotoari = staze.map((s, k) => (s.vrsta === "strana" && s.duzina > 5 && !s.srednja ? k : -1)).filter((k) => k >= 0);
  const prelaziCelije = new Map<number, number[]>();
  for (const p of prelazi) {
    const vidjene = new Set<number>();
    for (let w = 0; w <= p.duzina + 1e-9; w += GRAD_PJ_CELIJA / 4) {
      const f = Math.min(1, w / p.duzina);
      const kl = kljucCelije(celija(p.a.x + (p.b.x - p.a.x) * f), celija(p.a.y + (p.b.y - p.a.y) * f));
      if (vidjene.has(kl)) continue;
      vidjene.add(kl);
      prelaziCelije.set(kl, [...(prelaziCelije.get(kl) ?? []), p.id]);
    }
    const kl = kljucCelije(celija(p.b.x), celija(p.b.y));
    if (!vidjene.has(kl)) prelaziCelije.set(kl, [...(prelaziCelije.get(kl) ?? []), p.id]);
  }
  return { staze, cx: sx, cy: sy, veze, izCvora, vezeStaze, prelazi, celije, trotoari, prelaziCelije, straneIvica: stazaStrane };
}

/** Kolovoz duž prelaza `p`: od–do [m od `a`] — pojas zebre po kojem se vozi. */
export function kolovozPrelaza(p: Prelaz): [number, number] {
  if (p.pojasevi.length === 0) return [0, p.duzina];
  return [Math.min(...p.pojasevi.map((x) => x.w0)) - 0.25, Math.max(...p.pojasevi.map((x) => x.w1)) + 0.25];
}

/** Udaljenost tačke od pojasa zebre (kolovoz prelaza × dubina zebre) [m]; 0 u njemu. */
export function doZebre(p: Prelaz, x: number, y: number): number {
  const ux = (p.b.x - p.a.x) / p.duzina;
  const uy = (p.b.y - p.a.y) / p.duzina;
  const w = (x - p.a.x) * ux + (y - p.a.y) * uy;
  const n = Math.abs(-(x - p.a.x) * uy + (y - p.a.y) * ux);
  const [w0, w1] = kolovozPrelaza(p);
  const dw = w < w0 ? w0 - w : w > w1 ? w - w1 : 0;
  const dn = Math.max(0, n - GRAD_ZEBRA_DUBINA / 2);
  return Math.hypot(dw, dn);
}

/** Da li tijelo vozila (sredina, pravac, dužina, širina) dodiruje pojas zebre. */
export function tijeloNaZebri(x: number, y: number, ugao: number, duzina: number, sirina: number, p: Prelaz): boolean {
  const c = Math.cos(ugao);
  const s = Math.sin(ugao);
  for (const dl of [-0.5, -0.25, 0, 0.25, 0.5]) {
    for (const dw of [-0.5, 0, 0.5]) {
      const l = dl * duzina;
      const w = dw * sirina;
      if (doZebre(p, x + c * l - s * w, y + s * l + c * w) === 0) return true;
    }
  }
  return false;
}

/**
 * Može li vozilo mirno (udobnim kočenjem, `GRAD_VOZAC_USPORENJE`) stati
 * `GRAD_STOP_ISPRED_ZEBRE` pred zebrom prelaza `p` — zebra je ispred njega, a
 * ono još nije na njoj. Po tome i sudija i drugi vozači znaju da li se mora
 * ustupiti pješaku koji je na ivičnjaku pokazao namjeru.
 */
export function mozeMirnoStati(x: number, y: number, ugao: number, v: number, duzina: number, sirina: number, p: Prelaz): boolean {
  const nx = x + Math.cos(ugao) * (duzina / 2);
  const ny = y + Math.sin(ugao) * (duzina / 2);
  const ispred = (p.centar.x - nx) * Math.cos(ugao) + (p.centar.y - ny) * Math.sin(ugao) > -GRAD_ZEBRA_DUBINA / 2;
  if (!ispred || tijeloNaZebri(x, y, ugao, duzina, sirina, p)) return false;
  const brzina = Math.max(0, v);
  return doZebre(p, nx, ny) - GRAD_STOP_ISPRED_ZEBRE >= (brzina * brzina) / (2 * GRAD_VOZAC_USPORENJE) - 0.5;
}

/**
 * Prelazi koje putanja siječe, redom: prelaz, `s` na putanji gdje siječe
 * liniju prelaza (preko kolovoza), i `w` — gdje na prelazu (od `a` ka `b`).
 * Isti prelaz i više puta, kad se ruta njemu vrati.
 */
export function prelaziNaPutanji(mp: MrezaPjesaka, tacke: readonly Point[], cum: readonly number[]): { prelaz: number; s: number; w: number }[] {
  const out: { prelaz: number; s: number; w: number }[] = [];
  for (let k = 1; k < tacke.length; k++) {
    const P = tacke[k - 1]!;
    const Q = tacke[k]!;
    const kandidati = new Set<number>();
    const d = Math.hypot(Q.x - P.x, Q.y - P.y);
    for (let w = 0; w <= d + GRAD_PJ_CELIJA / 4; w += GRAD_PJ_CELIJA / 4) {
      const f = d > 0 ? Math.min(1, w / d) : 0;
      const cx = celija(P.x + (Q.x - P.x) * f);
      const cy = celija(P.y + (Q.y - P.y) * f);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const id of mp.prelaziCelije.get(kljucCelije(cx + ox, cy + oy)) ?? []) kandidati.add(id);
    }
    for (const id of kandidati) {
      const p = mp.prelazi[id]!;
      // Presjek duži P–Q i a–b.
      const rx = Q.x - P.x;
      const ry = Q.y - P.y;
      const sx = p.b.x - p.a.x;
      const sy = p.b.y - p.a.y;
      const det = rx * sy - ry * sx;
      if (Math.abs(det) < 1e-9) continue;
      const qx = p.a.x - P.x;
      const qy = p.a.y - P.y;
      const t = (qx * sy - qy * sx) / det;
      const u = (qx * ry - qy * rx) / det;
      const [w0, w1] = kolovozPrelaza(p);
      if (t < 0 || t > 1 || u * p.duzina < w0 || u * p.duzina > w1) continue;
      const s = cum[k - 1]! + t * (cum[k]! - cum[k - 1]!);
      if (out.some((x) => x.prelaz === id && Math.abs(x.s - s) < 10)) continue;
      out.push({ prelaz: id, s, w: u * p.duzina });
    }
  }
  return out.sort((x, y) => x.s - y.s);
}

/** Najbliža tačka izlomljene linije: `u` duž nje i udaljenost. */
export function projekcijaNa(t: readonly Point[], cum: readonly number[], x: number, y: number): { u: number; d: number } {
  let naj = { u: 0, d: Infinity };
  for (let k = 1; k < t.length; k++) {
    const a = t[k - 1]!;
    const b = t[k]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const f = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(a.x + dx * f - x, a.y + dy * f - y);
    if (d < naj.d) naj = { u: cum[k - 1]! + Math.sqrt(l2) * f, d };
  }
  if (t.length === 1) naj = { u: 0, d: Math.hypot(t[0]!.x - x, t[0]!.y - y) };
  return naj;
}

/** Tačka i pravac na vezi, `d` metara od čvora `od` (jednog od njena dva kraja). */
export function naVezi(mp: MrezaPjesaka, v: Veza, od: number, d: number): { x: number; y: number; hx: number; hy: number } {
  const unaprijed = od === v.a;
  if (v.staza < 0) {
    const ax = mp.cx[unaprijed ? v.a : v.b]!;
    const ay = mp.cy[unaprijed ? v.a : v.b]!;
    const bx = mp.cx[unaprijed ? v.b : v.a]!;
    const by = mp.cy[unaprijed ? v.b : v.a]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const f = Math.max(0, Math.min(1, d / l));
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, hx: (bx - ax) / l, hy: (by - ay) / l };
  }
  const st = mp.staze[v.staza]!;
  const u = unaprijed ? v.u0 + Math.min(d, v.duzina) : v.u1 - Math.min(d, v.duzina);
  const p = pointAt(st.tacke, st.cum, u);
  const h = headingAt(st.tacke, st.cum, Math.min(u, st.duzina));
  return unaprijed ? { x: p.x, y: p.y, hx: h.x, hy: h.y } : { x: p.x, y: p.y, hx: -h.x, hy: -h.y };
}

/** Korak rute pješaka: veza i čvor od kojeg se njom ide. */
export interface KorakPjesaka {
  veza: number;
  od: number;
}

/** Binarni hip po cijeni (najmanja prva), stabilan po redu dodavanja. */
class Hip {
  private a: { c: number; f: number; red: number }[] = [];
  get duzina() {
    return this.a.length;
  }
  dodaj(x: { c: number; f: number; red: number }) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f < x.f || (a[p]!.f === x.f && a[p]!.red < x.red)) break;
      a[i] = a[p]!;
      i = p;
    }
    a[i] = x;
  }
  uzmi() {
    const a = this.a;
    const prvi = a[0]!;
    const zadnji = a.pop()!;
    if (a.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const d = l + 1;
        let m = i;
        const manji = (x: { f: number; red: number }, y: { f: number; red: number }) => x.f < y.f || (x.f === y.f && x.red < y.red);
        if (l < a.length && manji(a[l]!, m === i ? zadnji : a[m]!)) m = l;
        if (d < a.length && manji(a[d]!, m === i ? zadnji : a[m]!)) m = d;
        if (m === i) break;
        a[i] = a[m]!;
        i = m;
      }
      a[i] = zadnji;
    }
    return prvi;
  }
}

/**
 * Dokle pješak stiže iz čvora `od` pješačkom mrežom do cijene `najvise`:
 * za svaki dosegnut čvor cijena puta i veza kojom se do njega došlo. Iz toga
 * se bira cilj do kojeg sigurno ima puta, i ruta do njega (`rutaDo`).
 */
export function dosegnuti(mp: MrezaPjesaka, od: number, najvise: number, bez = -1): Map<number, { g: number; veza: number }> {
  const out = new Map<number, { g: number; veza: number }>([[od, { g: 0, veza: -1 }]]);
  const otvoreni = new Hip();
  let red = 0;
  otvoreni.dodaj({ c: od, f: 0, red: red++ });
  const zatvoren = new Set<number>();
  while (otvoreni.duzina > 0) {
    const { c, f } = otvoreni.uzmi();
    if (zatvoren.has(c)) continue;
    zatvoren.add(c);
    for (const vi of mp.izCvora[c]!) {
      if (vi === bez) continue;
      const v = mp.veze[vi]!;
      const dalje = v.a === c ? v.b : v.a;
      const ng = f + v.cijena;
      if (ng > najvise || zatvoren.has(dalje)) continue;
      if (ng < (out.get(dalje)?.g ?? Infinity) - 1e-9) {
        out.set(dalje, { g: ng, veza: vi });
        otvoreni.dodaj({ c: dalje, f: ng, red: red++ });
      }
    }
  }
  return out;
}

/** Ruta do čvora `do_` iz stabla `dosegnuti`. */
export function rutaDo(mp: MrezaPjesaka, stablo: Map<number, { g: number; veza: number }>, do_: number): KorakPjesaka[] {
  const put: KorakPjesaka[] = [];
  for (let x = do_; ; ) {
    const e = stablo.get(x);
    if (!e || e.veza < 0) break;
    const v = mp.veze[e.veza]!;
    const iz = v.a === x ? v.b : v.a;
    put.unshift({ veza: e.veza, od: iz });
    x = iz;
  }
  return put;
}

/** Ruta pješaka od čvora `od` do čvora `do_` (A*), ili `null`. */
export function rutaPjesaka(mp: MrezaPjesaka, od: number, do_: number, najvise = GRAD_PJ_A_ZVIJEZDA): KorakPjesaka[] | null {
  if (od === do_) return [];
  const tx = mp.cx[do_]!;
  const ty = mp.cy[do_]!;
  const h = (c: number) => Math.hypot(mp.cx[c]! - tx, mp.cy[c]! - ty);
  const g = new Map<number, number>([[od, 0]]);
  const prije = new Map<number, number>();
  const otvoreni = new Hip();
  let red = 0;
  otvoreni.dodaj({ c: od, f: h(od), red: red++ });
  const zatvoren = new Set<number>();
  let koraka = 0;
  while (otvoreni.duzina > 0 && koraka++ < najvise) {
    const { c } = otvoreni.uzmi();
    if (zatvoren.has(c)) continue;
    if (c === do_) {
      const put: KorakPjesaka[] = [];
      for (let x = c; x !== od; ) {
        const vi = prije.get(x)!;
        const v = mp.veze[vi]!;
        const iz = v.a === x ? v.b : v.a;
        put.unshift({ veza: vi, od: iz });
        x = iz;
      }
      return put;
    }
    zatvoren.add(c);
    const gc = g.get(c)!;
    for (const vi of mp.izCvora[c]!) {
      const v = mp.veze[vi]!;
      const dalje = v.a === c ? v.b : v.a;
      if (zatvoren.has(dalje)) continue;
      const ng = gc + v.cijena;
      if (ng < (g.get(dalje) ?? Infinity) - 1e-9) {
        g.set(dalje, ng);
        prije.set(dalje, vi);
        otvoreni.dodaj({ c: dalje, f: ng + h(dalje), red: red++ });
      }
    }
  }
  return null;
}

/** Staze u ćelijama koje dodiruju krug oko `c` poluprečnika `r` (sa ponavljanjem). */
export function* stazeUKrugu(mp: MrezaPjesaka, c: Point, r: number): Generator<number> {
  for (let x = celija(c.x - r); x <= celija(c.x + r); x++) {
    for (let y = celija(c.y - r); y <= celija(c.y + r); y++) {
      yield* mp.celije.get(kljucCelije(x, y)) ?? [];
    }
  }
}

/** Najbliži trotoar tački, do `do_` [m]: staza, `u` duž nje i udaljenost. */
export function najbliziTrotoar(mp: MrezaPjesaka, x: number, y: number, do_: number): { staza: number; u: number; d: number } | null {
  let naj: { staza: number; u: number; d: number } | null = null;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (const k of mp.celije.get(kljucCelije(celija(x) + ox, celija(y) + oy)) ?? []) {
        const st = mp.staze[k]!;
        if (st.vrsta !== "strana") continue;
        const pr = projekcijaNa(st.tacke, st.cum, x, y);
        if (pr.d <= do_ && (!naj || pr.d < naj.d)) naj = { staza: k, u: pr.u, d: pr.d };
      }
    }
  }
  return naj;
}

/**
 * Veza staze `staza` u kojoj je mjesto `u` (ili najbliža njemu) — pješak
 * se pojavljuje na njoj, a cilj mu je njen kraj.
 */
export function vezaNaStazi(mp: MrezaPjesaka, staza: number, u: number): number {
  let naj = -1;
  let najD = Infinity;
  for (const k of mp.vezeStaze[staza] ?? []) {
    const v = mp.veze[k]!;
    const d = u < v.u0 ? v.u0 - u : u > v.u1 ? u - v.u1 : 0;
    if (d < najD) {
      najD = d;
      naj = k;
    }
    if (d === 0) break;
  }
  return naj;
}
