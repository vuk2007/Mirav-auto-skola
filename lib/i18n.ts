/**
 * UI stringovi (chrome) na crnogorskom i engleskom.
 *
 * VAŽNO: prevodi se samo interfejs. Sadržaj pitanja ostaje na crnogorskom dok se
 * u questions.json ne dodaju polja `text_en` / `options_en` — vidi `localizedText`
 * u lib/questions.ts. Pitanja se ne prevode automatski.
 */

export type Lang = "me" | "en";

export const LANGS: readonly Lang[] = ["me", "en"] as const;

export const DEFAULT_LANG: Lang = "me";

export interface Dict {
  // Zaglavlje / opšte
  back: string;
  close: string;
  literature: string;
  langLabel: string;

  // Landing
  landingTitle: string;
  landingLead: string;
  practiceTitle: string;
  practiceDesc: string;
  practiceStart: string;
  practiceResume: string;
  categoryLabel: string;
  examTitle: string;
  examDesc: string;
  examStart: string;
  metaQuestions: string;
  metaMinutes: string;
  metaPass: string;
  examLimitationNote: string;
  bestResult: string;

  // Kviz
  loading: string;
  loadErrorTitle: string;
  noQuestions: string;
  question: string;
  examQuestion: string;
  progress: string;
  next: string;
  prev: string;
  newRound: string;
  finishExam: string;
  check: string;
  correctAnswerLabel: string;
  yourAnswerLabel: string;
  correctFeedback: string;
  wrongFeedback: string;
  remaining: string;
  answeredLabel: string;
  correctLabel: string;
  inPool: string;
  explanationTitle: string;
  questionsOnlyInMe: string;

  // Navigacija po pitanjima
  navTitle: string;
  navAnswered: string;
  navUnanswered: string;
  navJump: string;
  confirmLeaveExam: string;

  // Ordering
  orderingLabel: string;
  orderingHint: string;
  orderingEntered: string;
  orderingCorrectIs: string;

  // Oznake kategorija
  badgeSign: string;
  badgeIntersection: string;
  badgeOrdering: string;
  badgeText: string;

  // Rezultat
  resultTitle: string;
  passed: string;
  failed: string;
  passThreshold: string;
  timedOutNote: string;
  statCorrect: string;
  statWrong: string;
  statUnanswered: string;
  statAnswered: string;
  newExam: string;
  backToStart: string;
  reviewTitle: string;
  reviewLead: string;
  reviewPerfect: string;
  reviewNoAnswer: string;
  reviewWrong: string;

  // Literatura
  litTitle: string;
  litLead: string;

  // Kategorije
  catAll: string;
  catText: string;
  catImage: string;
  catSign: string;
  catIntersection: string;
  catOrdering: string;
}

const me: Dict = {
  back: "Nazad",
  close: "Zatvori",
  literature: "Literatura",
  langLabel: "Jezik",

  landingTitle: "Pripremite se za teorijski ispit",
  landingLead:
    "Izaberite način rada. Vježbajte bez pritiska uz odmah prikazan tačan odgovor, ili provjerite znanje pod uslovima pravog ispita.",
  practiceTitle: "Vježba",
  practiceDesc:
    "Birate kategoriju pitanja, odgovor se odmah provjerava i prikazuje tačno rješenje. Bez tajmera i bez ograničenja.",
  practiceStart: "Počni vježbu",
  practiceResume: "Nastavi gdje si stao",
  categoryLabel: "Kategorija",
  examTitle: "Simulacija ispita",
  examDesc:
    "Nasumična pitanja iz cijele baze, bez prikaza tačnog odgovora dok ispit traje. Na kraju dobijate bodove i ocjenu prolaza.",
  examStart: "Počni ispit",
  metaQuestions: "pitanja",
  metaMinutes: "minuta",
  metaPass: "prag",
  examLimitationNote:
    "Napomena: naša baza sadrži samo pitanja sa jednim tačnim odgovorom. Zvanični ispit ima i pitanja sa više tačnih odgovora, gdje se priznaje samo potpuno tačan odgovor.",
  bestResult: "Najbolji rezultat",

  loading: "Učitavanje pitanja…",
  loadErrorTitle: "Greška pri učitavanju pitanja",
  noQuestions: "Nema pitanja u izabranoj kategoriji. Izaberite drugu kategoriju.",
  question: "Pitanje",
  examQuestion: "Ispitno pitanje",
  progress: "Napredak kroz pitanja",
  next: "Sljedeće pitanje",
  prev: "Prethodno",
  newRound: "Novi krug",
  finishExam: "Završi ispit",
  check: "Provjeri",
  correctAnswerLabel: "Tačno",
  yourAnswerLabel: "Vaš odgovor",
  correctFeedback: "Tačan odgovor",
  wrongFeedback: "Netačan odgovor",
  remaining: "Preostalo",
  answeredLabel: "Odgovoreno",
  correctLabel: "Tačno",
  inPool: "pitanja u izboru",
  explanationTitle: "Objašnjenje",
  questionsOnlyInMe: "Pitanja su dostupna na crnogorskom.",

  navTitle: "Pregled pitanja",
  navAnswered: "odgovoreno",
  navUnanswered: "bez odgovora",
  navJump: "Idi na pitanje",
  confirmLeaveExam: "Ispit je u toku. Ako izađete, odgovori se gube. Želite li da izađete?",

  orderingLabel: "Redoslijed prolaska vozila",
  orderingHint: "Unesite brojeve redom kojim vozila prolaze — crtica, razmak ili bez razmaka.",
  orderingEntered: "Uneseno",
  orderingCorrectIs: "tačan redoslijed je",

  badgeSign: "Saobraćajni znak",
  badgeIntersection: "Raskrsnica",
  badgeOrdering: "Redoslijed prolaska",
  badgeText: "Tekstualno pitanje",

  resultTitle: "Rezultat simulacije",
  passed: "Položeno",
  failed: "Nije položeno",
  passThreshold: "Prag za prolaz je {n}% osvojenih bodova.",
  timedOutNote: "Ispit je zaustavljen jer je isteklo vrijeme.",
  statCorrect: "Tačno",
  statWrong: "Netačno",
  statUnanswered: "Bez odgovora",
  statAnswered: "Odgovoreno",
  newExam: "Novi ispit",
  backToStart: "Nazad na početak",
  reviewTitle: "Pregled grešaka",
  reviewLead: "Prođite kroz pitanja koja niste riješili tačno — uz tačan odgovor.",
  reviewPerfect: "Sva pitanja su tačna. Nema šta da se ponavlja.",
  reviewNoAnswer: "Bez odgovora",
  reviewWrong: "Netačno",

  litTitle: "Literatura",
  litLead: "Zvanični izvori na kojima se zasniva ispitna materija:",

  catAll: "Sve",
  catText: "Tekstualna",
  catImage: "Sa slikom",
  catSign: "Znaci",
  catIntersection: "Raskrsnice",
  catOrdering: "Redoslijed",
};

