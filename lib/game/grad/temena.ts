import { GRAD_SJENKA_DUZINA, GRAD_SJENKA_PRAVAC } from "../sim/config";
import type { Point } from "../sim/types";

/**
 * Temena za grafički čip, zajednička zgradama i dekoru (faza 6, stavka 4):
 * položaj, visina (po kojoj vertex shader naginje teme u lažnom 2.5D), boja,
 * i metri duž zida za prozore.
 */

export const uPoligonu = (t: readonly Point[], x: number, y: number): boolean => {
  let u = false;
  for (let i = 0, j = t.length - 1; i < t.length; j = i++) {
    const a = t[i]!;
    const b = t[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) u = !u;
  }
  return u;
};

export const izaberi = <T>(niz: readonly T[], r: () => number): T => niz[Math.floor(r() * niz.length) % niz.length]!;

/** Trouglovi prstena `[x0, y0, x1, y1, …]` → indeksi (Pixi `earcut`). */
export type Triangulacija = (ravno: number[]) => number[];

/**
 * Nizovi temena jednog sloja: položaj, visina (0 je tlo), boja (0–1) i indeksi
 * trouglova. Visina ide u shader, koji po njoj naginje teme.
 */
export interface Temena {
  polozaj: Float32Array;
  visina: Float32Array;
  boja: Float32Array;
  /**
   * Na zidu sa prozorima: metri duž zida od njegovog početka — shader po njima
   * i po visini crta prozore. `−1` za krov, detalje i zidove bez prozora.
   */
  zid: Float32Array;
  /** Sjeme zgrade u [0, 1) — koji prozori noću svijetle. 0 za dekor. */
  sjeme: Float32Array;
  indeksi: Uint32Array;
}

export class Graditelj {
  p: number[] = [];
  v: number[] = [];
  b: number[] = [];
  z: number[] = [];
  sj: number[] = [];
  i: number[] = [];
  /** Sjeme koje dobija svako sljedeće teme (vidi `Temena.sjeme`). */
  sjeme = 0;
  teme(x: number, y: number, h: number, boja: readonly [number, number, number], zid = -1): number {
    this.p.push(x, y);
    this.v.push(h);
    this.b.push(boja[0], boja[1], boja[2]);
    this.z.push(zid);
    this.sj.push(this.sjeme);
    return this.v.length - 1;
  }
  gotovo(): Temena {
    return {
      polozaj: new Float32Array(this.p),
      visina: new Float32Array(this.v),
      boja: new Float32Array(this.b),
      zid: new Float32Array(this.z),
      sjeme: new Float32Array(this.sj),
      indeksi: new Uint32Array(this.i),
    };
  }
}

export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
export const puta = (c: readonly [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Prizma: zidovi od visine `od` do `do_`, pa krov na `do_`. Zidovi se osvjetljavaju
 * po tome koliko gledaju ka suncu — strana u sjenci je tamnija. Sa `prozori`
 * zid nosi metre duž sebe, po kojima shader crta prozore.
 */
export function prizma(
  g: Graditelj,
  osnova: readonly Point[],
  od: number,
  do_: number,
  zid: readonly [number, number, number],
  krov: readonly [number, number, number],
  triangulisi: Triangulacija,
  prozori = false,
): void {
  const n = osnova.length;
  for (let k = 0; k < n; k++) {
    const a = osnova[k]!;
    const b = osnova[(k + 1) % n]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    // Osnova ide u smjeru kazaljke (`y` na jug): spoljna normala je lijevo od ivice.
    const nx = dy / d;
    const ny = -dx / d;
    // Sunce sija suprotno od pravca sjenke.
    const kaSuncu = -(nx * GRAD_SJENKA_PRAVAC.x + ny * GRAD_SJENKA_PRAVAC.y);
    const boja = puta(zid, 0.68 + 0.22 * Math.max(0, kaSuncu));
    const z0 = prozori ? 0 : -1;
    const z1 = prozori ? d : -1;
    const i0 = g.teme(a.x, a.y, od, boja, z0);
    const i1 = g.teme(b.x, b.y, od, boja, z1);
    const i2 = g.teme(b.x, b.y, do_, boja, z1);
    const i3 = g.teme(a.x, a.y, do_, boja, z0);
    g.i.push(i0, i1, i2, i0, i2, i3);
  }
  const ravno: number[] = [];
  for (const p of osnova) ravno.push(p.x, p.y);
  const prvi = g.v.length;
  for (const p of osnova) g.teme(p.x, p.y, do_, krov);
  for (const t of triangulisi(ravno)) g.i.push(prvi + t);
}

/** Pravougaonik `sirina × duzina` oko (`x`, `y`), okrenut za `ugao`, u smjeru kazaljke. */
export function pravougaonik(x: number, y: number, sirina: number, duzina: number, ugao: number): Point[] {
  const c = Math.cos(ugao);
  const s = Math.sin(ugao);
  return (
    [
      [-duzina / 2, -sirina / 2],
      [duzina / 2, -sirina / 2],
      [duzina / 2, sirina / 2],
      [-duzina / 2, sirina / 2],
    ] as const
  ).map(([u, w]) => ({ x: x + u * c - w * s, y: y + u * s + w * c }));
}

/**
 * Sjenka prizme visine `visina` na tlu: osnova povučena u pravcu sjenke —
 * osnova pomjerena za dužinu sjenke, i po četvorougao za svaku ivicu. Dijelovi
 * se preklapaju; crtač zato boji punom bojom, a providnost daje cijelom sloju
 * odjednom, da preklop ne bude tamniji.
 */
export function sjenkaPrizme(g: Graditelj, osnova: readonly Point[], visina: number, triangulisi: Triangulacija): void {
  const crna: [number, number, number] = [0, 0, 0];
  const sx = GRAD_SJENKA_PRAVAC.x * visina * GRAD_SJENKA_DUZINA;
  const sy = GRAD_SJENKA_PRAVAC.y * visina * GRAD_SJENKA_DUZINA;
  const n = osnova.length;
  for (let k = 0; k < n; k++) {
    const a = osnova[k]!;
    const b = osnova[(k + 1) % n]!;
    const i0 = g.teme(a.x, a.y, 0, crna);
    const i1 = g.teme(b.x, b.y, 0, crna);
    const i2 = g.teme(b.x + sx, b.y + sy, 0, crna);
    const i3 = g.teme(a.x + sx, a.y + sy, 0, crna);
    g.i.push(i0, i1, i2, i0, i2, i3);
  }
  const ravno: number[] = [];
  for (const p of osnova) ravno.push(p.x + sx, p.y + sy);
  const prvi = g.v.length;
  for (let k = 0; k < n; k++) g.teme(ravno[2 * k]!, ravno[2 * k + 1]!, 0, crna);
  for (const t of triangulisi(ravno)) g.i.push(prvi + t);
}

/** Konveksan poligon (lepeza) na visini `h` — krošnje, bez zidova. */
export function ploca(g: Graditelj, oblik: readonly Point[], h: number, boja: readonly [number, number, number]): void {
  const prvi = g.v.length;
  for (const p of oblik) g.teme(p.x, p.y, h, boja);
  for (let k = 1; k + 1 < oblik.length; k++) g.i.push(prvi, prvi + k, prvi + k + 1);
}
