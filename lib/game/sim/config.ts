/**
 * Sve konstante simulacije na jednom mjestu.
 *
 * Nijedan broj iz ovog fajla ne smije se ponoviti u kodu — ako negdje zatreba
 * „3 sekunde" ili „2 metra", uzima se odavde. Razlog je praktičan: podešavanje
 * osjećaja igre je posao od pola sata ako su brojevi ovdje, i posao od pola
 * dana ako su rasuti po petlji.
 *
 * Jedinice: metri, sekunde, m/s. Nigdje km/h osim u prikazu.
 */

/** Korak simulacije. Fiksan — vidi `world.ts` za razlog. */
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/**
 * Koliko koraka simulacije smije da se odradi u jednom pozivu `advance`.
 * Štiti od „spirale smrti" kad se tab vrati iz pozadine sa velikim zaostatkom:
 * bolje preskočiti vrijeme nego zamrznuti stranicu.
 */
export const MAX_STEPS_PER_FRAME = 10;

// ── Fizika ──────────────────────────────────────────────────────────────────

/** Najveće ubrzanje na pun gas [m/s²]. */
export const A_MAX = 2.5;
/** Najveće usporenje na punu kočnicu [m/s²]. */
export const B_MAX = 6;
/**
 * Dozvoljena brzina [m/s] ≈ 50 km/h. Scenario je može promijeniti.
 *
 * Ovo je PROPIS, ne mogućnost vozila — vidi `V_TOP`.
 */
export const V_MAX_DEFAULT = 14;

/**
 * Koliko vozilo fizički može [m/s] ≈ 65 km/h.
 *
 * Razdvojeno od `V_MAX_DEFAULT` namjerno: dok su bili isti broj, brzina se
 * stezala na dozvoljenu, pa uslov `v > vMax * 1.05` nikad nije mogao biti
 * tačan i pravilo o prekoračenju je bilo mrtvo slovo. Sad igrač MOŽE da pretjera
 * — i da za to odgovara.
 */
export const V_TOP = 18;

/**
 * Otpor: bez gasa vozilo usporava. Namjerno je linearan i mali — cilj nije
 * vjeran model vozila nego da puštanje gasa ima vidljivu posljedicu.
 */
export const DRAG_COEFF = 0.12;
/** Konstantno usporenje pri kotrljanju, da vozilo bez gasa na kraju stane. */
export const ROLL_RESISTANCE = 0.35;

// ── Vozilo ──────────────────────────────────────────────────────────────────

export const CAR_LENGTH = 4.4;
export const CAR_WIDTH = 1.8;

// ── Ponašanje NPC vozila ────────────────────────────────────────────────────

/**
 * Ako drugo vozilo stiže do zajedničke tačke za manje od ovoliko sekundi,
 * smatra se da „nailazi" i da mu treba ustupiti.
 */
export const TTC_THRESHOLD = 3;
/** Razmak koji NPC drži do tačke na kojoj mora da stane [m]. */
export const GAP = 2;

/**
 * Koliko sekundi NPC ostavlja sebi da očisti konfliktnu tačku [s].
 *
 * Fiksni prag od `TTC_THRESHOLD` sam nije dovoljan: dok drugi ne uđe u tri
 * sekunde, NPC vozi punom brzinom, a tada mu za kočenje ostane manje puta nego
 * što mu treba — i uleti u raskrsnicu. Zato se ustupa i kad bi drugi stigao
 * prije nego što ja stignem da prođem, bez obzira na to koliko je to sekundi.
 */
export const CLEAR_TIME = 2;
/** Koliko NPC stoji na STOP liniji prije nego što nastavi [s]. */
export const STOP_DWELL = 1;
/** Razmak do vozila ispred u istoj traci [m]. */
export const FOLLOW_GAP = 6;

// ── Prekršaji ───────────────────────────────────────────────────────────────

/** Brzina ispod koje se smatra da vozilo stoji [m/s]. */
export const STOPPED_SPEED = 0.15;
/** Koliko dugo mora stajati da bi se priznalo zaustavljanje na STOP-u [s]. */
export const STOP_HOLD = 0.5;
/** Koliko prije stop-linije se zaustavljanje priznaje [m]. */
export const STOP_ZONE = 2;

/**
 * Koliko prije stop-linije vozilo cilja da stane [m].
 *
 * Bez ove margine vozilo staje TAČNO na liniji, pa ispada da ju je prešlo
 * (`s >= stopLineS`) — što je rušilo i STOP i crveno svjetlo i savršenom vozaču.
 * Stvarni vozač takođe staje ispred linije, ne na njoj.
 */
export const STOP_MARGIN = 0.6;

/** Brzina ispod koje se smatra da igrač „puzi" i zadržava saobraćaj [m/s]. */
export const CRAWL_SPEED = 0.5;
/** Koliko smije da stoji na slobodnom putu prije nego što je to prekršaj [s]. */
export const OBSTRUCTION_TIMEOUT = 4;

/** Koliko puta preko `V_MAX` se tolerише prije nego što je prekoračenje. */
export const SPEEDING_FACTOR = 1.05;

/**
 * Koliko sekundi prije stop-linije je vozilo smjelo da nastavi kad se upali
 * žuto. Bliže od ovoga zaustavljanje bi bilo naglo i opasnije od prolaska.
 */
export const YELLOW_COMMIT_TTC = 1.5;

// ── Geometrija raskrsnice ───────────────────────────────────────────────────

/** Širina jedne saobraćajne trake [m]. */
export const LANE_WIDTH = 3.5;
/** Dužina prilaza od stop-linije do mjesta gdje vozila nastaju [m]. */
export const APPROACH_LENGTH = 60;
/** Dužina izlaza poslije raskrsnice [m]. */
export const EXIT_LENGTH = 40;
/** Na koliko se dijelova uzorkuje luk kroz raskrsnicu. */
export const ARC_SAMPLES = 24;

// ── Snimanje i ponavljanje ──────────────────────────────────────────────────

/** Koliko sekundi unazad se pamti za „Replay zadnjih 5 s". */
export const REPLAY_SECONDS = 5;
/** Na koliko sekundi se pamti snimak stanja za replay. */
export const SNAPSHOT_INTERVAL = 1;

// ── Ograničenja ─────────────────────────────────────────────────────────────

/** Poslije ovoliko sekundi se scenario prekida — zaštita od beskonačne petlje. */
export const MAX_SCENARIO_SECONDS = 120;
