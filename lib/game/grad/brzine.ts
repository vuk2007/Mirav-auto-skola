import { GRAD_BRZINA_PODRAZUMIJEVANA } from "../sim/config";
import type { Point } from "../sim/types";
import type { Mreza } from "./mreza";
import { procitajZnak, type Zona } from "./overlay";
import { BEZ, type Paket } from "./paket";
import type { Raskrsnice } from "./raskrsnica";
import { uPoligonu } from "./temena";

/**
 * Ograničenje brzine u gradu (faza 6, stavke 5 i 6), redom kojim važi:
 *  1. znak ograničenja iz editora — od znaka do prve raskrsnice, u smjeru
 *     vožnje (ispitno pitanje 233: „važi do prve raskrsnice");
 *  2. zona sa ograničenjem (školska zona…) — na ulazu u nju se crta znak
 *     zone, na izlazu kraj zone (odluka korisnika 2026-10-01);
 *  3. OSM `maxspeed` — samo na brzinomjeru, bez znaka (odluka korisnika);
 *  4. u naselju 50 km/h.
 * Isto ograničenje vide sudija, bot i brzinomjer.
 */

export interface DioZone {
  s0: number;
  s1: number;
  brzina: number;
}

/** Znak zone za crtanje: na ulici, u smjeru vožnje — ulazak u zonu ili kraj zone. */
export interface ZnakZone {
  ivica: number;
  s: number;
  /** 1: vožnja `a → b`. */
  smjer: 1 | -1;
  vrsta: "zona" | "krajZone";
  brzina: number;
}

export interface Ogranicenja {
  /** Znakovi ograničenja po „ivica:smjer": `s` znaka (od `a`) i brzina. */
  znakovi: Map<string, { s: number; brzina: number }[]>;
  /** Dijelovi ivica u zonama sa ograničenjem. */
  zone: Map<number, DioZone[]>;
  znakoviZone: ZnakZone[];
  /** Pamćenje: ograničenje sa znaka koje važi na početku ivice u smjeru vožnje. */
  ulazno: Map<string, number | null>;
}

const kljuc = (ivica: number, smjer: 1 | -1) => `${ivica}:${smjer}`;

/** Dijelovi izlomljene linije unutar poligona: [s0, s1] od početka linije. */
function uPoligonuDuz(tacke: readonly Point[], cum: readonly number[], poligon: readonly Point[]): [number, number][] {
  // Sve tačke u kojima linija siječe ivicu poligona, pa se između susjednih
  // provjeri sredina.
  const s: number[] = [0, cum[cum.length - 1]!];
  for (let k = 0; k + 1 < tacke.length; k++) {
    const a = tacke[k]!;
    const b = tacke[k + 1]!;
    for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
      const p = poligon[j]!;
      const q = poligon[i]!;
      const d = (b.x - a.x) * (q.y - p.y) - (b.y - a.y) * (q.x - p.x);
      if (Math.abs(d) < 1e-12) continue;
      const t = ((p.x - a.x) * (q.y - p.y) - (p.y - a.y) * (q.x - p.x)) / d;
      const u = ((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / d;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) s.push(cum[k]! + t * (cum[k + 1]! - cum[k]!));
    }
  }
  s.sort((x, y) => x - y);
  const dijelovi: [number, number][] = [];
  for (let i = 0; i + 1 < s.length; i++) {
    const s0 = s[i]!;
    const s1 = s[i + 1]!;
    if (s1 - s0 < 1e-6) continue;
    const sr = (s0 + s1) / 2;
    let k = 0;
    while (k + 2 < tacke.length && cum[k + 1]! < sr) k++;
    const a = tacke[k]!;
    const b = tacke[k + 1]!;
    const l = cum[k + 1]! - cum[k]! || 1;
    const t = (sr - cum[k]!) / l;
    if (!uPoligonu(poligon, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) continue;
    const zadnji = dijelovi[dijelovi.length - 1];
    if (zadnji && Math.abs(zadnji[1] - s0) < 1e-6) zadnji[1] = s1;
    else dijelovi.push([s0, s1]);
  }
  return dijelovi;
}

export function napraviOgranicenja(p: Paket, m: Mreza, zone: readonly Zona[]): Ogranicenja {
  const n = p.n;
  const z = p.zaglavlje;
  const znakovi = new Map<string, { s: number; brzina: number }[]>();
  const vrstaZnaka = z.vrsteObjekata.indexOf("znak");
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrstaZnaka || n.obIvica[o] === BEZ) continue;
    const zn = procitajZnak(z.stringovi[n.obPodatak[o]!] ?? "");
    if (!zn || zn.znak !== "brzina" || zn.brzina === null) continue;
    const k = kljuc(n.obIvica[o]!, zn.naprijed ? 1 : -1);
    znakovi.set(k, [...(znakovi.get(k) ?? []), { s: n.obS[o]!, brzina: zn.brzina }]);
  }

  const dijelovi = new Map<number, DioZone[]>();
  const znakoviZone: ZnakZone[] = [];
  const saOgranicenjem = zone.filter((x) => x.speedLimit !== null && x.speedLimit > 0 && x.poligon.length >= 3);
  for (const zona of saOgranicenjem) {
    const poligon = zona.poligon.map(([x, y]) => ({ x, y }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of poligon) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x);
      maxY = Math.max(maxY, t.y);
    }
    const brzina = zona.speedLimit!;
    for (const iv of m.ivice) {
      if (!iv.vozna) continue;
      if (iv.tacke.every((t) => t.x < minX) || iv.tacke.every((t) => t.x > maxX)) continue;
      if (iv.tacke.every((t) => t.y < minY) || iv.tacke.every((t) => t.y > maxY)) continue;
      for (const [s0, s1] of uPoligonuDuz(iv.tacke, iv.cum, poligon)) {
        dijelovi.set(iv.i, [...(dijelovi.get(iv.i) ?? []), { s0, s1, brzina }]);
        // Granica zone na sredini ulice: znak zone za onoga ko ulazi, kraj
        // zone za onoga ko izlazi — u svakom dozvoljenom smjeru.
        const smije = (smjer: 1 | -1) => iv.smjer === 0 || iv.smjer === smjer;
        if (s0 > 0.01) {
          if (smije(1)) znakoviZone.push({ ivica: iv.i, s: s0, smjer: 1, vrsta: "zona", brzina });
          if (smije(-1)) znakoviZone.push({ ivica: iv.i, s: s0, smjer: -1, vrsta: "krajZone", brzina });
        }
        if (s1 < iv.duzina - 0.01) {
          if (smije(-1)) znakoviZone.push({ ivica: iv.i, s: s1, smjer: -1, vrsta: "zona", brzina });
          if (smije(1)) znakoviZone.push({ ivica: iv.i, s: s1, smjer: 1, vrsta: "krajZone", brzina });
        }
      }
    }
  }
  return { znakovi, zone: dijelovi, znakoviZone, ulazno: new Map() };
}

