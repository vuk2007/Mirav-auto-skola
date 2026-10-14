/**
 * Parkiranje drugih vozača uz desni ivičnjak (faza 6, stavka 7e).
 *
 * Odluke korisnika (2026-10-03 i 2026-10-08): vozilo parkira na cilju, samo u
 * stambenim i sporednim ulicama (`GRAD_PARK_KLASE`), bar
 * `GRAD_PARK_OD_RASKRSNICE` od raskrsnice i `GRAD_PARK_OD_ZEBRE` od zebre,
 * nikad na bulevaru ni na stajalištu, i samo gdje ulica ostaje dovoljno
 * široka: ko prolazi pored parkiranog auta, obilazi ga u svojoj polovini
 * ulice, uz `GRAD_PARK_OBILAZAK` od njega i `GRAD_PARK_DO_SREDINE` od
 * razdjelne linije. Naspram parkiranog se ne parkira — dvostruko suženje bi
 * tražilo da jedan čeka; ovako niko ne prelazi sredinu i niko ne čeka.
 *
 * Mjesto se bira (i zauzima) kad se vozilo pojavi, pa ga vozila koja dođu
 * poslije i ona koja su već na putu obilaze od tada — bočnim pomakom tačaka
 * svoje putanje (`obidji`). Dužina puta (`cum`) se ne mijenja: pomak je mali,
 * a sve što je vezano za `s` (linije, prolazi, žmigavci) ostaje gdje jeste.
 */
