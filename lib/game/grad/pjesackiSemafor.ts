import {
  GRAD_PJ_SEMAFOR_PJESACI,
  GRAD_PJ_SEMAFOR_VOZILA,
  GRAD_PJ_SEMAFOR_ZAVRSI,
  GRAD_PJESACKI_SEMAFOR_PRELAZ,
  GRAD_SEMAFOR_KRAKA_DO,
  GRAD_SEMAFOR_SVE_CRVENO,
  GRAD_SEMAFOR_ZUTO,
  GRAD_STOP_ISPRED_ZEBRE,
  GRAD_ZEBRA_DUBINA,
} from "../sim/config";
import type { Point } from "../sim/types";
import type { Svjetlo } from "./raskrsnica";
import { BEZ, type Paket } from "./paket";

/**
 * Pješački semafor na sredini ulice (stavka 8, odluka korisnika 2026-10-08):
 * OSM semafor uz zebru koji nije semafor nijedne raskrsnice
 * (`Raskrsnice.semaforiRaskrsnica`). Vozila imaju zeleno, pa žuto i crveno,
 * dok pješaci prelaze; prolazak na crveno je `redLightPedestrian`.
 *
 * Ciklus (vidi `GRAD_PJ_SEMAFOR_*`): zeleno za vozila, žuto, sve crveno,
 * zeleno za pješake, trepćuće zeleno za pješake (ko je na prelazu završava),
 * sve crveno. Pomak ciklusa je iz broja OSM objekta — semafori nisu u taktu.
 */
export interface PjesackiSemafor {
  ivica: number;
  /** Sredina zebre na ivici, `s` od `a` [m]. */
  s: number;
  ciklus: number;
  pomak: number;
  /** Stop-linija za vožnju `a → b` i `b → a`: `s` na ivici [m]. */
  linijaNaprijed: number;
  linijaNazad: number;
}

/** Trajanje ciklusa pješačkog semafora [s]. */
export const CIKLUS_PJESACKOG =
  GRAD_PJ_SEMAFOR_VOZILA + GRAD_SEMAFOR_ZUTO + 2 * GRAD_SEMAFOR_SVE_CRVENO + GRAD_PJ_SEMAFOR_PJESACI + GRAD_PJ_SEMAFOR_ZAVRSI;

/** Deterministički broj iz cijelog broja — pomak ciklusa. */
function hes(x: number): number {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Pješački semafori grada: OSM semafor na ivici koji raskrsnice ne koriste,
 * uz obilježenu zebru (`zebre`) na istoj ivici, do `GRAD_PJESACKI_SEMAFOR_PRELAZ`
 * — i dalje od `GRAD_SEMAFOR_KRAKA_DO` od svakog čvora semaforisane
 * raskrsnice (`cvoroviSaSemaforom`): bliže je to drugi semafor iste
 * raskrsnice (npr. na izlaznom kraku), ne pješački.
 */
export function pjesackiSemafori(
  p: Paket,
  semaforiRaskrsnica: ReadonlySet<number>,
  zebre: ReadonlyMap<number, number[]>,
  cvoroviSaSemaforom: readonly Point[],
): PjesackiSemafor[] {
  const n = p.n;
  const vrsta = p.zaglavlje.vrsteObjekata.indexOf("traffic_signals");
  const out: PjesackiSemafor[] = [];
  for (let o = 0; o < n.obVrsta.length; o++) {
    if (n.obVrsta[o] !== vrsta || n.obIvica[o] === BEZ || semaforiRaskrsnica.has(o)) continue;
    const x = n.obXY[2 * o]!;
    const y = n.obXY[2 * o + 1]!;
    if (cvoroviSaSemaforom.some((c) => Math.hypot(c.x - x, c.y - y) <= GRAD_SEMAFOR_KRAKA_DO)) continue;
    const ivica = n.obIvica[o]!;
    const s0 = n.obS[o]!;
    const zebra = (zebre.get(ivica) ?? []).filter((z) => Math.abs(z - s0) <= GRAD_PJESACKI_SEMAFOR_PRELAZ).sort((a, b) => Math.abs(a - s0) - Math.abs(b - s0))[0];
    if (zebra === undefined) continue;
    // Dva OSM semafora (po jedan za svaki smjer) uz istu zebru: jedan semafor.
    if (out.some((x) => x.ivica === ivica && Math.abs(x.s - zebra) < 0.5)) continue;
    const odZebre = GRAD_ZEBRA_DUBINA / 2 + GRAD_STOP_ISPRED_ZEBRE;
    out.push({
      ivica,
      s: zebra,
      ciklus: CIKLUS_PJESACKOG,
      pomak: hes(o + 7) % CIKLUS_PJESACKOG,
      linijaNaprijed: zebra - odZebre,
      linijaNazad: zebra + odZebre,
    });
  }
  return out;
}

const uCiklusu = (p: PjesackiSemafor, t: number) => (((t + p.pomak) % p.ciklus) + p.ciklus) % p.ciklus;

/** Svjetlo pješačkog semafora za vozila. */
export function svjetloZaVozila(p: PjesackiSemafor, t: number): Svjetlo {
  const u = uCiklusu(p, t);
  if (u < GRAD_PJ_SEMAFOR_VOZILA) return "zeleno";
  if (u < GRAD_PJ_SEMAFOR_VOZILA + GRAD_SEMAFOR_ZUTO) return "zuto";
  return "crveno";
}

/**
 * Svjetlo za pješake: „zeleno" (smije se krenuti), „zavrsi" (trepće — ko je
 * na prelazu završava, novi ne kreću) ili „crveno"; i koliko [s] još traje
 * zeleno (0 kad nije zeleno).
 */
export interface SvjetloPjesaka {
  stanje: "zeleno" | "zavrsi" | "crveno";
  preostalo: number;
}

export function svjetloZaPjesake(p: PjesackiSemafor, t: number): SvjetloPjesaka {
  const u = uCiklusu(p, t);
  const od = GRAD_PJ_SEMAFOR_VOZILA + GRAD_SEMAFOR_ZUTO + GRAD_SEMAFOR_SVE_CRVENO;
  if (u >= od && u < od + GRAD_PJ_SEMAFOR_PJESACI) return { stanje: "zeleno", preostalo: od + GRAD_PJ_SEMAFOR_PJESACI - u };
  if (u >= od + GRAD_PJ_SEMAFOR_PJESACI && u < od + GRAD_PJ_SEMAFOR_PJESACI + GRAD_PJ_SEMAFOR_ZAVRSI) return { stanje: "zavrsi", preostalo: 0 };
  return { stanje: "crveno", preostalo: 0 };
}
