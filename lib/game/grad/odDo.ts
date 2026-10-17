/**
 * „Vožnja od–do" (faza 6, stavka 9; zadatak, odjeljak 7): cilj nasumičan ili
 * izabran, navigacija do njega, bodovi po prekršajima i vremenu, tri težine.
 *
 * Bodovi (najviše 1000): vožnja bez prekršaja `GRAD_ODDO_PRAVILA` (upozorenje
 * i pad oduzimaju), plus vrijeme do `GRAD_ODDO_VRIJEME` — puno do
 * referentnog vremena, pa opada. Brzinom se ne dobija mnogo: prekoračenje je
 * prekršaj, a referentno vrijeme je vožnja po pravilima.
 */
import {
  GRAD_ODDO_FAIL,
  GRAD_ODDO_MINOR,
  GRAD_ODDO_PRAVILA,
  GRAD_ODDO_TEZINE,
  GRAD_ODDO_VRIJEME,
  GRAD_ODDO_ZVJEZDICE,
  type Level,
} from "../sim/config";
import type { Odrediste } from "./odredista";

export type Tezina = "lako" | "srednje" | "tesko";

export const TEZINE: readonly Tezina[] = ["lako", "srednje", "tesko"];

/** Nivo saobraćaja i sudije, dužina nasumične rute i referentna brzina po težini. */
export const tezina = (t: Tezina): { nivo: Level; odM: number; doM: number; brzina: number } => GRAD_ODDO_TEZINE[t];

export interface OcjenaOdDo {
  bodovi: number;
  pravila: number;
  vrijeme: number;
  zvjezdice: 0 | 1 | 2 | 3;
  /** Referentno vrijeme [s]. */
  referentno: number;
}

/** Ocjena vožnje: dužina rute [m], vrijeme [s], broj upozorenja i padova. */
export function ocjenaOdDo(t: Tezina, duzina: number, sekundi: number, upozorenja: number, padova: number): OcjenaOdDo {
  const referentno = duzina / tezina(t).brzina;
  const pravila = Math.max(0, GRAD_ODDO_PRAVILA - GRAD_ODDO_MINOR * upozorenja - GRAD_ODDO_FAIL * padova);
  const vrijeme = Math.round(GRAD_ODDO_VRIJEME * Math.min(1, referentno / Math.max(1, sekundi)));
  const bodovi = pravila + vrijeme;
  const zvjezdice = (GRAD_ODDO_ZVJEZDICE.filter((z) => bodovi >= z).length as 0 | 1 | 2 | 3);
  return { bodovi, pravila, vrijeme, zvjezdice, referentno };
}

/**
 * Nasumičan cilj za težinu: zračno rastojanje od auta u rasponu težine
 * (ruta je duža, ali raspon je dovoljno grub). Znamenitosti (spomenici) nisu
 * cilj dostave — odredište je ustanova ili objekat. `slucajno` — [0, 1).
 */
export function nasumicanCilj(odredista: readonly Odrediste[], x: number, y: number, t: Tezina, slucajno: () => number): Odrediste | null {
  const { odM, doM } = tezina(t);
  const kandidati = odredista.filter((o) => {
    if (o.kategorija === "znamenitost") return false;
    const d = Math.hypot(o.ulaz.x - x, o.ulaz.y - y);
    return d >= odM && d <= doM;
  });
  const lista = kandidati.length > 0 ? kandidati : odredista.filter((o) => o.kategorija !== "znamenitost");
  return lista.length > 0 ? lista[Math.floor(slucajno() * lista.length)]! : null;
}

/** Najbolji rezultat po cilju i težini (pregledač; udobnost, ne obaveza). */
const kljuc = (cilj: string, t: Tezina) => `mirav:grad:oddo:${t}:${cilj}`;

export function najbolji(cilj: string, t: Tezina): number | null {
  try {
    const v = window.localStorage.getItem(kljuc(cilj, t));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

/** Upis ako je bolji; vraća da li je novi najbolji. */
export function zapisiNajbolji(cilj: string, t: Tezina, bodovi: number): boolean {
  const prije = najbolji(cilj, t);
  if (prije !== null && prije >= bodovi) return false;
  try {
    window.localStorage.setItem(kljuc(cilj, t), String(bodovi));
  } catch {
    // Bez pamćenja — rezultat se samo prikaže.
  }
  return true;
}