import {
  CAR_LENGTH,
  CAR_WIDTH,
  GRAD_PARK_DO_SREDINE,
  GRAD_PARK_KLASE,
  GRAD_PARK_NAGIB,
  GRAD_PARK_OBILAZAK,
  GRAD_PARK_OD_IVICNJAKA,
  GRAD_PARK_OD_RASKRSNICE,
  GRAD_PARK_OD_STAJALISTA,
  GRAD_PARK_OD_ZEBRE,
  GRAD_PARK_PRAVO,
  GRAD_PARK_PRILAZ,
  GRAD_PARK_PUNO,
  GRAD_PARK_RAZMAK,
  GRAD_PARK_ZMIGAVAC_PAUZA,
} from "../sim/config";
import { headingAt, pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { PlanBota } from "./botGrad";
import type { Ivica } from "./mreza";
import type { SvijetGrada } from "./svijet";

/** Dio ulice u smjeru vožnje na kojem se smije parkirati uz desni ivičnjak. */
export interface UlicaZaParkiranje {
  ivica: number;
  smjer: 1 | -1;
  /** Dozvoljene sredine parkiranog auta, `s` ivice (od `a`) — bez zebri i stajališta, vidi `slobodno`. */
  od: number;
  do_: number;
  /** Sredina ivice — za izbor cilja po udaljenosti. */
  x: number;
  y: number;
}

/** Zauzeto mjesto: auto je na putu do njega, ili već parkiran. */
export interface MjestoParkiranja {
  ivica: number;
  smjer: 1 | -1;
  /** Sredina parkiranog auta, `s` ivice (od `a`). */
  s: number;
  /** Sredina parkiranog auta i pravac vožnje (u smjeru `smjer`). */
  x: number;
  y: number;
  hx: number;
  hy: number;
  /** Vozilo kojem pripada (id); parkirano je kad je `parkirano`. */
  id: number;
  parkirano: boolean;
  /** Boja karoserije (kao vozilo koje je parkiralo). */
  boja: number;
}

/** Pomak sredine parkiranog auta od osovine ivice [m, + desno u smjeru vožnje]. */
function pomakParkiranog(iv: Ivica): number {
  return iv.sirina / 2 - GRAD_PARK_OD_IVICNJAKA - CAR_WIDTH / 2;
}

/** Bočni razmak (sredina do sredine) vozila koje prolazi od parkiranog [m]. */
const RAZMAK_OBILASKA = CAR_WIDTH + GRAD_PARK_OBILAZAK;

/** Polovina dužine dijela ulice na kojem se parkirani obilazi [m] (od sredine parkiranog). */
export const ZONA_OBILASKA = CAR_LENGTH / 2 + GRAD_PARK_PUNO + GRAD_PARK_NAGIB;

/**
 * Da li ulica ostaje dovoljno široka (odluka korisnika 2026-10-08): pored
 * parkiranog auta staje vozilo uz `GRAD_PARK_OBILAZAK` — u dvosmjernoj sa
 * jednom trakom po smjeru u svojoj polovini (do `GRAD_PARK_DO_SREDINE` od
 * razdjelnice), u jednosmjernoj uz rezervu do lijevog ivičnjaka.
 */
export function dovoljnoSiroka(iv: Ivica): boolean {
  const zauzeto = GRAD_PARK_OD_IVICNJAKA + CAR_WIDTH + RAZMAK_OBILASKA - CAR_WIDTH / 2;
  if (iv.smjer === 0) {
    if (iv.trakeNaprijed !== 1 || iv.trakeNazad !== 1) return false;
    return iv.sirina / 2 - zauzeto - CAR_WIDTH / 2 >= GRAD_PARK_DO_SREDINE - 1e-6;
  }
  // Jednosmjerna: kao `uUlici` kod bota — auto 0.3 m od ivičnjaka.
  return iv.sirina - zauzeto - CAR_WIDTH / 2 >= 0.3 - 1e-6;
}

/** Najveći lom osovine ivice na `[s0, s1]` [°]. */
function lomOsovine(iv: Ivica, s0: number, s1: number): number {
  const h0 = headingAt(iv.tacke, iv.cum, s0);
  let naj = 0;
  for (let s = s0 + 2; s <= s1; s += 2) {
    const h = headingAt(iv.tacke, iv.cum, Math.min(s, s1));
    naj = Math.max(naj, (Math.acos(Math.max(-1, Math.min(1, h.x * h0.x + h.y * h0.y))) * 180) / Math.PI);
  }
  return naj;
}

/**
 * Ulice (ivica i smjer) na kojima se smije parkirati, sa dijelom ivice
 * dozvoljenim za sredinu parkiranog auta: klasa, nivo, bez autobuske trake,
 * dovoljno široka, `GRAD_PARK_OD_RASKRSNICE` od oba kraja (od ruba
 * raskrsnice, i od čvora koji nije raskrsnica — iza njega može biti zebra
 * ili raskrsnica na kratkoj ivici). `zaNpc` je filter ulica kojima drugi
 * vozači voze.
 */
export function uliceZaParkiranje(sv: SvijetGrada, zaNpc: (iv: Ivica) => boolean): UlicaZaParkiranje[] {
  const { mreza: m, zaSudiju: g } = sv;
  const rez: UlicaZaParkiranje[] = [];
  for (const iv of m.ivice) {
    if (!zaNpc(iv) || !GRAD_PARK_KLASE.includes(iv.klasa) || iv.nivo !== 0 || iv.most || iv.tunel || iv.kruzni) continue;
    if (!dovoljnoSiroka(iv)) continue;
    const kraj = (k: 0 | 1) => Math.max(g.odsjeci[2 * iv.i + k] ?? 0, g.preliv.get(2 * iv.i + k)?.d ?? 0);
    const od = kraj(0) + GRAD_PARK_OD_RASKRSNICE + CAR_LENGTH / 2;
    const do_ = iv.duzina - kraj(1) - GRAD_PARK_OD_RASKRSNICE - CAR_LENGTH / 2;
    if (do_ < od) continue;
    const sredina = pointAt(iv.tacke, iv.cum, iv.duzina / 2);
    for (const smjer of [1, -1] as const) {
      if (iv.smjer !== 0 && iv.smjer !== smjer) continue;
      if (smjer === 1 ? iv.busNaprijed : iv.busNazad) continue;
      rez.push({ ivica: iv.i, smjer, od, do_, x: sredina.x, y: sredina.y });
    }
  }
  return rez;
}

/**
 * Da li je sredina parkiranog auta na `s` slobodna: zebre i stajališta na
 * ivici, ulica prava oko mjesta, i druga zauzeta mjesta na istoj ivici — na
 * istoj strani toliko da prilaz ivičnjaku (`GRAD_PARK_PRILAZ`) počne iza
 * parkiranog (inače bi ga auto zakačilo vraćajući se ka ivičnjaku), a na
 * suprotnoj se zone obilaska ne preklapaju (vidi zaglavlje).
 */
export function slobodno(sv: SvijetGrada, u: UlicaZaParkiranje, s: number, zauzeta: readonly MjestoParkiranja[]): boolean {
  const { mreza: m, zaSudiju: g } = sv;
  const iv = m.ivice[u.ivica]!;
  if (s < u.od || s > u.do_) return false;
  if ((g.zebre.get(u.ivica) ?? []).some((z) => Math.abs(z - s) < GRAD_PARK_OD_ZEBRE + CAR_LENGTH / 2)) return false;
  // Stajalište: `strana` +1 je desno od `a → b` — desni ivičnjak smjera 1.
  if ((g.stajalista.get(u.ivica) ?? []).some((st) => st.strana === u.smjer && Math.abs(st.s - s) < GRAD_PARK_OD_STAJALISTA)) return false;
  const nazad = u.smjer === 1 ? CAR_LENGTH / 2 + GRAD_PARK_PRILAZ : ZONA_OBILASKA;
  const naprijed = u.smjer === 1 ? ZONA_OBILASKA : CAR_LENGTH / 2 + GRAD_PARK_PRILAZ;
  const s0 = Math.max(0, s - Math.max(nazad, ZONA_OBILASKA));
  const s1 = Math.min(iv.duzina, s + Math.max(naprijed, ZONA_OBILASKA));
  if (lomOsovine(iv, s0, s1) > GRAD_PARK_PRAVO) return false;
  for (const z of zauzeta) {
    if (z.ivica !== u.ivica) continue;
    const d = Math.abs(z.s - s);
    if (z.smjer === u.smjer ? d < CAR_LENGTH + GRAD_PARK_PRILAZ + GRAD_PARK_RAZMAK : d < 2 * ZONA_OBILASKA) return false;
  }
  return true;
}

/** Mjesto na ulici `u`, sredina na `s` ivice: tačka uz ivičnjak i pravac vožnje. */
export function mjestoNa(sv: SvijetGrada, u: UlicaZaParkiranje, s: number, id: number, boja: number): MjestoParkiranja {
  const iv = sv.mreza.ivice[u.ivica]!;
  const c = pointAt(iv.tacke, iv.cum, s);
  const h0 = headingAt(iv.tacke, iv.cum, s);
  const h = u.smjer === 1 ? h0 : { x: -h0.x, y: -h0.y };
  const w = pomakParkiranog(iv);
  return { ivica: u.ivica, smjer: u.smjer, s, x: c.x - h.y * w, y: c.y + h.x * w, hx: h.x, hy: h.y, id, parkirano: false, boja };
}

/** Pravac putanje u tački `i` (od susjednih tačaka). */
function pravacTacke(t: readonly Point[], i: number): Point {
  const a = t[Math.max(0, i - 1)]!;
  const b = t[Math.min(t.length - 1, i + 1)]!;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/**
 * Obilazak zauzetih mjesta: tačke putanje plana od `odS` naprijed koje idu
 * pored nekog mjesta, u istom smjeru i bliže mu bočno od
 * `CAR_WIDTH + GRAD_PARK_OBILAZAK`, pomjeraju se ka sredini — pun pomak do
 * `CAR_LENGTH / 2 + GRAD_PARK_PUNO` od sredine mjesta, pa postepeno na
 * `GRAD_PARK_NAGIB`. Kad je vozilo već blizu (`odS`), pomak počinje od njega
 * (bez skoka). Mjesto vozila samog (`osim`) se preskače. Tačke se zamjenjuju
 * novim objektima: keširana geometrija prolaza ostaje kakva je bila.
 */
export function obidji(plan: PlanBota, mjesta: readonly MjestoParkiranja[], odS: number, osim: number | null = null): void {
  const { tacke, cum } = plan.put;
  const blizu = mjesta.filter((z) => z.id !== osim);
  if (blizu.length === 0) return;
  // Duže i šire vozilo (autobus, stavka 8c): pomak počinje ranije i veći je.
  const duze = (plan.vozilo.duzina - CAR_LENGTH) / 2;
  const razmak = RAZMAK_OBILASKA + (plan.vozilo.sirina - CAR_WIDTH) / 2;
  const zona = ZONA_OBILASKA + duze;
  const puno = CAR_LENGTH / 2 + GRAD_PARK_PUNO + duze;
  // Pomaci se računaju sa originalnih tačaka, pa tek onda upisuju.
  const pomaci: [number, Point][] = [];
  for (let i = 0; i < tacke.length; i++) {
    if (cum[i]! < odS) continue;
    const P = tacke[i]!;
    let naj = 0;
    let nx = 0;
    let ny = 0;
    for (const z of blizu) {
      const dx = P.x - z.x;
      const dy = P.y - z.y;
      if (Math.abs(dx) > zona + 4 || Math.abs(dy) > zona + 4) continue;
      const duz = dx * z.hx + dy * z.hy;
      if (Math.abs(duz) > zona) continue;
      const h = pravacTacke(tacke, i);
      if (h.x * z.hx + h.y * z.hy < 0.9) continue;
      // Bočno, + desno (ka ivičnjaku): parkirani je na 0.
      const bok = -dx * z.hy + dy * z.hx;
      if (bok > razmak / 2 || bok <= -razmak) continue;
      let f = Math.abs(duz) <= puno ? 1 : 1 - (Math.abs(duz) - puno) / GRAD_PARK_NAGIB;
      f = Math.min(f, (cum[i]! - odS) / GRAD_PARK_NAGIB);
      const pomak = (bok + razmak) * Math.max(0, f);
      if (pomak > naj) {
        naj = pomak;
        nx = z.hy;
        ny = -z.hx;
      }
    }
    // Lijevo od pravca vožnje (ka sredini ulice).
    if (naj > 0) pomaci.push([i, { x: P.x + nx * naj, y: P.y + ny * naj }]);
  }
  for (const [i, q] of pomaci) {
    // Koliko je tačka pomjerena (vidi `PlanBota.obilazak`).
    plan.obilazak ??= new Array<number>(tacke.length).fill(0);
    plan.obilazak[i] = Math.max(plan.obilazak[i] ?? 0, Math.hypot(q.x - tacke[i]!.x, q.y - tacke[i]!.y));
    tacke[i] = q;
  }
}

/**
 * Plan vozila koje parkira na mjestu `z`: putanja se završava 1,5 m iza
 * sredine mjesta — vozilo tu „stiže" i postaje parkirano tačno na mjestu
 * koje drugi obilaze (vidi `ukloni` u saobraćaju), a zadnjih
 * `GRAD_PARK_PRILAZ` prilazi ivičnjaku, sa žmigavcem desno. Vraća `false`
 * kad putanja ne prolazi pored mjesta (tada se ne parkira).
 */
export function doMjesta(plan: PlanBota, z: MjestoParkiranja): boolean {
  const { tacke, cum } = plan.put;
  // Mjesto na putanji: zadnji prelazak poprečne linije kroz mjesto, u istom
  // smjeru i bočno do pola trake.
  let sMjesta = -1;
  for (let i = tacke.length - 1; i > 0; i--) {
    const A = tacke[i - 1]!;
    const B = tacke[i]!;
    const da = (A.x - z.x) * z.hx + (A.y - z.y) * z.hy;
    const db = (B.x - z.x) * z.hx + (B.y - z.y) * z.hy;
    if (da > 0 || db < 0) continue;
    const l = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    if (((B.x - A.x) * z.hx + (B.y - A.y) * z.hy) / l < 0.9) continue;
    const u = db - da > 1e-9 ? -da / (db - da) : 0;
    const bok = -(A.x + (B.x - A.x) * u - z.x) * z.hy + (A.y + (B.y - A.y) * u - z.y) * z.hx;
    if (Math.abs(bok) > 3) continue;
    sMjesta = cum[i - 1]! + (cum[i]! - cum[i - 1]!) * u;
    break;
  }
  if (sMjesta < GRAD_PARK_PRILAZ + 5) return false;
  // Vozilo „stiže" 1,5 m prije kraja (`ukloni` u saobraćaju) — tačno na mjestu.
  const kraj = sMjesta + 1.5;
  if (kraj > plan.put.duzina) return false;
  // Skraćivanje na `kraj` (tačka na kraju interpolirana).
  let n = 0;
  while (n < cum.length && cum[n]! < kraj) n++;
  const zadnja = pointAt(tacke, cum, kraj);
  const t2 = tacke.slice(0, n);
  const c2 = cum.slice(0, n);
  t2.push(zadnja);
  c2.push(kraj);
  plan.brzine = [...plan.brzine.slice(0, n), plan.brzine[Math.min(n, plan.brzine.length - 1)]!];
  plan.nivoi = [...plan.nivoi.slice(0, n), plan.nivoi[Math.min(n, plan.nivoi.length - 1)] ?? 0];
  plan.linije = plan.linije.filter((l) => l.s < kraj);
  plan.prolazi = plan.prolazi.filter((q) => q.od < kraj);
  // Žmigavac desno od početka prilaza — ali tek kad se ugasi onaj za
  // skretanje u ovu ulicu (`GRAD_PARK_ZMIGAVAC_PAUZA`); mjesto tik iza
  // raskrsnice, gdje za to nema puta, se ne bira.
  const najave = plan.najave.filter((q) => q.od < kraj);
  const pali = Math.max(sMjesta - GRAD_PARK_PRILAZ - 3, ...najave.map((q) => q.do_ + GRAD_PARK_ZMIGAVAC_PAUZA));
  if (pali > sMjesta - 3) return false;
  plan.najave = [...najave, { od: pali, do_: kraj, strana: "right" as const }];
  // Prilaz ivičnjaku: tačke zadnjih `GRAD_PARK_PRILAZ` ka liniji parkiranih.
  for (let i = 0; i < t2.length; i++) {
    const d = sMjesta - c2[i]!;
    if (d > GRAD_PARK_PRILAZ) continue;
    const f0 = Math.min(1, Math.max(0, 1 - d / GRAD_PARK_PRILAZ));
    const f = f0 * f0 * (3 - 2 * f0);
    const P = t2[i]!;
    const bok = -(P.x - z.x) * z.hy + (P.y - z.y) * z.hx;
    // Na liniju parkiranih: bočno na 0 (desno je +).
    t2[i] = { x: P.x - -z.hy * bok * f, y: P.y - z.hx * bok * f };
  }
  plan.put = { tacke: t2, cum: c2, duzina: kraj };
  return true;
}
