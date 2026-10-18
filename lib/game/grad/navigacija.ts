/**
 * Navigacija do odredišta (faza 6, stavka 9): ruta od mjesta gdje je auto do
 * ulaza odredišta, manevri na njoj (strelica i putokaz) i napredak dok se vozi.
 * Čista logika — bez crtanja i bez Reacta; ista ruta vodi i igrača i bota.
 *
 * Ruta je niz ivica (A* kao kod bota, sa zabranama skretanja i jednosmjernim
 * ulicama) i linija po osovini tih ulica. Kad igrač ode sa nje, traži se nova
 * — od mjesta gdje je sad (`naRuti`).
 */
import {
  GRAD_NAV_DOLAZAK,
  GRAD_NAV_SA_RUTE,
  GRAD_NAV_SA_RUTE_TRAJE,
  GRAD_NAV_TRAZI_ULICU,
} from "../sim/config";
import type { Point } from "../sim/types";
import { ruta, ZA_BOTA, type Korak } from "./botGrad";
import { manevarKrakova, type Ivica, type Manevar, type Mreza } from "./mreza";
import type { Odrediste } from "./odredista";
import { oseBlizu } from "./povrsina";
import type { SvijetGrada } from "./svijet";

export interface ManevarRute {
  /** Gdje je na ruti [m od početka] — ulaz u raskrsnicu. */
  s: number;
  manevar: Manevar;
  /** U kružnom toku: redni broj izlaza (1 = prvi). */
  izlaz?: number;
  /** Ime ulice na koju se izlazi; prazno kad je nema. */
  ulica: string;
}

export interface RutaDo {
  koraci: Korak[];
  /** Linija rute po osovini ulica, od auta do ulaza odredišta. */
  tacke: Point[];
  cum: number[];
  duzina: number;
  manevri: ManevarRute[];
  cilj: Odrediste;
  /** Gdje su na ruti [m] obavezne tačke, redom (zadnja je cilj). */
  mete: number[];
}

/** Mjesto na mreži: korak (ivica i smjer vožnje) i metara od početka ivice. */
export interface MjestoNaMrezi {
  korak: Korak;
  s: number;
}

const kraj = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.b : iv.a);
const pocetak = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.a : iv.b);
const smije = (iv: Ivica, smjer: 1 | -1) => iv.smjer === 0 || iv.smjer === smjer;

/** Gdje je auto u mreži: ulica kojom se vozi, smjer po pravcu auta i metara od početka ivice. */
export function mjestoAuta(sv: SvijetGrada, x: number, y: number, ugao: number): { korak: Korak; s: number } | null {
  const osa = oseBlizu(sv.povrsina, x, y, GRAD_NAV_TRAZI_ULICU)
    .filter((o) => ZA_BOTA(sv.mreza.ivice[o.ivica]!))
    .sort((a, b) => a.d - b.d)[0];
  if (!osa) return null;
  const iv = sv.mreza.ivice[osa.ivica]!;
  let smjer: 1 | -1 = osa.pravac.x * Math.cos(ugao) + osa.pravac.y * Math.sin(ugao) >= 0 ? 1 : -1;
  // Jednosmjerna u suprotnom smjeru: ruta ide njenim smjerom (okreni se).
  if (!smije(iv, smjer)) smjer = smjer === 1 ? -1 : 1;
  return { korak: { ivica: iv.i, smjer }, s: osa.s };
}

