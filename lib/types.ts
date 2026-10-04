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

/**
 * Vrsta pitanja po sastavu ispita — polje `kind` u questions.json, upisuje ga
 * `scripts/gen-exam-meta.mjs`.
 *
 * NEZAVISNO je od `area`: `area` (I/II/III) određuje kategorije u vježbi, a
 * `kind` segmente simulacije ispita (vidi EXAM_STRUCTURE u lib/config.ts).
 * Isto pitanje može biti `area: "III"` i `kind: "policajac"`.
 *
 * `teorija` su propisi (str. 1–9 kataloga), `opste` teorija o vozilu i prvoj
 * pomoći sa kraja kataloga; `semafor` su pitanja čija je slika semafor.
 */
export type QuestionKind =
  | "znak"
  | "teorija"
  | "opste"
  | "policajac"
  | "kosnik"
  | "semafor"
  | "situacija"
  | "ostalo";

export const QUESTION_KINDS: readonly QuestionKind[] = [
  "znak",
  "teorija",
  "opste",
  "policajac",
  "kosnik",
  "semafor",
  "situacija",
  "ostalo",
] as const;

/** Polja zajednička svim pitanjima iz questions.json. */
interface QuestionBase {
  id: number;
  type: QuestionType;
  text: string;
  page: number;
  local_no: number;
  /** Ordering pitanja imaju null → vidi `questionPoints` i DEFAULT_ORDERING_POINTS. */
  points: number | null;
  /** Oblast iz koje pitanje dolazi — određuje kategorije u vježbi. */
  area: Area;
  /** Vrsta pitanja — određuje segment ispita (vidi EXAM_STRUCTURE). */
  kind: QuestionKind;
  /**
   * Pitanje o prvoj pomoći. Na ispitu ta pitanja idu u segment opštih znanja
   * (`kind: "opste"`); polje postoji da bi vježba imala zaseban filter
   * „Prva pomoć".
   * Upisuje ga `scripts/gen-exam-meta.mjs`.
   */
  firstAid?: boolean;
  /**
   * Kod podpitanja: id glavnog pitanja sa kojim dijeli sliku — to je ujedno id
   * grupe (vidi `groupId` u lib/questions.ts). Na ispitu podpitanje stoji uz
   * svoje glavno pitanje na istoj kartici; samo za sebe se izvlači jedino u
   * segmentu semafora, gdje svako pitanje ima svoju sliku.
   */
  subOf?: number;
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
   * Prevodi teksta pitanja. Ako polje nedostaje, prikazuje se crnogorski
   * original uz napomenu — vidi `hasTranslation` u lib/questions.ts.
   */
  text_en?: string;
  text_ru?: string;
  text_sq?: string;
}

/** Pitanje sa tri ponuđena odgovora — bez slike. */
export interface TextQuestion extends QuestionBase {
  type: "text";
  options: Record<OptionKey, string>;
  correct: OptionKey;
  /** Prevodi ponuđenih odgovora; ako nedostaju, koriste se crnogorski. */
  options_en?: Record<OptionKey, string>;
  options_ru?: Record<OptionKey, string>;
  options_sq?: Record<OptionKey, string>;
}

/** Pitanje sa tri ponuđena odgovora — uz sliku. */
export interface ImageQuestion extends QuestionBase {
  type: "image";
  image: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  options_en?: Record<OptionKey, string>;
  options_ru?: Record<OptionKey, string>;
  options_sq?: Record<OptionKey, string>;
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

/**
 * Režim rada. `simulator` je statična vježba redoslijeda, `igra` je vožnja kroz
 * raskrsnicu u realnom vremenu (vidi `lib/game/`).
 */
export type Mode = "vjezba" | "simulacija" | "simulator" | "igra";

/** Koji je ekran aktivan — landing se vidi prvi, prije učitavanja pitanja. */
export type Screen = "landing" | "uputstvo" | "kviz" | "rezultat";

/** Status jednog pitanja u toku rješavanja. */
export interface AnswerRecord {
  questionId: number;
  answer: Answer;
  correct: boolean;
  /** Osvojeni bodovi (0 ako je netačno). */
  points: number;
}
