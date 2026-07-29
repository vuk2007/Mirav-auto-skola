import type { Dict } from "./i18n";

/**
 * Crtani scenariji raskrsnice — familija „pravilo desne strane".
 *
 * Scena se opisuje podacima, a crta se programski (vidi components/sim/).
 * Za sada su svi scenariji na neregulisanoj raskrsnici (bez znakova i semafora)
 * i sva vozila zadržavaju pravac — tada je redoslijed jednoznačno određen
 * pravilom desne strane, pa nema prostora za spor oko tačnog odgovora.
 */

export type Approach = "N" | "E" | "S" | "W";
export type Intent = "straight" | "left" | "right";
export type VehicleKind = "car" | "van";

export interface DrawnVehicle {
  /** Broj kojim je vozilo označeno u sceni (1..n). */
  id: number;
  approach: Approach;
  intent: Intent;
  kind: VehicleKind;
}

export interface DrawnScenario {
  id: string;
  family: "priority";
  layout: "cross";
  vehicles: DrawnVehicle[];
  /** Tačan redoslijed prolaska (id-jevi). Autoritativan — solver ga provjerava. */
  answer: number[];
  /** Ključevi pravila koja se ispisuju uz rješenje. */
  rules: (keyof Dict)[];
}

/**
 * Kome vozilo ustupa prvenstvo — vozilu sa svoje desne strane.
 *
 * Desna strana zavisi od smjera kretanja (desna vožnja):
 * vozilo sa sjevera ide na jug, pa mu je desno zapad; sa zapada ide na istok,
 * desno mu je jug; i tako u krug N → W → S → E → N.
 */
export const YIELDS_TO: Readonly<Record<Approach, Approach>> = {
  N: "W",
  W: "S",
  S: "E",
  E: "N",
};

/**
 * Računa redoslijed prolaska po pravilu desne strane.
 *
 * Vrijedi samo za neregulisanu raskrsnicu na kojoj sva vozila zadržavaju pravac.
 * Vraća `null` ako se redoslijed ne može odrediti — kad sva četiri kraka imaju
 * vozilo, svako ima nekoga sa desne strane i nastaje „bešavna petlja"
 * (zaglavljeni krug), koju pravilo samo ne rješava.
 */
export function solveRightHand(vehicles: readonly DrawnVehicle[]): number[] | null {
  const remaining = new Map<Approach, DrawnVehicle>();
  for (const v of vehicles) {
    if (v.intent !== "straight") return null; // skretanja traže dodatna pravila
    remaining.set(v.approach, v);
  }

  const order: number[] = [];
  while (remaining.size > 0) {
    // Prolazi vozilo koje nikoga (više) nema sa svoje desne strane.
    const free = [...remaining.values()].find((v) => !remaining.has(YIELDS_TO[v.approach]));
    if (!free) return null; // bešavna petlja
    order.push(free.id);
    remaining.delete(free.approach);
  }
  return order;
}

const RULES: (keyof Dict)[] = ["ruleFreeRight", "ruleRightHand"];

/**
 * Scenariji su ručno autorski, a ID-jevi vozila se dodjeljuju redom N → E → S → W
 * među prisutnim kracima. Test provjerava da se `answer` poklapa sa `solveRightHand`.
 */
export const DRAWN_SCENARIOS: readonly DrawnScenario[] = [
  {
    id: "rh-2-nw",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [2, 1],
    rules: RULES,
  },
  {
    id: "rh-2-es",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "car" },
      { id: 2, approach: "S", intent: "straight", kind: "van" },
    ],
    answer: [1, 2],
    rules: RULES,
  },
  {
    id: "rh-3-nes",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "van" },
      { id: 3, approach: "S", intent: "straight", kind: "car" },
    ],
    answer: [1, 2, 3],
    rules: RULES,
  },
  {
    id: "rh-3-new",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "car" },
      { id: 2, approach: "E", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "van" },
    ],
    answer: [3, 1, 2],
    rules: RULES,
  },
  {
    id: "rh-3-esw",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "E", intent: "straight", kind: "van" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [1, 2, 3],
    rules: RULES,
  },
  {
    id: "rh-3-nsw",
    family: "priority",
    layout: "cross",
    vehicles: [
      { id: 1, approach: "N", intent: "straight", kind: "van" },
      { id: 2, approach: "S", intent: "straight", kind: "car" },
      { id: 3, approach: "W", intent: "straight", kind: "car" },
    ],
    answer: [2, 3, 1],
    rules: RULES,
  },
] as const;

export function isDrawnOrderCorrect(
  scenario: DrawnScenario,
  picked: readonly number[],
): boolean {
  return (
    picked.length === scenario.answer.length &&
    picked.every((v, i) => v === scenario.answer[i])
  );
}
