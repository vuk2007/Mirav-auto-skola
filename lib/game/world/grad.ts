/**
 * Grad na ruti: autobuske stanice i parkirani auti uz ivičnjak.
 *
 * Oboje zavisi samo od rute, a ne od sjemena: stanica i parking su dio ulice,
 * isti pri svakoj vožnji, kao i krivina. Šablon se uz to kešira po `id`-u rute,
 * pa bi raspored koji zavisi od sjemena dvije vožnje iste rute pomiješao.
 *
 * Gdje ih nema i zašto:
 *  - uz ulaz u grad i izlaz iz njega (`GRAD_OD_KRAJA`) — tu je raskrsnica;
 *  - u oštroj krivini (`PARKING_MIN_POLUPRECNIK`) — tu se ne parkira;
 *  - parkiranih auta nema uz stanicu, sa one strane na kojoj autobus staje.
 *
 * Oštrina krivine se mjeri na OSI RUTE, dakle na sabijenoj ulici koja se vozi,
 * a ne iz spiska krivina. Spisak nosi poluprečnik stvarne geometrije i samo
 * krivine sa tablom; izmjereno, u sabijenom Mojkovcu je devet parkiranih auta
 * stajalo u krivinama od trinaest do trideset pet metara kojih u spisku nema, i
 * savršen vozač je u jedan od njih udario vozeći osom svoje trake.
 */

import {
  GRAD_OD_KRAJA,
  PARKING_MIN_POLUPRECNIK,
  PARKING_NIZ,
  PARKING_PRAZNINA,
  PARKING_RAZMAK,
  ROUTE_STEP,
  STANICA_BEZ_PARKINGA_POSLIJE,
  STANICA_BEZ_PARKINGA_PRIJE,
  STANICA_RAZMAK,
  VOZILA,
} from "../sim/config";
import { rng } from "../sim/geometry";
import type { ParkiranoVozilo, Stanica, VrstaVozila } from "../sim/types";
import type { Ruta } from "./ruta";

/** Koje vrste vozila stoje parkirane, u procentima. */
const PARKIRANE_VRSTE: readonly (readonly [VrstaVozila, number])[] = [
  ["auto-mali", 34],
  ["auto", 38],
  ["auto-veliki", 18],
  ["kombi", 10],
];

/**
 * Preko koliko metara sa svake strane se mjeri poluprečnik ose [m].
 *
 * Tetiva, a ne susjedne tačke: osa je uzorkovana na dva metra, pa bi poluprečnik
 * iz tri susjedne tačke skakao od tačke do tačke.
 */
const TETIVA = 10;

/** Poluprečnik kruga kroz tri tačke osovine rute [m]; prav put je beskonačan. */
function poluprecnikOse(ruta: Ruta, x: number): number {
  const t = ruta.tacke;
  const i = Math.min(t.length - 1, Math.max(0, Math.round(x / ROUTE_STEP)));
  const korak = Math.round(TETIVA / ROUTE_STEP);
  const a = t[Math.max(0, i - korak)]!;
  const b = t[i]!;
  const c = t[Math.min(t.length - 1, i + korak)]!;
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  const dvostrukaPovrsina = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return dvostrukaPovrsina < 1e-9 ? Infinity : (ab * bc * ca) / (2 * dvostrukaPovrsina);
}

/**
 * Da li je dio puta `[od, doK]` oštar — po osi koja se vozi ILI po spisku
 * krivina.
 *
 * Oba kriterijuma, jer nijedan sam nije dovoljan. Osa se mjeri preko tetive, pa
 * kratku oštru krivinu izgladi; spisak nosi poluprečnik STVARNE geometrije, a
 * sabijena ulica je oštrija od nje i ima prelome kojih u spisku nema.
 */
function ostro(ruta: Ruta, od: number, doK: number): boolean {
  for (let x = od; x <= doK + ROUTE_STEP / 2; x += ROUTE_STEP) {
    if (poluprecnikOse(ruta, Math.min(x, doK)) < PARKING_MIN_POLUPRECNIK) return true;
  }
  return ruta.krivine.some(
    (k) =>
      k.radius < PARKING_MIN_POLUPRECNIK &&
      doK > k.atS - k.arc / 2 &&
      od < k.atS + k.arc / 2,
  );
}

