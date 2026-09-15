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
  LOAD_AHEAD,
  KEEP_BEHIND,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
  SAOBRACAJ_NIVO,
  SAOBRACAJ_PROZOR,
} from "../sim/config";
import { zabraneNaPutu } from "../road/zabrane";
import { compile } from "../sim/intersection";
import { zagarantovaniKamioni } from "../sim/tok";
import type { Level } from "../sim/config";
import type { DionicaToka, RoadTemplate, Scenario, TokSaobracaja, World } from "../sim/types";
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
    // Gradske dionice nisu ivice grafa, pa ih ovdje i nema.
    edgeId: ruta.dionice.flatMap((d) => (d.edge ? [d.edge.id] : [])).join(","),
    edgeKm: kilometraza(ruta),
    vMax: ruta.vMax,
    // Rok vožnje se računa po ograničenjima svake dionice, ne po najbržoj.
    trajanje: vrijemeDo(ruta, ruta.duzina),
    // Ograničenje se duž rute mijenja: magistrala, autoput, ulica kroz grad.
    vMaxNa: (s) => ruta.vMaxNa(s),
    curves: ruta.krivine,
    centerline: ruta.tacke,
    landmarks: ruta.landmarks,
    // Puna linija: krivine, naselja i prilazi mjestima u koja se ulazi. Isti
    // podatak čitaju i crtanje i sud.
    zabrane: zabraneNaPutu({
      duzina: ruta.duzina,
      krivine: ruta.krivine,
      vMaxNa: (s) => ruta.vMaxNa(s),
      raskrsnice: ruta.dionice.flatMap((d, i) => (i === 0 ? [] : [d.odS])).concat(ruta.duzina),
    }),
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
}

/**
 * Kada igrač stiže do mjesta `s` na ruti [s].
 *
 * Računa se po ograničenju svake dionice, jer se ono duž rute mijenja. Ovo nije
 * predviđanje vožnje nego mjera za rok vožnje — dovoljno je da bude pošten, ne
 * da pogodi sekundu.
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
 * Saobraćaj na ruti, kao opis toka.
 *
 * Svaka dionica rute nosi svoju vrstu puta i svoje ograničenje: kroz grad se
 * vozi drugom mješavinom vozila i drugom brzinom nego magistralom, a na
 * planinskom putu čeka kamion. Vozila nastaju u toku vožnje — vidi `sim/tok.ts`.
 */
export function tokRute(ruta: Ruta, seed: number): TokSaobracaja {
  const dionice = ruta.dionice.map(
    (d): DionicaToka => ({
      od: d.odS,
      do: d.doS,
      vrsta: d.vrsta === "grad" ? "grad" : d.edge?.kind === "planinski" ? "planinski" : "put",
      vMax: d.vMax,
    }),
  );
  return { seed: (seed ^ 0x9e3779b9) >>> 0, dionice, kamioni: zagarantovaniKamioni(dionice) };
}

/**
 * Ruta kao scenario. Igrač kreće u vožnji, ne iz mjesta.
 *
 * `difficulty` je nivo saobraćaja: po njemu se bira gustina (`SAOBRACAJ_U_PROZORU`).
 */
export function rutaScenario(
  ruta: Ruta,
  seed: number,
  difficulty: Level = SAOBRACAJ_NIVO,
): Scenario {
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
    npcs: [],
    tok: tokRute(ruta, seed),
    // Ruta je otvoren put kao i dionica putovanja — vozi se volanom.
    upravljanje: "traka",
    difficulty,
    title: tekst(naslov),
    explanation: tekst(naslov),
  };
}

/**
 * Koliko je vozila u prozoru oko igrača.
 *
 * Prozor je `LOAD_AHEAD` ispred i `KEEP_BEHIND` iza — isti onaj u kojem tok
 * saobraćaja pušta i briše vozila. Ne služi da nešto obriše nego da se izmjeri
 * da li se van njega išta vrti.
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

/**
 * Koliko vozila ima u prozoru po kojem se mjeri gustina saobraćaja.
 *
 * Prozor počinje `KEEP_BEHIND` iza igrača i dug je `SAOBRACAJ_PROZOR`; broje se
 * oba smjera, bez igrača. `cijeli` kaže da li prozor u tom trenutku cijeli leži
 * na putu — na početku i na kraju puta dio prozora pada van njega, pa bi broj
 * bio manji bez ikakve veze sa gustinom.
 */
export function uProzoruGustine(
  world: World,
  tpl: RoadTemplate,
): { vozila: number; cijeli: boolean } {
  const { paths } = compile(tpl);
  const igrac = world.vehicles.find((v) => v.id === PLAYER_ID);
  const put = igrac ? paths.get(igrac.pathId) : undefined;
  if (!igrac || !put) return { vozila: 0, cijeli: false };
  const od = igrac.s - KEEP_BEHIND;
  const doK = od + SAOBRACAJ_PROZOR;
  let vozila = 0;
  for (const v of world.vehicles) {
    if (v.id === PLAYER_ID || v.done || world.t < v.spawnT) continue;
    const p = paths.get(v.pathId);
    if (!p) continue;
    // Susretna traka je okrenuta, pa se njeno `s` prevodi na mjesto na putu.
    const x = v.lane === 1 ? p.length - v.s : v.s;
    if (x >= od && x <= doK) vozila += 1;
  }
  return { vozila, cijeli: od >= 0 && doK <= put.length };
}
