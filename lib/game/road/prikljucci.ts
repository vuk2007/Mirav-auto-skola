/**
 * Raskrsnice sa sporednim putem, od OSM podatka do mjesta na putu koji se vozi.
 *
 * Skripta (`scripts/osm/lib/prikljucci.mjs`) bilježi mjesto u metrima STVARNOG
 * puta, u smjeru ivice. Ovdje se to okreće u smjer vožnje i preslikava istim
 * preslikavanjem kojim je put sabijen — kao i znamenitosti, jer se sabijanje
 * duž puta mijenja i proporcija bi raskrsnicu sa izlaza iz kanjona spustila
 * nasred pravca.
 */

import { PRIKLJUCAK_PUNA_LINIJA, PRIKLJUCAK_RAZMAK } from "../sim/config";
import type { Prikljucak } from "../sim/types";
import type { EdgeGeometry } from "./edgeGeometry";
import type { Sabijeno } from "./sabijanje";

/** Redoslijed vrsta puta, od najkrupnijeg. */
const RED = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential"];

/** Koji je od dva puta krupniji. Nepoznata vrsta je najsitnija. */
const krupniji = (a: string, b: string): boolean => {
  const i = RED.indexOf(a);
  const j = RED.indexOf(b);
  return (i < 0 ? RED.length : i) < (j < 0 ? RED.length : j);
};

/** Da li je pred raskrsnicom sa ovim putem razdjelna linija puna. */
export const punaPred = (p: Prikljucak): boolean => PRIKLJUCAK_PUNA_LINIJA.includes(p.rang);

/**
 * Raskrsnice ivice na sabijenoj dionici, u smjeru vožnje.
 *
 * `s` je od početka OVE vožnje, kao i `Sabijeno.uSabijeni`; u povratku se i
 * strana okreće — put koji je u odlasku lijevo, u povratku je desno.
 */
export function prikljucciIvice(geom: EdgeGeometry, sabijeno: Sabijeno, obrnuto: boolean): Prikljucak[] {
  const duz = geom.duzinaM;
  if (!geom.prikljucci || duz <= 0) return [];
  return geom.prikljucci
    .map((p): Prikljucak => {
      const naIvici = obrnuto ? duz - p.s : p.s;
      const strana = obrnuto ? (p.strana === "lijevo" ? "desno" : "lijevo") : p.strana;
      return {
        s: sabijeno.uSabijeni((naIvici / duz) * sabijeno.stvarnaDuzina),
        strana,
        rang: p.rang,
      };
    })
    .sort((a, b) => a.s - b.s);
}

/**
 * Proređivanje: dvije raskrsnice na istoj strani bliže od `razmak` postaju
 * jedna, i ostaje krupniji put.
 *
 * Strane se ne miješaju: put lijevo i put desno na istom mjestu su jedna
 * raskrsnica u obliku krsta, i obje strane postoje.
 */
export function prorijedi(niz: readonly Prikljucak[], razmak = PRIKLJUCAK_RAZMAK): Prikljucak[] {
  const out: Prikljucak[] = [];
  const zadnja: Record<"lijevo" | "desno", Prikljucak | null> = { lijevo: null, desno: null };
  for (const p of [...niz].sort((a, b) => a.s - b.s)) {
    const z = zadnja[p.strana];
    if (z && p.s - z.s < razmak) {
      if (krupniji(p.rang, z.rang)) z.rang = p.rang;
      continue;
    }
    const nova = { ...p };
    out.push(nova);
    zadnja[p.strana] = nova;
  }
  return out;
}
