import { ORDERING_POINTS } from "./config";
import type { Answer, ChoiceQuestion, OrderingQuestion, Question } from "./types";

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

/** Bodovi pitanja; `ordering` u JSON-u ima null pa se koristi ORDERING_POINTS. */
export function questionPoints(q: Question): number {
  return q.points ?? ORDERING_POINTS;
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

/** Nasumičan uzorak; ako je `count` 0 ili veći od dužine, vraća sve izmiješano. */
export function sample<T>(items: readonly T[], count: number): T[] {
  const shuffled = shuffle(items);
  if (count <= 0 || count >= shuffled.length) return shuffled;
  return shuffled.slice(0, count);
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
