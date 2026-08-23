/**
 * Uputstvo koje kandidat mora pročitati prije nego što započne simulaciju.
 *
 * ⚠️ TODO(MIRAV): tvrdnje o samom ispitu (dokumenti, odjeća, rok važenja
 * položenog teorijskog dijela) su preuzete iz uobičajene prakse auto-škola i
 * **nijesu provjerene uz važeći Pravilnik**. MIRAV ih mora potvrditi ili
 * ispraviti prije objave — ovo je jedini fajl koji za to treba dirati.
 *
 * Brojevi se ne prepisuju ručno: `{count}` i `{minutes}` dolaze iz lib/config.ts,
 * a `{points}` i `{pass}` iz **stvarno sastavljenog testa** — bodovi po pitanju
 * dolaze iz baze, pa ukupan zbir nije isti na svakom izvlačenju. Zato se ispit
 * sastavlja prije nego što se uputstvo prikaže (vidi `prepareExam` u Quiz.tsx).
 */

import type { Lang } from "./i18n";

export interface BriefingSection {
  id: string;
  /** `warn` je crveno zaglavlje (ono što kandidata može vratiti kući). */
  tone: "warn" | "info";
  title: Record<Lang, string>;
  items: Record<Lang, readonly string[]>;
}

export const EXAM_BRIEFING: readonly BriefingSection[] = [
  {
    id: "vazno",
    tone: "warn",
    title: {
      me: "Važno",
      en: "Important",
      ru: "Важно",
      sq: "Me rëndësi",
    },
    items: {
      me: [
        "Ispitu se ne može pristupiti bez lične karte, pasoša ili boravišne dozvole.",
        "Ispitu se ne može pristupiti u šorcu, mini suknji, golih ramena, golih leđa ili sa velikim dekolteom.",
        "Na ispitu pažljivo slušajte uputstva koja vam daje komisija.",
      ],
      en: [
        "You cannot sit the exam without an identity card, a passport or a residence permit.",
        "You cannot sit the exam in shorts, a mini skirt, with bare shoulders, a bare back or a low neckline.",
        "At the exam, listen carefully to the instructions given by the board.",
      ],
      ru: [
        "К экзамену нельзя приступить без удостоверения личности, паспорта или вида на жительство.",
        "К экзамену нельзя приступить в шортах, мини-юбке, с открытыми плечами, открытой спиной или с глубоким декольте.",
        "На экзамене внимательно слушайте указания комиссии.",
      ],
      sq: [
        "Provimit nuk mund t'i qaseni pa letërnjoftim, pasaportë ose leje qëndrimi.",
        "Provimit nuk mund t'i qaseni me pantallona të shkurtra, fund mini, me shpatulla të zbuluara, shpinë të zbuluar ose me dekolte të thellë.",
        "Në provim dëgjoni me kujdes udhëzimet që ju jep komisioni.",
      ],
    },
  },
  {
    id: "kako",
    tone: "info",
    title: {
      me: "Kako se rješava test",
      en: "How the test works",
      ru: "Как решается тест",
      sq: "Si zgjidhet testi",
    },
    items: {
      me: [
        "Test se sastoji od {count} pitanja.",
        "Tačan je samo jedan odgovor — nema pitanja sa više tačnih odgovora.",
        "Odgovarate klikom na kvadratić ispred odgovora; u njemu se upisuje ✕.",
        "Poslije izbora odgovora automatski prelazite na sljedeće pitanje.",
        "Vrijeme izrade testa je {minutes} minuta.",
        "Odgovor možete promijeniti dok test traje — vratite se na pitanje preko pregleda pitanja.",
      ],
      en: [
        "The test consists of {count} questions.",
        "Only one answer is correct — there are no questions with several correct answers.",
        "You answer by clicking the box in front of the answer; an ✕ is written in it.",
        "After you choose an answer you move on to the next question automatically.",
        "The time allowed for the test is {minutes} minutes.",
        "You can change an answer while the test is running — go back to the question through the question overview.",
      ],
      ru: [
        "Тест состоит из {count} вопросов.",
        "Верным является только один ответ — вопросов с несколькими верными ответами нет.",
        "Вы отвечаете, нажимая на квадрат перед ответом; в нём появляется ✕.",
        "После выбора ответа вы автоматически переходите к следующему вопросу.",
        "Время выполнения теста — {minutes} минут.",
        "Ответ можно изменить, пока идёт тест — вернитесь к вопросу через обзор вопросов.",
      ],
      sq: [
        "Testi përbëhet nga {count} pyetje.",
        "I saktë është vetëm një përgjigje — nuk ka pyetje me disa përgjigje të sakta.",
        "Përgjigjeni duke klikuar në katrorin para përgjigjes; në të shkruhet ✕.",
        "Pas zgjedhjes së përgjigjes kaloni automatikisht te pyetja tjetër.",
        "Koha e punimit të testit është {minutes} minuta.",
        "Përgjigjen mund ta ndryshoni derisa zgjat testi — kthehuni te pyetja përmes pasqyrës së pyetjeve.",
      ],
    },
  },
  {
    id: "poeni",
    tone: "info",
    title: {
      me: "Obračun poena",
      en: "Scoring",
      ru: "Подсчёт баллов",
      sq: "Llogaritja e pikëve",
    },
    items: {
      me: [
        "Svako pitanje nosi određeni broj bodova, a test ukupno {points} bodova.",
        "Za prolaz je potrebno najmanje {pass} od {points} bodova.",
        "Sastav testa: 10 saobraćajnih znakova, 20 teorijskih pitanja, komanda policijskog službenika, kosnik ili graničnik i 4 saobraćajne situacije.",
        "Uz komandu policajca i uz svaku situaciju ide i podpitanje uz istu sliku — u pregledu pitanja nosi slovo (npr. 32 i 32a).",
        "Položen teorijski dio ispita važi godinu dana od dana polaganja.",
      ],
      en: [
        "Each question carries a certain number of points, and the test carries {points} points in total.",
        "To pass you need at least {pass} out of {points} points.",
        "Test composition: 10 road signs, 20 theory questions, one police officer signal, one chevron or delineator, and 4 traffic situations.",
        "The police signal and each situation come with a follow-up question on the same picture — in the question overview it carries a letter (e.g. 32 and 32a).",
        "A passed theory exam is valid for one year from the day it was taken.",
      ],
      ru: [
        "Каждый вопрос имеет определённое количество баллов, а тест в целом — {points} баллов.",
        "Для сдачи нужно не менее {pass} из {points} баллов.",
        "Состав теста: 10 дорожных знаков, 20 теоретических вопросов, сигнал сотрудника полиции, косник или ограничитель и 4 дорожные ситуации.",
        "К сигналу полицейского и к каждой ситуации идёт дополнительный вопрос по той же картинке — в обзоре вопросов он отмечен буквой (например, 32 и 32a).",
        "Сданная теоретическая часть экзамена действительна один год со дня сдачи.",
      ],
      sq: [
        "Çdo pyetje bart një numër të caktuar pikësh, kurse testi gjithsej {points} pikë.",
        "Për të kaluar nevojiten së paku {pass} nga {points} pikë.",
        "Përbërja e testit: 10 shenja rrugore, 20 pyetje teorike, një sinjal i punonjësit të policisë, një kosnik ose kufizues dhe 4 situata në komunikacion.",
        "Sinjali i policisë dhe çdo situatë kanë edhe një nënpyetje me të njëjtën figurë — në pasqyrën e pyetjeve mban shkronjë (p.sh. 32 dhe 32a).",
        "Pjesa teorike e provimit e kaluar vlen një vit nga dita e dhënies.",
      ],
    },
  },
];

/** Zamjenjuje `{count}`, `{minutes}`, `{points}` i `{pass}` iz konfiguracije. */
export function fillBriefing(
  text: string,
  values: { count: number; minutes: number; points: number; pass: number },
): string {
  return text
    .replace(/\{count\}/g, String(values.count))
    .replace(/\{minutes\}/g, String(values.minutes))
    .replace(/\{points\}/g, String(values.points))
    .replace(/\{pass\}/g, String(values.pass));
}