/** Tačke ivice u smjeru vožnje, od `od` do `do_` metara (mjereno od početka ivice `a`). */
function dioIvice(iv: Ivica, smjer: 1 | -1, od: number, do_: number): Point[] {
  const [lo, hi] = smjer === 1 ? [od, do_] : [do_, od];
  const out: Point[] = [];
  const tacka = (s: number): Point => {
    for (let k = 1; k < iv.tacke.length; k++) {
      if (iv.cum[k]! >= s) {
        const a = iv.tacke[k - 1]!;
        const b = iv.tacke[k]!;
        const l = iv.cum[k]! - iv.cum[k - 1]!;
        const u = l > 0 ? (s - iv.cum[k - 1]!) / l : 0;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
    }
    return iv.tacke[iv.tacke.length - 1]!;
  };
  out.push(tacka(lo));
  for (let k = 0; k < iv.tacke.length; k++) if (iv.cum[k]! > lo && iv.cum[k]! < hi) out.push(iv.tacke[k]!);
  out.push(tacka(hi));
  return smjer === 1 ? out : out.reverse();
}

/**
 * Manevri na ruti: u svakoj raskrsnici (grupa čvorova, `raskrsnice.uCvoru`)
 * ulazna i izlazna ivica daju manevar; pravo se ne javlja. Kružni tok je jedan
 * manevar sa rednim brojem izlaza.
 */
function manevriRute(sv: SvijetGrada, koraci: Korak[], pocetakS: number[]): ManevarRute[] {
  const m = sv.mreza;
  const r = sv.raskrsnice;
  const out: ManevarRute[] = [];
  for (let i = 0; i + 1 < koraci.length; ) {
    const ulazna = m.ivice[koraci[i]!.ivica]!;
    const cvorUlaza = kraj(ulazna, koraci[i]!.smjer);
    // Kružni tok: od ulaska na prsten do silaska sa njega.
    if (m.ivice[koraci[i + 1]!.ivica]!.kruzni && !ulazna.kruzni) {
      let j = i + 1;
      let izlaz = 0;
      while (j < koraci.length && m.ivice[koraci[j]!.ivica]!.kruzni) {
        const iv = m.ivice[koraci[j]!.ivica]!;
        const c = kraj(iv, koraci[j]!.smjer);
        // Izlaz sa prstena u ovom čvoru (vozni, dozvoljenog smjera)?
        const imaIzlaz = (m.izCvora[c] ?? []).some((e) => {
          const f = m.ivice[e]!;
          if (f.kruzni || !ZA_BOTA(f)) return false;
          return smije(f, f.a === c ? 1 : -1);
        });
        if (imaIzlaz) izlaz += 1;
        j++;
      }
      if (j < koraci.length) {
        const izlazna = m.ivice[koraci[j]!.ivica]!;
        out.push({ s: pocetakS[i + 1]!, manevar: "pravo", izlaz: Math.max(1, izlaz), ulica: izlazna.ime });
      }
      i = j;
      continue;
    }
    // Raskrsnica od više čvorova: preko unutrašnjih ivica do izlazne.
    const rc = r.uCvoru[cvorUlaza]!;
    let j = i + 1;
    if (rc >= 0) {
      const unutra = r.lista[rc]!.unutrasnje;
      while (j + 1 < koraci.length && unutra.includes(koraci[j]!.ivica)) j++;
    }
    const izlazna = m.ivice[koraci[j]!.ivica]!;
    const cvorIzlaza = pocetak(izlazna, koraci[j]!.smjer);
    // Samo gdje se zaista bira put: čvor sa više od dva kraka ili raskrsnica.
    const izbor = rc >= 0 || (m.izCvora[cvorUlaza]?.length ?? 0) > 2;
    const manevar = manevarKrakova(ulazna, cvorUlaza, izlazna, cvorIzlaza);
    if (izbor && manevar !== "pravo") out.push({ s: pocetakS[i + 1]!, manevar, ulica: izlazna.ime });
    i = j;
  }
  return out;
}

/**
 * Ruta od `start` redom kroz `mete` (zadnja je kraj rute): A* od mete do mete,
 * linija po osovini ulica i manevri. `null` kad neka dionica nema propisne
 * rute (ili je meta iza auta na istoj ulici — tad bi trebalo kružiti).
 */
export function rutaKroz(sv: SvijetGrada, start: MjestoNaMrezi, mete: readonly MjestoNaMrezi[], cilj: Odrediste): RutaDo | null {
  const m: Mreza = sv.mreza;
  if (mete.length === 0) return null;
  const pocetakIvice = (k: Korak) => (k.smjer === 1 ? 0 : m.ivice[k.ivica]!.duzina);
  const krajIvice = (k: Korak) => (k.smjer === 1 ? m.ivice[k.ivica]!.duzina : 0);
  // Dijelovi rute: ivica u smjeru vožnje, od–do metara na njoj. Zadnji je
  // otvoren dok se ne zna gdje se na njemu staje.
  const dijelovi: { korak: Korak; od: number; do_: number }[] = [];
  let otvoren = { korak: start.korak, od: start.s };
  const naDijelu: { i: number; s: number }[] = [];
  let tu = start;
  for (const meta of mete) {
    const isti = tu.korak.ivica === meta.korak.ivica && tu.korak.smjer === meta.korak.smjer;
    const ispred = isti && (meta.korak.smjer === 1 ? meta.s >= tu.s : meta.s <= tu.s);
    if (!ispred) {
      const k = ruta(m, sv.raskrsnice, sv.zabrane, tu.korak, meta.korak);
      if (!k || k.length < 2) return null;
      dijelovi.push({ korak: otvoren.korak, od: otvoren.od, do_: krajIvice(otvoren.korak) });
      for (const x of k.slice(1, -1)) dijelovi.push({ korak: x, od: pocetakIvice(x), do_: krajIvice(x) });
      const z = k[k.length - 1]!;
      otvoren = { korak: z, od: pocetakIvice(z) };
    }
    naDijelu.push({ i: dijelovi.length, s: meta.s });
    tu = meta;
  }
  dijelovi.push({ korak: otvoren.korak, od: otvoren.od, do_: tu.s });
  const tacke: Point[] = [];
  const pocetakS: number[] = [];
  let duz = 0;
  for (const d of dijelovi) {
    pocetakS.push(duz);
    for (const p of dioIvice(m.ivice[d.korak.ivica]!, d.korak.smjer, d.od, d.do_)) {
      const zadnja = tacke[tacke.length - 1];
      if (zadnja && Math.hypot(p.x - zadnja.x, p.y - zadnja.y) < 0.01) continue;
      tacke.push(p);
    }
    duz += Math.abs(d.do_ - d.od);
  }
  if (tacke.length < 2) tacke.push({ ...tacke[0]! });
  const cum = [0];
  for (let k = 1; k < tacke.length; k++) cum.push(cum[k - 1]! + Math.hypot(tacke[k]!.x - tacke[k - 1]!.x, tacke[k]!.y - tacke[k - 1]!.y));
  // `pocetakS` je po dužinama ivica; linija ima svoju dužinu — razmjera.
  const r = duz > 0 ? cum[cum.length - 1]! / duz : 1;
  return {
    koraci: dijelovi.map((d) => d.korak),
    tacke,
    cum,
    duzina: cum[cum.length - 1]!,
    manevri: manevriRute(
      sv,
      dijelovi.map((d) => d.korak),
      pocetakS.map((s) => s * r),
    ),
    cilj,
    mete: naDijelu.map(({ i, s }) => (pocetakS[i]! + Math.abs(s - dijelovi[i]!.od)) * r),
  };
}

/**
 * Ruta od mjesta auta do ulaza odredišta; `null` kad je nema (auto van
 * ulica, cilj nedostižan). Dvosmjerna ulica cilja se probava u oba smjera —
 * uzima se kraća ruta.
 */
export function rutaDo(sv: SvijetGrada, x: number, y: number, ugao: number, cilj: Odrediste): RutaDo | null {
  const start = mjestoAuta(sv, x, y, ugao);
  if (!start) return null;
  const civ = sv.mreza.ivice[cilj.ivica]!;
  let naj: RutaDo | null = null;
  for (const smjer of [1, -1] as const) {
    if (!smije(civ, smjer)) continue;
    const kandidat = rutaKroz(sv, start, [{ korak: { ivica: civ.i, smjer }, s: cilj.s }], cilj);
    if (kandidat && (!naj || kandidat.duzina < naj.duzina)) naj = kandidat;
  }
  return naj;
}

/** Projekcija tačke na rutu, u prozoru `[od, do_]` metara po ruti. */
export function projekcijaNaRutu(rt: RutaDo, x: number, y: number, od = 0, do_ = Infinity): { s: number; d: number } {
  let naj = { s: od, d: Infinity };
  for (let k = 1; k < rt.tacke.length; k++) {
    if (rt.cum[k]! < od) continue;
    if (rt.cum[k - 1]! > do_) break;
    const a = rt.tacke[k - 1]!;
    const b = rt.tacke[k]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y);
    if (d < naj.d) naj = { s: rt.cum[k - 1]! + u * Math.sqrt(l2), d };
  }
  return naj;
}

