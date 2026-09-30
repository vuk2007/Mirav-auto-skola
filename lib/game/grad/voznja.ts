import {
  A_MAX,
  B_MAX,
  DECISION_HOLD,
  DECISION_STEER,
  DT,
  GRAD_DRAG,
  GRAD_LUK_TACAKA,
  GRAD_ODLUKA,
  GRAD_PUN_VOLAN_UGAO,
  GRAD_V_TOP,
  GRAD_ZAKLJUCAJ,
  GRAD_ZAOBLJENJE,
  GRAD_ZAOBLJENJE_UDIO,
  STEER_DEAD_ZONE,
} from "../sim/config";
import { bocnaBrzina, integrate } from "../sim/dinamika";
import { cumulative, headingAt, pointAt } from "../sim/geometry";
import type { Input, Point } from "../sim/types";
import { najveciBok, pocetniBok, type Ivica, type Mreza } from "./mreza";

/**
 * Vožnja po grafu ulica: auto koje ide ivicom, a na raskrsnici bira izlaz
 * (faza 6, stavka 3b). Igrač se od stavke 3c vozi slobodno (`slobodno.ts`) —
 * skreće gdje okrene volan. Ovo ostaje za vozila koja idu ulicama po grafu
 * (drugi učesnici, stavka 7), i sa istim testovima.
 *
 * Auto je uvijek na jednoj ivici mreže (u smjeru `smjer`, `s` metara od
 * početka u tom smjeru, `bok` metara desno od osovine), ili na luku kroz
 * raskrsnicu. Volan radi dvije stvari, kao i na raskrsnici iz faze 5: pomjera
 * auto poprečno, a pred raskrsnicom bira izlaz.
 */

/** Izlaz iz raskrsnice: ivica, smjer kojim se njome ide, i ugao skretanja. */
export interface Izlaz {
  ivica: number;
  smjer: 1 | -1;
  /** Ugao skretanja [°]: negativan je lijevo, pozitivan desno, 0 pravo. */
  ugao: number;
}

/** Luk kroz raskrsnicu — od mjesta na kojem se napušta ivica do nove. */
export interface Luk {
  tacke: Point[];
  cum: number[];
  duzina: number;
  s: number;
  cilj: Izlaz;
  /** Gdje se na novoj ivici izlazi sa luka: `s` i bočni položaj. */
  ulazS: number;
  ulazBok: number;
}

export interface GradVozilo {
  ivica: number;
  smjer: 1 | -1;
  s: number;
  v: number;
  bok: number;
  bokV: number;
  /** Izabrani izlaz na raskrsnici ispred; `null` dok se do nje ne dođe. */
  izbor: Izlaz | null;
  /** Strana na koju se volan drži, i koliko dugo — kao `izborPravca` u fazi 5. */
  izborStrana: "left" | "right" | null;
  izborT: number;
  luk: Luk | null;
  /** Ukupno pređeno [m]. */
  predjeno: number;
}

// ── orijentacija na ivici ───────────────────────────────────────────────────

const krajCvor = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.b : iv.a);

/** Tačka osovine ivice `s` metara od početka u smjeru vožnje. */
export function tackaNaIvici(iv: Ivica, smjer: 1 | -1, s: number): Point {
  return pointAt(iv.tacke, iv.cum, smjer === 1 ? s : iv.duzina - s);
}

/** Smjer vožnje na ivici (jedinični vektor). */
export function pravacNaIvici(iv: Ivica, smjer: 1 | -1, s: number): Point {
  const h = headingAt(iv.tacke, iv.cum, smjer === 1 ? s : iv.duzina - s);
  return smjer === 1 ? h : { x: -h.x, y: -h.y };
}

/** Desno od smjera `h` — `y` raste nadolje. */
const desno = (h: Point): Point => ({ x: -h.y, y: h.x });

function naBoku(iv: Ivica, smjer: 1 | -1, s: number, bok: number): { pos: Point; heading: Point } {
  const c = tackaNaIvici(iv, smjer, s);
  const h = pravacNaIvici(iv, smjer, s);
  const d = desno(h);
  return { pos: { x: c.x + d.x * bok, y: c.y + d.y * bok }, heading: h };
}

/**
 * Pravac kojim ivica izlazi iz čvora — mjeren do tačke nekoliko metara dalje,
 * a ne po prvom segmentu: OSM zna da ima tačku na pola metra od raskrsnice, i
 * ugao iz nje bi bio slučajan.
 */
