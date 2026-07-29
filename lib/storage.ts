/**
 * Tanak omotač oko localStorage-a.
 *
 * Sve je u try/catch jer u <iframe>-u skladište trećih strana može biti
 * blokirano (Safari „Prevent cross-site tracking", privatni prozor, korporativne
 * politike). U tom slučaju kviz radi normalno, samo bez pamćenja.
 */

import type { Category } from "./categories";
import type { Lang } from "./i18n";

const KEY_LANG = "mirav.lang";
const KEY_BEST = "mirav.bestExam";
const KEY_PRACTICE = "mirav.practice";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Skladište nedostupno ili puno — pamćenje se tiho preskače.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignoriši
  }
}

// ── Jezik ───────────────────────────────────────────────────────────────────

export function loadLang(): Lang | null {
  const value = read<unknown>(KEY_LANG);
  return value === "me" || value === "en" ? value : null;
}

export function saveLang(lang: Lang): void {
  write(KEY_LANG, lang);
}

// ── Najbolji rezultat simulacije ────────────────────────────────────────────

export interface BestExam {
  percent: number;
  scored: number;
  max: number;
  passed: boolean;
  /** ISO datum, radi prikaza „kad". */
  date: string;
}

export function loadBestExam(): BestExam | null {
  const v = read<Partial<BestExam>>(KEY_BEST);
  if (
    !v ||
    typeof v.percent !== "number" ||
    typeof v.scored !== "number" ||
    typeof v.max !== "number" ||
    typeof v.date !== "string"
  ) {
    return null;
  }
  return {
    percent: v.percent,
    scored: v.scored,
    max: v.max,
    passed: Boolean(v.passed),
    date: v.date,
  };
}

/** Upisuje rezultat samo ako je bolji od zapamćenog. */
export function saveBestExam(result: Omit<BestExam, "date">): void {
  const prev = loadBestExam();
  if (prev && prev.percent >= result.percent) return;
  write(KEY_BEST, { ...result, date: new Date().toISOString() });
}

// ── Nastavak vježbe ─────────────────────────────────────────────────────────

export interface PracticeState {
  category: Category;
  /** Redoslijed pitanja u sesiji — bez njega „nastavi" ne bi vratio isto pitanje. */
  ids: number[];
  index: number;
  correct: number;
  answered: number;
}

export function loadPractice(): PracticeState | null {
  const v = read<Partial<PracticeState>>(KEY_PRACTICE);
  if (
    !v ||
    typeof v.category !== "string" ||
    !Array.isArray(v.ids) ||
    v.ids.length === 0 ||
    !v.ids.every((id) => typeof id === "number") ||
    typeof v.index !== "number"
  ) {
    return null;
  }
  return {
    category: v.category as Category,
    ids: v.ids,
    index: v.index,
    correct: typeof v.correct === "number" ? v.correct : 0,
    answered: typeof v.answered === "number" ? v.answered : 0,
  };
}

export function savePractice(state: PracticeState): void {
  write(KEY_PRACTICE, state);
}

export function clearPractice(): void {
  remove(KEY_PRACTICE);
}
