/**
 * Parametri simulacije ispita.
 *
 * TODO: uskladiti sa zvaničnim pravilnikom MUP-a (B kategorija, Crna Gora).
 * Vrijednosti ispod su PRIVREMENE — prije objave provjeriti tačan broj pitanja,
 * prag za prolaz i trajanje ispita, pa izmijeniti samo ovaj fajl.
 */

/** Broj nasumičnih pitanja u simulaciji ispita. */
export const EXAM_QUESTION_COUNT = 40; // TODO: uskladiti sa zvaničnim pravilnikom MUP-a

/** Procenat osvojenih bodova potreban za prolaz (0–100). */
export const PASS_PERCENT = 85; // TODO: uskladiti sa zvaničnim pravilnikom MUP-a

/** Trajanje ispita u minutima. Koristi se samo ako je `EXAM_TIMER_ENABLED = true`. */
export const EXAM_MINUTES = 45; // TODO: uskladiti sa zvaničnim pravilnikom MUP-a

/** Uključi/isključi tajmer na simulaciji ispita. */
export const EXAM_TIMER_ENABLED = true;

/**
 * Bodovi za `ordering` pitanja — u izvornom JSON-u imaju `points: null`.
 * TODO: provjeriti koliko zvanično nose pitanja sa redoslijedom prolaska.
 */
export const ORDERING_POINTS = 1;

/** Broj pitanja po vježbi kad je izabrana kategorija — 0 znači „sva pitanja iz kategorije". */
export const PRACTICE_QUESTION_LIMIT = 0;

/** Dozvoljeni roditeljski domeni za <iframe> (koristi se u next.config.mjs). */
export const FRAME_ANCESTORS = ["'self'", "https://mirav.me", "https://*.mirav.me"] as const;
