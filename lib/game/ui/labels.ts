/**
 * Veza između pojmova simulacije i ključeva u `lib/i18n.ts`.
 *
 * Stoji odvojeno od komponenti da bi i ekran igre i (kasnije) rezime i replay
 * zvali iste nazive — prekršaj ne smije da se zove jedno na jednom ekranu, a
 * drugo na drugom.
 */

import type { Dict } from "@/lib/i18n";
import { OPPOSITE, type Approach } from "@/lib/simRules";
import type { Intent, ViolationType } from "../sim/types";

export const VIOLATION_LABEL: Readonly<Record<ViolationType, keyof Dict>> = {
  rightOfWay: "vioRightOfWay",
  stopSign: "vioStopSign",
  redLight: "vioRedLight",
  collision: "vioCollision",
  obstruction: "vioObstruction",
  speeding: "vioSpeeding",
  pedestrian: "vioPedestrian",
  officer: "vioOfficer",
};

export const TASK_LABEL: Readonly<Record<Intent, keyof Dict>> = {
  straight: "gameTaskStraight",
  left: "gameTaskLeft",
  right: "gameTaskRight",
};

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
    case "speeding":
      return "ruleSpeeding";
    case "pedestrian":
      return "rulePedestrian";
    case "officer":
      return "ruleOfficer";
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
