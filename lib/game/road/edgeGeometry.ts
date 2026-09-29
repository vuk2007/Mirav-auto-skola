/**
 * Stvarna geometrija ivica grafa.
 *
 * Fajlovi u `public/data/osm/edgeGeometry/` prave skripte iz `scripts/osm/`.
 * Ovdje je samo oblik podatka i njegova provjera — učitavanje je stvar onoga ko
 * ga koristi, jer se u pregledaču ide preko `fetch`, a u testu se čita s diska.
 *
 * Koordinate su metri UTM 34N, ne stepeni. Vidi `scripts/osm/README.md`.
 */

import type { Point } from "../sim/types";

/** Šta skripta kaže o rezultatu traženja rute za jednu ivicu. */
export type GeometrijaStatus = "ok" | "duzinaNeSlaze" | "drugiKoridor" | "autoputUmjestoPuta";

export interface EdgeGeometry {
  id: string;
  a: string;
  b: string;
  status: GeometrijaStatus;
  /** Dužina po OSM-u [m]. */
  duzinaM: number;
  /** Dužina po grafu [km] — namjerno se čuvaju obje. */
  kmIzGrafa: number;
  odnos: number;
  oznake: string[];
  poRangu: Record<string, number>;
  tacaka: number;
  /** Osovina puta, `[x, y]` u metrima. */
  g: [number, number][];
  /**
   * Sporedni putevi koji izlaze na ivicu, u smjeru od `a` prema `b`.
   *
   * `s` je u metrima po istoj mjeri kao `duzinaM`. Nema ga u fajlovima
   * napravljenim prije nego što ga je skripta počela da bilježi.
   */
  prikljucci?: { s: number; strana: "lijevo" | "desno"; rang: string }[];
}

/** Tačke geometrije kao `Point[]`, u smjeru od `a` prema `b`. */
export function osovina(geom: EdgeGeometry, obrnuto = false): Point[] {
  const tacke = geom.g.map(([x, y]) => ({ x, y }));
  return obrnuto ? tacke.reverse() : tacke;
}

/**
 * Provjera oblika pročitanog fajla.
 *
 * Postoji zato što se ovi fajlovi generišu skriptom koja se pokreće ručno: ako
 * neko pokrene stariju verziju, ili fajl ostane od ranijeg grafa, bolje je da
 * se to vidi odmah nego da igra dobije praznu dionicu.
 */
export function parseGeometry(raw: unknown): EdgeGeometry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.a !== "string" || typeof v.b !== "string") return null;
  if (typeof v.duzinaM !== "number" || typeof v.kmIzGrafa !== "number") return null;
  if (!Array.isArray(v.g) || v.g.length < 2) return null;
  for (const t of v.g) {
    if (!Array.isArray(t) || t.length !== 2) return null;
    if (typeof t[0] !== "number" || typeof t[1] !== "number") return null;
  }
  if (v.prikljucci !== undefined) {
    if (!Array.isArray(v.prikljucci)) return null;
    for (const p of v.prikljucci as unknown[]) {
      if (typeof p !== "object" || p === null) return null;
      const q = p as Record<string, unknown>;
      if (typeof q.s !== "number" || typeof q.rang !== "string") return null;
      if (q.strana !== "lijevo" && q.strana !== "desno") return null;
    }
  }
  return raw as EdgeGeometry;
}
