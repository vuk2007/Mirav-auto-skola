/** Ključ ponuđenog odgovora kod pitanja sa izborom. */
export type OptionKey = "a" | "b" | "c";

export const OPTION_KEYS: readonly OptionKey[] = ["a", "b", "c"] as const;

export type QuestionType = "text" | "image" | "ordering";

/** Polja zajednička svim pitanjima iz questions.json. */
interface QuestionBase {
  id: number;
  type: QuestionType;
  text: string;
  page: number;
  local_no: number;
  /** Ordering pitanja imaju null → tretira se kao 1 bod (vidi `questionPoints`). */
  points: number | null;
  needs_review: boolean;
  review_reason: string[];
  /** Ime fajla u public/web_images/, samo kod pitanja sa slikom. */
  image?: string;
}

/** Pitanje sa tri ponuđena odgovora — bez slike. */
export interface TextQuestion extends QuestionBase {
  type: "text";
  options: Record<OptionKey, string>;
  correct: OptionKey;
}

/** Pitanje sa tri ponuđena odgovora — uz sliku. */
export interface ImageQuestion extends QuestionBase {
  type: "image";
  image: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
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

export type Mode = "vjezba" | "simulacija";

/** Status jednog pitanja u toku rješavanja. */
export interface AnswerRecord {
  questionId: number;
  answer: Answer;
  correct: boolean;
  /** Osvojeni bodovi (0 ako je netačno). */
  points: number;
}