/** Stanje navigacije dok se vozi. */
export interface Navigacija {
  ruta: RutaDo;
  /** Pređeno po ruti [m]. */
  s: number;
  /** Od kad je auto van rute [s simulacije]; `null` — na ruti je. */
  vanOd: number | null;
  stigao: boolean;
}

export const novaNavigacija = (ruta: RutaDo): Navigacija => ({ ruta, s: 0, vanOd: null, stigao: false });

/**
 * Korak navigacije: napredak po ruti (samo naprijed, u prozoru oko zadnjeg
 * mjesta — ruta zna proći istom ulicom dvaput), dolazak, i da li treba nova
 * ruta (van rute duže od `GRAD_NAV_SA_RUTE_TRAJE`).
 */
export function korakNavigacije(nav: Navigacija, x: number, y: number, t: number): { novaRuta: boolean } {
  if (nav.stigao) return { novaRuta: false };
  const p = projekcijaNaRutu(nav.ruta, x, y, nav.s - 20, nav.s + 80);
  if (p.d <= GRAD_NAV_SA_RUTE) {
    nav.s = Math.max(nav.s, p.s);
    nav.vanOd = null;
  } else nav.vanOd ??= t;
  const doCilja = Math.hypot(x - nav.ruta.cilj.ulaz.x, y - nav.ruta.cilj.ulaz.y);
  if (nav.ruta.duzina - nav.s <= GRAD_NAV_DOLAZAK && doCilja <= GRAD_NAV_DOLAZAK) nav.stigao = true;
  return { novaRuta: nav.vanOd !== null && t - nav.vanOd >= GRAD_NAV_SA_RUTE_TRAJE };
}

