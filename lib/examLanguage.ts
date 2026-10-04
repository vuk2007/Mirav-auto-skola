/**
 * Upozorenje o jeziku ispita — samo za EN i RU.
 *
 * Na pravom ispitu teorija se polaže samo na crnogorskom ili albanskom, pa
 * kandidat koji koristi engleski ili ruski mora učiti pitanja na crnogorskom;
 * prevod mu je samo pomoć (vidi `Bilingual` u lib/questions.ts).
 *
 * Tekstovi su van `Dict`-a jer postoje samo za ta dva jezika. Za ME i AL se
 * upozorenje nikad ne prikazuje.
 */

import type { Lang } from "./i18n";

export interface ExamLanguageNotice {
  title: string;
  body: string;
  confirm: string;
  /** Kratka verzija za traku iznad pitanja. */
  strip: string;
}

export const EXAM_LANGUAGE_NOTICE: Partial<Record<Lang, ExamLanguageNotice>> = {
  en: {
    title: "Exam language",
    body:
      "Important: The official driving theory exam in Montenegro can only be taken in Montenegrin or Albanian. " +
      "To prepare you for the real exam, every question and answer is shown in Montenegrin first, with an English " +
      "translation below it. Learn to recognise the questions in Montenegrin — that is how they will appear on your exam.",
    confirm: "I understand",
    strip: "Exam language: Montenegrin / Albanian only",
  },
  ru: {
    title: "Язык экзамена",
    body:
      "Важно: официальный теоретический экзамен на водительские права в Черногории можно сдать только на " +
      "черногорском или албанском языке. Чтобы подготовить вас к настоящему экзамену, каждый вопрос и ответ " +
      "показан сначала на черногорском, а под ним — перевод на русский. Учитесь узнавать вопросы на " +
      "черногорском — именно так они будут выглядеть на экзамене.",
    confirm: "Понятно",
    strip: "Язык экзамена: только черногорский / албанский",
  },
};
