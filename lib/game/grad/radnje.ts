/**
 * Radnje (faza 6, stavka 8d): dnevni ciklus „ograničava koje su radnje
 * otvorene" (dekor). Radnja je OSM `shop=*` — bez imena (odjeljak 10) — sa
 * radnim vremenom: iz `opening_hours` kad se da pročitati, inače po vrsti
 * (`GRAD_RADNJA_VRIJEME`). Crta se kao izlog sa tendom na fasadi zgrade ka
 * trotoaru (radnja van zgrade — na trotoaru):
 * otvorena — tenda u boji, uveče osvijetljena; zatvorena — spuštena roletna.
 */
import {
  GRAD_RADNJA_DO,
  GRAD_RADNJA_DUBINA,
  GRAD_RADNJA_DUZINA,
  GRAD_RADNJA_ODMAK,
  GRAD_RADNJA_ZGRADA,
  GRAD_RADNJA_RAZMAK,
  GRAD_RADNJA_VRIJEME,
  GRAD_RADNJA_VRIJEME_OSTALO,
} from "../sim/config";
import { headingAt, pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import { naKolovozu } from "./povrsina";
import type { SvijetGrada } from "./svijet";
import { najbliziTrotoar, type MrezaPjesaka } from "./trotoari";

/** Raspon radnog vremena [h od, h do]; `do` preko 24 — radi i poslije ponoći. */
export type Raspon = readonly [number, number];

const SAT = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;

/**
 * Radno vrijeme iz OSM oznaka: `24/7` — cijeli dan; inače rasponi prvog
 * pravila koje nije `off` (radni dan, npr. „Mo-Fr 08:00-16:00; Sa …"); bez
 * čitljivog `opening_hours` — po vrsti radnje.
 */
export function radnoVrijemeOsm(shop: string | undefined, openingHours: string | undefined): Raspon[] {
  const oh = (openingHours ?? "").trim();
  if (/^24\/7/.test(oh)) return [[0, 24]];
  for (const pravilo of oh.split(";")) {
    if (/\boff\b|\bclosed\b/i.test(pravilo)) continue;
    const rasponi: Raspon[] = [];
    for (const m of pravilo.matchAll(SAT)) {
      const od = Number(m[1]) + Number(m[2]) / 60;
      let do_ = Number(m[3]) + Number(m[4]) / 60;
      if (do_ <= od) do_ += 24;
      if (od < 24 && do_ <= 48) rasponi.push([od, do_]);
    }
    if (rasponi.length > 0) return rasponi;
  }
  return [GRAD_RADNJA_VRIJEME[shop ?? ""] ?? GRAD_RADNJA_VRIJEME_OSTALO];
}

/** Zapis za paket: „7-22", „8-12,17-21", „8.5-15.5". */
export function zapisiRadnoVrijeme(r: readonly Raspon[]): string {
  const broj = (h: number) => String(Math.round(h * 100) / 100);
  return r.map(([od, do_]) => `${broj(od)}-${broj(do_)}`).join(",");
}

export function procitajRadnoVrijeme(s: string): Raspon[] {
  const out: Raspon[] = [];
  for (const dio of s.split(",")) {
    const [a, b] = dio.split("-").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) out.push([a!, b!]);
  }
  return out.length > 0 ? out : [GRAD_RADNJA_VRIJEME_OSTALO];
}

/** Da li je radnja otvorena u `sat` (0–24): i raspon preko ponoći. */
export function otvorena(r: readonly Raspon[], sat: number): boolean {
  const h = ((sat % 24) + 24) % 24;
  return r.some(([od, do_]) => (h >= od && h < do_) || (do_ > 24 && h < do_ - 24));
}

/** Izlog radnje: sredina, pravac duž ulice [rad], radno vrijeme i boja tende (indeks). */
export interface Radnja {
  x: number;
  y: number;
  ugao: number;
  vrijeme: Raspon[];
  boja: number;
}

/**
 * Izlozi radnji grada (radnja iz paketa, vrsta `radnja`). Radnja u zgradi
 * (ili do `GRAD_RADNJA_ZGRADA` m od nje): izlog na fasadi te zgrade okrenutoj
 * ka najbližem trotoaru, sa spoljne strane. Inače na tom trotoaru (do
 * `GRAD_RADNJA_DO` m), pomjeren od staze hoda ka zgradama. Dva bliža od
 * `GRAD_RADNJA_RAZMAK` (više radnji u istom prizemlju) — jedan.
 */
export function radnjeGrada(sv: SvijetGrada, mp: MrezaPjesaka): Radnja[] {
  const n = sv.paket.n;
  const z = sv.paket.zaglavlje;
  const vrsta = z.vrsteObjekata.indexOf("radnja");
  if (vrsta < 0) return [];
  const zgrade = zgradeUzRadnje(sv, vrsta);
  const out: Radnja[] = [];
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrsta) continue;
    const r = { x: n.obXY[2 * o]!, y: n.obXY[2 * o + 1]! };
    const t = najbliziTrotoar(mp, r.x, r.y, GRAD_RADNJA_DO);
    if (!t) continue;
    const st = mp.staze[t.staza]!;
    const q = pointAt(st.tacke, st.cum, t.u);
    const izlog = naFasadi(zgrade, r, q) ?? naTrotoaru(sv, st, t.u, q);
    if (!izlog || naKolovozu(sv.povrsina, izlog.x, izlog.y)) continue;
    if (out.some((x) => Math.hypot(x.x - izlog.x, x.y - izlog.y) < GRAD_RADNJA_RAZMAK)) continue;
    const podatak = z.stringovi[n.obPodatak[o]!] ?? "";
    out.push({ ...izlog, vrijeme: procitajRadnoVrijeme(podatak), boja: o });
  }
  return out;
}

