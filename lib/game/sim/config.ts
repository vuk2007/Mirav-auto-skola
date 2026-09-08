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

// ── Prikaz ──────────────────────────────────────────────────────────────────

/**
 * Pola vidljivog polja [m]. Kamera je fiksna na cijelu raskrsnicu, pa mora da
 * obuhvati i mjesto na kojem vozila nastaju — inače igrač ne vidi sebe na startu.
 */
export const VIEW_HALF = 52;

/** Koliko puta u sekundi se osvježava HUD. Simulacija i dalje ide na `TICK_HZ`. */
export const HUD_HZ = 10;

/**
 * Najmanja dužina vozila na ekranu [px]. Na uskom telefonu 4,4 m ispadne
 * petnaestak piksela; ispod ovoga se vozilo crta uvećano da ostane vidljivo.
 */
export const MIN_CAR_PX = 16;

/** Najmanja veličina znaka na ekranu [px] — znak mora da se prepozna. */
export const MIN_SIGN_PX = 18;

/** Koliko puta u sekundi trepće pokazivač pravca. */
export const BLINK_HZ = 1.5;

/**
 * Koliko unutar ivice kadra stoji oznaka za vozilo koje još nije u kadru [m].
 *
 * Vozila nastaju 67 m od centra, a kadar hvata 52 m — bez oznake NPC iskrsne na
 * ivici tek 1,3 s prije posljednjeg trenutka za kočenje, što nije dovoljno da
 * čovjek reaguje. Mjereno, vidi `zvid` mjerenje u izvještaju faze 2.
 */
export const EDGE_MARKER_INSET = 2.5;

// ── Pokazivač pravca ────────────────────────────────────────────────────────

/**
 * Koliko prije stop-linije se očekuje uključen pokazivač [m].
 *
 * Rastojanje, a ne vrijeme, jer se zona pokazivača crta na putanji: igrač mora
 * da vidi gdje se šta očekuje, a vrijeme se ne može nacrtati.
 */
export const INDICATOR_LEAD = 20;

/** Koliko poslije izlaska iz raskrsnice pokazivač mora biti ugašen [m]. */
export const INDICATOR_OFF_AFTER = 15;

/**
 * Tolerancija na rok za paljenje pokazivača [m].
 *
 * Kad je rok isti kao početak faze (u kružnom toku: „najkasnije kad prođeš
 * izlaz prije svog"), vozač koji upali TAČNO tu ispadne zakasnio — jer se
 * simulacija odvija u koracima, pa se promjena zabilježi metar dalje. Bez ove
 * tolerancije ni savršen bot ne bi mogao da prođe sopstvenu tabelu.
 *
 * Ista tolerancija vrijedi i za čovjeka: niko ne pomjera ručicu na tačan metar.
 */
export const INDICATOR_GRACE = 2;

/**
 * Koliko je linija ustupanja odmaknuta od ivice prstena [m].
 *
 * Bez odmaka vozilo koje ISPRAVNO stane i čeka prazninu stoji nosom u kružnoj
 * traci, pa ga pokosi prvo vozilo koje prođe — izmjereno, sva tri scenarija sa
 * gustim prstenom su tako padala na sudar bez ičije greške. Stvarna linija
 * ustupanja je takođe uvučena.
 */
export const RING_YIELD_SETBACK = 5;

// ── Težina ──────────────────────────────────────────────────────────────────

export type Level = 1 | 2 | 3 | 4 | 5;

