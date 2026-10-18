/**
 * Ispitna ruta u gradu (faza 6, stavka 9c; zadatak, odjeljak 7): ruta iz
 * editora (start, obavezne tačke redom, cilj), vožnja po njoj pod sudijom, i
 * zapisnik ispita po stavkama.
 *
 * Odluke korisnika: rute samo iz editora (2026-10-15), kao prave ispitne rute
 * u Podgorici — sa istog starta kod teniskih terena uz školu „Ivan Uskoković"
 * (2026-10-17). Pada se na bilo koji teži prekršaj ili na više od
 * `GRAD_ISPIT_LAKSIH` lakših; zapisnik grupiše greške po stavkama.
 */
import { GRAD_ISPIT_LAKSIH, GRAD_ISPIT_TACKA } from "../sim/config";
import type { Point } from "../sim/types";
import { mjestoAuta, rutaKroz, type MjestoNaMrezi, type Navigacija, type RutaDo } from "./navigacija";
import type { Odrediste } from "./odredista";
import type { SidroUlice, Zadatak } from "./overlay";
import type { GradskiPrekrsaj, VrstaGradskogPrekrsaja } from "./sudija";
import type { SvijetGrada } from "./svijet";

export type StavkaIspita = "raskrsnice" | "brzina" | "znakovi" | "pjesaci" | "polozaj" | "manevri";

export const STAVKE_ISPITA: readonly StavkaIspita[] = ["raskrsnice", "brzina", "znakovi", "pjesaci", "polozaj", "manevri"];

/** Stavka zapisnika za svaku vrstu prekršaja. */
export const STAVKA_PREKRSAJA: Readonly<Record<VrstaGradskogPrekrsaja, StavkaIspita>> = {
  // Raskrsnice i prvenstvo.
  rightOfWay: "raskrsnice",
  collision: "raskrsnice",
  busDeparture: "raskrsnice",
  emergencyVehicle: "raskrsnice",
  // Brzina.
  speeding: "brzina",
  // Znakovi, svjetla i oznake na putu.
  redLight: "znakovi",
  stopSign: "znakovi",
  wrongWay: "znakovi",
  zabranaSkretanja: "znakovi",
  crossingSolidLine: "znakovi",
  // Pješaci.
  pedestrianRightOfWay: "pjesaci",
  redLightPedestrian: "pjesaci",
  pedestrianCollision: "pjesaci",
  // Položaj na putu i trake.
  wrongSide: "polozaj",
  wrongLaneForTurn: "polozaj",
  laneDisciplineRoundabout: "polozaj",
  busLane: "polozaj",
  // Manevri: pokazivači, okretanje, zaustavljanje i parkiranje.
  indicatorMissing: "manevri",
  indicatorWrong: "manevri",
  indicatorLate: "manevri",
  indicatorLeftOn: "manevri",
  polukruzno: "manevri",
  parkingViolation: "manevri",
};

export interface ZapisnikIspita {
  stavke: { stavka: StavkaIspita; laksih: number; teskih: number; prekrsaji: GradskiPrekrsaj[] }[];
  laksih: number;
  teskih: number;
  polozio: boolean;
}

/** Zapisnik: prekršaji po stavkama, i da li je položio. */
export function zapisnikIspita(prekrsaji: readonly GradskiPrekrsaj[]): ZapisnikIspita {
  const stavke = STAVKE_ISPITA.map((stavka) => {
    const lista = prekrsaji.filter((p) => STAVKA_PREKRSAJA[p.vrsta] === stavka);
    const teskih = lista.filter((p) => p.ozbiljnost === "fail").length;
    return { stavka, laksih: lista.length - teskih, teskih, prekrsaji: lista };
  });
  const laksih = stavke.reduce((a, x) => a + x.laksih, 0);
  const teskih = stavke.reduce((a, x) => a + x.teskih, 0);
  return { stavke, laksih, teskih, polozio: teskih === 0 && laksih <= GRAD_ISPIT_LAKSIH };
}

/** Mjesto sidra iz editora u mreži: ulica i smjer po pravcu sidra. */
export function mjestoSidra(sv: SvijetGrada, s: SidroUlice): MjestoNaMrezi | null {
  return mjestoAuta(sv, s.x, s.y, Math.atan2(s.hy, s.hx));
}

/** Ispitne rute grada: zadaci vrste „ispitna" iz overlay-a. */
export const ispitneRute = (zadaci: readonly Zadatak[]): Zadatak[] => zadaci.filter((z) => z.vrsta === "ispitna");

/** Cilj ispita kao odredište (za navigaciju): ulica i mjesto cilja. */
function ciljIspita(z: Zadatak, cilj: MjestoNaMrezi): Odrediste {
  const p: Point = { x: z.cilj.x, y: z.cilj.y };
  return { id: -1, ime: z.ime, kategorija: "ustanova", tacka: p, ulaz: p, ivica: cilj.korak.ivica, s: cilj.s };
}

/** Obavezne tačke i cilj ispita, redom, u mreži; `null` kad neka nije na voznoj ulici. */
export function meteIspita(sv: SvijetGrada, z: Zadatak): MjestoNaMrezi[] | null {
  const mete = [...z.tacke, z.cilj].map((s) => mjestoSidra(sv, s));
  return mete.every((m) => m !== null) ? (mete as MjestoNaMrezi[]) : null;
}

/** Ruta ispita od starta kroz sve obavezne tačke do cilja. */
export function rutaIspita(sv: SvijetGrada, z: Zadatak): RutaDo | null {
  const start = mjestoSidra(sv, z.start);
  const mete = meteIspita(sv, z);
  if (!start || !mete) return null;
  return rutaKroz(sv, start, mete, ciljIspita(z, mete[mete.length - 1]!));
}

/**
 * Nova ruta kad je igrač otišao sa ispitne: od mjesta auta kroz obavezne
 * tačke koje još nije prošao (`predjeno` ih je prošao), do cilja.
 */
export function rutaIspitaOd(sv: SvijetGrada, z: Zadatak, x: number, y: number, ugao: number, predjeno: number): RutaDo | null {
  const start = mjestoAuta(sv, x, y, ugao);
  const mete = meteIspita(sv, z);
  if (!start || !mete) return null;
  return rutaKroz(sv, start, mete.slice(Math.min(predjeno, mete.length - 1)), ciljIspita(z, mete[mete.length - 1]!));
}

/**
 * Koliko je obaveznih tačaka (bez cilja) pređeno na ovoj ruti: one do kojih
 * je auto po ruti stigao. `vecRanije` — pređene prije nove rute.
 */
export function predjeneTacke(nav: Navigacija, vecRanije: number, ukupnoTacaka: number): number {
  const naRuti = nav.ruta.mete.slice(0, -1).filter((s) => nav.s >= s - GRAD_ISPIT_TACKA).length;
  return Math.min(ukupnoTacaka, vecRanije + naRuti);
}
