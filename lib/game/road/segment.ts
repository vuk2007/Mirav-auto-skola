/**
 * Od ivice grafa do dionice koja se vozi.
 *
 * Ivice su od 8 do 60 km. Vozi se izvod, uvijek jednako dug u vremenu
 * (`TRIP_SEGMENT_TIME`), pa se dužina u metrima dobija iz ograničenja brzine:
 * planinski put od 50 km/h daje kraću dionicu od magistrale, i to je namjerno —
 * na sporijem putu se za četiri minuta i pređe manje.
 *
 * Krivine dolaze iz `curvesFor` i preslikavaju se srazmjerno: krivina na 30.
 * kilometru šezdesetokilometarske ivice ostaje na pola dionice.
 *
 * Šta ovdje NEMA i zašto: nema sporijih vozila u našoj traci. Dok preticanje
 * nije napravljeno, jedno takvo vozilo bi značilo tri minuta vožnje iza njega
 * bez ijednog ispravnog poteza — a pravilo je da svaka situacija mora imati
 * rješenje. Vraćaju se zajedno sa preticanjem.
 */

import {
  ONCOMING_GAP,
  ROAD_LATERAL_ACCEL,
  ROAD_TURN_MAX,
  ROAD_TURN_MIN,
  TRIP_SEGMENT_TIME,
  LANE_WIDTH,
} from "../sim/config";
import { rng } from "../sim/geometry";
import type { Level } from "../sim/config";
import type { RoadCurve, RoadTemplate, Scenario, ScenarioNpc } from "../sim/types";
import { curvesFor, type RoadEdge, type RoadKind, nodeById } from "./roadGraph";

/** Koliko je dionica teška — dok nema pravila, ovo samo bira gustinu. */
const TEZINA: Record<RoadKind, Level> = {
  autoput: 2,
  magistrala: 2,
  regionalni: 2,
  planinski: 3,
  gradski: 2,
};

/** Kratak opis dionice po vrsti puta, na sva četiri jezika. */
const OPIS: Record<RoadKind, Record<string, string>> = {
  autoput: {
    me: "Autoput. Držite se svoje trake i odstojanja od vozila ispred.",
    en: "A motorway. Keep your lane and your distance from the vehicle ahead.",
    sq: "Autostradë. Mbani korsinë tuaj dhe distancën nga automjeti përpara.",
    ru: "Автомагистраль. Держитесь своей полосы и дистанции до впереди идущего.",
  },
  magistrala: {
    me: "Magistralni put sa po jednom trakom u svakom smjeru. Susretna vozila prolaze blizu — držite se svoje strane.",
    en: "A main road with one lane each way. Oncoming vehicles pass close — keep to your side.",
    sq: "Rrugë magjistrale me nga një korsi për çdo drejtim. Automjetet përballë kalojnë afër — mbani anën tuaj.",
    ru: "Магистраль с одной полосой в каждом направлении. Встречные проходят близко — держитесь своей стороны.",
  },
  regionalni: {
    me: "Regionalni put. Uži je i sporiji od magistrale, a susretni saobraćaj je isti.",
    en: "A regional road. Narrower and slower than a main road, with the same oncoming traffic.",
    sq: "Rrugë rajonale. Më e ngushtë dhe më e ngadaltë se magjistralja, me të njëjtin trafik përballë.",
    ru: "Региональная дорога. Уже и медленнее магистрали, встречное движение то же.",
  },
  planinski: {
    me: "Planinski put sa krivinama. Table pokazuju preporučenu brzinu prije svake.",
    en: "A mountain road with bends. Signs show the advisory speed before each one.",
    sq: "Rrugë malore me kthesa. Tabelat tregojnë shpejtësinë e rekomanduar para secilës.",
    ru: "Горная дорога с поворотами. Знаки показывают рекомендуемую скорость перед каждым.",
  },
  gradski: {
    me: "Gradska ulica.",
    en: "A city street.",
    sq: "Rrugë qytetit.",
    ru: "Городская улица.",
  },
};

const imeCvora = (id: string): string => nodeById(id)?.name ?? id;

/** Naziv dionice u smjeru vožnje. */
export function nazivDionice(edge: RoadEdge, obrnuto: boolean): string {
  const [od, doK] = obrnuto ? [edge.b, edge.a] : [edge.a, edge.b];
  return `${imeCvora(od)} — ${imeCvora(doK)}`;
}

/**
 * Krivine preslikane sa ivice na dionicu koja se vozi.
 *
 * Poluprečnik dolazi iz preporučene brzine (`v² / a`), a ne iz oka — tako se
 * tabla i geometrija slažu. Luk se skraćuje da ne uđe u susjednu krivinu:
 * `curvesFor` garantuje razmak po kilometraži, ali ne i po dužini luka.
 */