export interface DifficultyParams {
  /** Množilac za broj NPC-a i skraćivanje prozora nastanka. */
  densityMultiplier: number;
  /** Množilac brzine NPC-a. */
  speedMultiplier: number;
  /** Koliko igrač smije da stoji na slobodnom putu [s]. */
  obstructionTimeout: number;
  /** Prag „nailazi" za ustupanje [s]. */
  ttcThreshold: number;
  /** Vjerovatnoća problematičnog događaja u generisanom segmentu. */
  ruleBreakerChance: number;
  /** Tolerancija na rok za pokazivač [m]. */
  indicatorGrace: number;
  /**
   * Vjerovatnoća da segment u smjeni bude dionica autoputa.
   *
   * Na prvom nivou je nula: polaznik koji tek uči pravilo desne strane nema
   * šta da traži na autoputu. Ni na višim nivoima ne ide preko četvrtine —
   * smjena je vježba raskrsnica, autoput je promjena ritma u njoj.
   */
  highwayChance: number;
}

/**
 * Parametri po nivou.
 *
 * `ttcThreshold` NIKAD ne pada ispod 2,5 s. Ispod toga bi se kažnjavalo
 * ponašanje koje je ispravno: vozač koji uđe sa dvije sekunde rezerve nije
 * pogriješio, nego je igra postala nemoguća.
 *
 * `densityMultiplier` i `speedMultiplier` se NE primjenjuju na napisane
 * scenarije. Njihovi prozori nastanka su izmjereni (vidi `tune.test.ts`) i
 * skaliranje bi ih poništilo — scenario bi prestao da uči ono zbog čega je
 * napisan. Ta dva množioca važe samo za generisane segmente u beskonačnom modu.
 */
export const DIFFICULTY: Readonly<Record<Level, DifficultyParams>> = {
  1: {
    densityMultiplier: 1,
    speedMultiplier: 1,
    obstructionTimeout: 4,
    ttcThreshold: 3,
    ruleBreakerChance: 0,
    indicatorGrace: 3,
    highwayChance: 0,
  },
  2: {
    densityMultiplier: 1,
    speedMultiplier: 1,
    obstructionTimeout: 4,
    ttcThreshold: 3,
    ruleBreakerChance: 0,
    indicatorGrace: 2.5,
    highwayChance: 0.15,
  },
  3: {
    densityMultiplier: 1.15,
    speedMultiplier: 1.1,
    obstructionTimeout: 3.5,
    ttcThreshold: 3,
    ruleBreakerChance: 0.25,
    indicatorGrace: 2,
    highwayChance: 0.2,
  },
  4: {
    densityMultiplier: 1.3,
    speedMultiplier: 1.2,
    obstructionTimeout: 3,
    ttcThreshold: 2.75,
    ruleBreakerChance: 0.4,
    indicatorGrace: 1.5,
    highwayChance: 0.2,
  },
  5: {
    densityMultiplier: 1.5,
    speedMultiplier: 1.3,
    obstructionTimeout: 2,
    ttcThreshold: 2.5,
    ruleBreakerChance: 0.5,
    indicatorGrace: 1,
    highwayChance: 0.25,
  },
};

/** Najniži dozvoljeni prag ustupanja [s] — vidi komentar uz `DIFFICULTY`. */
export const TTC_FLOOR = 2.5;

/**
 * Koliko poslije okidanja problematični događaj još „traje".
 *
 * Za to vrijeme se igraču ne broji zadržavanje saobraćaja: on ispravno stoji i
 * čeka da prekršilac prođe, a kazniti ga za to bilo bi upravo ono što se ovom
 * igrom uči da se ne radi.
 */
export const HAZARD_WINDOW = 8;

/** Na kojem dijelu isteklog roka zadržavanja se javlja truba iza leđa. */
export const HORN_AT = 0.5;

/** Usporenje iznad kojeg se kamera blago trese [m/s²]. */
export const SHAKE_DECEL = 3;

/**
 * Širina razdjelnog ostrva između ulazne i izlazne trake kraka kružnog toka [m].
 *
 * Bez njega su ulaz i izlaz istog kraka udaljeni samo širinu trake (3,5 m), pa
 * se vozilo koje ULAZI i vozilo koje IZLAZI na istom kraku fizički preklapaju
 * iako jedno drugom ne prelaze put. Izmjereno: bez ostrva je oko 2% nasumično
 * generisanih segmenata sa kružnim tokom završavalo sudarom koji nije ničija
 * greška. Stvarni kružni tokovi imaju to ostrvo iz istog razloga.
 */
