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

import { INDICATOR_LEAD, INDICATOR_OFF_AFTER, MERGE_ZONE } from "./config";
import type { Intent, Path, Severity, ViolationType } from "./types";
import { turnSide } from "./types";

/** Karakteristična mjesta na putanji, na koja se pravila vežu. */
export type Anchor =
  | "pathStart"
  | "stopLine"
  | "boxEnter"
  | "boxExit"
  | "pathEnd"
  /** Izlaz koji prethodi mom — postoji samo u kružnom toku. */
  | "prevExit"
  /** Kraj trake za ubrzavanje — postoji samo na spoljnoj traci autoputa. */
  | "rampEnd";

/**
 * Za koji manevar pravilo važi.
 *
 * Krstasta raskrsnica ima tri; kružni tok tri druga, jer se tamo ne pita smjer
 * nego koji izlaz: prvi (desno), drugi (praktično pravo) i treći ili dalji.
 */
export type Maneuver = "left" | "right" | "straight" | "ring1" | "ring2" | "ringN" | "lane";

export interface Spot {
  at: Anchor;
  /** Pomak duž putanje [m]; negativan je prije sidra. */
  offset: number;
}

export interface IndicatorPhase {
  id: string;
  maneuver: Maneuver;
  from: Spot;
  to: Spot;
  /** Očekivano stanje pokazivača kroz cijelu fazu. */
  expected: "left" | "right" | null;
  /** Do kad najkasnije mora biti uključen; poslije toga je `indicatorLate`. */
  mustBeSetBefore?: Spot;
  severity: Severity;
  /** Koji se prekršaj prijavljuje kad se očekuje ugašen, a nije. */
  mismatchType?: ViolationType;
  /**
   * Faza koja se CRTA, ali se ne ocjenjuje.
   *
   * Postoji zbog autoputa. Tamo se pokazivač traži uz sam čin promjene trake, a
   * ne na dionici puta: čim se uključenje završi, ispravno je ugasiti ga. Faza
   * koja bi kroz cijelu zonu tražila lijevi kaznila bi upravo to gašenje —
   * dakle ispravno ponašanje. Zato zona ostaje putokaz igraču, a sud i dalje
   * donosi `laneStep`. Razlika je ovdje, u podatku, a ne skrivena u kodu.
   */
  hintOnly?: boolean;
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