/** Sljedeći manevar ispred auta i koliko je do njega [m]; `null` — samo pravo do cilja. */
export function sljedeciManevar(nav: Navigacija): { manevar: ManevarRute; za: number } | null {
  const m = nav.ruta.manevri.find((x) => x.s > nav.s - 5);
  return m ? { manevar: m, za: Math.max(0, m.s - nav.s) } : null;
}

/**
 * Koraci od ivice `od` do ulice odredišta (fuzz bota, stavka 9): kraća od
 * ruta u dva smjera dvosmjerne ulice cilja; `null` kad je nema.
 */
export function koraciDoOdredista(sv: SvijetGrada, od: Korak, cilj: Odrediste): Korak[] | null {
  const civ = sv.mreza.ivice[cilj.ivica]!;
  let naj: { k: Korak[]; d: number } | null = null;
  for (const smjer of [1, -1] as const) {
    if (!smije(civ, smjer)) continue;
    const k = ruta(sv.mreza, sv.raskrsnice, sv.zabrane, od, { ivica: civ.i, smjer });
    if (!k) continue;
    const d = k.reduce((x, y) => x + sv.mreza.ivice[y.ivica]!.duzina, 0);
    if (!naj || d < naj.d) naj = { k, d };
  }
  return naj?.k ?? null;
}