function izlazniPravac(iv: Ivica, smjer: 1 | -1): Point {
  const a = tackaNaIvici(iv, smjer, 0);
  const b = tackaNaIvici(iv, smjer, Math.min(8, iv.duzina));
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

function ulazniPravac(iv: Ivica, smjer: 1 | -1): Point {
  const a = tackaNaIvici(iv, smjer, Math.max(0, iv.duzina - 8));
  const b = tackaNaIvici(iv, smjer, iv.duzina);
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Ugao od `a` do `b` [°]; pozitivno je udesno (`y` raste nadolje). */
function ugaoSkretanja(a: Point, b: Point): number {
  return (Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180) / Math.PI;
}

/**
 * Izlazi iz raskrsnice na kraju ivice, redom kojim su u mreži.
 *
 * Bez pravila se smije svuda autom: i uz jednosmjernu. Ne ide se samo tamo
 * gdje auto ne može — pješačka zona, biciklistička staza — osim ako drugog
 * izlaza nema. Okretanje nazad istom ulicom nije izlaz; njega daje slijepa
 * ulica.
 */
export function izlazi(m: Mreza, ivica: number, smjer: 1 | -1): Izlaz[] {
  const iv = m.ivice[ivica]!;
  const c = krajCvor(iv, smjer);
  const ulaz = ulazniPravac(iv, smjer);
  const svi: Izlaz[] = [];
  for (const j of m.izCvora[c] ?? []) {
    const f = m.ivice[j]!;
    const smjerovi: (1 | -1)[] = [];
    if (f.a === c) smjerovi.push(1);
    if (f.b === c) smjerovi.push(-1);
    for (const sm of smjerovi) {
      if (j === ivica && sm === -smjer) continue;
      svi.push({ ivica: j, smjer: sm, ugao: ugaoSkretanja(ulaz, izlazniPravac(f, sm)) });
    }
  }
  const vozni = svi.filter((x) => m.ivice[x.ivica]!.vozna);
  return vozni.length > 0 ? vozni : svi;
}

/** Izlaz najbliži željenom uglu; kod jednakih, prvi po redu u mreži. */
export function izaberiIzlaz(moguci: readonly Izlaz[], zeljeniUgao: number): Izlaz | null {
  let naj: Izlaz | null = null;
  for (const x of moguci) {
    if (!naj || Math.abs(x.ugao - zeljeniUgao) < Math.abs(naj.ugao - zeljeniUgao)) naj = x;
  }
  return naj;
}

// ── početak i korak ─────────────────────────────────────────────────────────

export function novoVozilo(m: Mreza, ivica: number, smjer: 1 | -1, s: number): GradVozilo {
  const iv = m.ivice[ivica]!;
  return {
    ivica,
    smjer,
    s,
    v: 0,
    bok: pocetniBok(iv),
    bokV: 0,
    izbor: null,
    izborStrana: null,
    izborT: 0,
    luk: null,
    predjeno: 0,
  };
}

const zaobljenje = (iv: Ivica) => Math.min(GRAD_ZAOBLJENJE, iv.duzina * GRAD_ZAOBLJENJE_UDIO);

/** Luk od tekućeg položaja do ulaska u izlaz `cilj` — kubni Bezier. */
function napraviLuk(m: Mreza, st: GradVozilo, cilj: Izlaz): Luk {
  const iv = m.ivice[st.ivica]!;
  const nova = m.ivice[cilj.ivica]!;
  const p0 = naBoku(iv, st.smjer, st.s, st.bok);
  const ulazS = zaobljenje(nova);
  const ulazBok = pocetniBok(nova);
  const p3 = naBoku(nova, cilj.smjer, ulazS, ulazBok);
  // Ručke luka duž pravca vožnje; kod okretanja su oba kraja blizu, pa se luk
  // mora ispružiti naprijed da bi se auto okrenuo, a ne zavrtio u mjestu.
  const d = Math.hypot(p3.pos.x - p0.pos.x, p3.pos.y - p0.pos.y);
  const k = Math.max(d * 0.45, 3);
  const c1 = { x: p0.pos.x + p0.heading.x * k, y: p0.pos.y + p0.heading.y * k };
  const c2 = { x: p3.pos.x - p3.heading.x * k, y: p3.pos.y - p3.heading.y * k };
  const tacke: Point[] = [];
  for (let i = 0; i <= GRAD_LUK_TACAKA; i++) {
    const t = i / GRAD_LUK_TACAKA;
    const u = 1 - t;
    tacke.push({
      x: u * u * u * p0.pos.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.pos.x,
      y: u * u * u * p0.pos.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.pos.y,
    });
  }
  const cum = cumulative(tacke);
  return { tacke, cum, duzina: cum[cum.length - 1] ?? 0, s: 0, cilj, ulazS, ulazBok };
}

/**
 * Izbor izlaza volanom, kao `izborPravca` u fazi 5: strana (lijevo, desno ili
 * ništa) mora da se drži `DECISION_HOLD`, pa tek onda važi — da korekcija u
 * traci ne promijeni pravac. Volan u sredini je „pravo".
 */
function birajIzlaz(m: Mreza, st: GradVozilo, steer: number): void {
  const strana: "left" | "right" | null =
    steer <= -DECISION_STEER ? "left" : steer >= DECISION_STEER ? "right" : null;
  if (strana === st.izborStrana) st.izborT += DT;
  else {
    st.izborStrana = strana;
    st.izborT = 0;
  }
  const moguci = izlazi(m, st.ivica, st.smjer);
  if (st.izbor === null) st.izbor = izaberiIzlaz(moguci, 0);
  if (st.izborT < DECISION_HOLD) return;
  const zeljeni = strana === null ? 0 : Math.max(-1, Math.min(1, steer)) * GRAD_PUN_VOLAN_UGAO;
  st.izbor = izaberiIzlaz(moguci, zeljeni) ?? st.izbor;
}

/** Jedan korak (`DT`). Mijenja `st` na mjestu. */
export function korak(m: Mreza, st: GradVozilo, input: Input): void {
  const a = input.throttle * A_MAX - input.brake * B_MAX;
  const k = { v: st.v, s: 0 };
  integrate(k, a, GRAD_V_TOP, GRAD_DRAG);
  st.v = k.v;
  st.predjeno += k.s;
  let ds = k.s;
  const steer = input.steer ?? 0;

  if (st.luk) {
    st.luk.s += ds;
    st.bokV = 0;
    if (st.luk.s < st.luk.duzina) return;
    // Sa luka na novu ivicu; višak puta ide na nju.
    ds = st.luk.s - st.luk.duzina;
    st.ivica = st.luk.cilj.ivica;
    st.smjer = st.luk.cilj.smjer;
    st.s = st.luk.ulazS;
    st.bok = st.luk.ulazBok;
    st.luk = null;
    st.izbor = null;
    st.izborStrana = null;
    st.izborT = 0;
  }

  const iv = m.ivice[st.ivica]!;
  st.s += ds;
  // Volan pomjera auto poprečno, unutar kolovoza — bez pravila o traci.
  const komanda = Math.abs(steer) < STEER_DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, steer));
  const granica = najveciBok(iv);
  const bok = Math.max(-granica, Math.min(granica, st.bok + komanda * bocnaBrzina(st.v) * DT));
  st.bokV = (bok - st.bok) / DT;
  st.bok = bok;

  const doKraja = iv.duzina - st.s;
  if (doKraja <= GRAD_ODLUKA && doKraja > GRAD_ZAKLJUCAJ) birajIzlaz(m, st, steer);
  if (doKraja > zaobljenje(iv)) return;

  // Na raskrsnici: izabrani izlaz, ili pravo ako se nije ni biralo. Slijepa
  // ulica: okretanje nazad istom ulicom.
  const cilj =
    st.izbor ??
    izaberiIzlaz(izlazi(m, st.ivica, st.smjer), 0) ??
    { ivica: st.ivica, smjer: (st.smjer === 1 ? -1 : 1) as 1 | -1, ugao: 180 };
  st.s = Math.min(st.s, iv.duzina);
  st.luk = napraviLuk(m, st, cilj);
}

/** Gdje je auto i kuda gleda. */
export function poza(m: Mreza, st: GradVozilo): { pos: Point; heading: Point } {
  if (st.luk) {
    return {
      pos: pointAt(st.luk.tacke, st.luk.cum, st.luk.s),
      heading: headingAt(st.luk.tacke, st.luk.cum, Math.min(st.luk.s, st.luk.duzina)),
    };
  }
  return naBoku(m.ivice[st.ivica]!, st.smjer, st.s, st.bok);
}