const en: Dict = {
  back: "Back",
  close: "Close",
  literature: "Sources",
  langLabel: "Language",

  landingTitle: "Prepare for the theory exam",
  landingLead:
    "Choose a mode. Practise without pressure with the correct answer shown immediately, or test yourself under real exam conditions.",
  practiceTitle: "Practice",
  practiceDesc:
    "Pick a question category; each answer is checked right away and the correct one is shown. No timer, no limits.",
  practiceStart: "Start practice",
  practiceResume: "Resume where you left off",
  categoryLabel: "Category",
  examTitle: "Exam simulation",
  examDesc:
    "Random questions from the whole bank, with no correct answers revealed while the exam runs. You get your score and a pass mark at the end.",
  examStart: "Start exam",
  metaQuestions: "questions",
  metaMinutes: "minutes",
  metaPass: "to pass",
  examLimitationNote:
    "Note: our question bank contains only single-answer questions. The official exam also includes multiple-answer questions, where only a fully correct answer counts.",
  bestResult: "Best result",

  loading: "Loading questions…",
  loadErrorTitle: "Could not load the questions",
  noQuestions: "No questions in the selected category. Please choose another one.",
  question: "Question",
  examQuestion: "Exam question",
  progress: "Progress through questions",
  next: "Next question",
  prev: "Previous",
  newRound: "New round",
  finishExam: "Finish exam",
  check: "Check",
  correctAnswerLabel: "Correct",
  yourAnswerLabel: "Your answer",
  correctFeedback: "Correct answer",
  wrongFeedback: "Wrong answer",
  remaining: "Remaining",
  answeredLabel: "Answered",
  correctLabel: "Correct",
  inPool: "questions available",
  explanationTitle: "Explanation",
  questionsOnlyInMe: "The questions themselves are available in Montenegrin.",

  navTitle: "Question overview",
  navAnswered: "answered",
  navUnanswered: "unanswered",
  navJump: "Go to question",
  confirmLeaveExam: "The exam is in progress. If you leave, your answers are lost. Leave anyway?",

  orderingLabel: "Order in which vehicles proceed",
  orderingHint: "Enter the numbers in order — separated by a dash, a space, or nothing at all.",
  orderingEntered: "Entered",
  orderingCorrectIs: "the correct order is",

  badgeSign: "Road sign",
  badgeIntersection: "Intersection",
  badgeOrdering: "Order of passage",
  badgeText: "Text question",

  resultTitle: "Exam result",
  passed: "Passed",
  failed: "Not passed",
  passThreshold: "You need {n}% of the available points to pass.",
  timedOutNote: "The exam was stopped because time ran out.",
  statCorrect: "Correct",
  statWrong: "Wrong",
  statUnanswered: "Unanswered",
  statAnswered: "Answered",
  newExam: "New exam",
  backToStart: "Back to start",
  reviewTitle: "Review your mistakes",
  reviewLead: "Go through the questions you did not get right — with the correct answer.",
  reviewPerfect: "Every answer was correct. Nothing to review.",
  reviewNoAnswer: "No answer",
  reviewWrong: "Wrong",

  litTitle: "Sources",
  litLead: "Official documents the exam material is based on:",

  catAll: "All",
  catText: "Text only",
  catImage: "With image",
  catSign: "Signs",
  catIntersection: "Intersections",
  catOrdering: "Order of passage",
};

export const STRINGS: Record<Lang, Dict> = { me, en };

export function dict(lang: Lang): Dict {
  return STRINGS[lang];
}

/**
 * Množina uz broj bodova. Crnogorski: 1 bod, 2–4 boda, 5+ bodova
 * (uz izuzetak 11–14, koji idu na „bodova").
 */
export function pointsLabel(n: number, lang: Lang): string {
  if (lang === "en") return n === 1 ? "point" : "points";
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return "bodova";
  if (last === 1) return "bod";
  if (last >= 2 && last <= 4) return "boda";
  return "bodova";
}

export function isLang(value: unknown): value is Lang {
  return value === "me" || value === "en";
}