export const RING_SPLITTER = 3;

/** Pola vidnog polja u beskonačnom modu [m] — kamera prati, pa je uže. */
export const SHIFT_VIEW_HALF = 34;

// ── Autoput ─────────────────────────────────────────────────────────────────

/** Koliko traje prelazak iz trake u traku [s]. */
export const LANE_CHANGE_TIME = 2;
/** Koliko prije promjene trake pokazivač mora biti uključen [s]. */
export const INDICATOR_LEAD_TIME = 1;
/** Najmanje odstojanje iza koje se smije uključiti [s]. */
export const MERGE_GAP_TIME = 2;
/**
 * Najmanje odstojanje ispred koje se smije uključiti [s].
 *
 * Isto je kao `HIGHWAY_FOLLOW_TIME` i to nije slučajno: kad bi bilo manje,
 * uključenje bi bilo dozvoljeno na razmaku na kojem se odmah poslije njega ne
 * smije voziti — pa bi vozilo koje je legalno prešlo u traku istog trena
 * moralo naglo da koči.
 */
export const MERGE_AHEAD_TIME = 2;
/** Koliko dugo se smije voziti ispod donje granice [s]. */
export const TOO_SLOW_TIME = 3;
/** Odstojanje ispod kojeg je vožnja preblizu [s]. */
export const TAILGATE_GAP = 2;
/** Koliko dugo se to trpi [s]. */
export const TAILGATE_TIME = 2;
/** Iznad koje brzine se odstojanje uopšte mjeri [m/s] ≈ 60 km/h. */
export const TAILGATE_SPEED = 16.7;
/** Usporenje iznad kojeg je kočenje na autoputu naglo [m/s²]. */
export const HIGHWAY_BRAKE = 3;
/** Brzina ispod koje se smatra da vozilo stoji na traci za ubrzavanje [m/s]. */
export const RAMP_STOP_SPEED = 2;
/** Odstojanje koje NPC drži na autoputu [s]. */
export const HIGHWAY_FOLLOW_TIME = 2;
/**
 * Najveća brzina koju vozilo MOŽE da razvije na autoputu [m/s] ≈ 144 km/h.
 *
 * Gradski `V_TOP` je 18 m/s i to je bila namjera: u gradu se ne vozi brže.
 * Na autoputu bi ista granica značila da je najveća dozvoljena brzina duplo
 * iznad onoga što vozilo uopšte može, pa bi pravilo o prekoračenju bilo mrtvo,
 * a donja granica od 60 km/h bi bila skoro pa najveća moguća.
 */
export const HIGHWAY_V_TOP = 40;
/**
 * Otpor na autoputu.
 *
 * Manji je nego u gradu (`DRAG_COEFF`) iz istog razloga: gradski koeficijent
 * je biran tako da terminalna brzina padne blizu `V_TOP`, pa bi na autoputu
 * zakovao vozilo na šezdesetak km/h bez obzira na `HIGHWAY_V_TOP`.
 */
export const HIGHWAY_DRAG = 0.02;
/** Koliko se dugo smije voziti spoljnom (zaustavnom) trakom [s]. */
export const HARD_SHOULDER_TIME = 1.5;
/**
 * Dužina zone uključenja koja se crta pred krajem trake za ubrzavanje [m].
 *
 * Nije pravilo nego putokaz: uključiti se smije bilo gdje na traci, a ovo je
 * dionica na kojoj je krajnje vrijeme. Devedeset metara je na sto na sat oko
 * tri sekunde — taman za pokazivač (`INDICATOR_LEAD_TIME`) i sam prelazak
 * (`LANE_CHANGE_TIME`), sa nešto rezerve.
 */
export const MERGE_ZONE = 90;
