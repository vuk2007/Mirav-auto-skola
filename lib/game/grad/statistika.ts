/**
 * Statistika slobodne vožnje (faza 6, stavka 9; zadatak, odjeljak 7): pređeni
 * kilometri, prekršaji i „čiste minute" — minuti vožnje bez ijednog
 * prekršaja — i dnevni zbir.
 *
 * Minut se broji samo dok auto vozi (brže od `GRAD_STAT_VOZI`): stajanje na
 * semaforu ne pravi čiste minute. Dnevni zbir je udobnost jednog igrača, pa
 * stoji u pregledaču (localStorage), bez obaveze da preživi.
 */
import { GRAD_STAT_VOZI } from "../sim/config";

export interface StatistikaVoznje {
  /** Pređeno [m]. */
  metara: number;
  prekrsaja: number;
  /** Završeni minuti vožnje bez prekršaja. */
  cisteMinute: number;
  /** Uzastopni čisti minuti, do sada (prekršaj vraća na 0). */
  niz: number;
  /** Sekundi vožnje u minutu koji teče, i da li je u njemu bilo prekršaja. */
  uMinuti: number;
  prekrsajUMinuti: boolean;
}

export const novaStatistika = (): StatistikaVoznje => ({ metara: 0, prekrsaja: 0, cisteMinute: 0, niz: 0, uMinuti: 0, prekrsajUMinuti: false });

/** Korak: `v` brzina auta [m/s], `dt` [s], `novih` prekršaja u ovom koraku. */
export function korakStatistike(s: StatistikaVoznje, v: number, dt: number, novih: number): void {
  s.metara += Math.abs(v) * dt;
  if (novih > 0) {
    s.prekrsaja += novih;
    s.prekrsajUMinuti = true;
    s.niz = 0;
  }
  if (Math.abs(v) < GRAD_STAT_VOZI) return;
  s.uMinuti += dt;
  if (s.uMinuti >= 60) {
    s.uMinuti -= 60;
    if (!s.prekrsajUMinuti) {
      s.cisteMinute += 1;
      s.niz += 1;
    }
    s.prekrsajUMinuti = false;
  }
}

export interface DanVoznje {
  km: number;
  cisteMinute: number;
  prekrsaja: number;
}

const kljucDana = (d: Date) =>
  `mirav:grad:dan:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Današnji zbir (lokalni datum); nule kad ga nema ili se ne može pročitati. */
export function procitajDan(d = new Date()): DanVoznje {
  try {
    const x = JSON.parse(window.localStorage.getItem(kljucDana(d)) ?? "null") as Partial<DanVoznje> | null;
    return { km: Number(x?.km) || 0, cisteMinute: Number(x?.cisteMinute) || 0, prekrsaja: Number(x?.prekrsaja) || 0 };
  } catch {
    return { km: 0, cisteMinute: 0, prekrsaja: 0 };
  }
}

/** Dodaje razliku današnjem zbiru; vraća novi zbir (i kad upis ne uspije). */
export function dodajDanu(razlika: DanVoznje, d = new Date()): DanVoznje {
  const x = procitajDan(d);
  const novo = { km: x.km + razlika.km, cisteMinute: x.cisteMinute + razlika.cisteMinute, prekrsaja: x.prekrsaja + razlika.prekrsaja };
  try {
    window.localStorage.setItem(kljucDana(d), JSON.stringify(novo));
  } catch {
    // Privatni prozor, puna memorija: zbir živi samo dok je ekran otvoren.
  }
  return novo;
}
