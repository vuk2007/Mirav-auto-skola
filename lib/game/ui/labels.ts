/**
 * Veza između pojmova simulacije i ključeva u `lib/i18n.ts`.
 *
 * Stoji odvojeno od komponenti da bi i ekran igre i (kasnije) rezime i replay
 * zvali iste nazive — prekršaj ne smije da se zove jedno na jednom ekranu, a
 * drugo na drugom.
 */

import type { Dict } from "@/lib/i18n";
import type { Intent, ViolationType } from "../sim/types";

export const VIOLATION_LABEL: Readonly<Record<ViolationType, keyof Dict>> = {
  rightOfWay: "vioRightOfWay",
  stopSign: "vioStopSign",
  redLight: "vioRedLight",
  collision: "vioCollision",
  obstruction: "vioObstruction",
  speeding: "vioSpeeding",
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
