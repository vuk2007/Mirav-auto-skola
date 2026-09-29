/**
 * Raskrsnice sa sporednim putem: ko skreće, ko čeka, i gdje su dok nisu u traci.
 *
 * Zadatak: „Sporedne raskrsnice na magistrali: NPC ulazi i izlazi na svakoj,
 * sa vjerovatnoćom po nivou". Mjesta raskrsnica dolaze iz OSM-a (vidi
 * `road/prikljucci.ts`); ovdje je ponašanje.
 *
 * Tri odluke koje drže sve ostalo jednostavnim:
 *
 *  1. SAMO DESNO. Sa naše trake se skreće u put na desnoj strani, sa susretne u
 *     put na lijevoj — obje su skretanja udesno. Isto i za uključivanje.
 *     Skretanje ulijevo presijeca drugu traku i traži prvenstvo prema
 *     susretnom saobraćaju, a to na otvorenom putu ove igre nije ono što se
 *     uči; na raskrsnicama u gradu se uči.
 *  2. VAN TRAKE, U ZASEBNOM NIZU. Vozilo koje čeka na sporednom putu, ili je
 *     upravo skrenulo, nije u `world.vehicles` nego u `world.naSporednom`. Tako
 *     nijedno pravilo o traci, odstojanju i sudaru ne mora da zna za njega, a
 *     igrač do njega i ne može: sporedni put počinje iza bankine.
 *  3. PRAVILA SE POŠTUJU. Skretanje se najavljuje pokazivačem i blagim
 *     usporavanjem (`PRIKLJUCAK_USPORENJE`) — naglo kočenje bez opasnosti zakon
 *     ne dozvoljava. Ko se uključuje, nema prednost: čeka dok svako ko prilazi,
 *     i igrač u bilo kojoj traci, ne bude dalje od `PRIKLJUCAK_PRAZNINA`.
 *
 * Sve odluke su iz sjemena i rednih brojeva — ista vožnja, iste odluke.
 */

import {
  PRIKLJUCAK_BRZINA,
  PRIKLJUCAK_IZLAZ,
  PRIKLJUCAK_ULAZ,
  PRIKLJUCAK_USPORENJE,
  SHOULDER_WIDTH,
  VOZILA,
  type Level,
} from "./config";
import { headingAt, pointAt, right, valueAt } from "./geometry";
import { izvlacenje } from "./tok";
import type { Path, Point, Prikljucak, VoziloNaSporednom, VrstaVozila } from "./types";

/**
 * Koliko ispred raskrsnice (u smjeru vožnje) vozilo završi skretanje u traku,
 * odnosno počne skretanje iz nje [m] — poluprečnik luka.
 */
export const LUK = 8;

/** Koliko je vozilo koje čeka odmaknuto od spoljne ivice bankine [m]. */
const IZA_BANKINE = 0.5;

/**
 * Najduže vozilo koje skreće u sporedni put ili izlazi iz njega [m].
 *
 * Kamion i autobus u seoski put ne skreću, a ni ne crtaju se valjano na luku
 * od osam metara — tijelo im je u traci iz komada, a na luku bi bilo jedan
 * pravougaonik preko ivice.
 */
export const NAJDUZE_SKRECE = 7;

/** Traka koju raskrsnica opslužuje: sa desne strane naša, sa lijeve susretna. */
export const trakaPrikljucka = (p: Prikljucak): 0 | 1 => (p.strana === "desno" ? 0 : 1);

/** Da li na raskrsnici `j` čeka vozilo koje se uključuje. */
export function cekaNa(seed: number, nivo: Level, j: number): boolean {
  return izvlacenje(seed, "c", j)() < PRIKLJUCAK_ULAZ[nivo];
}

/**
 * Da li na raskrsnici `j` jedno vozilo skreće. Koje — odlučuje ko prvi stigne,
 * dok je raskrsnica u kadru igrača; vidi `skretanje` u `world.ts`.
 */
export function skreceNa(seed: number, nivo: Level, j: number): boolean {
  return izvlacenje(seed, "i", j)() < PRIKLJUCAK_IZLAZ[nivo];
}

/** Vrsta vozila koje se uključuje: dugačko postaje kombi — vidi `NAJDUZE_SKRECE`. */
export const vrstaZaSporedni = (v: VrstaVozila): VrstaVozila =>
  VOZILA[v].duzina > NAJDUZE_SKRECE ? "kombi" : v;

/**
 * Najveća brzina na `d` metara pred mjestom skretanja [m/s].
 *
 * Profil po kojem se stiže na `PRIKLJUCAK_BRZINA` usporavajući ne jače od
 * dijela `PRIKLJUCAK_USPORENJE` — ostatak je zaliha, pa se kočiti počne malo
 * ranije nego što bi se moralo.
 */
export function brzinaDoSkretanja(d: number): number {
  const a = PRIKLJUCAK_USPORENJE * 0.8;
  return Math.sqrt(PRIKLJUCAK_BRZINA * PRIKLJUCAK_BRZINA + 2 * a * Math.max(0, d));
}

/** Koliko metara pred skretanjem se kočiti mora početi, sa brzine `v` [m]. */
export function putDoSkretanja(v: number): number {
  const a = PRIKLJUCAK_USPORENJE * 0.8;
  return Math.max(0, (v * v - PRIKLJUCAK_BRZINA * PRIKLJUCAK_BRZINA) / (2 * a));
}

// ── geometrija ─────────────────────────────────────────────────────────────

