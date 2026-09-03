/**
 * Geometrija: vektori, polilinije i sudar pravougaonika.
 *
 * Sve je čista funkcija bez stanja — nema ni React-a ni globalnih promjenljivih,
 * pa se može testirati bez pokretanja simulacije.
 *
 * Koordinatni sistem: `x` raste udesno, `y` raste **nadolje** (kao na ekranu).
 * Centar raskrsnice je `(0, 0)`. Zbog `y` nadolje, „desno od pravca kretanja"
 * se dobija rotacijom smjera za +90°: `right(h) = (-h.y, h.x)`.
 */

import type { Point } from "./types";

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const len = (a: Point): number => Math.hypot(a.x, a.y);

export function norm(a: Point): Point {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Desno od pravca kretanja — vidi napomenu o koordinatama na vrhu. */
export const right = (h: Point): Point => ({ x: -h.y, y: h.x });

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Kumulativne dužine duž polilinije; prvi član je uvijek 0. */
export function cumulative(points: readonly Point[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1]! + len(sub(points[i]!, points[i - 1]!)));
  }
  return cum;
}

/** Tačka na poliliniji na pređenoj dužini `s`; van opsega se stеže na krajeve. */
export function pointAt(points: readonly Point[], cum: readonly number[], s: number): Point {
  const total = cum[cum.length - 1] ?? 0;
  if (s <= 0) return points[0]!;
  if (s >= total) return points[points.length - 1]!;

  // Binarna pretraga: polilinije imaju do nekoliko stotina tačaka, a `pointAt`
  // se zove za svako vozilo u svakom koraku.
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi]! - cum[lo]!;
  const t = seg === 0 ? 0 : (s - cum[lo]!) / seg;
  return lerp(points[lo]!, points[hi]!, t);
}

/** Smjer kretanja na dužini `s` (jedinični vektor). */
export function headingAt(points: readonly Point[], cum: readonly number[], s: number): Point {
  const total = cum[cum.length - 1] ?? 0;
  const eps = Math.min(0.5, Math.max(0.01, total * 0.001));
  const a = pointAt(points, cum, Math.max(0, s - eps));
  const b = pointAt(points, cum, Math.min(total, s + eps));
  return norm(sub(b, a));
}

/**
 * Presjek dvije duži. Vraća `null` kad se ne sijeku ili su paralelne.
 * Vraća i parametre `ta`/`tb` u [0,1] da se može izračunati `s` na obje.
 */
export function segmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): { point: Point; ta: number; tb: number } | null {
  const d1 = sub(p2, p1);
  const d2 = sub(p4, p3);
  const den = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(den) < 1e-9) return null; // paralelne ili degenerisane

  const d3 = sub(p3, p1);
  const ta = (d3.x * d2.y - d3.y * d2.x) / den;
  const tb = (d3.x * d1.y - d3.y * d1.x) / den;
  if (ta < 0 || ta > 1 || tb < 0 || tb > 1) return null;

  return { point: add(p1, scale(d1, ta)), ta, tb };
}

// ── Sudar vozila ────────────────────────────────────────────────────────────

/** Četiri tjemena orijentisanog pravougaonika. */
export function rectCorners(center: Point, heading: Point, length: number, width: number): Point[] {
  const f = scale(heading, length / 2);
  const r = scale(right(heading), width / 2);
  return [
    add(add(center, f), r),
    add(sub(center, f), r),
    sub(sub(center, f), r),
    sub(add(center, f), r),
  ];
}

/**
 * Da li se dva konveksna poligona preklapaju — teorema o razdvajajućoj osi.
 *
 * Za pravougaonike je dovoljno provjeriti četiri ose (po dvije normale svakog),
 * ali se ovdje ide kroz sve ivice — jeftino je, a radi za bilo koji konveksan
 * oblik ako kasnije zatreba.
 */
export function polygonsOverlap(a: readonly Point[], b: readonly Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]!;
      const p2 = poly[(i + 1) % poly.length]!;
      const axis = norm({ x: -(p2.y - p1.y), y: p2.x - p1.x });

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of a) {
        const d = dot(p, axis);
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of b) {
        const d = dot(p, axis);
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA < minB || maxB < minA) return false; // našli smo razdvajajuću osu
    }
  }
  return true;
}

/**
 * Deterministički generator slučajnih brojeva (mulberry32).
 *
 * Postoji da bi isti scenario sa istim sjemenom dao **identičnu** simulaciju —
 * bez toga nema ni ponavljanja snimka ni testova koji nešto tvrde.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