function krivine(tpl: Pick<RoadTemplate, "length">, edge: RoadEdge, seed: number): RoadCurve[] {
  const sirove = curvesFor(edge, seed);
  if (sirove.length === 0) return [];
  const r = rng((seed * 2654435761) >>> 0);

  const centri = sirove.map((k) => (k.atKm / edge.km) * tpl.length);
  return sirove.map((k, i) => {
    const atS = centri[i] ?? 0;
    const prije = i === 0 ? 0 : (centri[i - 1] ?? 0);
    const poslije = i === centri.length - 1 ? tpl.length : (centri[i + 1] ?? tpl.length);
    const radius = (k.advisorySpeed / 3.6) ** 2 / ROAD_LATERAL_ACCEL;
    const ugao = ROAD_TURN_MIN + r() * (ROAD_TURN_MAX - ROAD_TURN_MIN);
    const prostor = 0.8 * Math.min(atS - prije, poslije - atS);
    return {
      atS,
      arc: Math.min(radius * ugao, 2 * prostor),
      radius,
      side: k.side,
      advisorySpeed: k.advisorySpeed,
    };
  });
}

/** Šablon dionice. `id` nosi i ivicu i sjeme, da se dvije dionice ne pobrkaju. */
export function roadTemplate(edge: RoadEdge, seed: number): RoadTemplate {
  const vMax = edge.speedLimit / 3.6;
  const length = TRIP_SEGMENT_TIME * vMax;
  return {
    kind: "road",
    id: `road:${edge.id}:${seed >>> 0}`,
    length,
    edgeId: edge.id,
    edgeKm: edge.km,
    vMax,
    curves: krivine({ length }, edge, seed),
    geometry: { laneWidth: LANE_WIDTH },
    // Dvije trake, ne tri: uže vidno polje nego na autoputu, inače put ostane
    // tanka traka nasred praznog ekrana.
    viewHalf: 26,
  };
}

/**
 * Susretna kolona.
 *
 * Za svaki željeni trenutak mimoilaska se računa gdje vozilo mora početi:
 * ako stane u dionicu, kreće odmah sa udaljenijeg kraja, a ako ne stane —
 * dionica je kraća od toga — kreće sa kraja, ali kasnije. Bez ovog računa se
 * susretna vozila skupe u prvoj polovini puta i druga dva minuta su prazna.
 */
function susretna(tpl: RoadTemplate, seed: number): ScenarioNpc[] {
  const r = rng((seed ^ 0x9e3779b9) >>> 0);
  const v = tpl.vMax;
  const out: ScenarioNpc[] = [];
  for (let t = ONCOMING_GAP; t < TRIP_SEGMENT_TIME; t += ONCOMING_GAP) {
    // Razmak se malo koleba, da kolona ne bude metronom.
    const kada = t + (r() - 0.5) * ONCOMING_GAP * 0.6;
    const naDionici = tpl.length - 2 * v * kada;
    const startS = Math.max(0, naDionici);
    const spawnT = naDionici >= 0 ? 0 : 2 * kada - tpl.length / v;
    if (spawnT >= TRIP_SEGMENT_TIME) continue;
    out.push({
      arm: "S",
      intent: { kind: "lane", index: 1 },
      startS,
      spawnAt: [Math.max(0, spawnT), Math.max(0, spawnT)],
      speed: v * (0.85 + r() * 0.15),
    });
  }
  return out;
}

/**
 * Dionica kao scenario.
 *
 * `obrnuto` je vožnja od `b` prema `a`. Za sada mijenja samo naziv: geometrija
 * je simetrična, a znamenitosti i kilometraža se preslikavaju u prikazu.
 */
export function dionica(edge: RoadEdge, seed: number, obrnuto = false): Scenario {
  const tpl = roadTemplate(edge, seed);
  const naziv = nazivDionice(edge, obrnuto);
  const opis = OPIS[edge.kind];
  const naslov: Record<string, string> = {};
  for (const jezik of Object.keys(opis)) naslov[jezik] = naziv;

  return {
    id: `dionica:${edge.id}${obrnuto ? ":obrnuto" : ""}`,
    intersection: tpl.id,
    template: tpl,
    player: {
      arm: "N",
      intent: { kind: "lane", index: 0 },
      spawnDistance: 0,
      startS: 0,
      // Kreće se u vožnji, ne iz mjesta: dionica je sredina puta, ne polazak.
      startV: tpl.vMax * 0.8,
    },
    npcs: susretna(tpl, seed),
    difficulty: TEZINA[edge.kind],
    title: naslov,
    explanation: opis,
  };
}