/** Tačka i smjer na osi naše trake pomjereni poprečno za `bocno` metara (+ desno). */
function naOsi(nasa: Path, s: number, bocno: number): { pos: Point; heading: Point } {
  const x = Math.min(nasa.length, Math.max(0, s));
  const osa = pointAt(nasa.points, nasa.cum, x);
  const heading = headingAt(nasa.points, nasa.cum, x);
  const d = right(heading);
  return { pos: { x: osa.x + d.x * bocno, y: osa.y + d.y * bocno }, heading };
}

/** Ivica kolovoza na strani raskrsnice, mjereno od ose naše trake (+ desno) [m]. */
function ivica(nasa: Path, p: Prikljucak, laneWidth: number): number {
  const niz = p.strana === "desno" ? nasa.doIvice : nasa.doPreko;
  const mjera = niz ? valueAt(nasa.cum, niz, p.s) : p.strana === "desno" ? laneWidth / 2 : laneWidth * 1.5;
  return p.strana === "desno" ? mjera : -mjera;
}

/** Osa trake raskrsnice, poprečno od ose naše trake [m]. */
const osaTrake = (p: Prikljucak, laneWidth: number): number =>
  trakaPrikljucka(p) === 0 ? 0 : -laneWidth;

/** Smjer vožnje trake raskrsnice duž našeg `s`: naša napred, susretna nazad. */
const smjerTrake = (p: Prikljucak): 1 | -1 => (trakaPrikljucka(p) === 0 ? 1 : -1);

/**
 * Sporedni put kao geometrija: ušće na ivici kolovoza, pravac od puta i
 * širina. Isto čitaju i crtanje i položaj vozila na njemu.
 */
export function sporedniPut(
  nasa: Path,
  p: Prikljucak,
  laneWidth: number,
): { usce: Point; van: Point; uzduz: Point } {
  const e = ivica(nasa, p, laneWidth);
  const { pos, heading } = naOsi(nasa, p.s, e);
  const d = right(heading);
  const znak = p.strana === "desno" ? 1 : -1;
  return { usce: pos, van: { x: d.x * znak, y: d.y * znak }, uzduz: heading };
}

/** Gdje stoji sredina vozila koje čeka na liniji, duž sporednog puta [m]. */
export const naLiniji = (vrsta: VrstaVozila): number =>
  SHOULDER_WIDTH + IZA_BANKINE + VOZILA[vrsta].duzina / 2;

/** Kvadratna Bezijeova kriva i njen smjer u tački `f`. */
function bezije(a: Point, b: Point, c: Point, f: number): { pos: Point; heading: Point } {
  const g = 1 - f;
  const pos = {
    x: g * g * a.x + 2 * g * f * b.x + f * f * c.x,
    y: g * g * a.y + 2 * g * f * b.y + f * f * c.y,
  };
  const dx = 2 * g * (b.x - a.x) + 2 * f * (c.x - b.x);
  const dy = 2 * g * (b.y - a.y) + 2 * f * (c.y - b.y);
  const n = Math.hypot(dx, dy) || 1;
  return { pos, heading: { x: dx / n, y: dy / n } };
}

/** Dužina luka skretanja, približno [m] — po njoj se `f` pomjera brzinom. */
export function duzinaLuka(nasa: Path, p: Prikljucak, laneWidth: number, vrsta: VrstaVozila): number {
  const { usce } = sporedniPut(nasa, p, laneWidth);
  const kut = naOsi(nasa, p.s, osaTrake(p, laneWidth)).pos;
  const dUsce = Math.hypot(usce.x - kut.x, usce.y - kut.y);
  return LUK + dUsce + naLiniji(vrsta);
}

/**
 * Mjesto u traci na kojem se luk skretanja sastaje sa trakom [m naše trake].
 *
 * Uključivanje tu završava, skretanje tu počinje: `LUK` metara iza raskrsnice
 * u smjeru trake za uključivanje, `LUK` metara prije nje za skretanje.
 */
export const krajLuka = (p: Prikljucak, faza: "ulazi" | "odlazi"): number =>
  p.s + (faza === "ulazi" ? 1 : -1) * smjerTrake(p) * LUK;

/**
 * Položaj i smjer vozila na sporednom putu — za crtanje.
 *
 * Čeka: na liniji, okrenuto ka putu. Uključuje se: luk od linije do ose
 * trake. Odlazi: luk od ose trake do ušća, pa pravo niz sporedni put.
 */
export function pozaNaSporednom(
  nasa: Path,
  p: Prikljucak,
  laneWidth: number,
  x: Pick<VoziloNaSporednom, "faza" | "u" | "vrsta" | "f">,
): { pos: Point; heading: Point } {
  const { usce, van } = sporedniPut(nasa, p, laneWidth);
  const linija = naLiniji(x.vrsta);
  const naLin = { x: usce.x + van.x * linija, y: usce.y + van.y * linija };
  const osaTr = osaTrake(p, laneWidth);
  const kut = naOsi(nasa, p.s, osaTr).pos;

  if (x.faza === "ceka") return { pos: naLin, heading: { x: -van.x, y: -van.y } };
  if (x.faza === "ulazi") {
    const kraj = naOsi(nasa, krajLuka(p, "ulazi"), osaTr).pos;
    return bezije(naLin, kut, kraj, Math.min(1, Math.max(0, x.f ?? 0)));
  }
  // Odlazi: luk do mjesta malo iza ušća, pa pravo.
  const pocetak = naOsi(nasa, krajLuka(p, "odlazi"), osaTr).pos;
  const izaUsca = { x: usce.x + van.x * 3, y: usce.y + van.y * 3 };
  if ((x.f ?? 0) < 1) return bezije(pocetak, kut, izaUsca, Math.max(0, x.f ?? 0));
  return { pos: { x: izaUsca.x + van.x * x.u, y: izaUsca.y + van.y * x.u }, heading: van };
}
