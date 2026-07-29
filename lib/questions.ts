import { DEFAULT_ORDERING_POINTS } from "./config";
import type { Lang } from "./i18n";
import type {
  Answer,
  ChoiceQuestion,
  OptionKey,
  OrderingQuestion,
  Question,
} from "./types";

/**
 * Učitava bazu pitanja sa /questions.json (statički fajl iz public/).
 *
 * NAMJERNO bez `cache: "force-cache"`: ime fajla nema heš sadržaja, pa bi
 * force-cache koristio staru kopiju bez provjere kod servera — poslije izmjene
 * pitanja ili slika korisnik bi zadržao zastarjelu bazu (i dobijao 404 na slike
 * kojih više nema). Podrazumijevano ponašanje šalje uslovni zahtjev i server
 * vraća 304 ako se ništa nije promijenilo, pa je cijena zanemarljiva.
 */
export async function loadQuestions(signal?: AbortSignal): Promise<Question[]> {
  const res = await fetch("/questions.json", { signal });
  if (!res.ok) throw new Error(`Neuspješno učitavanje pitanja (HTTP ${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Neispravan format baze pitanja.");
  return data as Question[];
}

/** Bodovi pitanja; `ordering` u katalogu nema bod pa se koristi DEFAULT_ORDERING_POINTS. */
export function questionPoints(q: Question): number {
  return q.points ?? DEFAULT_ORDERING_POINTS;
}

/**
 * Tekst pitanja na traženom jeziku. Prevodi pitanja još ne postoje u
 * questions.json, pa se pada nazad na crnogorski — vidi `hasTranslation`.
 */
export function localizedText(q: Question, lang: Lang): string {
  return lang === "en" && q.text_en ? q.text_en : q.text;
}

/** Ponuđeni odgovor na traženom jeziku, uz isti fallback kao `localizedText`. */
export function localizedOption(q: ChoiceQuestion, key: OptionKey, lang: Lang): string {
  const en = lang === "en" ? q.options_en : undefined;
  return en?.[key] ?? q.options[key];
}

/** Da li pitanje uopšte ima prevod na dati jezik (koristi se za napomenu u UI-u). */
export function hasTranslation(q: Question, lang: Lang): boolean {
  if (lang === "me") return true;
  return Boolean(q.text_en);
}

/** Fisher–Yates — vraća novi niz, ne mijenja ulazni. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Nasumičan uzorak bez ponavljanja; `count` 0 ili veći od dužine vraća sve izmiješano. */
export function sample<T>(items: readonly T[], count: number): T[] {
  const shuffled = shuffle(items);
  if (count <= 0 || count >= shuffled.length) return shuffled;
  return shuffled.slice(0, count);
}

/**
 * Sastavlja ispit čiji je zbir bodova TAČNO `targetPoints`.
 *
 * Broj pitanja zato nije fiksan — zavisi od toga koliko koje pitanje nosi (1–4).
 * Radi u dva koraka: prvo pokupi nasumična pitanja koja staju u preostali budžet,
 * pa ako na kraju fali 1–4 boda, dopuni jednim pitanjem tačno te vrijednosti.
 * Drugi korak je bitan: bez njega bi ispit povremeno završio sa 78 ili 79 bodova,
 * pa bi prag „68 od 80" bio netačan.
 */
export function buildExam(questions: readonly Question[], targetPoints: number): Question[] {
  const pool = shuffle(questions);
  const chosen: Question[] = [];
  const used = new Set<number>();
  let remaining = targetPoints;

  for (const q of pool) {
    if (remaining === 0) break;
    const p = questionPoints(q);
    if (p > remaining) continue;
    chosen.push(q);
    used.add(q.id);
    remaining -= p;
  }

  // Dopuna: nađi neiskorišćeno pitanje koje tačno pokriva ostatak.
  if (remaining > 0) {
    const exact = pool.find((q) => !used.has(q.id) && questionPoints(q) === remaining);
    if (exact) {
      chosen.push(exact);
      remaining = 0;
    }
  }

  return shuffle(chosen);
}

/**
 * Vraća pitanja tačno onim redom kojim su ID-evi navedeni.
 * Koristi se za „nastavi vježbu" — bez sačuvanog redoslijeda korisnik bi se
 * vratio na isti *indeks*, ali na sasvim drugo pitanje.
 */
export function byIds(questions: readonly Question[], ids: readonly number[]): Question[] {
  const map = new Map(questions.map((q) => [q.id, q]));
  const out: Question[] = [];
  for (const id of ids) {
    const q = map.get(id);
    if (q) out.push(q);
  }
  return out;
}

/** Ostavlja samo cifre: "3-4-2-1", "3 4 2 1", "3421" → "3421". */
export function normalizeSequence(value: string): string {
  return value.replace(/\D/g, "");
}

/** Tačan redoslijed u kanonskom obliku za prikaz: "3-4-2-1". */
export function formatSequence(sequence: readonly string[]): string {
  return sequence.join("-");
}

export function isOrderingCorrect(q: OrderingQuestion, value: string): boolean {
  const given = normalizeSequence(value);
  return given.length > 0 && given === normalizeSequence(q.answer_sequence.join(""));
}

export function isChoiceCorrect(q: ChoiceQuestion, value: string): boolean {
  return value === q.correct;
}

/** Da li je odgovor tačan — jedinstvena tačka istine za oba tipa pitanja. */
export function isAnswerCorrect(q: Question, answer: Answer): boolean {
  if (q.type === "ordering") {
    return answer.kind === "ordering" && isOrderingCorrect(q, answer.value);
  }
  return answer.kind === "choice" && isChoiceCorrect(q, answer.value);
}

/** Ukupan broj bodova skupa pitanja (maksimum na ispitu). */
export function totalPoints(questions: readonly Question[]): number {
  return questions.reduce((sum, q) => sum + questionPoints(q), 0);
}

/** Formatira sekunde u mm:ss. */
export function formatClock(seconds: number): string {
  const safe = Math.max(seconds, 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
