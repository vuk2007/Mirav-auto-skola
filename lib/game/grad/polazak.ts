/**
 * Polazak autobusa sa stajališta (faza 6, stavka 8c; odluka korisnika
 * 2026-10-13): u naselju se autobusu omogućava uključivanje u saobraćaj.
 * Vozilo iza autobusa koji daje lijevi žmigavac (ili tek kreće), u njegovoj
 * ili susjednoj traci, ne smije ga obići ako je moglo mirno stati kad se
 * žmigavac upalio. Ista geometrija za druge vozače (`saobracaj.ts`) i sudiju.
 */
import { GRAD_BUS_PROPUSTI_BOCNO } from "../sim/config";
import type { Point } from "../sim/types";

/** Autobus u polasku: tijelo i nivo ulice. */
export interface AutobusUPolasku {
  id: number;
  x: number;
  y: number;
  ugao: number;
  duzina: number;
  sirina: number;
  nivo: number;
}

/**
 * Vozilo (sredina, pravac, dužina) je iza autobusa koji polazi: isti smjer,
 * bočno do `GRAD_BUS_PROPUSTI_BOCNO` od njega, nos još iza njegovog zadnjeg
 * kraja (do 80 m). Vraća koliko je nos od zadnjeg kraja (u pravcu autobusa) i
 * gdje je zadnji kraj; `null` kad nije iza.
 */
export function izaAutobusa(b: AutobusUPolasku, x: number, y: number, ugao: number, duzina: number): { doZadnjeg: number; zadnji: Point } | null {
  const bx = Math.cos(b.ugao);
  const by = Math.sin(b.ugao);
  if (Math.cos(ugao) * bx + Math.sin(ugao) * by < 0.7) return null;
  if (Math.abs(-(x - b.x) * by + (y - b.y) * bx) > GRAD_BUS_PROPUSTI_BOCNO) return null;
  const zadnji = { x: b.x - bx * (b.duzina / 2), y: b.y - by * (b.duzina / 2) };
  const nx = x + Math.cos(ugao) * (duzina / 2);
  const ny = y + Math.sin(ugao) * (duzina / 2);
  const doZadnjeg = -((nx - zadnji.x) * bx + (ny - zadnji.y) * by);
  if (doZadnjeg < 0 || doZadnjeg > 80) return null;
  return { doZadnjeg, zadnji };
}
