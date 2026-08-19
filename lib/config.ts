/**
 * Parametri simulacije ispita — Crna Gora, B kategorija.
 *
 * Ispit nosi ukupno 80 bodova, a za prolaz treba 68 (što je istih 85% kao ranije,
 * samo izraženo u bodovima). Bodovi po pitanju su 1–4, gdje situacije i raskrsnice
 * nose najviše — što se poklapa sa našom bazom.
 *
 * TODO(MIRAV): potvrditi 80/68/45 i eventualnu raspodjelu po oblastima
 *   (teorija / znakovi / raskrsnice) po važećem Pravilniku o osposobljavanju
 *   kandidata za vozače (MUP CG) prije objave. Ako je zvanično fiksan i broj
 *   pitanja, treba znati raspodjelu po bodovima da bi oba uslova mogla važiti.
 */

/**
 * Ukupan broj bodova na ispitu. Ispit ima istovremeno TAČNO ovoliko bodova i
 * TAČNO `EXAM_QUESTION_COUNT` pitanja — vidi `buildExam` u lib/questions.ts.
 */
export const EXAM_TOTAL_POINTS = 80;

/** Bodova potrebno za prolaz. */
export const EXAM_PASS_POINTS = 68; // prag: 68 od 80 bodova

/**
 * NORMA PO OBLASTIMA — test se NE izvlači ravnomjerno nasumično.
 * Svako pitanje u questions.json ima `area`:
 *   I = propisi/teorija, II = saobraćajni znakovi, III = raskrsnice/situacije
 *
 * Brojevi su TAČAN broj pitanja iz svake oblasti (odnos ~2:1:1), a njihov zbir
 * je broj pitanja na ispitu. Mijenja li se kvota, mijenja se i broj pitanja.
 *
 * TODO(MIRAV): potvrditi tačnu kvotu po važećem Pravilniku (MUP CG), ili
 *   empirijski: pokrenuti jednu zvaničnu simulaciju na eUpravi i prebrojati
 *   koliko pitanja dolazi iz svake oblasti.
 *   Oblast „Posljedice nepoštovanja propisa" NE dolazi na ispit.
 *
 * Napomena o posljedici: prosjek u bazi je 1,93 (I), 2,97 (II) i 3,22 (III)
 * boda, pa nasumičnih 20/10/10 nosi oko 100 bodova. Da bi ispit imao tačno 80,
 * `buildExam` bira jeftinija pitanja unutar svake oblasti — pitanje od 1 boda
 * uđe u ispit ~18 puta češće od pitanja od 4 boda. To je posljedica bodova u
 * NAŠEM katalogu i vjerovatno znak da se oni razlikuju od zvaničnih: zvaničnih
 * 40 pitanja / 80 bodova daje prosjek tačno 2,00, a naša baza ima 2,66.
 */
export const EXAM_QUOTA: Readonly<Record<"I" | "II" | "III", number>> = {
  I: 20,
  II: 10,
  III: 10,
};

/**
 * Broj pitanja na ispitu — zbir kvote, ne zaseban broj, da se ta dva ne mogu
 * razići. Ispit ima tačno toliko pitanja i tačno EXAM_TOTAL_POINTS bodova.
 */
export const EXAM_QUESTION_COUNT = EXAM_QUOTA.I + EXAM_QUOTA.II + EXAM_QUOTA.III;

/** Trajanje ispita u minutima. */
export const EXAM_MINUTES = 45; // 45 minuta

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

/**
 * Prikaz novčane kazne uz grešku. Isključi jednim potezom ako pravna provjera
 * iznosa nije završena — vidi napomenu na vrhu lib/penalties.ts.
 */
export const PENALTIES_ENABLED = true;

/**
 * Koliko se zadrži na izabranom odgovoru prije automatskog prelaska na sljedeće
 * pitanje (samo na simulaciji ispita). Bez pauze kandidat ne vidi ✕ koji je
 * upisao; predugo i test djeluje sporo.
 */
export const AUTO_ADVANCE_MS = 350;
