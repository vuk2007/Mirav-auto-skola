import { DEFAULT_ORDERING_POINTS, EXAM_QUESTION_COUNT, EXAM_STRUCTURE } from "./config";
import type { Lang } from "./i18n";
import type {
  Answer,
  ChoiceQuestion,
  OptionKey,
  OrderingQuestion,
  Question,
  QuestionKind,
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

/**
 * Tekst pitanja ili odgovora spreman za prikaz: glavni tekst i, ispod njega,
 * prevod kao pomoć.
 *
 * Na pravom ispitu teorija se polaže samo na crnogorskom ili albanskom. Zato:
 *  - `me` — samo crnogorski,
 *  - `sq` — samo albanski (zvanični ispitni jezik); bez prevoda pada na
 *    crnogorski i to javlja kroz `fallback`,
 *  - `en` / `ru` — crnogorski kao glavni tekst, prevod ispod. Kandidat uči
 *    pitanje onako kako će ga vidjeti na ispitu.
 */
export interface Bilingual {
  primary: string;
  /** Jezik glavnog teksta — za `lang` atribut (čitači ekrana, rastavljanje riječi). */
  primaryLang: Lang;
  /** Prevod ispod glavnog teksta; `null` kad ga nema ili ne treba. */
  secondary: string | null;
  secondaryLang: Lang | null;
  /** Albanski je izabran, a prevoda nema — prikazan je crnogorski. */
  fallback: boolean;
}

/** Jezici kojih nema na pravom ispitu — tu je prevod samo pomoć uz crnogorski. */
export function isHelperLang(lang: Lang): boolean {
  return lang === "en" || lang === "ru";
}

/** Prijavljeni nedostajući prevodi — svaki se javlja jednom, ne na svakom crtanju. */
const reportedMissing = new Set<string>();

function reportMissing(q: Question, lang: Lang, part: string): void {
  const key = `${q.id}:${lang}:${part}`;
  if (reportedMissing.has(key)) return;
  reportedMissing.add(key);
  console.warn(`[MIRAV] Pitanje ${q.id} nema prevod (${lang}) za ${part} — prikazan samo crnogorski.`);
}

function bilingual(q: Question, lang: Lang, original: string, translated: string | undefined, part: string): Bilingual {
  if (isHelperLang(lang)) {
    if (!translated) reportMissing(q, lang, part);
    return {
      primary: original,
      primaryLang: "me",
      secondary: translated ?? null,
      secondaryLang: translated ? lang : null,
      fallback: false,
    };
  }
  if (lang === "sq" && translated) {
    return { primary: translated, primaryLang: "sq", secondary: null, secondaryLang: null, fallback: false };
  }
  return { primary: original, primaryLang: "me", secondary: null, secondaryLang: null, fallback: lang === "sq" };
}

/** Tekst pitanja po pravilu iz `Bilingual`. */
export function bilingualText(q: Question, lang: Lang): Bilingual {
  return bilingual(q, lang, q.text, lang === "me" ? undefined : q[`text_${lang}`], "tekst");
}

/** Ponuđeni odgovor po pravilu iz `Bilingual`. */
export function bilingualOption(q: ChoiceQuestion, key: OptionKey, lang: Lang): Bilingual {
  const translated = lang === "me" ? undefined : q[`options_${lang}`]?.[key];
  return bilingual(q, lang, q.options[key], translated, `odgovor ${key}`);
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
 * Greška u sastavu ispita. Baca se umjesto tihe dopune iz druge kategorije:
 * ispit koji nema traženi sastav nije simulacija ispita.
 */
export class ExamBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamBuildError";
  }
}

/** Jedno pitanje na ispitu, sa mjestom na testu. */
export interface ExamSlot {
  question: Question;
  /** Segment iz EXAM_STRUCTURE. */
  kind: QuestionKind;
  /** Redni broj segmenta, 0-baziran. */
  segment: number;
  /** Podpitanje stoji uz svoje glavno pitanje i dijeli s njim sliku. */
  isSub: boolean;
  /** Redni broj na testu, 1..EXAM_QUESTION_COUNT — bez slova za podpitanja. */
  number: number;
  /** Stranica testa, 1-bazirana. */
  page: number;
  /**
   * Kartica kojoj pitanje pripada: id glavnog pitanja kod para, inače id samog
   * pitanja. Pitanja iste kartice dijele jednu sliku.
   */
  card: number;
}

/**
 * Id para kojem pitanje pripada — id glavnog pitanja, i za glavno pitanje i za
 * podpitanje. Pitanja istog para imaju istu sliku.
 */
