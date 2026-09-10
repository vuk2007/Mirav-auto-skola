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
  SLOW_GAP,
  SLOW_SHARE,
  ROAD_LATERAL_ACCEL,
  ROAD_TURN_MAX,
  ROAD_TURN_MIN,
  TRIP_SEGMENT_TIME,
  ROAD_LANE_WIDTH,
  ROAD_VIEW_HALF,
} from "../sim/config";
import { rng } from "../sim/geometry";
import { zabraneNaPutu } from "./zabrane";
import type { Level } from "../sim/config";
import type {
  RoadCurve,
  RoadLandmark,
  RoadTemplate,
  Scenario,
  ScenarioNpc,
} from "../sim/types";
import { landmarksOnEdge } from "./landmarks";
import { osovina, type EdgeGeometry } from "./edgeGeometry";
import { sabijenaIvica, type Sabijeno } from "./sabijanje";
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

/**
 * Znamenitosti preslikane sa ivice na dionicu koja se vozi.
 *
 * `landmarksOnEdge` već okreće i redoslijed i stranu kad se vozi unatrag, pa
 * ovdje ostaje samo srazmjera: znamenitost na 30. kilometru šezdesetokilo-
 * metarske ivice stoji na pola dionice.
 */
function znamenitostiNaDionici(
  edge: RoadEdge,
  length: number,
  obrnuto: boolean,
  sabijeno?: Sabijeno,
): RoadLandmark[] {
  return landmarksOnEdge(edge.id, obrnuto).flatMap((l): RoadLandmark[] => {
    if (l.at.kind !== "edge") return [];
    // Bez geometrije je razmjera ravnomjerna. Sa geometrijom nije: sabijanje
    // nije svuda isto, pa se položaj prvo prevede u metre STVARNOG puta, a
    // onda preslika istim preslikavanjem kojim je i put sabijen. Inače bi
    // znamenitost na izlazu iz kanjona ispala nasred pravca.
    const udio = l.at.atKm / edge.km;
    const atS = sabijeno
      ? sabijeno.uSabijeni(udio * sabijeno.stvarnaDuzina)
      : udio * length;
    return [{ atS, side: l.at.side, icon: l.icon, name: l.name }];
  });
}

/**
 * Šablon dionice.
 *
 * `id` nosi ivicu, sjeme I smjer: geometrija jeste ista u oba smjera, ali
 * znamenitosti nisu, a šabloni se keširaju po `id`-u — bez smjera bi povratak
 * dobio tuđi raspored.
 */
export function roadTemplate(
  edge: RoadEdge,
  seed: number,
  obrnuto = false,
  geom?: EdgeGeometry,
): RoadTemplate {
  const vMax = edge.speedLimit / 3.6;

  // Sa stvarnom geometrijom se proceduralni generator krivina GASI: oblik puta
  // dolazi iz OSM-a, a `curves` ostaju samo kao table sa preporučenom brzinom.
  // Dužina više nije fiksna nego onolika kolika ispadne poslije sabijanja —
  // Podgorica — Zeta je minut i po, Žabljak — Plužine trinaest.
  if (geom) {
    const sabijeno = sabijenaIvica(geom.id, osovina(geom, obrnuto), obrnuto);
    return {
      kind: "road",
      id: `road:${edge.id}:${seed >>> 0}${obrnuto ? ":obrnuto" : ""}:osm`,
      length: sabijeno.duzina,
      edgeId: edge.id,
      edgeKm: edge.km,
      vMax,
      curves: sabijeno.krivine,
      centerline: sabijeno.tacke,
      landmarks: znamenitostiNaDionici(edge, sabijeno.duzina, obrnuto, sabijeno),
      zabrane: zabraneNaPutu({
        duzina: sabijeno.duzina,
        krivine: sabijeno.krivine,
        // Dionica ima jedno ograničenje, pa naselja u njoj nema; kraj dionice
        // je uvijek raskrsnica ili mjesto u koje se stiže.
        raskrsnice: [sabijeno.duzina],
      }),
      geometry: { laneWidth: ROAD_LANE_WIDTH },
      viewHalf: ROAD_VIEW_HALF,
    };
  }

  const length = TRIP_SEGMENT_TIME * vMax;
  return {
    kind: "road",
    id: `road:${edge.id}:${seed >>> 0}${obrnuto ? ":obrnuto" : ""}`,
    length,
    edgeId: edge.id,
    edgeKm: edge.km,
    vMax,
    curves: krivine({ length }, edge, seed),
    landmarks: znamenitostiNaDionici(edge, length, obrnuto),
    zabrane: zabraneNaPutu({
      duzina: length,
      krivine: krivine({ length }, edge, seed),
      raskrsnice: [length],
    }),
    geometry: { laneWidth: ROAD_LANE_WIDTH },
    viewHalf: ROAD_VIEW_HALF,
  };
}

/**
 * Sporija vozila u našoj traci — nešto što se ima preteći.
 *
 * Postavljaju se tako da ih igrač sustigne otprilike u trenutku `kada`: nastaju
 * unaprijed i voze svojom brzinom, pa ne iskrsnu pred haubom.
 */
function spora(tpl: RoadTemplate, seed: number): ScenarioNpc[] {
  const r = rng((seed ^ 0x51ed270b) >>> 0);
  const out: ScenarioNpc[] = [];
  const v = tpl.vMax;
  const trajanje = tpl.length / v;
  for (let t = SLOW_GAP; t < trajanje; t += SLOW_GAP) {
    const kada = t + (r() - 0.5) * SLOW_GAP * 0.4;
    const mjesto = v * kada;
    if (mjesto > tpl.length) continue;
    const vs = v * SLOW_SHARE * (0.9 + r() * 0.2);
    const cilj = mjesto + 30;
    let spawnT = Math.max(0, kada - 60);
    let startS = cilj - vs * (kada - spawnT);
    if (startS < 0) {
      startS = 0;
      spawnT = Math.max(0, kada - cilj / Math.max(1, vs));
    }
    out.push({
      arm: "N",
      intent: { kind: "lane", index: 0 },
      startS,
      spawnAt: [spawnT, spawnT],
      speed: vs,
    });
  }
  return out;
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
  // Koliko dionica traje NIJE više uvijek `TRIP_SEGMENT_TIME`: sa stvarnom
  // geometrijom dužina zavisi od puta. Susretna kolona mora da prati to
  // trajanje, inače na dugoj dionici ostane praznih deset minuta.
  const trajanje = tpl.length / v;
  for (let t = ONCOMING_GAP; t < trajanje; t += ONCOMING_GAP) {
    // Razmak se malo koleba, da kolona ne bude metronom.
    const kada = t + (r() - 0.5) * ONCOMING_GAP * 0.6;
    const naDionici = tpl.length - 2 * v * kada;
    const startS = Math.max(0, naDionici);
    const spawnT = naDionici >= 0 ? 0 : 2 * kada - trajanje;
    if (spawnT >= trajanje) continue;
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
 * `obrnuto` je vožnja od `b` prema `a`: geometrija je ista, ali znamenitosti
 * dolaze obrnutim redom i sa druge strane puta.
 */
export function dionica(
  edge: RoadEdge,
  seed: number,
  obrnuto = false,
  geom?: EdgeGeometry,
): Scenario {
  const tpl = roadTemplate(edge, seed, obrnuto, geom);
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
    npcs: [...susretna(tpl, seed), ...spora(tpl, seed)],
    // Na otvorenom putu se vozi volanom: dionica ima trake, ne šinu.
    upravljanje: "traka",
    difficulty: TEZINA[edge.kind],
    title: naslov,
    explanation: opis,
  };
}
