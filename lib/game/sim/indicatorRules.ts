/**
 * Pravila pokazivača pravca — kao PODATAK, ne kao kod.
 *
 * Tabela se mijenja po ZOBS-u i po praksi škole, pa detekcija ne smije da je
 * zna napamet. `evaluatePhase` u `world.ts` radi isključivo nad ovim oblikom;
 * test u `indicator.test.ts` mijenja tabelu i traži da se rezultat promijeni
 * bez ijedne izmjene u detekciji.
 *
 * Mjesta na putanji se ne pišu kao brojevi nego kao sidro + pomak, jer se `s`
 * stop-linije i izlaza razlikuju od putanje do putanje.
 */

import { INDICATOR_LEAD, INDICATOR_OFF_AFTER } from "./config";
import type { Intent, Path, Severity, ViolationType } from "./types";
import { turnSide } from "./types";

/** Karakteristična mjesta na putanji, na koja se pravila vežu. */
export type Anchor = "pathStart" | "stopLine" | "boxEnter" | "boxExit" | "pathEnd";

export interface Spot {
  at: Anchor;
  /** Pomak duž putanje [m]; negativan je prije sidra. */
  offset: number;
}

export interface IndicatorPhase {
  id: string;
  /** Za koji manevar pravilo važi. */
  maneuver: "left" | "right" | "straight";
  from: Spot;
  to: Spot;
  /** Očekivano stanje pokazivača kroz cijelu fazu. */
  expected: "left" | "right" | null;
  /** Do kad najkasnije mora biti uključen; poslije toga je `indicatorLate`. */
  mustBeSetBefore?: Spot;
  severity: Severity;
  /** Koji se prekršaj prijavljuje kad se očekuje ugašen, a nije. */
  mismatchType?: ViolationType;
}

/**
 * Krstasta raskrsnica.
 *
 * Najava skretanja je `fail` — bez nje ostali ne znaju šta namjeravaš i to je
 * suština pravila. Gašenje poslije skretanja je `minor`: jeste greška, ali nije
 * istog reda.
 *
 * Faza najave traje DO IZLASKA iz raskrsnice, ne do stop-linije. Razlog je
 * mjeren, ne estetski: u ovom modelu je `stopLineS === boxEnterS`, pa bi faza
 * koja se završava na liniji imala nultu dužinu poslije `mustBeSetBefore` i
 * `indicatorLate` se ne bi mogao okinuti nikad — pravilo bi postojalo u tabeli
 * a ne bi radilo.
 */
export const INDICATOR_RULES: readonly IndicatorPhase[] = [
  {
    id: "najava-lijevo",
    maneuver: "left",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "boxExit", offset: 0 },
    expected: "left",
    mustBeSetBefore: { at: "stopLine", offset: 0 },
    severity: "fail",
  },
  {
    id: "najava-desno",
    maneuver: "right",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "boxExit", offset: 0 },
    expected: "right",
    mustBeSetBefore: { at: "stopLine", offset: 0 },
    severity: "fail",
  },
  {
    id: "gasenje-lijevo",
    maneuver: "left",
    from: { at: "boxExit", offset: INDICATOR_OFF_AFTER },
    to: { at: "pathEnd", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorLeftOn",
  },
  {
    id: "gasenje-desno",
    maneuver: "right",
    from: { at: "boxExit", offset: INDICATOR_OFF_AFTER },
    to: { at: "pathEnd", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorLeftOn",
  },
  {
    id: "pravo-bez-pokazivaca",
    maneuver: "straight",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "boxExit", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorWrong",
  },
];

export function resolveSpot(path: Path, spot: Spot): number {
  const base =
    spot.at === "pathStart"
      ? 0
      : spot.at === "stopLine"
        ? path.stopLineS
        : spot.at === "boxEnter"
          ? path.boxEnterS
          : spot.at === "boxExit"
            ? path.boxExitS
            : path.length;
  return Math.max(0, Math.min(path.length, base + spot.offset));
}

export interface ResolvedPhase {
  id: string;
  from: number;
  to: number;
  expected: "left" | "right" | null;
  mustBeSetBefore: number | null;
  severity: Severity;
  mismatchType: ViolationType;
}

/** Faze koje važe za dati manevar, sa `s` vrijednostima za tu putanju. */
export function phasesFor(
  path: Path,
  intent: Intent,
  rules: readonly IndicatorPhase[] = INDICATOR_RULES,
): ResolvedPhase[] {
  const side = turnSide(intent);
  const maneuver = side ?? "straight";
  return rules
    .filter((r) => r.maneuver === maneuver)
    .map((r) => ({
      id: r.id,
      from: resolveSpot(path, r.from),
      to: resolveSpot(path, r.to),
      expected: r.expected,
      mustBeSetBefore: r.mustBeSetBefore ? resolveSpot(path, r.mustBeSetBefore) : null,
      severity: r.severity,
      mismatchType: r.mismatchType ?? "indicatorWrong",
    }))
    .filter((p) => p.to > p.from);
}

/**
 * Koje se stanje pokazivača očekuje na mjestu `s`.
 *
 * Koriste je i botovi (da bi vozili ispravno) i crtanje (da bi se zona vidjela)
 * — ista funkcija, pa se ono što se traži i ono što se prikazuje ne mogu
 * razići.
 */
export function expectedIndicatorAt(
  path: Path,
  intent: Intent,
  s: number,
  rules: readonly IndicatorPhase[] = INDICATOR_RULES,
): "left" | "right" | null {
  for (const p of phasesFor(path, intent, rules)) {
    if (s >= p.from && s < p.to && p.expected !== null) return p.expected;
  }
  return null;
}
