import { DEFAULT_ORDERING_POINTS } from "./config";
import type { Lang } from "./i18n";
import {
  AREAS,
  type Answer,
  type Area,
  type ChoiceQuestion,
  type OptionKey,
  type OrderingQuestion,
  type Question,
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
 * Tekst pitanja na traženom jeziku. Prevodi žive u questions.json kao
 * `text_en` / `text_ru` / `text_sq`; ako ih nema, pada se nazad na crnogorski —
 * vidi `hasTranslation`.
 */
export function localizedText(q: Question, lang: Lang): string {
  if (lang === "me") return q.text;
  return q[`text_${lang}`] ?? q.text;
}

/** Ponuđeni odgovor na traženom jeziku, uz isti fallback kao `localizedText`. */
export function localizedOption(q: ChoiceQuestion, key: OptionKey, lang: Lang): string {
  if (lang === "me") return q.options[key];
  return q[`options_${lang}`]?.[key] ?? q.options[key];
}

/** Da li pitanje uopšte ima prevod na dati jezik (koristi se za napomenu u UI-u). */
export function hasTranslation(q: Question, lang: Lang): boolean {
  if (lang === "me") return true;
  return Boolean(q[`text_${lang}`]);
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
 * Redoslijed oblasti iz kojih se redom vuku pitanja, u odnosu zadatom kvotom.
 * Npr. za 21:10:10 niz sadrži 21 „I", 10 „II" i 10 „III", izmiješano.
 */
function areaDrawOrder(quota: Readonly<Record<Area, number>>): Area[] {
  const seq: Area[] = [];
  for (const area of AREAS) {
    for (let i = 0; i < (quota[area] ?? 0); i++) seq.push(area);
  }
  return shuffle(seq);
}

/**
 * Sastavlja ispit čiji je zbir bodova TAČNO `targetPoints`, poštujući pri tom
 * odnos oblasti iz `quota`.
 *
 * Zašto ne fiksan broj pitanja: sa bodovima iz našeg kataloga 41 pitanje po
 * odnosu 21:10:10 daje 87–116 bodova, nikad 80. Pošto je maksimum na ispitu 80,
 * odnos oblasti određuje SASTAV, a punjenje staje na 80 bodova — broj pitanja
 * zato ispadne oko 32.
 *
 * Radi u tri koraka:
 *  1. redom prolazi kroz izmiješani niz oblasti i iz svake vuče pitanje koje
 *     staje u preostali budžet,
 *  2. ako budžet nije potrošen (kvota se iscrpila), dopunjuje iz cijele baze,
 *  3. ako na kraju fali 1–4 boda, dodaje jedno pitanje tačno te vrijednosti.
 * Treći korak je bitan: bez njega bi ispit povremeno završio na 78 ili 79
 * bodova, pa bi prag „68 od 80" bio netačan.
 */
export function buildExam(
  questions: readonly Question[],
  targetPoints: number,
  quota: Readonly<Record<Area, number>>,
): Question[] {
  const byArea = new Map<Area, Question[]>();
  for (const area of AREAS) {
    byArea.set(
      area,
      shuffle(questions.filter((q) => q.area === area)),
    );
  }

  for (const area of AREAS) {
    const have = byArea.get(area)?.length ?? 0;
    if (have < (quota[area] ?? 0)) {
      console.warn(
        `Oblast ${area}: u bazi je ${have} pitanja, a kvota traži ${quota[area]}. ` +
          `Ispit će biti dopunjen iz ostalih oblasti.`,
      );
    }
  }

  const chosen: Question[] = [];
  const used = new Set<number>();
  let remaining = targetPoints;

  const take = (q: Question) => {
    chosen.push(q);
    used.add(q.id);
    remaining -= questionPoints(q);
  };

  // 1) Po kvoti oblasti
  for (const area of areaDrawOrder(quota)) {
    if (remaining === 0) break;
    const pool = byArea.get(area) ?? [];
    const pick = pool.find((q) => !used.has(q.id) && questionPoints(q) <= remaining);
    if (pick) take(pick);
  }

  // 2) Kvota iscrpljena, a budžet nije — dopuni iz cijele baze
  if (remaining > 0) {
    for (const q of shuffle(questions)) {
      if (remaining === 0) break;
      if (used.has(q.id) || questionPoints(q) > remaining) continue;
      take(q);
    }
  }

  // 3) Tačna dopuna ostatka
  if (remaining > 0) {
    const exact = questions.find(
      (q) => !used.has(q.id) && questionPoints(q) === remaining,
    );
    if (exact) take(exact);
  }

  return shuffle(chosen);
}

/** Broj izvučenih pitanja po oblasti — koristi se za provjeru sastava. */
export function areaBreakdown(questions: readonly Question[]): Record<Area, number> {
  const out: Record<Area, number> = { I: 0, II: 0, III: 0 };
  for (const q of questions) {
    if (q.area in out) out[q.area] += 1;
  }
  return out;
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
