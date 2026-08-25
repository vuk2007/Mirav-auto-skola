/**
 * Parametri simulacije ispita — Crna Gora, B kategorija.
 *
 * Ispit se NE izvlači po oblastima I/II/III nego po segmentima (`kind`), onako
 * kako je sastavljen zvanični test. Polje `area` u bazi ostaje netaknuto i dalje
 * se koristi u vježbi.
 */
/**
 * SASTAV ISPITA — koliko pitanja iz kojeg segmenta, i da li segment nosi
 * podpitanje.
 *
 * `withSub: true` znači da se uz svako izvučeno pitanje odmah iza njega
 * postavlja i njegovo podpitanje (`subOf` u bazi) — to je par koji u zvaničnom
 * katalogu dijeli jednu sliku („kako ćete postupiti…" + „redoslijed prolaska…").
 * Podpitanje se broji kao zasebno pitanje.
 *
 * Redoslijed unosa je i redoslijed segmenata u testu.
 *
 * TODO(MIRAV): potvrditi sastav uz važeći Pravilnik (MUP CG).
 */
export const EXAM_STRUCTURE = [
    { kind: "znak", count: 10, withSub: false },
    { kind: "teorija", count: 20, withSub: false },
    { kind: "policajac", count: 1, withSub: true },
    { kind: "kosnik", count: 1, withSub: false },
    { kind: "situacija", count: 4, withSub: true },
];
/**
 * Ukupan broj pitanja na ispitu, uključujući podpitanja: 10 + 20 + (1+1) + 1 +
 * (4+4) = 41. Poklapa se sa zvaničnim brojem pitanja.
 *
 * Napisan je kao konstanta a ne izveden zbroj da bi bio provjerljiv naspram
 * zvaničnog broja — `assertExamStructure()` ispod puca ako se razminu.
 */
export const EXAM_QUESTION_COUNT = 41;
/**
 * Puca ako `EXAM_STRUCTURE` i `EXAM_QUESTION_COUNT` ne daju isti broj. Zove se
 * odmah pri učitavanju modula, pa greška u sastavu pada na buildu (stranice se
 * prerenderuju), a ne tiho u browseru kandidata.
 */
export function assertExamStructure() {
    const sum = EXAM_STRUCTURE.reduce((n, seg) => n + seg.count * (seg.withSub ? 2 : 1), 0);
    if (sum !== EXAM_QUESTION_COUNT) {
        throw new Error(`EXAM_STRUCTURE daje ${sum} pitanja, a EXAM_QUESTION_COUNT je ${EXAM_QUESTION_COUNT}. ` +
            `Uskladi lib/config.ts.`);
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
export function examPassPoints(total) {
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
export const FRAME_ANCESTORS = ["'self'", "https://mirav.me", "https://*.mirav.me"];
/**
 * Zvanični izvori — prikazuju se u modalu „Literatura".
 * Naslovi su nazivi akata, pa ostaju na crnogorskom i u engleskom UI-u.
 */
export const LITERATURE = [
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
];
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
