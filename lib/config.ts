/**
 * Parametri simulacije ispita — Crna Gora, B kategorija.
 *
 * Ispit se NE izvlači po oblastima I/II/III nego po segmentima (`kind`), onako
 * kako je sastavljen zvanični test. Polje `area` u bazi ostaje netaknuto i dalje
 * se koristi u vježbi.
 */

import type { QuestionKind } from "./types";

/**
 * SASTAV ISPITA — segmenti redom kojim idu u testu, po uzoru na pravi test
 * (40 pitanja numerisanih 1–40, na 9 stranica):
 *
 *   str. 1     Q1–9    teorija (propisi)
 *   str. 2–5   Q10–25  8 slika situacija, svaka sa 2 pitanja (2 slike po strani)
 *   str. 6     Q26–34  8 saobraćajnih znakova + kosnik ili graničnik
 *   str. 7     Q35–36  policijski službenik, 1 slika sa 2 pitanja
 *   str. 8     Q37–38  semafori, svako pitanje sa svojom slikom
 *   str. 9     Q39–40  opšta znanja (vozilo, prva pomoć)
 *
 * Polja:
 *  - `count` — broj izvlačenja; kod `withSub` to su parovi, pa segment nosi
 *    `count × 2` pitanja,
 *  - `withSub` — uz svako izvučeno pitanje ide i njegovo podpitanje (`subOf`),
 *    na istoj kartici, jer dijele sliku,
 *  - `allowSubs` — podpitanja se izvlače i sama za sebe. Tada nikad dva pitanja
 *    iz istog para, da svako pitanje ima drugu sliku (semafori),
 *  - `page` — stranica (1-bazirana) na kojoj segment počinje,
 *  - `groupsPerPage` — koliko izvlačenja staje na stranicu; bez njega cio
 *    segment je na `page`.
 */
export const EXAM_STRUCTURE = [
  { kind: "teorija", count: 9, withSub: false, page: 1 },
  { kind: "situacija", count: 8, withSub: true, page: 2, groupsPerPage: 2 },
  { kind: "znak", count: 8, withSub: false, page: 6 },
  { kind: "kosnik", count: 1, withSub: false, page: 6 },
  { kind: "policajac", count: 1, withSub: true, page: 7 },
  { kind: "semafor", count: 2, withSub: false, allowSubs: true, page: 8 },
  { kind: "opste", count: 2, withSub: false, page: 9 },
] as const satisfies readonly ExamSegment[];

export interface ExamSegment {
  kind: QuestionKind;
  count: number;
  withSub: boolean;
  allowSubs?: boolean;
  page: number;
  groupsPerPage?: number;
}

/**
 * Ukupan broj pitanja na ispitu: 9 + 16 + 8 + 1 + 2 + 2 + 2 = 40.
 *
 * Napisan je kao konstanta a ne izveden zbroj da bi bio provjerljiv naspram
 * zvaničnog broja — `assertExamStructure()` ispod puca ako se razminu.
 */
export const EXAM_QUESTION_COUNT = 40;

/** Broj stranica simulacije ispita. */
export const EXAM_PAGE_COUNT = 9;

/** Posljednja stranica koju segment zauzima (1-bazirana). */
export function segmentLastPage(seg: ExamSegment): number {
  return seg.groupsPerPage ? seg.page + Math.ceil(seg.count / seg.groupsPerPage) - 1 : seg.page;
}

/**
 * Puca ako `EXAM_STRUCTURE` ne daje `EXAM_QUESTION_COUNT` pitanja ili ako
 * stranice nijesu redom 1..EXAM_PAGE_COUNT bez rupa. Zove se odmah pri
 * učitavanju modula, pa greška u sastavu pada na buildu (stranice se
 * prerenderuju), a ne tiho u browseru kandidata.
 */
export function assertExamStructure(): void {
  const sum = EXAM_STRUCTURE.reduce((n, seg) => n + seg.count * (seg.withSub ? 2 : 1), 0);
  if (sum !== EXAM_QUESTION_COUNT) {
    throw new Error(
      `EXAM_STRUCTURE daje ${sum} pitanja, a EXAM_QUESTION_COUNT je ${EXAM_QUESTION_COUNT}. ` +
        `Uskladi lib/config.ts.`,
    );
  }
  let last = 0;
  for (const seg of EXAM_STRUCTURE) {
    // Segment počinje na istoj stranici kao prethodni ili na sljedećoj.
    if (seg.page !== last && seg.page !== last + 1) {
      throw new Error(`Segment „${seg.kind}" počinje na str. ${seg.page}, poslije str. ${last}.`);
    }
    last = segmentLastPage(seg);
  }
  if (last !== EXAM_PAGE_COUNT) {
    throw new Error(`EXAM_STRUCTURE ide do str. ${last}, a EXAM_PAGE_COUNT je ${EXAM_PAGE_COUNT}.`);
  }
}
assertExamStructure();

/**
 * Prag za prolaz, u procentu osvojenih bodova.
 *
 * Bodovi po pitanju dolaze iz baze (1–4), pa ukupan broj bodova zavisi od toga
 * koja su pitanja izvučena i nije isti na svakom testu. Zato je prag procenat,
 * a ne fiksan broj bodova — vidi `examPassPoints`.
 */
export const EXAM_PASS_PERCENT = 85;

/** Koliko bodova treba za prolaz na testu koji ukupno nosi `total` bodova. */
export function examPassPoints(total: number): number {
  return Math.ceil((total * EXAM_PASS_PERCENT) / 100);
}

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
 * Prikaz novčane kazne uz grešku.
 *
 * **Podrazumijevano ISKLJUČENO.** Iznosi u `lib/penalties.ts` su parsirani
 * automatski i nijedan nije potvrdio čovjek (0 od 39 — vidi `qa/izvjestaj.md`).
 * Dok instruktorka ne prođe kroz pitanja i ne potvrdi kazne, ništa se ne
 * prikazuje kandidatu.
 *
 * Pali se sa `NEXT_PUBLIC_KAZNE_ENABLED=true` u okruženju. Promjenljiva se
 * ugrađuje u build, pa poslije njene izmjene treba ponovo deployovati.
 * Ako nije postavljena, vrijednost je `false` — bezbjedno podrazumijevano.
 */
export const PENALTIES_ENABLED = process.env.NEXT_PUBLIC_KAZNE_ENABLED === "true";
