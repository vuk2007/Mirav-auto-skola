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

/** Koliko zamjena po pokušaju prije nego što se krene iz početka. */
const SWAP_STEPS = 200;
/** Koliko puta se kreće iz početka prije nego što se odustane. */
const BUILD_ATTEMPTS = 40;

/**
 * Sastavlja ispit sa **tačno `sum(quota)` pitanja** i zbirom bodova **tačno
 * `targetPoints`**, poštujući broj pitanja po oblasti iz `quota`.
 *
 * Zašto ovako, a ne „puni dok ne dođeš do 80": ranija verzija je punila budžet
 * pa je broj pitanja ispadao 27–39. Ispit ima fiksnih 40 pitanja i 80 bodova,
 * pa oba uslova moraju važiti istovremeno.
 *
 * Kako radi:
 *  1. iz svake oblasti se nasumično uzme tačno `quota[oblast]` pitanja,
 *  2. ako zbir nije `targetPoints`, radi se **zamjena unutar iste oblasti** —
 *     izabrano pitanje se mijenja neizabranim čija razlika u bodovima gura zbir
 *     ka cilju, ali ga ne preskače. Broj pitanja po oblasti se time ne mijenja.
 *  3. ako se u datom broju pokušaja ne pogodi tačno, kreće se iz početka sa
 *     novim nasumičnim izborom.
 *
 * Zamjena uvijek ide korakom koji ne preskače cilj, pa se zbir monotono
 * približava — a pošto u bazi postoje pitanja od 1 i 2 boda, korak od 1 boda je
 * gotovo uvijek dostupan i postupak se zaustavlja u nekoliko zamjena.
 *
 * NAPOMENA o sastavu: prosjek u bazi je 1,93 (I), 2,97 (II) i 3,22 (III) boda,
 * pa nasumičnih 20/10/10 nosi oko 100 bodova. Da bi se stiglo na 80, zamjene
 * nužno biraju jeftinija pitanja unutar svake oblasti. To je posljedica bodova
 * u našem katalogu, ne izbora algoritma — vidi README, „Sastav ispita".
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
      questions.filter((q) => q.area === area),
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

  const total = (qs: readonly Question[]) => qs.reduce((sum, q) => sum + questionPoints(q), 0);

  /** Jedan pokušaj: nasumičan izbor po kvoti, pa zamjene do tačnog zbira. */
  const attempt = (): Question[] | null => {
    const picked = new Map<Area, Question[]>();
    const rest = new Map<Area, Question[]>();
    for (const area of AREAS) {
      const pool = shuffle(byArea.get(area) ?? []);
      const want = Math.min(quota[area] ?? 0, pool.length);
      picked.set(area, pool.slice(0, want));
      rest.set(area, pool.slice(want));
    }

    // Ako neka oblast nema dovoljno pitanja, manjak se nadoknađuje iz ostalih,
    // da broj pitanja na ispitu ostane tačan.
    const wanted = AREAS.reduce((sum, a) => sum + (quota[a] ?? 0), 0);
    let short = wanted - AREAS.reduce((sum, a) => sum + (picked.get(a)?.length ?? 0), 0);
    for (const area of AREAS) {
      while (short > 0 && (rest.get(area)?.length ?? 0) > 0) {
        picked.get(area)?.push(rest.get(area)!.shift()!);
        short -= 1;
      }
    }

    const flat = () => AREAS.flatMap((a) => picked.get(a) ?? []);

    for (let step = 0; step < SWAP_STEPS; step++) {
      const diff = targetPoints - total(flat());
      if (diff === 0) return flat();

      // Sve zamjene koje guraju zbir ka cilju bez preskakanja. Bira se
      // nasumična, ne najveća — inače bi ispit uvijek imao ista pitanja.
      const moves: { area: Area; outIndex: number; inIndex: number }[] = [];
      for (const area of AREAS) {
        const inside = picked.get(area) ?? [];
        const outside = rest.get(area) ?? [];
        for (let i = 0; i < inside.length; i++) {
          for (let j = 0; j < outside.length; j++) {
            const delta = questionPoints(outside[j]!) - questionPoints(inside[i]!);
            if (delta === 0) continue;
            if (diff > 0 ? delta > 0 && delta <= diff : delta < 0 && delta >= diff) {
              moves.push({ area, outIndex: i, inIndex: j });
            }
          }
        }
      }
      if (moves.length === 0) return null;

      const move = moves[Math.floor(Math.random() * moves.length)]!;
      const inside = picked.get(move.area)!;
      const outside = rest.get(move.area)!;
      const swapped = inside[move.outIndex]!;
      inside[move.outIndex] = outside[move.inIndex]!;
      outside[move.inIndex] = swapped;
    }
    return null;
  };

  for (let tries = 0; tries < BUILD_ATTEMPTS; tries++) {
    const built = attempt();
    if (built) return shuffle(built);
  }

  // Ne bi smjelo da se desi sa našom bazom, ali bolje glasno nego tiho pogrešno.
  console.warn(
    `Nije sastavljen ispit od ${AREAS.reduce((s, a) => s + (quota[a] ?? 0), 0)} pitanja ` +
      `sa tačno ${targetPoints} bodova. Provjerite kvotu i bodove u bazi.`,
  );
  const fallback = AREAS.flatMap((a) => shuffle(byArea.get(a) ?? []).slice(0, quota[a] ?? 0));
  return shuffle(fallback);
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
