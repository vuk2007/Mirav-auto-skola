/**
 * Parametri simulacije ispita — Crna Gora, B kategorija.
 *
 * Izvor: više crnogorskih auto-škola koje upućuju na e-Upravu navodi 41 pitanje,
 * 45 minuta i prag od 85% osvojenih bodova; bodovi po pitanju 1–4, gdje situacije
 * i raskrsnice nose najviše — što se poklapa sa našom bazom.
 *
 * TODO(MIRAV): potvrditi 41/45/85 i eventualnu raspodjelu po oblastima
 *   (teorija / znakovi / raskrsnice) po važećem Pravilniku o osposobljavanju
 *   kandidata za vozače (MUP CG) prije objave.
 */

/** Broj nasumičnih pitanja u simulaciji ispita. */
export const EXAM_QUESTION_COUNT = 41; // zvanično: 41 pitanje

/** Trajanje ispita u minutima. */
export const EXAM_MINUTES = 45; // 45 minuta

/** Procenat osvojenih bodova potreban za prolaz (0–100). */
export const PASS_PERCENT = 85; // prag 85% osvojenih bodova

/**
 * Bodovi za `ordering` pitanja — u katalogu nemaju bod (`points: null`), pa se
 * tretiraju kao situacijska pitanja.
 *
 * Bodovi po pitanju inače dolaze iz questions.json (`points: 1..4`).
 * Ako je null → DEFAULT_ORDERING_POINTS.
 */
export const DEFAULT_ORDERING_POINTS = 4;

/** Ispod ovoliko sekundi tajmer prelazi u crveno (zadnjih 5 minuta). */
export const EXAM_WARNING_SECONDS = 5 * 60;

/** Uključi/isključi tajmer na simulaciji ispita. */
export const EXAM_TIMER_ENABLED = true;

/** Broj pitanja po vježbi kad je izabrana kategorija — 0 znači „sva pitanja iz kategorije". */
export const PRACTICE_QUESTION_LIMIT = 0;

/** Dozvoljeni roditeljski domeni za <iframe> (koristi se u next.config.mjs). */
export const FRAME_ANCESTORS = ["'self'", "https://mirav.me", "https://*.mirav.me"] as const;

/**
 * Zvanični izvori — prikazuju se u modalu „Literatura".
 * Naslovi su nazivi akata, pa ostaju na crnogorskom i u engleskom UI-u.
 */
export const LITERATURE: readonly { title: string; url: string }[] = [
  {
    title: "Katalog ispitnih pitanja (MUP CG)",
    url: "https://www.gov.me/dokumenta/c4096c73-e71d-4b03-931b-a8809c971772",
  },
  {
    title: "Zakon o bezbjednosti saobraćaja na putevima",
    url: "https://www.gov.me/dokumenta/022a8ec6-b13e-44d2-8493-24e781bd94c3",
  },
  {
    title: "Pravilnik o saobraćajnoj signalizaciji",
    url: "https://www.gov.me/dokumenta/d3aca36f-daa4-4680-9b2e-370e3ab7e7e8",
  },
  {
    title: "Pravilnik o znacima ovlašćenog policijskog službenika",
    url: "https://www.gov.me/dokumenta/eb7c9869-3b62-4f55-85ad-08a576664f76",
  },
  {
    title: "Pravilnik o uslovima koje moraju ispunjavati vozila",
    url: "https://www.gov.me/dokumenta/09ef4d20-93ad-4ae5-906a-58bcd82d7963",
  },
] as const;