/** Gradske dionice rute, bez krajeva uz raskrsnice. */
function gradskiDijelovi(ruta: Ruta): { od: number; do: number }[] {
  return ruta.dionice
    .filter((d) => d.vrsta === "grad")
    .map((d) => ({ od: d.odS + GRAD_OD_KRAJA, do: d.doS - GRAD_OD_KRAJA }))
    .filter((d) => d.do > d.od);
}

/**
 * Autobuske stanice na ruti.
 *
 * U svakom smjeru po jedna na svakih `STANICA_RAZMAK`, a stanice dva smjera su
 * razmaknute za pola razmaka — da dva autobusa ne stoje jedan naspram drugog.
 * Stanica u oštroj krivini se izostavlja; autobus tamo ne staje.
 */
export function staniceNaRuti(ruta: Ruta): Stanica[] {
  const out: Stanica[] = [];
  const pola = VOZILA.autobus.duzina / 2;
  for (const d of gradskiDijelovi(ruta)) {
    for (const traka of [0, 1] as const) {
      for (let x = d.od + STANICA_RAZMAK * (traka === 0 ? 0.5 : 1); x <= d.do; x += STANICA_RAZMAK) {
        if (!ostro(ruta, x - pola, x + pola)) out.push({ s: x, traka });
      }
    }
  }
  return out.sort((a, b) => a.s - b.s);
}

/** Sjeme iz teksta — isti tekst, isti broj. */
function sjemeIz(tekst: string): number {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Da li bi parkirano vozilo na `[od, doK]` stajalo u prilazu stanici.
 *
 * Desni ivičnjak je stanica naše trake, lijevi susretne. Prilaz se gleda u smjeru
 * u kojem autobus vozi: u susretnoj traci je to prema manjem `s`.
 */
function uzStanicu(stanice: readonly Stanica[], strana: "lijevo" | "desno", od: number, doK: number): boolean {
  const traka = strana === "desno" ? 0 : 1;
  return stanice.some((st) => {
    if (st.traka !== traka) return false;
    const [prije, poslije] =
      traka === 0
        ? [st.s - STANICA_BEZ_PARKINGA_PRIJE, st.s + STANICA_BEZ_PARKINGA_POSLIJE]
        : [st.s - STANICA_BEZ_PARKINGA_POSLIJE, st.s + STANICA_BEZ_PARKINGA_PRIJE];
    return doK > prije && od < poslije;
  });
}

/**
 * Parkirani auti uz oba ivičnjaka gradskih dionica.
 *
 * Stoje u nizovima od nekoliko auta, sa prazninom između nizova — ulaz u
 * dvorište, pješački prelaz. Razmaci i vrste se izvlače iz `id`-a rute i
 * mjesta, pa je parking isti pri svakoj vožnji iste rute.
 */
export function parkiranaNaRuti(ruta: Ruta, stanice: readonly Stanica[]): ParkiranoVozilo[] {
  const out: ParkiranoVozilo[] = [];
  const izmedju = (r: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * r();
  const ukupno = PARKIRANE_VRSTE.reduce((a, [, p]) => a + p, 0);

  for (const d of gradskiDijelovi(ruta)) {
    for (const strana of ["desno", "lijevo"] as const) {
      const r = rng(sjemeIz(`${ruta.id}|${Math.round(d.od)}|${strana}`));
      let x = d.od + izmedju(r, PARKING_PRAZNINA);
      while (x < d.do) {
        const uNizu = Math.round(izmedju(r, PARKING_NIZ));
        for (let i = 0; i < uNizu && x < d.do; i++) {
          let prag = r() * ukupno;
          let vrsta: VrstaVozila = "auto";
          for (const [v, p] of PARKIRANE_VRSTE) {
            if (prag < p) {
              vrsta = v;
              break;
            }
            prag -= p;
          }
          const duzina = VOZILA[vrsta].duzina;
          const slobodno =
            x + duzina <= d.do && !ostro(ruta, x, x + duzina) && !uzStanicu(stanice, strana, x, x + duzina);
          if (slobodno) out.push({ s: x + duzina / 2, strana, vrsta });
          x += duzina + izmedju(r, PARKING_RAZMAK);
        }
        x += izmedju(r, PARKING_PRAZNINA);
      }
    }
  }
  return out.sort((a, b) => a.s - b.s);
}