export function groupId(q: Question): number {
  return q.subOf ?? q.id;
}

/**
 * Sastavlja simulaciju ispita po `EXAM_STRUCTURE`.
 *
 * Za svaki segment redom:
 *  - izvlači `count` nasumičnih pitanja tog `kind`-a, bez ponavljanja,
 *  - ako je `withSub`, bira samo pitanja koja **imaju** podpitanje i odmah iza
 *    svakog ubacuje to podpitanje (ista kartica, ista slika),
 *  - ako je `allowSubs`, i podpitanja ulaze u izvlačenje sama za sebe, ali
 *    nikad dva iz istog para — svako pitanje mora imati drugu sliku,
 *  - ako nema dovoljno pitanja, **baca `ExamBuildError`** — ne dopunjava iz
 *    druge kategorije, jer bi tako ispit tiho izgubio traženi sastav.
 *
 * Unutar segmenta je redoslijed nasumičan. Pitanja se numerišu 1..40 redom, a
 * stranica se računa iz `page` i `groupsPerPage` segmenta. Bodovi dolaze iz
 * baze kakvi jesu, pa ukupan broj bodova nije isti na svakom testu (prag je
 * procenat, vidi `examPassPoints`).
 */
export function buildExam(questions: readonly Question[]): ExamSlot[] {
  const subsByMain = new Map<number, Question>();
  for (const q of questions) {
    if (q.subOf !== undefined) subsByMain.set(q.subOf, q);
  }

  const slots: ExamSlot[] = [];

  EXAM_STRUCTURE.forEach((segment, index) => {
    const allowSubs = "allowSubs" in segment && segment.allowSubs;
    const groupsPerPage = "groupsPerPage" in segment ? segment.groupsPerPage : undefined;

    const pool = questions.filter(
      (q) =>
        q.kind === segment.kind &&
        (allowSubs || q.subOf === undefined) &&
        (!segment.withSub || subsByMain.has(q.id)),
    );

    // Najviše jedno pitanje po paru — kod `allowSubs` par dijeli sliku.
    const picked: Question[] = [];
    const usedGroups = new Set<number>();
    for (const q of shuffle(pool)) {
      if (picked.length === segment.count) break;
      if (usedGroups.has(groupId(q))) continue;
      usedGroups.add(groupId(q));
      picked.push(q);
    }

    if (picked.length < segment.count) {
      throw new ExamBuildError(
        `Segment „${segment.kind}"${segment.withSub ? " (sa podpitanjem)" : ""}: ` +
          `traži ${segment.count} pitanja, a u bazi ih ima ${picked.length}` +
          `${allowSubs ? " sa različitom slikom" : ""}. ` +
          `Pokreni \`node scripts/gen-exam-meta.mjs --report\`.`,
      );
    }

    picked.forEach((q, i) => {
      const page = segment.page + (groupsPerPage ? Math.floor(i / groupsPerPage) : 0);
      const push = (question: Question, isSub: boolean) =>
        slots.push({
          question,
          kind: segment.kind,
          segment: index,
          isSub,
          number: slots.length + 1,
          page,
          card: q.id,
        });

      push(q, false);
      if (!segment.withSub) return;
      const sub = subsByMain.get(q.id);
      if (!sub) {
        // Ne bi smjelo — bazen je već filtriran na pitanja sa podpitanjem.
        throw new ExamBuildError(`Pitanje ${q.id} nema podpitanje iako je izvučeno kao par.`);
      }
      push(sub, true);
    });
  });

  if (slots.length !== EXAM_QUESTION_COUNT) {
    throw new ExamBuildError(
      `Sastavljen ispit ima ${slots.length} pitanja, a treba ${EXAM_QUESTION_COUNT}.`,
    );
  }

  return slots;
}

/** Broj izvučenih pitanja po segmentu — koristi se u provjerama. */
export function kindBreakdown(questions: readonly Question[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of questions) out[q.kind] = (out[q.kind] ?? 0) + 1;
  return out;
}

/**
 * Kartice jedne stranice testa, redom. Kartica je jedno pitanje ili par
 * pitanja uz istu sliku.
 */
export function examCards(slots: readonly ExamSlot[], page: number): ExamSlot[][] {
  const cards: ExamSlot[][] = [];
  for (const slot of slots) {
    if (slot.page !== page) continue;
    const last = cards.at(-1);
    if (last && last[0]!.card === slot.card) last.push(slot);
    else cards.push([slot]);
  }
  return cards;
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
