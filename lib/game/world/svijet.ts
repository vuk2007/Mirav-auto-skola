/**
 * Ruta kao jedan scenario koji se vozi bez prekida.
 *
 * Ovdje se ruta pretvara u ono što simulacija već zna da vrti: jedan šablon
 * otvorenog puta, sa osovinom koja ide od početka do kraja rute. Time se ništa
 * u jezgru simulacije ne mijenja — a igrač vozi Budvu do Kolašina u jednom
 * potezu, bez resetovanja koordinata i bez ekrana između dionica.
 *
 * Brzina se mijenja duž rute (`Ruta.vMaxNa`), jer se mijenja i vrsta puta.
 * Šablon nosi najveću od njih: on opisuje šta vozilo MOŽE, a šta SMIJE je stvar
 * pravila i čita se iz rute na mjestu na kojem se vozilo nalazi.
 */

import {
  LANE_WIDTH,
  LOAD_AHEAD,
  KEEP_BEHIND,
  ONCOMING_GAP,
} from "../sim/config";
import { rng } from "../sim/geometry";
import type { Level } from "../sim/config";
import type { RoadTemplate, Scenario, ScenarioNpc, World } from "../sim/types";
import { PLAYER_ID } from "../sim/world";
import { kilometraza, type Ruta } from "./ruta";

/** Šablon otvorenog puta za cijelu rutu. */
export function rutaTemplate(ruta: Ruta): RoadTemplate {
  return {
    kind: "road",
    id: ruta.id,
    length: ruta.duzina,
    // Kilometraža i ivica se odnose na CIJELU rutu; pojedinačna dionica se
    // dobija iz `ruta.dionicaNa`.
    edgeId: ruta.dionice.map((d) => d.edge.id).join(","),
    edgeKm: kilometraza(ruta),
    vMax: ruta.vMax,
    curves: ruta.krivine,
    centerline: ruta.tacke,
    landmarks: ruta.landmarks,
    geometry: { laneWidth: LANE_WIDTH },
    viewHalf: 26,
  };
}

/**
 * Kada igrač stiže do mjesta `s` na ruti [s].
 *
 * Računa se po ograničenju svake dionice, jer se ono duž rute mijenja. Ovo nije
 * predviđanje vožnje nego mjera po kojoj se raspoređuje susretni saobraćaj —
 * dovoljno je da kolona bude ravnomjerna, ne da pogodi sekundu.
 */
export function vrijemeDo(ruta: Ruta, s: number): number {
  let t = 0;
  for (const d of ruta.dionice) {
    if (s <= d.odS) break;
    t += (Math.min(s, d.doS) - d.odS) / d.vMax;
  }
  return t;
}

/**
 * Susretna kolona duž cijele rute.
 *
 * Za svako mjesto susreta se računa gdje vozilo mora početi: ako stane u rutu,
 * kreće odmah sa udaljenijeg kraja, a ako ne stane — kreće sa kraja, ali
 * kasnije. Bez tog računa se susretna vozila skupe u prvoj četvrtini puta, a
 * ostatak rute je prazan.
 *
 * Brzina svakog vozila je brzina DIONICE na kojoj se susret dešava: na
 * autoputu se mimoilazi brže nego na planinskom putu.
 */
