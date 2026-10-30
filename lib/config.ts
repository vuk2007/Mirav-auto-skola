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
 *    segment je na `page`,
 *  - `points` — bodovi po mjestu u segmentu, redom (po jedan za svako
 *    pitanje, i za podpitanje),
 *  - `pairPoints` — umjesto `points` kod parova čija se podjela bodova
 *    određuje po pitanjima (situacije, vidi `situationPairPoints` u
 *    lib/questions.ts): zbir bodova svakog para.
 *
 * BODOVI ne dolaze iz baze nego iz mjesta na testu, po bodovnoj listi pravog
 * ispita (štampani testovi 1.1, 2.1 i 3.1): test uvijek nosi tačno
 * `EXAM_TOTAL_POINTS` = 80 bodova —
 *
 *   teorija               15  (2,2,2,2,1,1,1,2,2)
 *   situacije, 8 parova   40  (par = 5: 4+1 ili 3+2)
 *   znakovi + kosnik      15  (1,2,2,2,2,2,2,1 + 1)
 *   policajac (par)        4  (2+2)
 *   semafori               4  (2+2)
 *   opšta znanja           2  (1+1)
 */
export const EXAM_STRUCTURE = [
  { kind: "teorija", count: 9, withSub: false, page: 1, points: [2, 2, 2, 2, 1, 1, 1, 2, 2] },
  { kind: "situacija", count: 8, withSub: true, page: 2, groupsPerPage: 2, pairPoints: 5 },
  { kind: "znak", count: 8, withSub: false, page: 6, points: [1, 2, 2, 2, 2, 2, 2, 1] },
  { kind: "kosnik", count: 1, withSub: false, page: 6, points: [1] },
  { kind: "policajac", count: 1, withSub: true, page: 7, points: [2, 2] },
  { kind: "semafor", count: 2, withSub: false, allowSubs: true, page: 8, points: [2, 2] },
  { kind: "opste", count: 2, withSub: false, page: 9, points: [1, 1] },
] as const satisfies readonly ExamSegment[];

export interface ExamSegment {
  kind: QuestionKind;
  count: number;
  withSub: boolean;
  allowSubs?: boolean;
  page: number;
  groupsPerPage?: number;
  points?: readonly number[];
  pairPoints?: number;
}

/**
 * Ukupan broj pitanja na ispitu: 9 + 16 + 8 + 1 + 2 + 2 + 2 = 40.
 *
 * Napisan je kao konstanta a ne izveden zbroj da bi bio provjerljiv naspram
 * zvaničnog broja — `assertExamStructure()` ispod puca ako se razminu.
 */
export const EXAM_QUESTION_COUNT = 40;

/**
 * Podjela bodova para situacija (zbir = `pairPoints`), po bodovnoj listi:
 *  - `major` — redoslijed prolaska ili „vozilo je propisno/nepropisno
 *    zaustavljeno ili parkirano" nosi 4, pitanje uz njega 1,
 *  - `normal` — inače 3 + 2 („kako ćete postupiti" nosi 3).
 */
export const EXAM_PAIR_SPLIT = { major: [4, 1], normal: [3, 2] } as const;

/** Ukupan broj bodova na ispitu — isti na svakom testu. */
export const EXAM_TOTAL_POINTS = 80;

/** Najmanje bodova za prolaz (od `EXAM_TOTAL_POINTS`). */
export const EXAM_PASS_POINTS = 68;

/** Broj stranica simulacije ispita. */
export const EXAM_PAGE_COUNT = 9;

/** Posljednja stranica koju segment zauzima (1-bazirana). */
export function segmentLastPage(seg: ExamSegment): number {
  return seg.groupsPerPage ? seg.page + Math.ceil(seg.count / seg.groupsPerPage) - 1 : seg.page;
}

/** Zbir bodova segmenta. */
export function segmentPoints(seg: ExamSegment): number {
  if (seg.pairPoints !== undefined) return seg.pairPoints * seg.count;
  return (seg.points ?? []).reduce((n, p) => n + p, 0);
}

/**
 * Puca ako `EXAM_STRUCTURE` ne daje `EXAM_QUESTION_COUNT` pitanja ni
 * `EXAM_TOTAL_POINTS` bodova, ako bodovi segmenta nijesu zadati za svako
 * pitanje, ili ako stranice nijesu redom 1..EXAM_PAGE_COUNT bez rupa. Zove se odmah pri
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
  for (const seg of EXAM_STRUCTURE as readonly ExamSegment[]) {
    const n = seg.count * (seg.withSub ? 2 : 1);
    const ok =
      seg.pairPoints !== undefined
        ? seg.withSub && seg.points === undefined
        : seg.points !== undefined && seg.points.length === n;
    if (!ok) throw new Error(`Segment „${seg.kind}": bodovi nijesu zadati za svako od ${n} pitanja.`);
    for (const split of Object.values(EXAM_PAIR_SPLIT)) {
      if (seg.pairPoints !== undefined && split[0] + split[1] !== seg.pairPoints) {
        throw new Error(`EXAM_PAIR_SPLIT ${split.join("+")} ne daje ${seg.pairPoints} bodova para.`);
      }
    }
  }
  const points = EXAM_STRUCTURE.reduce((n, seg) => n + segmentPoints(seg), 0);
  if (points !== EXAM_TOTAL_POINTS) {
    throw new Error(
      `EXAM_STRUCTURE nosi ${points} bodova, a EXAM_TOTAL_POINTS je ${EXAM_TOTAL_POINTS}. ` +
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

/** Trajanje ispita u minutima. */
export const EXAM_MINUTES = 60; // 60 minuta (odluka korisnika 2026-10-30; ranije 45)

/**
 * Bodovi za `ordering` pitanja u VJEŽBI — u katalogu nemaju bod
 * (`points: null`). Vježba prikazuje bodove iz questions.json (`points: 1..4`);
 * na ispitu bodovi idu po mjestu, vidi `EXAM_STRUCTURE`.
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