/** Zadnji znak na ivici prije `s` u smjeru vožnje (`s` = ∞/−∞: bilo gdje na ivici). */
function znakIspred(o: Ogranicenja, ivica: number, smjer: 1 | -1, s: number): number | null {
  let naj: { s: number; brzina: number } | null = null;
  for (const z of o.znakovi.get(kljuc(ivica, smjer)) ?? []) {
    const iza = smjer === 1 ? z.s <= s : z.s >= s;
    if (iza && (!naj || (smjer === 1 ? z.s > naj.s : z.s < naj.s))) naj = z;
  }
  return naj ? naj.brzina : null;
}

/**
 * Ograničenje sa znaka koje važi na početku ivice (u smjeru vožnje): sa
 * prethodne ivice iste ulice, kroz čvorove koji nisu raskrsnice. Raskrsnica
 * prekida znak.
 */
function ulaznoSaZnaka(o: Ogranicenja, m: Mreza, r: Raskrsnice, ivica: number, smjer: 1 | -1, dubina = 0): number | null {
  const k = kljuc(ivica, smjer);
  if (o.ulazno.has(k)) return o.ulazno.get(k)!;
  const iv = m.ivice[ivica]!;
  const c = smjer === 1 ? iv.a : iv.b;
  let izlaz: number | null = null;
  if (r.uCvoru[c]! < 0 && dubina < 200) {
    const prethodna = (m.izCvora[c] ?? []).filter((x) => x !== ivica && m.ivice[x]!.vozna);
    if (prethodna.length === 1) {
      const p = m.ivice[prethodna[0]!]!;
      // Na prethodnoj se vozi KA čvoru `c`.
      const ps: 1 | -1 = p.b === c ? 1 : -1;
      o.ulazno.set(k, null); // petlja (prsten bez raskrsnice) ne vrti beskonačno
      izlaz = znakIspred(o, p.i, ps, ps === 1 ? Infinity : -Infinity) ?? ulaznoSaZnaka(o, m, r, p.i, ps, dubina + 1);
    }
  }
  o.ulazno.set(k, izlaz);
  return izlaz;
}

/** Odakle je ograničenje — za karticu i brzinomjer. */
export type IzvorOgranicenja = "znak" | "zona" | "osm" | "naselje";

/** Ograničenje na ivici `ivica`, `s` metara od `a`, u smjeru vožnje `smjer`. */
export function ogranicenjeNa(
  o: Ogranicenja,
  m: Mreza,
  r: Raskrsnice,
  ivica: number,
  smjer: 1 | -1,
  s: number,
): { brzina: number; izvor: IzvorOgranicenja } {
  const znak = znakIspred(o, ivica, smjer, s) ?? ulaznoSaZnaka(o, m, r, ivica, smjer);
  if (znak !== null) return { brzina: znak, izvor: "znak" };
  let zona: number | null = null;
  for (const d of o.zone.get(ivica) ?? []) if (s >= d.s0 && s <= d.s1) zona = zona === null ? d.brzina : Math.min(zona, d.brzina);
  if (zona !== null) return { brzina: zona, izvor: "zona" };
  const osm = m.ivice[ivica]!.brzina;
  return osm !== null ? { brzina: osm, izvor: "osm" } : { brzina: GRAD_BRZINA_PODRAZUMIJEVANA, izvor: "naselje" };
}