  // ── Kružni tok ────────────────────────────────────────────────────────────
  //
  // Prvi izlaz: desni od prilaza pa sve do izlaska. Drugi izlaz: bez pokazivača
  // do prethodnog izlaza, pa desni. Treći i dalji, kao i puni krug: lijevi od
  // prilaza, pa desni tek kad se prođe izlaz prije svog.
  //
  // Rok za desni na izlazu je POČETAK te faze („najkasnije kad prođeš izlaz
  // prije svog"), pa `mustBeSetBefore` smije da bude jednak `from` — provjera
  // tada traži da pokazivač već bude upaljen na ulasku u fazu.
  {
    id: "krug-prvi-izlaz",
    maneuver: "ring1",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "boxExit", offset: 0 },
    expected: "right",
    mustBeSetBefore: { at: "stopLine", offset: 0 },
    severity: "fail",
  },
  {
    id: "krug-drugi-prilaz",
    maneuver: "ring2",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "prevExit", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorWrong",
  },
  {
    id: "krug-dalji-prilaz",
    maneuver: "ringN",
    from: { at: "stopLine", offset: -INDICATOR_LEAD },
    to: { at: "prevExit", offset: 0 },
    expected: "left",
    mustBeSetBefore: { at: "stopLine", offset: 0 },
    severity: "fail",
  },
  {
    id: "krug-izlaz-drugi",
    maneuver: "ring2",
    from: { at: "prevExit", offset: 0 },
    to: { at: "boxExit", offset: 0 },
    expected: "right",
    mustBeSetBefore: { at: "prevExit", offset: 0 },
    severity: "fail",
  },
  {
    id: "krug-izlaz-dalji",
    maneuver: "ringN",
    from: { at: "prevExit", offset: 0 },
    to: { at: "boxExit", offset: 0 },
    expected: "right",
    mustBeSetBefore: { at: "prevExit", offset: 0 },
    severity: "fail",
  },
  // ── Autoput ───────────────────────────────────────────────────────────────
  //
  // Jedina zona koja se ne ocjenjuje — vidi `hintOnly`. Crta se samo na
  // spoljnoj traci, jer samo ona ima kraj trake za ubrzavanje.
  {
    id: "traka-najava",
    maneuver: "lane",
    from: { at: "rampEnd", offset: -MERGE_ZONE },
    to: { at: "rampEnd", offset: 0 },
    expected: "left",
    severity: "minor",
    hintOnly: true,
  },

  {
    id: "krug-gasenje",
    maneuver: "ring1",
    from: { at: "boxExit", offset: INDICATOR_OFF_AFTER },
    to: { at: "pathEnd", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorLeftOn",
  },
  {
    id: "krug-gasenje-drugi",
    maneuver: "ring2",
    from: { at: "boxExit", offset: INDICATOR_OFF_AFTER },
    to: { at: "pathEnd", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorLeftOn",
  },
  {
    id: "krug-gasenje-dalji",
    maneuver: "ringN",
    from: { at: "boxExit", offset: INDICATOR_OFF_AFTER },
    to: { at: "pathEnd", offset: 0 },
    expected: null,
    severity: "minor",
    mismatchType: "indicatorLeftOn",
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
            : spot.at === "prevExit"
              ? (path.prevExitS ?? path.stopLineS)
              : spot.at === "rampEnd"
                // Putanja bez trake za ubrzavanje daje nulu, pa se zona sama
                // sažme na ništa i `phasesFor` je odbaci.
                ? (path.rampEndS ?? 0)
                : path.length;
  return Math.max(0, Math.min(path.length, base + spot.offset));
}

/**
 * Koji manevar putanja predstavlja, u pojmovima tabele pravila.
 *
 * Kružni tok se ne svodi na smjer: prvi izlaz je desno, drugi je praktično
 * pravo, a treći i dalji su lijevo — ali pravila za njih nisu ista kao za
 * skretanje na krstastoj raskrsnici, pa imaju svoje ključeve.
 */
export function maneuverFor(intent: Intent): Maneuver {
  const side = turnSide(intent);
  if (side) return side;
  // Autoput nema faza vezanih za mjesto na putanji: pokazivač se tamo traži uz
  // promjenu trake, a to je događaj, ne dionica. Zato manevar postoji, a
  // nijedno pravilo u tabeli ga ne pominje — vidi `laneStep` u `world.ts`.
  if (typeof intent !== "string" && intent.kind === "lane") return "lane";
  if (typeof intent !== "string" && intent.kind === "exit") {
    return intent.n <= 1 ? "ring1" : intent.n === 2 ? "ring2" : "ringN";
  }
  return "straight";
}

export interface ResolvedPhase {
  id: string;
  from: number;
  to: number;
  expected: "left" | "right" | null;
  mustBeSetBefore: number | null;
  severity: Severity;
  mismatchType: ViolationType;
  hintOnly: boolean;
}

/**
 * Faze koje važe za dati manevar, sa `s` vrijednostima za tu putanju.
 *
 * Podrazumijevano vraća samo one po kojima se sudi. Crtanje traži i one koje su
 * puki putokaz (`hints: true`) — jedna funkcija za oboje, da se ono što se
 * prikazuje i ono što se traži ne mogu razići.
 */
export function phasesFor(
  path: Path,
  intent: Intent,
  rules: readonly IndicatorPhase[] = INDICATOR_RULES,
  { hints = false }: { hints?: boolean } = {},
): ResolvedPhase[] {
  const maneuver = maneuverFor(intent);
  return rules
    .filter((r) => r.maneuver === maneuver && (hints || !r.hintOnly))
    .map((r) => ({
      id: r.id,
      from: resolveSpot(path, r.from),
      to: resolveSpot(path, r.to),
      expected: r.expected,
      mustBeSetBefore: r.mustBeSetBefore ? resolveSpot(path, r.mustBeSetBefore) : null,
      severity: r.severity,
      mismatchType: r.mismatchType ?? "indicatorWrong",
      hintOnly: Boolean(r.hintOnly),
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