/** Osnove zgrada blizu neke radnje (do `GRAD_RADNJA_ZGRADA` m), po ćelijama od 50 m. */
function zgradeUzRadnje(sv: SvijetGrada, vrsta: number): Map<string, Point[][]> {
  const n = sv.paket.n;
  const C = 50;
  const kljuc = (x: number, y: number) => `${Math.floor(x / C)},${Math.floor(y / C)}`;
  const uzRadnju = new Set<string>();
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrsta) continue;
    uzRadnju.add(kljuc(n.obXY[2 * o]!, n.obXY[2 * o + 1]!));
  }
  const out = new Map<string, Point[][]>();
  for (let i = 0; i + 1 < n.zgOd.length; i++) {
    const od = n.zgOd[i]!;
    const do_ = n.zgOd[i + 1]!;
    if (do_ - od < 3) continue;
    const prsten: Point[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let k = od; k < do_; k++) {
      const x = n.zgXY[2 * k]!;
      const y = n.zgXY[2 * k + 1]!;
      prsten.push({ x, y });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const r = GRAD_RADNJA_ZGRADA;
    for (let cx = Math.floor((minX - r) / C); cx <= Math.floor((maxX + r) / C); cx++) {
      for (let cy = Math.floor((minY - r) / C); cy <= Math.floor((maxY + r) / C); cy++) {
        const k = `${cx},${cy}`;
        if (!uzRadnju.has(k)) continue;
        const l = out.get(k) ?? [];
        l.push(prsten);
        out.set(k, l);
      }
    }
  }
  return out;
}

/**
 * Izlog na fasadi zgrade u kojoj je radnja `r` (ili do `GRAD_RADNJA_ZGRADA` m
 * od nje): od ivica te zgrade ona najbliža trotoaru `q`, sa spoljne strane.
 */
function naFasadi(zgrade: Map<string, Point[][]>, r: Point, q: Point): { x: number; y: number; ugao: number } | null {
  let zgrada: Point[] | null = null;
  let najD = GRAD_RADNJA_ZGRADA;
  for (const prsten of zgrade.get(`${Math.floor(r.x / 50)},${Math.floor(r.y / 50)}`) ?? []) {
    const d = uPoligonu(r, prsten) ? 0 : udaljenostOdIvica(prsten, r).d;
    if (d <= najD) {
      najD = d;
      zgrada = prsten;
      if (d === 0) break;
    }
  }
  if (!zgrada) return null;
  const f = udaljenostOdIvica(zgrada, q);
  const a = zgrada[f.i]!;
  const b = zgrada[(f.i + 1) % zgrada.length]!;
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  if (l < GRAD_RADNJA_DUZINA) return null;
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  // Sredina izloga: na ivici naspram trotoara, ali cijeli izlog na ivici.
  const u = Math.max(GRAD_RADNJA_DUZINA / 2, Math.min(l - GRAD_RADNJA_DUZINA / 2, f.u * l));
  const px = a.x + ux * u;
  const py = a.y + uy * u;
  // Spolja: na stranu trotoara.
  let nx = -uy;
  let ny = ux;
  if ((q.x - px) * nx + (q.y - py) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const d = GRAD_RADNJA_DUBINA / 2;
  return { x: px + nx * d, y: py + ny * d, ugao: Math.atan2(uy, ux) };
}

/** Izlog na trotoaru (radnja nije u zgradi): od staze hoda ka zgradama. */
function naTrotoaru(sv: SvijetGrada, st: MrezaPjesaka["staze"][number], u: number, q: Point): { x: number; y: number; ugao: number } {
  const h = headingAt(st.tacke, st.cum, Math.min(u, st.duzina));
  // Od kolovoza ka zgradama: od ose ulice kojoj trotoar pripada ka stazi
  // (na širokom trotoaru kolovoz nije ni sa jedne strane blizu staze).
  let nx = -h.y;
  let ny = h.x;
  const osa = najblizeNaIvici(sv.mreza.ivice[st.ivica]!.tacke, q);
  if ((q.x - osa.x) * nx + (q.y - osa.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: q.x + nx * GRAD_RADNJA_ODMAK, y: q.y + ny * GRAD_RADNJA_ODMAK, ugao: Math.atan2(h.y, h.x) };
}

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

/** Najbliža ivica zatvorenog prstena tački: indeks ivice (od tačke `i` ka `i+1`), udio duž nje i udaljenost. */
function udaljenostOdIvica(prsten: readonly Point[], p: Point): { i: number; u: number; d: number } {
  let naj = { i: 0, u: 0, d: Infinity };
  for (let i = 0; i < prsten.length; i++) {
    const a = prsten[i]!;
    const b = prsten[(i + 1) % prsten.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(a.x + dx * u - p.x, a.y + dy * u - p.y);
    if (d < naj.d) naj = { i, u, d };
  }
  return naj;
}

/** Najbliža tačka izlomljene linije tački `p`. */
function najblizeNaIvici(t: readonly Point[], p: Point): Point {
  let naj = t[0]!;
  let najD = Infinity;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1]!;
    const b = t[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const q = { x: a.x + dx * u, y: a.y + dy * u };
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < najD) {
      najD = d;
      naj = q;
    }
  }
  return naj;
}
