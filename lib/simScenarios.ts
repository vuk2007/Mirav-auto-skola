import type { Dict } from "./i18n";
import type { DrawnScenario, Family } from "./simRules";

/**
 * Ručno autorski scenariji za simulator raskrsnica.
 *
 * ID-jevi vozila se dodjeljuju redom **N → E → S → W** među prisutnim kracima —
 * to je jedino pravilo kojeg se treba držati pri dodavanju novih scena.
 *
 * Svaki `answer` / `decision` provjerava test protiv rule-engine-a
 * (`lib/simRules.ts`). Ako se ne poklope, test pada — zato scenariji ne mogu
 * tiho odlutati od pravila.
 *
 * Šta NIJE autorisano i zašto:
 *  - **znaci policijskog službenika**: semantika znakova rukama (koji krak staje
 *    zavisi od položaja tijela i ruku) nije potvrđena iz Pravilnika, pa engine
 *    to i ne podržava. Bolje bez scenarija nego sa pogrešnim.
 *  - **četiri vozila na neregulisanoj raskrsnici**: „bešavna petlja" — svako ima
 *    nekoga sa desne strane, pravilo samo ne rješava situaciju.
 *  - **situacije sa više valjanih redoslijeda**: engine ih odbija, pa ih nema.
 */

const R = (...keys: (keyof Dict)[]) => keys;

// ── Pravilo desne strane: neregulisana raskrsnica, sva vozila idu pravo ──────
const PRAVILO: DrawnScenario[] = [
  {
    id: "rh-2-nw",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
  {
    id: "rh-2-es",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "van" },
    ],
    answer: [1, 2],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
  {
    id: "rh-3-nes",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "van" },
      { id: 3, approach: "S", intent: "straight", kind: "car" },
    ],
    answer: [1, 2, 3],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
  {
    id: "rh-3-new",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "van" },
    ],
    answer: [3, 1, 2],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
  {
    id: "rh-3-esw",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "van" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [1, 2, 3],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
  {
    id: "rh-3-nsw",
    family: "pravilo",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "van" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [2, 3, 1],
    rules: R("ruleFreeRight", "ruleRightHand"),
  },
];

// ── Glavni / sporedni put: znak prvenstva (romb), ustupi prvenstvo, STOP ─────
const ZNACI: DrawnScenario[] = [
  {
    id: "sg-main-ns-w",
    family: "znaci",
    layout: "cross",
    approaches: {
      N: { sign: "priority" },
      S: { sign: "priority" },
      W: { sign: "yield" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [1, 2],
    rules: R("rulePriorityRoad", "ruleYieldSign"),
  },
  {
    id: "sg-main-ns-e-stop",
    family: "znaci",
    layout: "cross",
    approaches: {
      N: { sign: "priority" },
      S: { sign: "priority" },
      E: { sign: "stop" },
    },
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "van" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: R("rulePriorityRoad", "ruleStopSign"),
  },
  {
    id: "sg-main-ew-n",
    family: "znaci",
    layout: "cross",
    approaches: {
      E: { sign: "priority" },
      W: { sign: "priority" },
      N: { sign: "yield" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "left", kind: "van" },
    ],
    // E i W su na glavnom putu; W skreće lijevo pa ustupa susretnom E.
    answer: [2, 3, 1],
    rules: R("rulePriorityRoad", "ruleLeftTurn"),
  },
  {
    id: "sg-main-ns-both-e",
    family: "znaci",
    layout: "cross",
    approaches: {
      N: { sign: "priority" },
      S: { sign: "priority" },
      E: { sign: "yield" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "S", intent: "left", kind: "car" },
    ],
    answer: [1, 3, 2],
    rules: R("rulePriorityRoad", "ruleLeftTurn"),
  },
  {
    id: "sg-main-ns-ew",
    family: "znaci",
    layout: "cross",
    approaches: {
      N: { sign: "priority" },
      S: { sign: "priority" },
      E: { sign: "yield" },
      W: { sign: "yield" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "van" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "S", intent: "left", kind: "car" },
      { id: 4, approach: "W", intent: "left", kind: "car" },
    ],
    answer: [1, 3, 2, 4],
    rules: R("rulePriorityRoad", "ruleLeftTurn"),
  },
  {
    id: "sg-main-ew-s-stop",
    family: "znaci",
    layout: "cross",
    approaches: {
      E: { sign: "priority" },
      W: { sign: "priority" },
      S: { sign: "stop" },
    },
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "left", kind: "van" },
    ],
    answer: [1, 3, 2],
    rules: R("rulePriorityRoad", "ruleStopSign", "ruleLeftTurn"),
  },
];