export function susretniSaobracaj(ruta: Ruta, seed: number): ScenarioNpc[] {
  const r = rng((seed ^ 0x9e3779b9) >>> 0);
  const out: ScenarioNpc[] = [];
  const ukupno = vrijemeDo(ruta, ruta.duzina);

  for (let t = ONCOMING_GAP; t < ukupno; t += ONCOMING_GAP) {
    // Razmak se malo koleba, da kolona ne bude metronom.
    const kada = t + (r() - 0.5) * ONCOMING_GAP * 0.6;
    if (kada <= 0 || kada >= ukupno) continue;

    // Gdje je igrač u tom trenutku — traži se po dionicama, jer brzina nije ista.
    let mjesto = 0;
    let preostalo = kada;
    for (const d of ruta.dionice) {
      const trajanje = (d.doS - d.odS) / d.vMax;
      if (preostalo <= trajanje) {
        mjesto = d.odS + preostalo * d.vMax;
        preostalo = 0;
        break;
      }
      preostalo -= trajanje;
      mjesto = d.doS;
    }
    if (preostalo > 0) continue;

    const vIgraca = ruta.vMaxNa(mjesto);
    const v = vIgraca * (0.85 + r() * 0.15);

    // Vozilo se ne pravi na kraju rute nego TAMO GDJE UĐE U PROZOR. Bez toga
    // svako susretno vozilo postoji od prve sekunde i vozi cijelu rutu prema
    // igraču: izmjereno, na Budvi — Kolašinu je tako bilo 93 vozila u pogonu
    // istovremeno, a samo 22 ih je bilo u prozoru. Ostalih sedamdeset se
    // računalo bez ikakve koristi.
    //
    // Prilaze jedno drugom zbirom brzina, pa od ulaska u prozor do susreta
    // prođe `LOAD_AHEAD / (v + vIgraca)` sekundi.
    const doSusreta = LOAD_AHEAD / (v + vIgraca);
    const spawnT = Math.max(0, kada - doSusreta);
    // Susretna traka je okrenuta: njeno `s` raste od kraja rute prema početku.
    const naSusretu = ruta.duzina - mjesto;
    const startS = Math.max(0, naSusretu - v * (kada - spawnT));
    if (spawnT >= ukupno) continue;

    out.push({
      arm: "S",
      intent: { kind: "lane", index: 1 },
      startS,
      spawnAt: [Math.max(0, spawnT), Math.max(0, spawnT)],
      speed: v,
    });
  }
  return out;
}

/** Ruta kao scenario. Igrač kreće u vožnji, ne iz mjesta. */
export function rutaScenario(ruta: Ruta, seed: number, difficulty: Level = 2): Scenario {
  const tpl = rutaTemplate(ruta);
  const naslov = ruta.cvorovi.join(" — ");
  const jezici = ["me", "en", "sq", "ru"];
  const tekst = (x: string): Record<string, string> =>
    Object.fromEntries(jezici.map((j) => [j, x]));

  return {
    id: ruta.id,
    intersection: tpl.id,
    template: tpl,
    player: {
      arm: "N",
      intent: { kind: "lane", index: 0 },
      spawnDistance: 0,
      startS: 0,
      startV: ruta.vMaxNa(0) * 0.8,
    },
    npcs: susretniSaobracaj(ruta, seed),
    difficulty,
    title: tekst(naslov),
    explanation: tekst(naslov),
  };
}

/**
 * Koliko je vozila u prozoru oko igrača.
 *
 * Prozor je `LOAD_AHEAD` ispred i `KEEP_BEHIND` iza. Ne služi da nešto obriše
 * nego da se izmjeri ima li šta da se briše: susretno vozilo ionako postoji
 * samo od svog `spawnT` do izlaska sa putanje, pa je pitanje da li ih se ikad
 * skupi toliko da streaming išta donese. Odgovor se mjeri, ne pretpostavlja.
 */
export function uProzoru(world: World, ruta: Ruta): { aktivnih: number; uProzoru: number } {
  const igrac = world.vehicles.find((v) => v.id === PLAYER_ID);
  const gdje = igrac?.s ?? 0;
  let aktivnih = 0;
  let unutra = 0;
  for (const v of world.vehicles) {
    if (v.id === PLAYER_ID || v.done || world.t < v.spawnT) continue;
    aktivnih += 1;
    // Susretna traka je okrenuta, pa se njeno `s` prevodi na mjesto na ruti.
    const naRuti = v.intent !== null && typeof v.intent === "object" && v.intent.kind === "lane" && v.intent.index === 1
      ? ruta.duzina - v.s
      : v.s;
    if (naRuti > gdje - KEEP_BEHIND && naRuti < gdje + LOAD_AHEAD) unutra += 1;
  }
  return { aktivnih, uProzoru: unutra };
}
