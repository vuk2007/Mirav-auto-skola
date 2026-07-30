/** Ključ ponuđenog odgovora kod pitanja sa izborom. */
export type OptionKey = "a" | "b" | "c";

export const OPTION_KEYS: readonly OptionKey[] = ["a", "b", "c"] as const;

export type QuestionType = "text" | "image" | "ordering";

/**
 * Oblast po kojoj se ispit sastavlja:
 *   I   — poznavanje propisa / teorija
 *   II  — saobraćajni znakovi
 *   III — raskrsnice i situacije
 */
export type Area = "I" | "II" | "III";

export const AREAS: readonly Area[] = ["I", "II", "III"] as const;

/** Polja zajednička svim pitanjima iz questions.json. */
interface QuestionBase {
  id: number;
  type: QuestionType;
  text: string;
  page: number;
  local_no: number;
  /** Ordering pitanja imaju null → vidi `questionPoints` i DEFAULT_ORDERING_POINTS. */
  points: number | null;
  /** Oblast iz koje pitanje dolazi — određuje sastav ispita (vidi EXAM_QUOTA). */
  area: Area;
  needs_review: boolean;
  review_reason: string[];
  /** Ime fajla u public/web_images/, samo kod pitanja sa slikom. */
  image?: string;
  /**
   * Objašnjenje tačnog odgovora. Ne postoji u questions.json — polje je
   * predviđeno da se kasnije ručno popuni za najteža pitanja. Prikazuje se u
   * Vježbi i u „Pregledu grešaka" ako postoji.
   */
  explanation?: string;
  /**
   * Mašinski prevodi teksta pitanja (vidi `scripts/translate.mjs`). Ako polje
   * nedostaje, prikazuje se crnogorski original uz napomenu.
   */
  text_en?: string;
  text_ru?: string;
}

/** Pitanje sa tri ponuđena odgovora — bez slike. */
export interface TextQuestion extends QuestionBase {
  type: "text";
  options: Record<OptionKey, string>;
  correct: OptionKey;
  /** Prevodi ponuđenih odgovora; ako nedostaju, koriste se crnogorski. */
  options_en?: Record<OptionKey, string>;
  options_ru?: Record<OptionKey, string>;
}

/** Pitanje sa tri ponuđena odgovora — uz sliku. */
export interface ImageQuestion extends QuestionBase {
  type: "image";
  image: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  options_en?: Record<OptionKey, string>;
  options_ru?: Record<OptionKey, string>;
}

/** Pitanje sa redoslijedom prolaska vozila, npr. ["3","4","2","1"]. */
export interface OrderingQuestion extends QuestionBase {
  type: "ordering";
  image: string;
  answer_sequence: string[];
}

export type Question = TextQuestion | ImageQuestion | OrderingQuestion;

/** Pitanje sa ponuđenim odgovorima (sve osim `ordering`). */
export type ChoiceQuestion = TextQuestion | ImageQuestion;

export function isOrdering(q: Question): q is OrderingQuestion {
  return q.type === "ordering";
}

export function isChoice(q: Question): q is ChoiceQuestion {
  return q.type === "text" || q.type === "image";
}

/** Odgovor kandidata: ključ opcije, ili uneseni redoslijed kod `ordering` pitanja. */
export type Answer = { kind: "choice"; value: OptionKey } | { kind: "ordering"; value: string };

export type Mode = "vjezba" | "simulacija" | "simulator";

/** Koji je ekran aktivan — landing se vidi prvi, prije učitavanja pitanja. */
export type Screen = "landing" | "kviz" | "rezultat";

/** Status jednog pitanja u toku rješavanja. */
export interface AnswerRecord {
  questionId: number;
  answer: Answer;
  correct: boolean;
  /** Osvojeni bodovi (0 ako je netačno). */
  points: number;
}
