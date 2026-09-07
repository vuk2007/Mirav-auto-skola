/**
 * Tok jedne smjene — čista logika, bez Reacta i bez crtanja.
 *
 * Odvojena je da bi se mogla testirati: bodovanje, životi i prilagođavanje
 * težine su pravila, a pravila se ne provjeravaju klikanjem.
 */

import type { Level } from "../sim/config";
import type { Violation, ViolationType, World } from "../sim/types";
import { nextLevel } from "./generate";

export const LIVES = 3;

export interface ShiftState {
  seed: number;
  /** Redni broj segmenta koji se upravo vozi. */
  index: number;
  level: Level;
  lives: number;
  /** Koliko je segmenata zaredom prošlo bez ijednog prekršaja. */
  cleanStreak: number;
  bestStreak: number;
  /** Koliko je segmenata završeno, bez obzira na ishod. */
  segments: number;
  violations: Partial<Record<ViolationType, number>>;
  /** Izmjerena vremena reakcije [s]; prazno ako nije bilo događaja. */
  reactions: number[];
  over: boolean;
}

export function startShift(seed: number): ShiftState {
  return {
    seed,
    index: 0,
    level: 1,
    lives: LIVES,
    cleanStreak: 0,
    bestStreak: 0,
    segments: 0,
    violations: {},
    reactions: [],
    over: false,
  };
}

/** Prosječno vrijeme reakcije, ili `null` ako nije bilo nijednog mjerenja. */
export function averageReaction(state: ShiftState): number | null {
  if (state.reactions.length === 0) return null;
  return state.reactions.reduce((a, b) => a + b, 0) / state.reactions.length;
}

/**
 * Šta se dešava kad se segment završi.
 *
 * Sudar je kraj smjene — to je jedina greška koja se u saobraćaju ne popravlja
 * sljedećom raskrsnicom. Svaki drugi prekršaj koji obara vožnju košta jedan
 * život; blagi se broje i prikazuju, ali život ne uzimaju.
 */
export function applySegment(state: ShiftState, world: World): ShiftState {
  const violations: Partial<Record<ViolationType, number>> = { ...state.violations };
  for (const v of world.violations) {
    violations[v.type] = (violations[v.type] ?? 0) + 1;
  }

  const reactions = [
    ...state.reactions,
    ...world.reaction
      .filter((r) => r.brakedAt !== null)
      .map((r) => r.brakedAt! - r.at),
  ];

  const sudar = world.violations.some((v: Violation) => v.type === "collision");
  const pao = world.violations.some((v: Violation) => v.severity === "fail");

  const lives = sudar ? 0 : pao ? state.lives - 1 : state.lives;
  const cleanStreak = pao ? 0 : state.cleanStreak + 1;

  return {
    ...state,
    index: state.index + 1,
    segments: state.segments + 1,
    lives: Math.max(0, lives),
    cleanStreak,
    bestStreak: Math.max(state.bestStreak, cleanStreak),
    level: nextLevel(state.level, cleanStreak, pao),
    violations,
    reactions,
    over: lives <= 0,
  };
}
