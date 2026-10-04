/**
 * Uputstvo koje kandidat mora pročitati prije nego što započne simulaciju.
 *
 * ⚠️ TODO(MIRAV): tvrdnje o samom ispitu (dokumenti, odjeća, rok važenja
 * položenog teorijskog dijela) su preuzete iz uobičajene prakse auto-škola i
 * **nijesu provjerene uz važeći Pravilnik**. MIRAV ih mora potvrditi ili
 * ispraviti prije objave — ovo je jedini fajl koji za to treba dirati.
 *
 * Brojevi se ne prepisuju ručno: `{count}`, `{pages}` i `{minutes}` dolaze iz lib/config.ts,
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
        "Test se sastoji od {count} pitanja na {pages} stranica.",
        "Tačan je samo jedan odgovor — nema pitanja sa više tačnih odgovora.",
        "Odgovarate klikom na kružić ispred odgovora. Kod pitanja o redoslijedu prolaska upisujete brojeve vozila.",
        "Između stranica se krećete dugmadima „Prethodna“ i „Sljedeća“; odgovori se čuvaju.",
        "Vrijeme izrade testa je {minutes} minuta. Kad istekne, test se automatski predaje.",
        "Odgovor možete promijeniti dok test traje — do svakog pitanja stižete i preko pregleda pitanja.",
      ],
      en: [
        "The test consists of {count} questions on {pages} pages.",
        "Only one answer is correct — there are no questions with several correct answers.",
        "You answer by clicking the circle in front of the answer. For questions on the order of passing you type in the vehicle numbers.",
        "You move between pages with the “Previous” and “Next” buttons; your answers are kept.",
        "The time allowed for the test is {minutes} minutes. When it runs out, the test is submitted automatically.",
        "You can change an answer while the test is running — you can reach any question through the question overview.",
      ],
      ru: [
        "Тест состоит из {count} вопросов на {pages} страницах.",
        "Верным является только один ответ — вопросов с несколькими верными ответами нет.",
        "Вы отвечаете, нажимая на кружок перед ответом. В вопросах об очерёдности проезда вводите номера транспортных средств.",
        "Между страницами вы переходите кнопками «Предыдущая» и «Следующая»; ответы сохраняются.",
        "Время выполнения теста — {minutes} минут. Когда оно истечёт, тест сдаётся автоматически.",
        "Ответ можно изменить, пока идёт тест — к любому вопросу можно перейти через обзор вопросов.",
      ],
      sq: [
        "Testi përbëhet nga {count} pyetje në {pages} faqe.",
        "I saktë është vetëm një përgjigje — nuk ka pyetje me disa përgjigje të sakta.",
        "Përgjigjeni duke klikuar në rrethin para përgjigjes. Te pyetjet për radhën e kalimit shkruani numrat e automjeteve.",
        "Ndërmjet faqeve lëvizni me butonat “E mëparshmja” dhe “Tjetra”; përgjigjet ruhen.",
        "Koha e punimit të testit është {minutes} minuta. Kur të skadojë, testi dorëzohet automatikisht.",
        "Përgjigjen mund ta ndryshoni derisa zgjat testi — te çdo pyetje arrini edhe përmes pasqyrës së pyetjeve.",
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
        "Sastav testa: 9 teorijskih pitanja, 8 saobraćajnih situacija sa po dva pitanja uz istu sliku, 8 saobraćajnih znakova i kosnik ili graničnik, komanda policijskog službenika sa dva pitanja, 2 pitanja o semaforima i 2 pitanja iz poznavanja vozila i prve pomoći.",
        "Bodovi i tačni odgovori se vide tek poslije predaje testa.",
        "Položen teorijski dio ispita važi godinu dana od dana polaganja.",
      ],
      en: [
        "Each question carries a certain number of points, and the test carries {points} points in total.",
        "To pass you need at least {pass} out of {points} points.",
        "Test composition: 9 theory questions, 8 traffic situations with two questions on each picture, 8 road signs and one chevron or delineator, a police officer signal with two questions, 2 questions on traffic lights and 2 questions on the vehicle and first aid.",
        "Points and correct answers are shown only after you submit the test.",
        "A passed theory exam is valid for one year from the day it was taken.",
      ],
      ru: [
        "Каждый вопрос имеет определённое количество баллов, а тест в целом — {points} баллов.",
        "Для сдачи нужно не менее {pass} из {points} баллов.",
        "Состав теста: 9 теоретических вопросов, 8 дорожных ситуаций с двумя вопросами по каждой картинке, 8 дорожных знаков и косник или ограничитель, сигнал сотрудника полиции с двумя вопросами, 2 вопроса о светофорах и 2 вопроса об устройстве автомобиля и первой помощи.",
        "Баллы и верные ответы видны только после сдачи теста.",
        "Сданная теоретическая часть экзамена действительна один год со дня сдачи.",
      ],
      sq: [
        "Çdo pyetje bart një numër të caktuar pikësh, kurse testi gjithsej {points} pikë.",
        "Për të kaluar nevojiten së paku {pass} nga {points} pikë.",
        "Përbërja e testit: 9 pyetje teorike, 8 situata në komunikacion me nga dy pyetje për secilën figurë, 8 shenja rrugore dhe një kosnik ose kufizues, një sinjal i punonjësit të policisë me dy pyetje, 2 pyetje për semaforët dhe 2 pyetje për automjetin dhe ndihmën e parë.",
        "Pikët dhe përgjigjet e sakta shihen vetëm pas dorëzimit të testit.",
        "Pjesa teorike e provimit e kaluar vlen një vit nga dita e dhënies.",
      ],
    },
  },
];

/** Zamjenjuje `{count}`, `{pages}`, `{minutes}`, `{points}` i `{pass}` iz konfiguracije. */
export function fillBriefing(
  text: string,
  values: { count: number; pages: number; minutes: number; points: number; pass: number },
): string {
  return text
    .replace(/\{count\}/g, String(values.count))
    .replace(/\{pages\}/g, String(values.pages))
    .replace(/\{minutes\}/g, String(values.minutes))
    .replace(/\{points\}/g, String(values.points))
    .replace(/\{pass\}/g, String(values.pass));
}
