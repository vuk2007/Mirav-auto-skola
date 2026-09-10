/**
 * Veza između pojmova simulacije i ključeva u `lib/i18n.ts`.
 *
 * Stoji odvojeno od komponenti da bi i ekran igre i (kasnije) rezime i replay
 * zvali iste nazive — prekršaj ne smije da se zove jedno na jednom ekranu, a
 * drugo na drugom.
 */

import type { Level } from "../sim/config";
import type { Dict } from "@/lib/i18n";
import { OPPOSITE, type Approach } from "@/lib/simRules";
import type { Intent, ViolationType } from "../sim/types";
import { crossIntent } from "../sim/types";

export const VIOLATION_LABEL: Readonly<Record<ViolationType, keyof Dict>> = {
  rightOfWay: "vioRightOfWay",
  stopSign: "vioStopSign",
  redLight: "vioRedLight",
  collision: "vioCollision",
  obstruction: "vioObstruction",
  speeding: "vioSpeeding",
  pedestrian: "vioPedestrian",
  officer: "vioOfficer",
  indicatorMissing: "vioIndicatorMissing",
  indicatorWrong: "vioIndicatorWrong",
  indicatorLate: "vioIndicatorLate",
  indicatorLeftOn: "vioIndicatorLeftOn",
  unsafeMerge: "vioUnsafeMerge",
  stoppedOnRamp: "vioStoppedOnRamp",
  tooSlow: "vioTooSlow",
  tailgating: "vioTailgating",
  brakingOnHighway: "vioBrakingOnHighway",
  hardShoulder: "vioHardShoulder",
  offRoad: "vioOffRoad",
  crossingSolidLine: "vioCrossingSolidLine",
  unsafeOvertake: "vioUnsafeOvertake",
  overtakeTooLong: "vioOvertakeTooLong",
  cutIn: "vioCutIn",
};

const TASK_LABEL_CROSS: Readonly<Record<"straight" | "left" | "right", keyof Dict>> = {
  straight: "gameTaskStraight",
  left: "gameTaskLeft",
  right: "gameTaskRight",
};

/**
 * Šta igrač treba da uradi, jednom rečenicom.
 *
 * Vraća gotov tekst, ne ključ: kružni tok nosi redni broj izlaza, pa se rečenica
 * ne može dobiti pukim indeksiranjem rječnika.
 */
export function taskTextFor(intent: Intent, t: Dict, exitCount = 4, taskKey?: string): string {
  // Scenario smije da kaže svoj zadatak: na autoputu se iz namjere vidi samo
  // polazna traka, ne i manevar.
  const iz = taskKey ? t[taskKey as keyof Dict] : undefined;
  if (typeof iz === "string") return iz;
  const c = crossIntent(intent);
  if (c) return t[TASK_LABEL_CROSS[c]];
  if (typeof intent !== "string" && intent.kind === "lane") return t.gameTaskMerge;
  if (typeof intent !== "string" && intent.kind === "exit") {
    return intent.n >= exitCount
      ? t.gameTaskFullCircle
      : t.gameTaskExit.replace("{n}", String(intent.n));
  }
  return t.gameTaskStraight;
}

/**
 * Koliko se od zona pokazivača vidi na datom nivou.
 *
 * Na prva dva nivoa zone nose i slovo strane, na trećem i četvrtom se vide
 * samo kao segmenti, a na petom ih nema — tada polaznik mora sam da zna gdje
 * se šta traži.
 *
 * Stoji ovdje, a ne u svakom ekranu ponaosob, jer je to jedna skala: scenario
 * i smjena moraju da je čitaju isto.
 */
export function zonesForLevel(
  level: Level,
  t: Dict,
): { labels?: { left: string; right: string } } | null {
  if (level >= 5) return null;
  return level <= 2
    ? { labels: { left: t.gameIndicatorShortLeft, right: t.gameIndicatorShortRight } }
    : {};
}

/** Znak na kraku igrača. Semafor nema tekst — HUD mu prikazuje boju. */
export const CONTROL_LABEL: Readonly<Record<string, keyof Dict>> = {
  none: "gameSignNone",
  priority: "gameSignPriority",
  yield: "gameSignYield",
  stop: "gameSignStop",
};

/**
 * Koje pravilo objašnjava dati prekršaj.
 *
 * Ne može se preslikati samo po vrsti prekršaja: „oduzeto prvenstvo" je jedno
 * pravilo na neregulisanoj raskrsnici, drugo pod znakom, a treće kad ljevak
 * presijeca susretnom. Zato se gleda i znak na kraku igrača i to odakle je
 * došlo vozilo kojem je prednost oduzeta.
 *
 * Tekstovi su isti oni koje koristi statični simulator — pravilo se ne smije
 * drukčije formulisati na dva mjesta u istoj aplikaciji.
 */
export function ruleKeyFor(opts: {
  type: ViolationType;
  control: string;
  playerArm: Approach;
  playerIntent: Intent;
  otherArm: Approach | null;
  /** Da li je vozilo kojem je oduzeta prednost bilo pod pratnjom. */
  otherEmergency?: boolean;
}): keyof Dict {
  switch (opts.type) {
    case "redLight":
      return "ruleRedStops";
    case "stopSign":
      return "ruleStopSign";
    case "obstruction":
      return "ruleObstruction";
    case "pedestrian":
      return "rulePedestrian";
    case "officer":
      return "ruleOfficer";
    case "indicatorLeftOn":
      return "ruleIndicatorOff";
    case "unsafeMerge":
      return "ruleMerge";
    case "stoppedOnRamp":
    case "tooSlow":
    case "speeding":
      return opts.control === "highway" ? "ruleHighwaySpeed" : "ruleSpeeding";
    case "hardShoulder":
      return "ruleHardShoulder";
    case "tailgating":
    case "brakingOnHighway":
      return "ruleFollowing";
    case "indicatorMissing":
    case "indicatorWrong":
    case "indicatorLate":
      return "ruleIndicator";
    default:
      break;
  }

  // `rightOfWay` i `collision` — pravilo zavisi od situacije.
  // Vozilo pod pratnjom je jače od svega ostalog, pa se gleda prvo.
  if (opts.otherEmergency) return "ruleEmergency";
  if (opts.playerIntent === "left" && opts.otherArm === OPPOSITE[opts.playerArm]) {
    return "ruleLeftTurn";
  }
  switch (opts.control) {
    case "stop":
      return "ruleStopSign";
    case "yield":
      return "ruleYieldSign";
    case "priority":
      return "rulePriorityRoad";
    case "green":
    case "yellow":
    case "red":
      return "ruleGreenNotFree";
    default:
      return "ruleRightHand";
  }
}