// ── Semafor: zeleno nije bezuslovno; ljevak propušta susretno vozilo ─────────
const SEMAFOR: DrawnScenario[] = [
  {
    id: "tl-ns-green-e-red",
    family: "semafor",
    layout: "cross",
    approaches: {
      N: { light: "green" },
      S: { light: "green" },
      E: { light: "red" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "S", intent: "left", kind: "car" },
    ],
    answer: [1, 3],
    rules: R("ruleGreenNotFree", "ruleLeftTurn", "ruleRedStops"),
  },
  {
    id: "tl-ew-green-s-red",
    family: "semafor",
    layout: "cross",
    approaches: {
      E: { light: "green" },
      W: { light: "green" },
      S: { light: "red" },
    },
    vehicles: [
      { id: 1, approach: "E", intent: "left", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "van" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [3, 1],
    rules: R("ruleGreenNotFree", "ruleLeftTurn", "ruleRedStops"),
  },
  {
    id: "tl-ns-left",
    family: "semafor",
    layout: "cross",
    approaches: {
      N: { light: "green" },
      S: { light: "green" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "left", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: R("ruleGreenNotFree", "ruleLeftTurn"),
  },
  {
    id: "tl-all-four",
    family: "semafor",
    layout: "cross",
    approaches: {
      N: { light: "green" },
      S: { light: "green" },
      E: { light: "red" },
      W: { light: "red" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "van" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "S", intent: "left", kind: "car" },
      { id: 4, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [1, 3],
    rules: R("ruleGreenNotFree", "ruleLeftTurn", "ruleRedStops"),
  },
  {
    id: "tl-ew-left",
    family: "semafor",
    layout: "cross",
    approaches: {
      E: { light: "green" },
      W: { light: "green" },
    },
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "car" },
      { id: 2, approach: "W", intent: "left", kind: "van" },
    ],
    answer: [1, 2],
    rules: R("ruleGreenNotFree", "ruleLeftTurn"),
  },
  {
    id: "tl-n-red",
    family: "semafor",
    layout: "cross",
    approaches: {
      N: { light: "red" },
      E: { light: "green" },
      W: { light: "green" },
    },
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "left", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [3, 2],
    rules: R("ruleGreenNotFree", "ruleLeftTurn", "ruleRedStops"),
  },
];

// ── Skretanje ulijevo na neregulisanoj raskrsnici ────────────────────────────
const LJEVAK: DrawnScenario[] = [
  {
    id: "lt-ns",
    family: "ljevak",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "left", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: R("ruleLeftTurn"),
  },
  {
    id: "lt-ew",
    family: "ljevak",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "E", intent: "left", kind: "van" },
      { id: 2, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: R("ruleLeftTurn"),
  },
  {
    id: "lt-nsw",
    family: "ljevak",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "left", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "van" },
    ],
    answer: [2, 3, 1],
    rules: R("ruleLeftTurn", "ruleRightHand"),
  },
  {
    id: "lt-nes",
    family: "ljevak",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "S", intent: "left", kind: "van" },
    ],
    answer: [1, 2, 3],
    rules: R("ruleLeftTurn", "ruleRightHand"),
  },
];

// ── Kružni tok: odluka „prolazim / propuštam" ───────────────────────────────
const KRUZNI: DrawnScenario[] = [
  {
    id: "rb-yield-1",
    family: "kruzni",
    layout: "roundabout",
    vehicles: [
      { id: 1, approach: "S", intent: "straight", kind: "car" },
      { id: 2, approach: "W", intent: "straight", kind: "car", inRoundabout: true },
    ],
    decision: { vehicleId: 1, answer: "yield" },
    rules: R("ruleRoundabout"),
  },
  {
    id: "rb-go-1",
    family: "kruzni",
    layout: "roundabout",
    vehicles: [{ id: 1, approach: "S", intent: "straight", kind: "car" }],
    decision: { vehicleId: 1, answer: "go" },
    rules: R("ruleRoundabout"),
  },
  {
    id: "rb-yield-2",
    family: "kruzni",
    layout: "roundabout",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car", inRoundabout: true },
      { id: 2, approach: "E", intent: "straight", kind: "van", inRoundabout: true },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    decision: { vehicleId: 3, answer: "yield" },
    rules: R("ruleRoundabout"),
  },
  {
    id: "rb-inside",
    family: "kruzni",
    layout: "roundabout",
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "car", inRoundabout: true },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
    ],
    decision: { vehicleId: 1, answer: "go" },
    rules: R("ruleRoundabout"),
  },
];

// ── Pješaci: odluka „prolazim / propuštam" ─────────────────────────────────
const PJESACI: DrawnScenario[] = [
  {
    id: "pd-right-turn",
    family: "pjesaci",
    layout: "cross",
    vehicles: [{ id: 1, approach: "N", intent: "right", kind: "car" }],
    pedestrians: [{ crossing: "W" }],
    decision: { vehicleId: 1, answer: "yield" },
    rules: R("rulePedestrian"),
  },
  {
    id: "pd-left-turn",
    family: "pjesaci",
    layout: "cross",
    vehicles: [{ id: 1, approach: "N", intent: "left", kind: "car" }],
    pedestrians: [{ crossing: "E" }],
    decision: { vehicleId: 1, answer: "yield" },
    rules: R("rulePedestrian"),
  },
  {
    id: "pd-straight-clear",
    family: "pjesaci",
    layout: "cross",
    vehicles: [{ id: 1, approach: "N", intent: "straight", kind: "car" }],
    pedestrians: [{ crossing: "E" }],
    decision: { vehicleId: 1, answer: "go" },
    rules: R("rulePedestrian"),
  },
];

export const DRAWN_SCENARIOS: readonly DrawnScenario[] = [
  ...PRAVILO,
  ...ZNACI,
  ...SEMAFOR,
  ...LJEVAK,
  ...KRUZNI,
  ...PJESACI,
];

/** Scenariji jedne familije. */
export function scenariosOf(family: Family): DrawnScenario[] {
  return DRAWN_SCENARIOS.filter((s) => s.family === family);
}

/** Familije koje imaju scenarije, redom kojim se prikazuju. */
export const FAMILIES: readonly { value: Family; labelKey: keyof Dict }[] = [
  { value: "pravilo", labelKey: "simFamilyRule" },
  { value: "znaci", labelKey: "simFamilySigns" },
  { value: "semafor", labelKey: "simFamilyLights" },
  { value: "ljevak", labelKey: "simFamilyLeft" },
  { value: "kruzni", labelKey: "simFamilyRoundabout" },
  { value: "pjesaci", labelKey: "simFamilyPedestrian" },
] as const;
