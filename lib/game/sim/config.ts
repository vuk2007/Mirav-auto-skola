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

import type { VrstaVozila } from "./types";

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

/**
 * Mjere vozila po vrsti [m].
 *
 * Srednji putnički auto je tačno `CAR_LENGTH` × `CAR_WIDTH` — jedino vozilo
 * koje su ispitni scenariji i „Smjena" ikad imali. Vozilo bez vrste je on, pa
 * se tamo ništa ne mijenja ni za centimetar.
 *
 * Ostalo su uobičajene mjere: gradski auto oko 3,8 m, karavan 4,9, kombi 5,4,
 * kamion sa sandukom i gradski autobus po dvanaest metara.
 */
export const VOZILA: Readonly<Record<VrstaVozila, { duzina: number; sirina: number }>> = {
  "auto-mali": { duzina: 3.8, sirina: 1.7 },
  auto: { duzina: CAR_LENGTH, sirina: CAR_WIDTH },
  "auto-veliki": { duzina: 4.9, sirina: 1.85 },
  kombi: { duzina: 5.4, sirina: 2 },
  kamion: { duzina: 12, sirina: 2.5 },
  autobus: { duzina: 12, sirina: 2.55 },
};

/**
 * Najduži komad tijela koji se računa kao jedan pravougaonik [m].
 *
 * Dugo vozilo u krivini nije kruta daska. Kamion od dvanaest metara postavljen
 * kao jedan pravougaonik na tangentu izlazi krajevima iz svoje trake za
 * `L² / 8R` — na poluprečniku od dvanaest metara, najoštrijem koji ruta smije
 * da ima, to je metar i po. Zato se tijelo dijeli na komade koji prate traku.
 * Sve do kombija ostaje jedan komad: njemu je ta greška 0,3 m.
 */
export const DIO_TIJELA = 5.5;

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

// ── Putna mreža Crne Gore ───────────────────────────────────────────────────
//
// Ovdje su, izuzetno, kilometri i km/h: to su jedinice sa saobraćajnog znaka i
// sa karte, a ne jedinice simulacije. Kad dionica grafa uđe u simulaciju,
// pretvaraju se u metre i m/s na jednom mjestu, ne ovdje.

/** Uobičajeno ograničenje po vrsti puta [km/h]; ivica ga smije nadjačati. */
export const SPEED_LIMIT_KMH_BY_ROAD = {
  autoput: 100,
  magistrala: 80,
  regionalni: 60,
  planinski: 50,
  gradski: 50,
} as const;

/** Koliko krivina dobija planinska ivica ako joj broj nije zadat. */
export const MOUNTAIN_CURVES_MIN = 4;
export const MOUNTAIN_CURVES_MAX = 8;
/** Preporučena brzina u planinskoj krivini [km/h] — raspon i korak. */
export const MOUNTAIN_ADVISORY_MIN = 30;
export const MOUNTAIN_ADVISORY_MAX = 40;
export const MOUNTAIN_ADVISORY_STEP = 5;

// ── Otvorena dionica (putovanje) ────────────────────────────────────────────

/**
 * Koliko traje jedna dionica [s].
 *
 * Ivice u grafu su od 8 do 60 km. Na osamdeset na sat je i najkraća od njih
 * šest minuta stvarne vožnje, a najduža skoro tri četvrt sata — to niko ne
 * vozi. Zato se vozi IZVOD dionice, uvijek jednako dug u vremenu: koliko je
 * metara to zapravo, zavisi od ograničenja, a kilometraža koja se prikazuje
 * ide srazmjerno stvarnoj dužini ivice.
 */
export const TRIP_SEGMENT_TIME = 240;

/** Razmak uzoraka polilinije puta [m]. Sitniji korak = glađa krivina. */
export const ROAD_STEP = 4;

/**
 * Bočno ubrzanje po kojem se iz preporučene brzine dobija poluprečnik krivine
 * [m/s²]. Poluprečnik je onda `v² / a` — tabla i geometrija se slažu, umjesto
 * da se poluprečnik pogađa.
 */
export const ROAD_LATERAL_ACCEL = 2.5;

/** Koliko krivina skreće [rad] — od šezdeset do sto dvadeset stepeni. */
export const ROAD_TURN_MIN = Math.PI / 3;
export const ROAD_TURN_MAX = (2 * Math.PI) / 3;

/**
 * Koliko vozilo fizički može na otvorenom putu, u odnosu na ograničenje.
 *
 * Gradski `V_TOP` je 18 m/s i na magistrali bi bio ispod dozvoljene brzine, pa
 * se ograničenje ne bi moglo ni dostići, a kamoli prekoračiti.
 */
export const ROAD_V_TOP_FACTOR = 1.35;

/**
 * Koliko vozilo najviše može na otvorenom putu [m/s].
 *
 * Dvjesta na sat. Ovo NIJE dozvoljena brzina nego ono što auto fizički vuče —
 * dozvoljeno se čita iz dionice na kojoj se vozi (`RoadTemplate.vMaxNa`) i po
 * njemu se sudi prekoračenje.
 */
export const ROAD_V_TOP = 200 / 3.6;

/**
 * Širina trake na otvorenom putu [m].
 *
 * Šira od gradske: kolovoz je dvije trake, dakle preko osam metara. Raskrsnice
 * zadržavaju svoj `LANE_WIDTH` — tamo je uža traka dio zadatka.
 */
export const ROAD_LANE_WIDTH = 4.2;

/** Pola vidnog polja na otvorenom putu [m]. */
export const ROAD_VIEW_HALF = 34;

/**
 * Koliko dionica smije da traje prije nego što se prekine, u odnosu na
 * `TRIP_SEGMENT_TIME`.
 *
 * Opšti `MAX_SCENARIO_SECONDS` je dvije minute i on je zaštita od zaglavljene
 * raskrsnice; na dionici od četiri minuta bi obarao svaku vožnju. Faktor je
 * 2,5 — ko vozi ispod četrdeset odsto ograničenja, taj i ne vozi.
 */
export const TRIP_SEGMENT_TIMEOUT_FACTOR = 2.5;

/**
 * Koliko prije krivine stoji tabla sa preporučenom brzinom [m].
 *
 * Na pedeset na sat je pedeset metara tri i po sekunde — taman da se vidi,
 * pročita i uspori. Tabla na samom početku luka bi stigla prekasno.
 */
export const SIGN_LEAD = 50;

/**
 * Gradska vožnja u mjestu u koje se stiže.
 *
 * Dvije do tri raskrsnice: dovoljno da grad bude vožnja, a ne natpis, a
 * dovoljno kratko da se ne pretvori u smjenu usred putovanja.
 */
export const CITY_JUNCTIONS_MIN = 2;
export const CITY_JUNCTIONS_MAX = 3;

/**
 * Težina gradskih raskrsnica u putovanju.
 *
 * Ne raste sa putovanjem: putovanje nije takmičenje nego obilazak, pa bi
 * napredovanje težine značilo da se isti grad na kraju vozi teže nego na
 * početku, bez ikakvog objašnjenja igraču.
 */
export const CITY_LEVEL: Level = 2;

/** Koliko je znamenitost udaljena od ivice kolovoza [m]. */
export const LANDMARK_OFFSET = 5;
/** Veličina table sa znamenitošću [m]. */
export const LANDMARK_SIZE = 6;

// ── Sabijanje stvarne geometrije ────────────────────────────────────────────
//
// Stvarna Crna Gora je prevelika da se vozi. Budva — Kolašin je sto trideset
// kilometara; na ograničenju je to preko dva sata, a niko toliko ne igra. Zato
// se put SABIJA po dužini: prave se skraćuju mnogo, krivine malo.
//
// Sabijanje je reparametrizacija po dužini, ne umanjenje slike. Pravci
// skretanja se čuvaju TAČNO — zbir svih uglova prije i poslije je isti, pa put
// zadržava svoj oblik i redoslijed krivina. Ono što se mijenja jeste koliko se
// metara pređe između dva skretanja, a s tim i poluprečnik: krivina koja u
// prirodi ima tri stotine metara poluprečnika, sabijena deset puta, ima
// trideset. Zbog toga postoji donja granica ispod koje faktor mora popustiti.

/** Koliko se skraćuje prav put. */
export const SCALE_STRAIGHT = 10;
/**
 * Koliko se skraćuje krivudav put.
 *
 * Zadatak je predlagao 2,5. Izmjereno, sa tom vrijednošću Budva — Kolašin traje
 * 25,3 minuta, a traženo je 15–20: crnogorski putevi su krivudavi skoro cijelom
 * dužinom, pa najmanji faktor odlučuje o svemu. Sa 3,5 ista ruta traje 19,9
 * minuta, a prosječna dionica 3,8 — taman koliko je i dogovoreno da traje.
 */
export const SCALE_CURVY = 3.5;

/**
 * Najmanji poluprečnik koji smije da ostane poslije sabijanja [m].
 *
 * Ovo je granica koja NADJAČAVA faktor: gdje bi sabijanje napravilo krivinu
 * oštriju od ove, faktor se lokalno smanjuje taman toliko da ne napravi.
 *
 * Granica važi samo dokle priroda dopušta. Izmjereno na stvarnoj geometriji:
 * dvadeset od pedeset četiri ivice već ima krivine ispod dvadeset pet metara —
 * Rožaje — Dračenovac ima osam, Njeguši — Kotor trinaest. Tamo se ne ispravlja
 * teren nego se sabijanje jednostavno isključi (faktor 1), pa krivina ostane
 * onakva kakva u prirodi jeste. Pravilo je: sabijanje ne smije napraviti
 * krivinu oštriju nego što je stvarna, niti oštriju od ove granice tamo gdje je
 * stvarna blaža.
 */
export const MIN_CURVE_RADIUS = 25;

/**
 * Iznad ovog poluprečnika je put prav [m].
 *
 * Pet stotina, a ne devet: na devet stotina skoro ništa u Crnoj Gori ne prolazi
 * kao prav put, pa cijela mreža sjedi na sredini prelaza i sabija se slabo.
 */
export const RADIUS_STRAIGHT = 500;
/** Ispod ovog poluprečnika je put krivudav [m]. */
export const RADIUS_CURVY = 150;

/**
 * Preko koliko metara se izglađuje zakrivljenost [m].
 *
 * Polilinija iz OSM-a je uprošćena na pet metara, pa svaka zadržana tačka
 * izgleda kao prelom. Bez izglađivanja bi se na pravom putu očitavale krivine
 * od nekoliko metara poluprečnika i sabijanje bi svuda popustilo.
 */
export const CURVATURE_WINDOW = 40;

/**
 * Poluprečnik → preporučena brzina [m, km/h], od najoštrije krivine naviše.
 *
 * Poluprečnik je onaj POSLIJE sabijanja — tabla mora da govori o krivini koju
 * igrač stvarno vozi, a ne o onoj koja stoji na terenu.
 */
export const ADVISORY_BY_RADIUS = [
  [60, 40],
  [100, 50],
  [180, 60],
] as const;

/** Ispod ovog poluprečnika krivina uopšte dobija tablu [m]. */
export const ADVISORY_MAX_RADIUS = 180;

/** Krivine bliže od ovoga se spajaju u jednu [m]. */
export const CURVE_MERGE_GAP = 30;

/**
 * Najkraći luk koji uopšte dobija tablu [m], mjereno po sabijenom putu.
 *
 * Ispod ovoga nije krivina nego talas u poliliniji: uprošćena linija iz OSM-a
 * ima sitne prelome koje izglađivanje ne pojede sasvim, a tabla pred svakim od
 * njih samo smeta.
 */
export const MIN_CURVE_ARC = 40;

/**
 * Mjera za proširenje kolovoza u krivini [m].
 *
 * Put se u oštroj krivini gradi širi nego na pravcu, jer vozilo kroz nju ne
 * prolazi kao tačka — zadnji točkovi sijeku unutrašnju stranu, a prednji kraj
 * izlazi na spoljašnju. Proširenje je `L² / (2R)`, gdje je `L` dužina vozila.
 *
 * Ovdje nije ukras nego uslov da se dionica može provesti: bez njega su se na
 * serpentini Njeguši — Kotor (poluprečnik trinaest metara) igrač i susretno
 * vozilo sudarali iako su oba bila propisno u svojoj traci — pod velikim uglom
 * im se preklapaju uglovi karoserije. Izmjereno, ne pretpostavljeno.
 */
export const CURVE_WIDENING_LENGTH = 6;
/** Koliko proširenje najviše smije da naraste [m]. */
export const CURVE_WIDENING_MAX = 2;

/**
 * Koliki dio poluprečnika smije da zauzme pola kolovoza sa proširenjem.
 *
 * Proširenje postoji da bi se dva vozila mimoišla u oštroj krivini. Ali kad
 * pola kolovoza priđe poluprečniku, bočni odmak trake se prelomi kroz osu i
 * unutrašnja traka pređe na drugu stranu — tada se vozila sudaraju upravo zbog
 * onoga što ih je trebalo razdvojiti. Trećina poluprečnika je granica na kojoj
 * se to ne dešava.
 */
export const CURVE_WIDENING_RADIUS_SHARE = 0.34;

/**
 * Najoštriji poluprečnik koji polilinija smije da ima prije sabijanja [m].
 *
 * Ovo NIJE ograničenje puta nego ispravka digitalizacije. Linija iz OSM-a je
 * uprošćena na pet metara, pa serpentina koja na terenu ima desetak metara
 * poluprečnika ispadne kao nekoliko oštrih uglova — mjereno, do tri metra. Na
 * takvom uglu se bočni odmak trake prelomi kroz osu puta: unutrašnja traka
 * pređe na drugu stranu i vozila se sudaraju stojeći svako u svojoj.
 *
 * Dvanaest metara je poluprečnik stvarne serpentine, pa zaobljavanje do te
 * mjere ne izmišlja put nego vraća onaj koji je uprošćavanje uglastim učinilo.
 */
export const MIN_GEOMETRY_RADIUS = 12;

// ── Ruta i svijet ───────────────────────────────────────────────────────────

/**
 * Koliko tačaka oko spoja dvije dionice ulazi u zaobljavanje.
 *
 * Na čvoru se put stvarno skreće, pa se dionice spajaju pod uglom koji dolazi
 * iz stvarne geometrije. Taj ugao treba razvući u luk: u prirodi je tu
 * raskrsnica na kojoj se usporava i skreće, a nju modelujemo tek sa gradskim
 * kičmama. Dok je nema, oštar prelom bi značio da se vozilo okrene u mjestu.
 *
 * Mjera je u METRIMA, ne u tačkama. Prva verzija je brojala tačke, pa kad se
 * razmak tačaka prepolovio (`ROUTE_STEP`), prozor se prepolovio s njim i
 * spojevi su postali dvostruko oštriji — na ruti Budva — Kolašin je odmah
 * poslije Cetinja došlo do sudara.
 *
 * Sto šezdeset metara sa svake strane je dovoljno da se i skretanje od
 * devedeset stepeni razvuče u luk od dvadeset pet metara poluprečnika, koliko i
 * jest raskrsnica.
 */
export const ROUTE_JOIN_WINDOW = 220;

/**
 * Koliko svijeta se drži ispred i iza igrača [m].
 *
 * Ispred mora stati sve što se vidi i sve što stiže u susret; iza je dovoljno
 * toliko da vozilo koje je upravo prošlo ne nestane pred ogledalom.
 */
export const LOAD_AHEAD = 2000;
export const KEEP_BEHIND = 500;

// ── Okolina puta ────────────────────────────────────────────────────────────

/**
 * Dokle se okolina crta sa strane puta [m].
 *
 * Mora biti šire od DIJAGONALE kadra, ne od njegove polovine: kadar je kvadrat,
 * pa se u ćošku vidi `viewHalf * √2`. Sa šezdeset metara se ivica pojasa
 * pojavljivala kao ravna kosa linija u uglu slike.
 *
 * Preslikavanje mnogo dalje od puta nema smisla: tamo ne postoji „mjesto duž
 * puta" na koje bi se tačka vezala — najbliža tačka osovine kilometrima daleko
 * ne kaže ništa.
 */
export const OKOLINA_POJAS = 95;

/**
 * Na svakoj koliko tačke osovine se pipa traka okoline kad se provjerava da li
 * je u kadru. Dvadeset metara na ruti — mnogo manje od kadra, pa okvir tih
 * tačaka ne promaši traku koja kroz kadar prolazi.
 */
export const OKOLINA_UZORAK = 10;

/** Stranica ćelije u rešetki nad stvarnom osovinom [m]. */
export const OKOLINA_RESETKA = 100;

/** Stranica tile-a okoline [m] — mora se slagati sa `scripts/osm/pripremi.mjs`. */
export const TILE = 2000;

/**
 * Razmak tačaka na osovini RUTE [m].
 *
 * Sitniji od `ROAD_STEP`, kojim se uzorkuje stvarna geometrija pri sabijanju.
 * Razlog je crtanje: na krivini od dvadeset pet metara poluprečnika korak od
 * četiri metra je devet stepeni po tački, pa se put vidi kao izlomljena linija
 * a kadar se u zavoju sjecka. Na dva metra je upola manje, a tačaka za rutu od
 * trideset kilometara i dalje ispod dvadeset hiljada.
 */
export const ROUTE_STEP = 2;

/**
 * Preko koliko metara se mjeri smjer za okretanje kadra [m].
 *
 * NE po jednom segmentu. Smjer segmenta je stepenasta veličina — mijenja se
 * skokom na svakom tjemenu, a kadar se okreće s njim, pa vozilo u krivini
 * poskakuje. Preko tetive od nekoliko metara ugao se mijenja glatko.
 */
export const KAMERA_TETIVA = 14;

/** Koliko se vrhova najviše ispisuje na horizontu odjednom. */
export const HORIZONT_NAJVISE = 5;
/**
 * Dokle sa strane se vrh još ispisuje [rad].
 *
 * Iza leđa se ne gleda, a ono što je skoro tačno bočno bi stajalo jedno preko
 * drugog uz samu ivicu kadra. Sedamdeset stepeni je otprilike ono što vozač i
 * vidi kroz vjetrobran i bočni prozor.
 */
export const HORIZONT_UGAO = (70 * Math.PI) / 180;
/** Koliko oznaka vrha stoji unutar ivice kadra [px]. */
export const HORIZONT_RUB = 26;
/** Najmanji vodoravni razmak između dva natpisa na horizontu [px]. */
export const HORIZONT_RAZMAK = 120;

/**
 * Najoštriji poluprečnik koji gotova osovina rute smije da ima [m].
 *
 * Ovo je posljednja brana i tiče se traka, ne izgleda: traka je osovina
 * pomjerena bočno za pola kolovoza sa proširenjem — preko tri metra. Kad
 * poluprečnik padne blizu toga, unutrašnja traka se prelomi kroz osu i vozila
 * se sudaraju stojeći svako u svojoj. Izmjereno na ruti Bar — Žabljak: mjesto
 * poluprečnika oko dva metra, koje mjerenje preko šesnaest metara nije ni
 * vidjelo.
 *
 * Dvanaest metara je stvarna serpentina; ispod toga geometrija dolazi od
 * spajanja i uprošćavanja, ne od puta.
 */
export const MIN_ROUTE_RADIUS = 12;

// ── volan (modovi „Putovanje" i „Ruta") ────────────────────────────────────

/**
 * Mrtva zona klizača volana i gasa.
 *
 * Prst na dodirnom ekranu nikad ne stoji tačno na nuli, a klizač koji se vraća
 * u sredinu se zaustavi „skoro" tamo. Bez mrtve zone auto neprekidno klizi u
 * stranu iako ga niko ne okreće.
 */
export const STEER_DEAD_ZONE = 0.08;

/**
 * Koliko brzo se auto pomjera bočno pri punom volanu [m/s].
 *
 * Raste sa brzinom, jer je to i fizika i osjećaj: na deset na sat se volan
 * okreće mnogo a auto se pomjeri malo, na osamdeset je obrnuto. Vrijednosti su
 * iz zadatka; između se interpolira pravolinijski.
 */
export const LAT_SPEED_SLOW = 1;
export const LAT_SPEED_FAST = 3;
export const LAT_SPEED_V_SLOW = 10 / 3.6;
export const LAT_SPEED_V_FAST = 80 / 3.6;

/**
 * Koliko se tastaturom volan pomjera ka krajnjem položaju i nazad [1/s].
 *
 * Taster je uključen ili isključen, pa bi bez ovoga volan skakao na kraj i
 * nazad u jednom kadru. Povratak je brži od okretanja: pušten volan se u autu
 * vraća sam.
 */
export const STEER_KEY_RISE = 3;
export const STEER_KEY_FALL = 6;

/** Koliko se vozilo vizuelno zakrene pri punom volanu [rad]. Čista kozmetika. */
export const STEER_TILT = 0.1;

/**
 * Dio širine trake preko kojeg se drži da bi počeo prelazak u susjednu.
 *
 * Vrijednost iz zadatka. Sam prelazak dolazi u sljedećoj stavci; ovdje stoji
 * zato što ista granica određuje i kad se vozilo računa u OBJE trake.
 */
export const LANE_COMMIT = 0.6;
export const LANE_COMMIT_TIME = 0.5;

/**
 * Bankina: koliko auto može van kolovoza prije nego što ga zaustavi granica [m].
 *
 * Isto ono što se i crta kao bankina pored puta. Nema slijetanja u provaliju —
 * auto stane na ivici i to je kraj poprečnog kretanja u tu stranu.
 */
export const SHOULDER_WIDTH = 1.6;

/**
 * Koliko prostora vozilu mora ostati sa svake strane, ma šta geometrija rekla [m].
 *
 * Postoji zbog izmjerenog nedostatka u proširenju krivine: ispod poluprečnika
 * od oko 17 m kapa iz `CURVE_WIDENING_RADIUS_SHARE` pogodi ivicu kolovoza prije
 * nego osu trake, pa osa bude gurnuta VIŠE od ivice. Na ruti Herceg Novi —
 * Rožaje je tako ostalo 0,67 m od ose do ivice, a pola auta je 0,9 m — vozilo
 * uredno u svojoj traci je time „izlazilo s puta".
 *
 * Dok se proširenje ne popravi, granica se ne računa ispod pola auta: pravilo
 * ne smije da kažnjava ono što je naša geometrija zgriješila.
 */
export const OFF_ROAD_MARGIN = 0.25;

/** Poslije koliko sekundi van kolovoza prekršaj obara vožnju [s]. */
export const OFF_ROAD_FAIL_TIME = 2;
/** Iznad koje brzine izlazak sa kolovoza odmah obara vožnju [m/s]. */
export const OFF_ROAD_FAIL_SPEED = 30 / 3.6;

// ── izbor pravca volanom ───────────────────────────────────────────────────

/**
 * Koliko prije tačke odluke se volanom bira pravac [m].
 *
 * Prije toga se pravac ne mijenja: vozač koji se u krivini nagne udesno ne
 * najavljuje time desno skretanje na raskrsnici koja je tek pred njim.
 */
export const DECISION_LEAD = 45;

/**
 * Koliko dugo volan mora da se drži da bi se pravac izabrao [s].
 *
 * Bez zadržavanja bi svaki trzaj u traci mijenjao izabranu putanju, a sa njom i
 * ono što NPC-ovi o nama pretpostavljaju.
 */
export const DECISION_HOLD = 0.4;

/** Koliko volan mora biti okrenut da bi se to računalo kao izbor. */
export const DECISION_STEER = 0.5;

// ── automatski pokazivači (modovi „Putovanje" i „Ruta") ────────────────────

/**
 * Koliko dugo automatski pokazivač ostaje upaljen kad vozilo stane uz razdjelnu
 * liniju, a ne pređe je [s].
 *
 * Pokazivač se pali kad volan pokaže da vozilo ide ka liniji. Ako tamo stane i
 * nastavi uz nju, to više nije prelazak nego vožnja uz liniju — a pokazivač koji
 * bi ostao upaljen obmanjivao bi ostale isto kao žmigavac ostavljen poslije
 * skretanja. Dvije sekunde su tri treptaja: dovoljno da se vidi namjera vozača
 * koji čeka priliku, a malo da bi se zaboravio.
 */
export const AUTO_INDICATOR_HOLD = 2;

// ── preticanje i puna linija ────────────────────────────────────────────────

/**
 * Ispod kojeg poluprečnika krivina nosi punu liniju [m].
 *
 * Mjeri se STVARNI poluprečnik, isti onaj po kojem se bira i tabla sa
 * preporučenom brzinom — dva pravila o istoj krivini ne smiju da govore
 * različito. Sabijanje krivinu čini oštrijom, pa zabrana na ekranu uvijek pada
 * u nešto što i izgleda kao oštra krivina.
 */
export const NO_OVERTAKE_RADIUS = 250;

/** Koliko se puna linija produžava prije i poslije krivine [m]. */
export const NO_OVERTAKE_CURVE_LEAD = 100;

/** Koliko prije raskrsnice počinje puna linija [m]. */
export const NO_OVERTAKE_BEFORE_JUNCTION = 50;

/**
 * Do koje dozvoljene brzine se dionica smatra naseljem [m/s].
 *
 * Naselje se u simulaciji ne označava zastavicom nego ograničenjem: gradska
 * dionica nosi pedeset na sat i to je jedini podatak koji o naselju postoji.
 */
export const SETTLEMENT_V = 50 / 3.6;

/**
 * Koliko vremena do susretnog vozila mora ostati da bi preticanje bilo
 * bezbjedno [s]. Računa se po ZBIRNOJ brzini — prilazi se jedno drugom.
 */
export const ONCOMING_TTC = 6;

/**
 * Najduže zadržavanje u kontra traci [s].
 *
 * Naš broj, ne ZOBS-ov: zakon ne daje rok nego traži da se vozač vrati čim to
 * može bez ometanja. Petnaest sekundi je izmjereno, a ne pogođeno. Na pravom
 * praznom putu je odvožen najbolji mogući manevar — pun gas do ograničenja,
 * volan, povratak čim se napravi propisan razmak — i on traje: kamion na
 * sedamdeset posto ograničenja 8,6 s sa osamdeset i 11,3 s na planinskom putu,
 * a kamion na osamdeset posto čak 14,0 s. Sa ranijih osam sekundi je svako
 * pošteno preticanje kamiona završavalo prekršajem, pa se pravilo nije moglo
 * poštovati ni savršenom vožnjom.
 */
export const MAX_OVERTAKE_TIME = 15;

/** Najmanji razmak pri vraćanju ispred preteknutog vozila [s]. */
export const CUT_IN_TIME = 1;

/**
 * Koliko poslije vraćanja u traku se još gleda da li je preteknuti zakočio [s].
 *
 * Bez prozora bi se moralo pogoditi baš onaj korak u kojem NPC zakoči, a on
 * reaguje tek kad mu se razmak stvarno smanji.
 */
export const CUT_IN_WINDOW = 2;

/**
 * Koliko točak smije preko razdjelne linije prije nego što se to zove
 * prelaskom [m].
 *
 * Bez tolerancije bi i držanje uz samu liniju bilo prekršaj: traka je 4,2 m, a
 * auto 1,8 m, pa je do linije svega 1,2 m.
 */
export const LINE_CROSS_TOL = 0.3;

/**
 * Koliko oko sebe se traži vozilo koje pretičemo [m].
 *
 * Ne mjeri se samo ono ispred: dok smo u kontra traci, preteknuti nam je pod
 * bokom, pa bi „ispred" propustilo baš onaj trenutak zbog kojeg pravilo i
 * postoji.
 */
export const PRETEKNUT_POJAS = 60;

// ── vozač rute (bot kojim se mjeri, ne dio igre) ───────────────────

/**
 * Koliko naprijed vozač gleda ograničenje brzine [m].
 *
 * Ograničenje na ruti pada u jednoj tački, a brzina se gubi na putu. Bez
 * pogleda unaprijed vozač u naselje ulazi punom brzinom i dobija prekršaj koji
 * nije mogao izbjeći.
 */
export const VOZAC_POGLED = 200;

/**
 * Najmanja razlika brzine zbog koje se uopšte kreće u preticanje [m/s].
 *
 * Ispod nje preticanje ne stane u `MAX_OVERTAKE_TIME`: za pedeset metara
 * razlike pri pet kilometara na čas treba pola minuta u suprotnoj traci.
 */
export const PRETICANJE_RAZLIKA = 15 / 3.6;

/**
 * Koliko se najduže PLANIRA boravak u suprotnoj traci [s].
 *
 * Manje od `MAX_OVERTAKE_TIME`, jer je to rok poslije kojeg se prekršaj
 * prijavljuje — plan koji ga tačno dodiruje pada na prvu nepreciznost.
 */
export const PRETICANJE_BUDZET = 12;

/**
 * Razmak koji se ostavlja preteknutom pri vraćanju [s].
 *
 * Veći od `CUT_IN_TIME`, jer se tamo mjeri sam prekršaj, a ovdje se ostavlja i
 * zaliha za nepreciznost plana. Ne mora biti mnogo veći: onaj ko se vraća brži
 * je od preteknutog, pa preteknuti po `roadFollowLimit` nema šta da usporava.
 * Svaka deseninka ovdje košta metre puta u suprotnoj traci.
 */
export const PRETICANJE_POVRATAK = 1.3;

/**
 * Usporenje sa kojim se, poslije preticanja, stiže vozilo ispred [m/s²].
 *
 * Iz suprotne trake se izlazi brže od kolone u koju se vraća: mjesta mora biti
 * toliko da se iza vozila ispred uspori ovim usporenjem, a ne punom kočnicom.
 */
export const PRETICANJE_KOCENJE = 3;

/** Zaliha puta koja se dodaje na sve što se pri preticanju mora preći [m]. */
export const PRETICANJE_ZALIHA = 6;

/**
 * Koliko vremena do susretnog vozila mora ostati kad se preticanje ZAVRŠI [s].
 *
 * Nije `ONCOMING_TTC`: taj prag se mjeri u svakom koraku, pa mora ostati i
 * poslije cijelog manevra, a ne samo na njegovom početku.
 */
export const PRETICANJE_SUSRETNI = ONCOMING_TTC + 2;

/**
 * Za koliko se vozač zaleti pred preticanje, iznad brzine preticanog [m/s], i
 * na koliko mu se pri tome primakne [m].
 *
 * Zalet nije stil vožnje nego uslov: bez njega se u suprotnu traku ulazi bez
 * razlike u brzini, pa se prvi dio roka troši na ubrzavanje. Prilaz je iz istog
 * razloga: svaki metar zaostatka se u suprotnoj traci plaća. Dvadeset metara je
 * na šezdeset na sat oko sekunde — bliže od toga se ne prilazi ni radi ročnika.
 */
export const PRETICANJE_ZALET = 3;
export const PRETICANJE_PRILAZ = 20;

// ── gustina i vrste saobraćaja (modovi „Putovanje" i „Ruta") ───────────────

/**
 * Nivo saobraćaja kad ga igrač nije izabrao.
 *
 * Drugi: gušće nego što je putovanje do sada imalo, a i dalje daleko od kolone
 * kroz koju se ne može proći.
 */
export const SAOBRACAJ_NIVO: Level = 2;

/**
 * Koliko vozila ima u prozoru oko igrača, po nivou — oba smjera zajedno.
 *
 * Nivoi 1, 3 i 5 su iz zadatka. Nivoi 2 i 4 su sredina između susjeda, jer ih
 * zadatak ne navodi.
 */
export const SAOBRACAJ_U_PROZORU: Readonly<Record<Level, readonly [number, number]>> = {
  1: [6, 8],
  2: [10, 13],
  3: [14, 18],
  4: [19, 24],
  5: [24, 30],
};

/**
 * Dužina prozora u kojem se vozila broje [m].
 *
 * Počinje `KEEP_BEHIND` iza igrača i ide dva kilometra naprijed — cijeli leži u
 * dijelu svijeta koji se drži, pa ga brisanje vozila iza leđa ne krnji.
 */
export const SAOBRACAJ_PROZOR = 2000;

/**
 * Prosječan broj vozila u koloni, po nivou.
 *
 * Saobraćaj ne dolazi kao metronom nego u kolonama: ko sustigne sporije vozilo,
 * vozi iza njega. Zato i na gustom putu između kolona ostaje praznina u kojoj se
 * može preticati. Isti broj vozila ravnomjerno razbacan na svakih sto pedeset
 * metara ne bi ostavio nijednu — a zadatak traži da se kamion može i preteći.
 */
export const KOLONA_PO_NIVOU: Readonly<Record<Level, number>> = { 1: 1.2, 2: 1.5, 3: 2, 4: 2.5, 5: 3 };

/** Odstojanje između vozila u koloni, u sekundama vožnje [najmanje, najviše]. */
export const KOLONA_ODSTOJANJE: readonly [number, number] = [2, 3];

/** Najmanja i najveća praznina između dvije kolone [m]. */
export const PRAZNINA_MIN = 80;
export const PRAZNINA_MAX = 1600;

/**
 * Koje vrste vozila voze kojim putem, u procentima.
 *
 * Kamiona ima najviše na magistrali, a kroz grad skoro nijedan.
 */
export const MJESAVINA: Readonly<
  Record<"put" | "planinski" | "grad", readonly (readonly [VrstaVozila, number])[]>
> = {
  put: [
    ["auto-mali", 22],
    ["auto", 34],
    ["auto-veliki", 16],
    ["kombi", 14],
    ["kamion", 14],
  ],
  planinski: [
    ["auto-mali", 26],
    ["auto", 36],
    ["auto-veliki", 14],
    ["kombi", 14],
    ["kamion", 10],
  ],
  grad: [
    ["auto-mali", 30],
    ["auto", 33],
    ["auto-veliki", 13],
    ["kombi", 14],
    ["kamion", 2],
    ["autobus", 8],
  ],
};

/**
 * Koliki dio dozvoljene brzine vozi koja vrsta [najmanje, najviše].
 *
 * Putnički auti voze blizu ograničenja, kombi nešto sporije, a kamion osjetno
 * sporije — to su vozila koja se sustižu i pretiču.
 */
export const BRZINA_VRSTE: Readonly<Record<VrstaVozila, readonly [number, number]>> = {
  "auto-mali": [0.85, 1],
  auto: [0.88, 1],
  "auto-veliki": [0.88, 1],
  kombi: [0.8, 0.95],
  kamion: [0.7, 0.82],
  autobus: [0.8, 0.92],
};

/**
 * Brzina kamiona na planinskom putu [m/s] — od 30 do 40 km/h.
 *
 * Iz zadatka: taj kamion se mora preteći ili pratiti. Ne zavisi od ograničenja,
 * jer ga ne drži propis nego uspon i krivine.
 */
export const KAMION_PLANINA: readonly [number, number] = [30 / 3.6, 40 / 3.6];

/**
 * Koliko ispred igrača se na planinskom putu pojavi kamion [m].
 *
 * Van kadra, ali blizu: na razlici od petnaestak km/h igrač ga sustigne za pola
 * minuta. Dalje od toga bi se zaboravilo da je uopšte stigao. Isto toliko igrač
 * mora da zađe na planinsku dionicu prije nego što se prvi pojavi.
 */
export const KAMION_ISPRED = 150;
/** Na koliko metara planinskog puta dolazi po jedan zagarantovan kamion [m]. */
export const KAMION_RAZMAK = 3000;
/** Planinska dionica kraća od ovoga nema zagarantovan kamion [m]. */
export const KAMION_NAJKRACA = 800;

/**
 * Usporenje kojim vozilo toka prelazi na niže ograničenje [m/s²].
 *
 * Blago, kao kad vozač vidi tablu: u naselje se ne smije uletjeti brzinom sa
 * magistrale, ali se ni ne koči kao pred preprekom.
 */
export const USPORENJE_OGRANICENJE = 1.5;

/**
 * Dokle vozilo van kadra na otvorenom putu dobija oznaku na ivici [m].
 *
 * Do tamo je bitno za preticanje: šest sekundi (`ONCOMING_TTC`) pri zbirnoj
 * brzini dvije osamdesetice je dvjesta šezdeset metara. Oznaku dobija samo
 * najbliže vozilo u svakoj traci, ispred i iza — na gustom putu bi ih inače na
 * ivici kadra bilo dvadeset, jedna preko druge.
 */
export const OZNAKA_DOMET_PUT = 300;

/**
 * Koliko najbliže ispred igrača se u našu traku ubacuje vozilo kad ih u prozoru
 * fali [m]: van kadra i van dometa oznake na ivici (`OZNAKA_DOMET_PUT`), da se ne
 * vidi kako nastaje.
 */
export const UBACI_ISPRED = 350;

/**
 * Koliko vozila u našem smjeru smije da fali, odnosno da bude viška, prije nego
 * što se broj popravi.
 *
 * Bez ovog pojasa bi se na samoj granici naizmjenično dodavalo i sklanjalo po
 * jedno vozilo. Isti višak važi i za susretni tok: preko njega izvor preskoči
 * vozilo — u sporom dijelu puta se susretna vozila zbiju.
 */
export const SAOBRACAJ_MANJAK = 1;
export const SAOBRACAJ_VISAK = 2;

/** Najmanje vremena između dvije popravke broja vozila u našem smjeru [s]. */
export const SAOBRACAJ_POPRAVKA = 1;

// ── grad na ruti: parkirani auti i autobus ─────────────────────────────────

/**
 * Koliko od ulaza u grad i izlaza iz njega nema ni stanice ni parkiranih auta [m].
 *
 * Tu je raskrsnica kojom se u grad ulazi; parkiranje uz nju je zabranjeno, a
 * stanica tik uz nju bi zaustavljala kolonu nasred raskrsnice.
 */
export const GRAD_OD_KRAJA = 60;

/** Razmak autobuskih stanica u jednom smjeru [m]. */
export const STANICA_RAZMAK = 400;

/**
 * Koliko prije i poslije stanice nema parkiranih auta, gledano u smjeru vožnje
 * autobusa [m]. Autobus mora prići ivičnjaku, a dvanaest metara autobusa plus
 * prilaz je tridesetak metara.
 */
export const STANICA_BEZ_PARKINGA_PRIJE = 30;
export const STANICA_BEZ_PARKINGA_POSLIJE = 15;

/**
 * Ispod kojeg poluprečnika krivine nema ni parkiranja ni stanice [m].
 *
 * U oštroj krivini se ne parkira: auto koje tu stoji ne vidi niko ko dolazi.
 */
export const PARKING_MIN_POLUPRECNIK = 80;

/** Koliko je parkirano vozilo odmaknuto od ivične linije, van kolovoza [m]. */
export const PARKING_ODMAK = 0.2;
/** Razmak između parkiranih auta u nizu [m, najmanje–najviše]. */
export const PARKING_RAZMAK: readonly [number, number] = [1, 2.5];
/** Koliko auta stoji u jednom nizu [najmanje–najviše]. */
export const PARKING_NIZ: readonly [number, number] = [3, 8];
/** Praznina između dva niza — ulaz u dvorište, prelaz, hidrant [m]. */
export const PARKING_PRAZNINA: readonly [number, number] = [15, 40];

/** Koliko autobus stoji na stanici [s]. */
export const BUS_STOJI = 10;
/** Sa koje daljine autobus uopšte računa sa stanicom ispred sebe [m]. */
export const BUS_POGLED = 150;
/**
 * Najjače kočenje kojim autobus staje na stanici [m/s²].
 *
 * Ako bi do stanice morao kočiti jače — nastao je preblizu nje — tu stanicu
 * preskače. Autobus koji naglo koči pred stanicom nije ono što se ovdje uči.
 */
export const BUS_USPORENJE_MAX = 2.5;
/** Koliko prije stanice autobus pali desni pokazivač [m]. */
export const BUS_POKAZIVAC_PRIJE = 60;
/** Koliko prije polaska sa stanice pali lijevi pokazivač [s]. */
export const BUS_POKAZIVAC_POLAZAK = 2;

/**
 * Do koje praznine ispred igrača vozilo koje stoji znači da igrač ne zadržava
 * saobraćaj nego čeka [m], od branika do branika.
 */
export const STOJI_ISPRED = 25;

// ── raskrsnice sa sporednim putem (modovi „Putovanje" i „Ruta") ────────────

/**
 * Najmanji razmak dvije raskrsnice na istoj strani sabijenog puta [m].
 *
 * Sabijanje skraćuje put nekoliko puta, a raskrsnice ostaju gdje jesu: dva
 * seoska puta na trista metara stvarnog puta bi na sabijenom stajala na
 * sedamdesetak. Bliže od ovoga se spajaju i ostaje krupniji put.
 */
export const PRIKLJUCAK_RAZMAK = 150;

/**
 * Koliko od kraja dionice raskrsnice nema [m].
 *
 * Kraj dionice je ulaz u mjesto — sam po sebi raskrsnica, sa punom linijom
 * pred njom. Sporedni put tik uz njega bi bio ista raskrsnica drugi put.
 */
export const PRIKLJUCAK_OD_KRAJA = 100;

/**
 * Pred kojim sporednim putevima je razdjelna linija puna.
 *
 * Zadatak traži punu liniju `NO_OVERTAKE_BEFORE_JUNCTION` metara pred
 * raskrsnicom. Primjenjuje se na raskrsnice sa regionalnim ili većim putem;
 * seoski i stambeni put na magistrali je bez pune linije, kako je najčešće i
 * obilježeno na terenu. Odluka od 29. septembra 2026.
 */
export const PRIKLJUCAK_PUNA_LINIJA: readonly string[] = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
];

/**
 * Vjerovatnoća da na raskrsnici jedno vozilo skrene u sporedni put, po nivou.
 *
 * Po RASKRSNICI, ne po vozilu, i isto koliko i uključivanje: saobraćaj između
 * dva mjesta se održava, koliko izađe toliko i uđe. Izmjereno sa vjerovatnoćom
 * po vozilu: na Herceg Novom — Rožajama je skrenulo 237 vozila a uključilo se
 * 47, i gustina na nivou 3 je pala ispod donje granice.
 *
 * Skreće se samo udesno — sa naše trake u put na desnoj strani, sa susretne u
 * put na lijevoj. Skretanje ulijevo presijeca drugu traku, a to na otvorenom
 * putu u ovoj igri nije ono što se uči.
 */
export const PRIKLJUCAK_IZLAZ: Readonly<Record<Level, number>> = {
  1: 0.15,
  2: 0.25,
  3: 0.35,
  4: 0.45,
  5: 0.55,
};

/**
 * Vjerovatnoća da na raskrsnici čeka vozilo koje se uključuje, po nivou.
 *
 * Isto kao i izlaz, samo udesno: iz puta na desnoj strani u našu traku, iz
 * puta na lijevoj u susretnu.
 */
export const PRIKLJUCAK_ULAZ: Readonly<Record<Level, number>> = {
  1: 0.15,
  2: 0.25,
  3: 0.35,
  4: 0.45,
  5: 0.55,
};

/** Brzina kojom se skreće u sporedni put [m/s]. */
export const PRIKLJUCAK_BRZINA = 20 / 3.6;

/**
 * Usporenje pred skretanjem [m/s²].
 *
 * Blago, jer se skretanje najavljuje: pokazivač i usporavanje, ne naglo
 * kočenje — ono po zakonu nije dozvoljeno bez opasnosti.
 */
export const PRIKLJUCAK_USPORENJE = 1.8;

/** Koliko prije raskrsnice vozilo koje skreće pali pokazivač [m]. */
export const PRIKLJUCAK_POKAZIVAC = 80;

/**
 * Koliko vremena do raskrsnice mora imati svako vozilo koje joj prilazi, da bi
 * se vozilo sa sporednog puta uključilo ispred njega [s].
 *
 * Vozilo na sporednom putu nema prednost i kreće iz mjesta: kad se uključi,
 * onaj koji dolazi mora da ga sustiže, a ne da koči. Osam sekundi je na
 * osamdeset na sat oko sto osamdeset metara.
 */
export const PRIKLJUCAK_PRAZNINA = 8;

/**
 * Na kojoj udaljenosti ispred igrača se pojavi vozilo koje čeka na sporednom
 * putu [m] — u kadru, da se vidi kako čeka.
 */
export const PRIKLJUCAK_POJAVA = 300;

/** Dužina sporednog puta koja se crta uz raskrsnicu [m]. */
export const PRIKLJUCAK_KRAK = 45;

/** Širina sporednog puta koja se crta, po vrsti [m]. */
export const PRIKLJUCAK_SIRINA: Readonly<Record<string, number>> = {
  motorway: 7,
  trunk: 7,
  primary: 7,
  secondary: 6.5,
  tertiary: 6,
  unclassified: 5,
  residential: 5,
};

// ── preglednost: zaklon kamiona i autobusa (modovi „Putovanje" i „Ruta") ───

/**
 * Koja vozila zaklanjaju pogled na suprotnu traku.
 *
 * Visoka: kamion i autobus. Preko putničkog auta i kombija se vidi — vozač
 * sjedi dovoljno visoko, a oni su dovoljno niski — pa njih pravilo ne dira.
 */
export const ZAKLANJA_POGLED: readonly VrstaVozila[] = ["kamion", "autobus"];

/**
 * Dokle ispred igrača se traži vozilo koje zaklanja [m]. Dalje od toga je
 * sjena preuska da bi išta zaklonila od onoga što se na putu tiče igrača.
 */
export const PREGLEDNOST_DOMET = 300;

/**
 * Koliko sekundi susretnog saobraćaja mora da se vidi prije ulaska u suprotnu
 * traku — računato zbirom brzina, sa susretnim na ograničenju.
 *
 * Isti prag po kojem se sudi nebezbjedno preticanje (`ONCOMING_TTC`): ako se
 * suprotna traka vidi toliko daleko, onda vozilo koje se nije vidjelo nije
 * moglo biti bliže od toga praga. Tako se nijedan pad ne može dogoditi zbog
 * onoga što igrač nije imao kako da vidi.
 */
export const PREGLEDNOST_VRIJEME = ONCOMING_TTC;

/**
 * Koliko dugo, neprekidno, suprotna traka mora da se vidi prije nego što tijelo
 * vozila pređe liniju [s].
 *
 * Vrijeme da se pogleda. Bez njega bi pravilo bilo mrtvo: dok volan prevlači
 * auto ka liniji, vozač u jednom trenutku izađe iza kamiona i sve vidi — ali
 * tada je već krenuo. Vidi se ili iz dovoljnog odstojanja, ili pomjeranjem na
 * lijevu ivicu svoje trake i kratkim zadržavanjem tu.
 */
export const PREGLEDNOST_REAKCIJA = 1;

/**
 * Koliko je vozačevo oko lijevo od sredine vozila [m] — vozač sjedi lijevo.
 */
export const OKO_LIJEVO = 0.35;

// ── haptika klizača (modovi „Putovanje" i „Ruta") ──────────────────────────

/**
 * Trajanje vibracije kad prst uhvati klizač [ms].
 *
 * Kratko — dodir, ne zujanje: potvrda da je klizač uhvaćen, jer se na ekranu
 * pod prstom ne vidi.
 */
export const HAPTIKA_DODIR = 12;

/**
 * Trajanje vibracije kad gas pređe u kočnicu ili obratno [ms].
 *
 * Sredina klizača se prstom ne osjeti, a baš tu se mijenja šta klizač radi.
 */
export const HAPTIKA_PRELAZ = 6;

// ── kamera (modovi „Putovanje" i „Ruta") ───────────────────────────────────

/**
 * Za koliko se, najviše, igrač spusti niz ekran kad vozi brzo — dio visine
 * kadra.
 *
 * Zadatak: „kamera prati smjer, sa malim pomakom unaprijed proporcionalnim
 * brzini". Na mjestu igrač stoji na 62 % visine; na `KAMERA_NAPRIJED_BRZINA`
 * je dvanaest posto niže, pa se ispred vidi toliko više puta.
 */
export const KAMERA_NAPRIJED = 0.12;

/** Brzina na kojoj je pomak kamere unaprijed najveći [m/s]. */
export const KAMERA_NAPRIJED_BRZINA = 100 / 3.6;

// ── mjerilo crtanja (`/igra/bench`) ─────────────────────────────────────────

/**
 * Ruta po kojoj se mjeri crtanje: od mora preko Cetinja i Podgorice do
 * planine — obala, dva grada, planinski zavoji, najviše okoline na jednoj ruti
 * srednje dužine. Uvijek ista, da se brojevi iz dva mjerenja mogu porediti.
 */
export const BENCH_OD = "budva";
export const BENCH_DO = "kolasin";
/** Najgušći saobraćaj — najviše vozila za nacrtati. */
export const BENCH_NIVO = 5;
/** Na koliko sekundi vožnje se uzima tačka mjerenja [s]. */
export const BENCH_TACKE_S = 120;
/** Koliko se kadrova mjeri na svakoj tački — tri sekunde na 60 fps. */
export const BENCH_KADROVA = 180;
/**
 * Veličina platna [CSS px] — kvadrat širok kao ekran telefona. Stalna, da
 * mjerenje na računaru i na telefonu crta isti broj piksela.
 */
export const BENCH_PLATNO = 360;

// ── WebGL (PixiJS) na otvorenom putu ───────────────────────────────────────

/**
 * Dužina komada statičnog svijeta [m]: okolina, bankina, kolovoz i linije se
 * grade jednom po komadu, a kamera ih samo pomjera. Kraći komad znači manje
 * posla kad jedan tek uđe u kadar; duži, manje komada za provjeriti.
 */
export const PIXI_KOMAD = 200;
/** Koliko sagrađenih komada se najviše drži; najdavnije viđeni se ruše. */
export const PIXI_KOMADA_NAJVISE = 48;
/** Stranica ćelije mreže u koju se svrstavaju linije okoline [m]. */
export const PIXI_CELIJA = 250;

// ── grad u razmjeri 1:1 (faza 6, `lib/game/grad/`) ─────────────────────────

/**
 * Najveća brzina i otpor u gradu — isti kao na otvorenom putu: bulevarima se
 * vozi i 60–80 km/h, a ispitni `V_TOP` sa gradskim otporom zakiva auto na
 * šezdesetak. Isti auto mora da se vozi isto na ruti i u gradu.
 */
export const GRAD_V_TOP = ROAD_V_TOP;
export const GRAD_DRAG = HIGHWAY_DRAG;

/**
 * Širina jedne saobraćajne trake u gradu [m] — IGRAČKA mjera, ne stvarna.
 *
 * Stvarna gradska traka je oko 3,25 m, i tako je bilo u prvoj verziji grada:
 * na ekranu telefona to izgleda kao da auto (koji je stvarne veličine, 4,4 ×
 * 1,8 m) jedva staje u ulicu. Igre odozgo (GTA 1/2) zato šire kolovoz, a auto
 * ostavljaju kakav jeste; ovdje je traka šira za trećinu. Zgrade ostaju na
 * stvarnim mjestima — grad je i dalje Podgorica 1:1, samo su ulice malo šire.
 */
export const GRAD_SIRINA_TRAKE = 4.25;

/**
 * Bulevar su u OSM-u dvije jednosmjerne polovine na stvarnom razmaku. Sa
 * igračkom trakom (`GRAD_SIRINA_TRAKE`) mogu se preklopiti: tada krajnja traka
 * jednog smjera leži preko trake suprotnog, i vozila koja se mimoilaze stanu
 * nos uz nos. Takvim polovinama se traka suzi tačno toliko da kolovozi stanu
 * jedan uz drugi (`GRAD_PREKLOP_RAZMAK` između), ali nikad ispod stvarne
 * gradske trake. Izmjereno u Podgorici: 62 para, od toga 9 se preklapa i sa
 * stvarnom trakom (greška podataka — ostaju za provjeru mape).
 */
export const GRAD_SIRINA_TRAKE_NAJMANJE = 3.25;

/** Razmak između dvije polovine bulevara poslije suženja [m]. */
export const GRAD_PREKLOP_RAZMAK = 0.2;

/**
 * Krajevi ivice [m] koji se ne gledaju pri traženju preklopa: tu se polovine
 * bulevara prirodno primiču da bi ušle u istu raskrsnicu.
 */
export const GRAD_PREKLOP_KRAJ = 25;

/** Korak uzorkovanja duž ivice pri traženju preklopa [m]. */
export const GRAD_PREKLOP_KORAK = 5;

/**
 * Broj traka kad ga OSM nema — po klasi ulice, za cijeli kolovoz dvosmjerne
 * ulice. Jednosmjerna polovina bulevara (`oneway`) dobija isti broj, jer je u
 * Podgorici glavna ulica po pravilu dvije trake u jednom smjeru.
 *
 * Ovo NIJE podatak o ulici nego samo mjera za crtanje i kretanje: pravila o
 * trakama (stavka 5) ne sude po pretpostavljenom broju.
 */
export const GRAD_TRAKE_PO_KLASI: Readonly<Record<string, number>> = {
  motorway: 4,
  trunk: 4,
  primary: 2,
  secondary: 2,
  tertiary: 2,
  motorway_link: 1,
  trunk_link: 1,
  primary_link: 1,
  secondary_link: 1,
  tertiary_link: 1,
  unclassified: 2,
  residential: 2,
  living_street: 2,
  road: 2,
  service: 1,
  track: 1,
  pedestrian: 2,
  cycleway: 1,
  busway: 1,
};

/**
 * Najuža ulica [m] — servisni prolaz sa jednom trakom je i dalje dovoljno
 * širok za jedan auto.
 */
export const GRAD_NAJUZA_ULICA = 4.5;

/**
 * Dvosmjerna ulica sa bar ovoliko traka u svakom smjeru dobija dvostruku punu
 * razdjelnu liniju kad je overlay ne mijenja (provjera mape, odluka korisnika
 * 2026-10-22): pravilnik za kolovoz sa četiri i više traka. Sudi se kao svaka
 * puna linija, a prekida se na raskrsnicama.
 */
export const GRAD_DVOSTRUKA_OD_TRAKA = 2;

/**
 * Na kojoj udaljenosti od raskrsnice volan bira izlaz [m]. Pedeset metara na
 * pedeset na sat su tri i po sekunde — dovoljno da se izbor vidi i promijeni.
 */
export const GRAD_ODLUKA = 50;

/**
 * Koliko prije raskrsnice se izbor zaključava [m]. Poslije toga volan više ne
 * mijenja pravac, samo položaj u traci — da auto ne skrene tamo gdje ga je
 * trzaj volana u posljednjem trenutku poslao.
 */
export const GRAD_ZAKLJUCAJ = 6;

/**
 * Ugao skretanja koji traži pun volan [°]. Volan na pola traži skretanje pod
 * pola toga, pa se na raskrsnici sa pet krakova može izabrati i koso.
 */
export const GRAD_PUN_VOLAN_UGAO = 100;

/**
 * Koliko luk kroz raskrsnicu počinje prije čvora i završava poslije njega [m] —
 * najviše; na kratkoj ivici manje (vidi `GRAD_ZAOBLJENJE_UDIO`).
 */
export const GRAD_ZAOBLJENJE = 7;
/** Najveći dio ivice koji luk kroz raskrsnicu smije da pojede, sa svake strane. */
export const GRAD_ZAOBLJENJE_UDIO = 0.45;
/** Na koliko tačaka se luk kroz raskrsnicu crta i prelazi. */
export const GRAD_LUK_TACAKA = 16;
/**
 * Pola vidnog polja u gradu [m] — skoro kao na otvorenom putu (34 m). Sa 48 m
 * auto je na ekranu telefona bio sitan, pa se činilo da ulice nisu u
 * razmjeri sa njim. Raskrsnica ispred se i dalje vidi na vrijeme: kamera je
 * pomaknuta naprijed (`KAMERA_NAPRIJED`).
 */
export const GRAD_POLA_KADRA = 36;
/** Koliko sagrađenih tile-ova grada se najviše drži; najdavnije viđeni se ruše. */
export const GRAD_KOMADA_NAJVISE = 36;
/**
 * Stepeni udaljavanja kadra u slobodnoj vožnji kroz grad — množe
 * `GRAD_POLA_KADRA`. Na najdaljem se vidi oko 790 m: dovoljno da se pregleda
 * kvart, a da tile-ova u kadru ne bude više nego što ih se drži.
 */
export const GRAD_ZUM = [1, 2, 4, 8, 11] as const;

// ── slobodna vožnja u gradu (faza 6, stavka 3c) ────────────────────────────

/**
 * Međuosovinsko rastojanje [m] — srednji putnički auto. Njime se računa koliko
 * se auto okrene za pređeni metar pri datom uglu točkova (model bicikla).
 */
export const GRAD_MEDJUOSOVINSKO = 2.7;
/**
 * Najveći ugao prednjih točkova [°]. Sa `GRAD_MEDJUOSOVINSKO` daje poluprečnik
 * okretanja zadnje osovine oko 3,9 m — kao u pravom autu.
 */
export const GRAD_VOLAN_UGAO = 35;
/**
 * Najveće bočno ubrzanje [m/s²] koje volan dopušta. Na brzini se ugao točkova
 * zato sužava: na 30 km/h ulica se može skrenuti, na 60 ne može — mora se
 * usporiti prije skretanja, kao u stvarnosti.
 */
export const GRAD_BOCNO_UBRZANJE = 7;
/**
 * Koliko brzo se točkovi okreću [°/s] — volan se ne prebaci u jednom kadru.
 * Brzo, jer tastatura i klizač već imaju svoje kašnjenje (`STEER_KEY_RISE`);
 * dva kašnjenja jedno na drugom tjeraju auto preko skretanja.
 */
export const GRAD_VOLAN_BRZINA = 240;
/** Najveća brzina unazad [m/s]. */
export const GRAD_RIKVERC_V = 15 / 3.6;
/** Ubrzanje unazad pri punoj pedali [m/s²]. */
export const GRAD_RIKVERC_A = 1.5;
/**
 * Koliko dugo se kočnica drži u mjestu [s] dok se ne ubaci rikverc. Kratko
 * kočenje do zaustavljanja zato nikad ne pokrene auto unazad.
 */
export const GRAD_RIKVERC_CEKANJE = 0.3;
/** Koliko pritisnuta pedala se računa kao namjera (rikverc, pa naprijed). */
export const GRAD_RIKVERC_PEDALA = 0.3;
/**
 * Zaobljen ugao raskrsnice [m]: ivičnjak je u uglu između dvije susjedne
 * ulice zasječen koso, ovoliko od tjemena duž obje ulice. Bez toga je ugao
 * trotoara oštar, a desno skretanje ga zakači i kad je vozač uradio sve kako
 * treba.
 */
export const GRAD_UGAO_ZASJEK = 3;
/**
 * Ugao između susjednih ulica [°] u kojem se ugao zasijeca. Van njega nema
 * ugla: ulica koja samo nastavlja (skoro 180°), ili dvije ulice pod tako oštrim
 * uglom da bi tjeme bilo daleko od raskrsnice.
 */
export const GRAD_UGAO_ZASJEK_OD = 25;
export const GRAD_UGAO_ZASJEK_DO = 155;
/**
 * Najveći ugao između auta i ivičnjaka [°] pod kojim auto klizi uz ivičnjak,
 * umjesto da stane. Kao u igrama odozgo: okrznuti trotoar ne smije da ubije
 * vožnju; čeoni udar je ipak udar.
 */
export const GRAD_IVICNJAK_UGAO = 50;
/** Usporenje dok auto struže uz ivičnjak [m/s²]. */
export const GRAD_IVICNJAK_USPORENJE = 4;
/** Koliko brzo ivičnjak poravnava auto sa ulicom [°/s]. */
export const GRAD_IVICNJAK_OKRET = 90;
/** Ćelija indeksa površine po kojoj se vozi [m]. */
export const GRAD_POVRSINA_CELIJA = 40;
/** Najdalje od ulice [m] na kojem se još kaže u kojoj je ulici auto. */
export const GRAD_ULICA_DO = 25;

// ── GTA izgled grada (faza 6, stavka 4) ─────────────────────────────────────

/** Trotoar sa svake strane kolovoza [m] — crta se i od njega se odmiču zgrade. */
export const GRAD_TROTOAR = 1.6;
/**
 * Najviše koliko se ugao zgrade odmiče od ulice [m]. Ulice su šire nego u
 * stvarnosti (`GRAD_SIRINA_TRAKE`), pa bi zgrada na stvarnom mjestu stajala na
 * asfaltu; njen ugao se zato pomjera do ivice trotoara. Dublje od ovoga u
 * servisnom putu nije greška širenja nego prolaz kroz zgradu (OSM
 * `building_passage`) — ostaje. Kod ostalih ulica se odmiče do kraja: kuća
 * duboko u stambenoj ulici je netačna OSM linija uske ulice po obodu grada.
 */
export const GRAD_ODMAK_NAJVISE = 3.5;
/** Visina sprata [m]. */
export const GRAD_SPRAT = 3;
/** Krov i parapet iznad posljednjeg sprata [m]. */
export const GRAD_KROV = 0.6;
/**
 * Broj spratova kad ga OSM nema, po vrsti zgrade (`building=*`) — iz zadatka,
 * odjeljak 1, i dopunjeno za vrste kojih u Podgorici ima. Vrsta `yes` (90 %
 * zgrada) nije ovdje: njoj se sprat procjenjuje po površini osnove.
 */
export const GRAD_SPRATOVI_PO_VRSTI: Readonly<Record<string, number>> = {
  residential: 3,
  apartments: 6,
  dormitory: 4,
  hotel: 5,
  commercial: 2,
  retail: 1,
  supermarket: 1,
  kiosk: 1,
  office: 5,
  government: 4,
  public: 3,
  industrial: 1,
  warehouse: 1,
  manufacture: 1,
  service: 1,
  school: 2,
  kindergarten: 1,
  college: 3,
  university: 4,
  hospital: 4,
  clinic: 3,
  church: 2,
  chapel: 1,
  mosque: 2,
  temple: 2,
  house: 2,
  detached: 2,
  terrace: 2,
  shed: 1,
  garage: 1,
  garages: 1,
  carport: 1,
  roof: 1,
  greenhouse: 1,
  hut: 1,
  stable: 1,
  guardhouse: 1,
  construction: 1,
  ruins: 1,
  sport: 2,
  sports_hall: 3,
  stadium: 3,
  grandstand: 2,
  parking: 3,
  train_station: 2,
  clock_tower: 6,
  transformer_tower: 2,
};
/**
 * Spratnost zgrade vrste `yes` po površini osnove [m², spratova]: prvi prag
 * koji je površina ne prelazi. Mala osnova je kuća ili garaža, srednja stambena
 * zgrada, a ogromna je hala ili tržni centar — oni su niski.
 */
export const GRAD_SPRATOVI_PO_POVRSINI: readonly (readonly [number, number])[] = [
  [40, 1],
  [200, 2],
  [700, 4],
  [2000, 6],
  [Infinity, 2],
];
/**
 * Lažni 2.5D (GTA 1/2): krov se pomjera od sredine ekrana za
 * `visina × GRAD_2_5D / pola kadra`. Zgrada visoka koliko je pola kadra, na
 * ivici kadra, nagne se za trećinu te udaljenosti.
 */
export const GRAD_2_5D = 0.35;
/** Najveći nagib (dio udaljenosti od sredine) — da neboder ne pređe preko ekrana. */
export const GRAD_2_5D_NAJVISE = 0.6;
/** Pravac u kojem padaju sjenke (jedinični, `y` na jug): sunce sa jugozapada. */
export const GRAD_SJENKA_PRAVAC = { x: 0.8, y: -0.6 } as const;
/** Dužina sjenke po metru visine [m]. */
export const GRAD_SJENKA_DUZINA = 0.45;
/** Koliko je sjenka tamna (0 nevidljiva, 1 crna). */
export const GRAD_SJENKA_ALFA = 0.22;
/** Jedan detalj na krovu (klima, dimnjak, rezervoar) na ovoliko m² krova. */
export const GRAD_DETALJ_POVRSINA = 80;
/** Najviše detalja na jednom krovu. */
export const GRAD_DETALJA_NAJVISE = 6;
/** Razmak prozora duž zida [m]. */
export const GRAD_PROZOR_RAZMAK = 2.6;
/**
 * Visina sprata na ekranu [px] ispod koje prozori nestaju; na dvostrukoj su
 * puni. Iz daleka bi mreža prozora bila samo treperenje.
 */
export const GRAD_PROZOR_PIKSELA = 5;

// ── oznake na kolovozu (faza 6, stavka 4b) ─────────────────────────────────

/**
 * Širina linije na kolovozu [m]. Stvarna je 0,10–0,15 m; ovdje je na gornjoj
 * granici, jer su i trake šire nego u stvarnosti (`GRAD_SIRINA_TRAKE`).
 */
export const GRAD_LINIJA_SIRINA = 0.15;
/** Isprekidana linija u gradu: crtica i razmak [m]. */
export const GRAD_CRTICA = 3;
export const GRAD_CRTICA_RAZMAK = 5;
/**
 * Linije staju ovoliko prije raskrsnice, preko pola najšire poprečne ulice [m]
 * — u samoj raskrsnici nema linija.
 */
export const GRAD_LINIJE_OD_RASKRSNICE = 1;
/** Zebra: dubina (duž ulice), širina pruge i razmak [m]. */
export const GRAD_ZEBRA_DUBINA = 3;
export const GRAD_ZEBRA_PRUGA = 0.5;
/** Najdalje od osovine ulice [m] na kojem se čvor prelaza još vezuje za tu ulicu. */
export const GRAD_ZEBRA_DO_ULICE = 3;
/**
 * Vrste prelaza (`crossing=*`) koje su obilježene zebrom. `unmarked`, `no`,
 * `informal` nisu, a prelaz bez vrste (`yes` ili ništa) se ne crta — ne zna se
 * da li ga ima na asfaltu, a nacrtan prelaz je i pravilo (stavka 5).
 */
export const GRAD_ZEBRA_VRSTE: readonly string[] = ["uncontrolled", "zebra", "marked", "traffic_signals"];
/** Strelice na traci: koliko prije linija raskrsnice počinju, i dužina strelice [m]. */
export const GRAD_STRELICA_OD_KRAJA = 6;
export const GRAD_STRELICA_DUZINA = 5;
/** Razmak strelice na kolovozu od zebre i od linije čekanja [m] (provjera mape). */
export const GRAD_STRELICA_RAZMAK = 1;

// ── dekor grada (faza 6, stavka 4c) ─────────────────────────────────────────

/** Razmak stabala u drvoredu (OSM `natural=tree_row`) [m]. */
export const GRAD_DRVORED_RAZMAK = 8;
/**
 * Koliko m² površine pripada jednom stablu, po vrsti površine. Šuma je rjeđa
 * nego što bi bila u stvarnosti: brdo Gorica bi inače bilo stotine hiljada
 * temena, a iz vazduha ionako izgleda kao zelena masa.
 */
export const GRAD_STABLO_PO_POVRSINI: Readonly<Record<string, number>> = {
  park: 140,
  suma: 110,
  groblje: 220,
  igraliste: 400,
  trava: 900,
};
/** Najviše stabala po tile-u — gornja granica za brzinu crtanja. */
export const GRAD_STABALA_NAJVISE = 1800;
/** Krošnja: poluprečnik [m] od–do, i visina [m] od–do. */
export const GRAD_KROSNJA_R = [1.8, 3.4] as const;
export const GRAD_KROSNJA_H = [5, 10] as const;
/** Ulična rasvjeta: razmak stubova [m], visina stuba [m]. */
export const GRAD_RASVJETA_RAZMAK = 32;
export const GRAD_RASVJETA_VISINA = 8;
/** Klase ulica koje imaju uličnu rasvjetu (dekor; noću svijetli, stavka 4d). */
export const GRAD_RASVJETA_KLASE: readonly string[] = [
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
];
/** Kontejneri uz stambene ulice: jedan na ovoliko metara ulice, po sjemenu [m]. */
export const GRAD_KONTEJNER_RAZMAK = 140;
/** Klupa u parku: jedna na ovoliko m² parka. */
export const GRAD_KLUPA_PO_POVRSINI = 900;
/** Parking: dubina mjesta, širina mjesta i prolaz između redova [m]. */
export const GRAD_PARKING_DUBINA = 5;
export const GRAD_PARKING_SIRINA = 2.6;
export const GRAD_PARKING_PROLAZ = 6;
/** Koliki dio parking mjesta je zauzet (po sjemenu). */
export const GRAD_PARKING_ZAUZETO = 0.6;
/** Visina parkiranog auta [m] — i krov auta se naginje u 2.5D. */
export const GRAD_AUTO_VISINA = 1.45;

// ── doba dana i vrijeme (faza 6, stavka 4d) ────────────────────────────────

/**
 * Po kiši kočnica daje ovoliki dio `B_MAX` — zaustavni put je duži (zadatak,
 * odjeljak 1). Igraču se to kaže na ekranu dok pada kiša.
 */
export const GRAD_KISA_KOCENJE = 0.8;
/** Koliki dio prozora svijetli uveče i noću (po sjemenu zgrade, sprata i prozora). */
export const GRAD_PROZORI_UPALJENI = { dan: 0, sumrak: 0.18, noc: 0.42 } as const;
/** Poluprečnik svjetla ulične lampe na tlu [m]. */
export const GRAD_LAMPA_SVJETLO = 9;
/** Dužina snopa farova [m] i ugao (pola otvora) [°]. */
export const GRAD_FAROVI_DUZINA = 26;
export const GRAD_FAROVI_UGAO = 22;
/** Broj kapi kiše na ekranu i njihova brzina [px/s]. */
export const GRAD_KISA_KAPI = 140;
export const GRAD_KISA_BRZINA = 900;

// ── raskrsnice u gradu: kontrola i semafori (faza 6, stavka 5) ────────────

/**
 * Raskrsnica dva bulevara je u OSM-u nekoliko čvorova (svaka kolovozna traka
 * je svoj put). Čvorovi raskrsnica spojeni voznom ivicom ne dužom od ovoga [m]
 * su jedna raskrsnica — jedan semaforski plan, jedna prednost.
 */
export const GRAD_KLASTER_IVICA = 30;
/** Najveći razmak dva čvora iste raskrsnice [m] — da se niz bliskih raskrsnica duž ulice ne spoji u jednu. */
export const GRAD_KLASTER_PRECNIK = 45;
/** Znak ili semafor na kraku važi za raskrsnicu ako je od nje ovoliko ili bliže [m]. */
export const GRAD_ZNAK_DO = 60;
/**
 * Klase glavnih i sporednih ulica za izvedeni prioritet (zadatak, odjeljak 5):
 * sporedna koja se bez znaka spaja na glavnu ustupa, uz `inferredPriority`.
 */
export const GRAD_KLASE_GLAVNE: readonly string[] = [
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
];
export const GRAD_KLASE_SPOREDNE: readonly string[] = ["residential", "living_street", "service", "unclassified", "track"];
/**
 * Izvedeni semaforski plan (OSM zna da semafor postoji, ali ne i faze):
 * zeleno za glavnu i za ostale ose [s], žuto [s], sve crveno između faza [s].
 */
export const GRAD_SEMAFOR_ZELENO_GLAVNO = 24;
export const GRAD_SEMAFOR_ZELENO = 16;
export const GRAD_SEMAFOR_ZUTO = 3;
export const GRAD_SEMAFOR_SVE_CRVENO = 2;
/** Krakovi čije se ose razlikuju manje od ovoga [°] dobijaju zeleno zajedno. */
export const GRAD_SEMAFOR_ISTA_OSA = 35;
/**
 * Klase krakova koji na semaforisanoj raskrsnici bez svog svjetla ustupaju
 * (prilaz iz dvorišta, parking). Ostali krakovi bez svjetla dobijaju
 * izvedeni semafor; priključna traka (`*_link`, slobodno desno) ustupa uvijek.
 */
export const GRAD_SEMAFOR_BEZ_SVJETLA_USTUPA: readonly string[] = ["service", "track"];
/** Stop-linija stoji ovoliko ispred zebre na istom kraku [m]. */
export const GRAD_STOP_ISPRED_ZEBRE = 1;
/**
 * Semafor na kraku, dalje od ivice raskrsnice od ovoga [m] a uz sam prelaz
 * (`GRAD_PJESACKI_SEMAFOR_PRELAZ`), je pješački semafor na sredini ulice — OSM
 * ga označava isto kao semafor raskrsnice. On ne upravlja raskrsnicom; dolazi
 * sa pješacima (stavka 8).
 */
export const GRAD_PJESACKI_SEMAFOR_OD = 15;
export const GRAD_PJESACKI_SEMAFOR_PRELAZ = 6;
/**
 * Semafor uz prelaz, dalje od `GRAD_PJESACKI_SEMAFOR_OD`, ipak je semafor
 * raskrsnice kad je do ovoliko [m] od nje, a semafor ima i drugi njen krak
 * (ili čvor): OSM ga tako ucrta iza zebre kad je krak kratak (stavka 8).
 */
export const GRAD_SEMAFOR_KRAKA_DO = 30;

// ── crtanje pravila (faza 6, stavka 5c) ────────────────────────────────────

/** Debljina stop-linije duž ulice [m]. */
export const GRAD_LINIJA_STOP = 0.5;
/** Crtica linije „ustupi prvenstvo" poprijeko ulice [m] (razmak iste dužine). */
export const GRAD_LINIJA_USTUPI_CRTICA = 0.6;
/** Visina znaka na stubu [m] — po njoj se znak naginje u 2.5D. */
export const GRAD_ZNAK_VISINA = 2.4;
/** Širina znaka u svijetu [m], i najmanje [px] koliko se crta da ostane čitljiv. */
export const GRAD_ZNAK_VELICINA = 1.2;
export const GRAD_ZNAK_NAJMANJE_PX = 22;
/** Visina semafora [m] i njegova glava u svijetu [m]. */
export const GRAD_SEMAFOR_VISINA = 3.5;
export const GRAD_SEMAFOR_VELICINA = 1.4;
/** Znakovi bliži od ovoga [m] dijele jedan stub. */
export const GRAD_ZNAK_ISTI_STUB = 1.5;

// ── sudija u gradu (faza 6, stavka 5d) ─────────────────────────────────────

/**
 * Tolerancija brzine po nivou [km/h] (zadatak, odjeljak 5: nivo 1 +10, nivo 5
 * +3; između ravnomjerno).
 */
export const GRAD_TOLERANCIJA_BRZINE: Readonly<Record<Level, number>> = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 3 };
/** Ograničenje u naselju kad ga OSM i zona nemaju [km/h] (ZOBS; `cityZones` → `podrazumijevano`). */
export const GRAD_BRZINA_PODRAZUMIJEVANA = 50;
/** Nivo slobodne vožnje po gradu dok ga igrač ne promijeni. */
export const GRAD_NIVO: Level = 3;
/** Koliko dugo mora trajati prekoračenje da bi se prijavilo [s] — ne trzaj pedale. */
export const GRAD_BRZINA_TRAJE = 1;
/** Pogrešan smjer u jednosmjernoj: koliko dugo i od koje brzine [s, m/s]. */
export const GRAD_SUPROTNO_TRAJE = 1;
export const GRAD_SUPROTNO_BRZINA = 1;
/** Lijeva strana dvosmjerne ulice: koliko dugo je dozvoljeno (odluka korisnika) [s]. */
export const GRAD_LIJEVO_TRAJE = 3;
/** Zaustavljanje na zebri, u raskrsnici, na stajalištu: koliko dugo je dozvoljeno (odluka korisnika) [s]. */
export const GRAD_STAJANJE_TRAJE = 2;
/** Dužina autobuskog stajališta duž ulice [m]; stajalište je na strani na kojoj je OSM tačka. */
export const GRAD_STAJALISTE_DUZINA = 20;
/** Najdalje od osovine ulice [m] na kojem se auto još vezuje za tu ulicu. */
export const GRAD_SUDIJA_DO_ULICE = 12;
/** Usporenje kojim vozač-bot u gradu staje [m/s²] — udobno, ispod `B_MAX`. */
export const GRAD_VOZAC_USPORENJE = 2.5;
/**
 * Izlazak iz raskrsnice na krak se potvrđuje tek kad je auto cijeli van nje i
 * još ovoliko dalje [m] — polukružno smije kratko zaći u susjedni krak.
 */
export const GRAD_IZLAZ_POTVRDA = 6;
/**
 * Promjena pravca kroz raskrsnicu veća od ovoga [°] je skretanje (traži
 * žmigavac); manja je vožnja pravo.
 */
export const GRAD_SKRETANJE_UGAO = 30;
/**
 * Promjena pravca kroz raskrsnicu veća od ovoga [°] je polukružno okretanje
 * — i kad auto izađe na drugi krak (okret preko razdjelnog pojasa bulevara).
 */
export const GRAD_POLUKRUZNO_UGAO = 150;
/**
 * Traka u prstenu dvotračnog kružnog toka se gleda na sredini ivice prstena,
 * na ovoliko metara od nje [m] — najdalje od priključaka.
 */
export const GRAD_PRSTEN_SREDINA = 1;
/**
 * Auto čija je sredina bliže liniji između traka prstena od ovoga [m] se ne
 * broji ni u jednu traku.
 */
export const GRAD_PRSTEN_RUB = 0.3;
/**
 * Traka u prstenu se ne broji od ovoliko metara [m] prije ulaska u raskrsnicu
 * izlaza: auto iz unutrašnje trake tu već prelazi ka izlazu.
 */
export const GRAD_PRSTEN_IZLAZ = 2;
/**
 * Ivica prstena kraća od ovoga [m] se ne uzorkuje: sredina joj je tik uz oba
 * priključka (u raskrsnici), gdje auto već mijenja traku ka izlazu ili od
 * ulaza — nema mjesta „najdalje od priključaka".
 */
export const GRAD_PRSTEN_NAJKRACA = 8;

// ── savršeni bot u gradu (faza 6, stavka 5f) ───────────────────────────────

/** Koliko ispod ograničenja bot vozi (dio ograničenja). */
export const GRAD_BOT_REZERVA_BRZINE = 0.1;
/** Bočno ubrzanje u krivini koje bot sebi dozvoljava [m/s²] — udobno, ispod granice gume. */
export const GRAD_BOT_BOCNO = 2.5;
/** Koliko prije raskrsnice bot pali žmigavac [m] (faza 5: `INDICATOR_LEAD` = 20). */
export const GRAD_BOT_ZMIGAVAC_PRIJE = 30;
/**
 * Ruta bota se ne vraća u raskrsnicu iz koje je izašla prije manje od ovoliko
 * metara puta [m]: kratka petlja oko bloka je polukružno okretanje.
 */
export const GRAD_BOT_PETLJA = 80;
/**
 * Najviše koliko [m] od čvora bot napušta traku za luk kroz raskrsnicu, ma
 * koliko dug bio odsječak raskrsnice na tom kraku.
 */
export const GRAD_BOT_ODSJEK_NAJVISE = 15;
/**
 * Rezerva [m] oko mjesta gdje sudija vidi ulazak u raskrsnicu i izlazak iz
 * nje: bot ne vozi tačno po putanji, pa žmigavac pali i gasi pedalj ranije
 * odnosno kasnije.
 */
export const GRAD_BOT_ZMIGAVAC_REZERVA = 1.5;
/**
 * Čvorovi raskrsnica bliži od ovoga [m] su uvijek jedna raskrsnica — smaknut
 * priključak dvije sporedne ulice; odvojene bi se preklapale.
 */
export const GRAD_KLASTER_BLIZU = 12;
/**
 * Poluprečnici luka kojim bot skreće u raskrsnici [m], redom kojim se probaju:
 * prvi koji je sa rezervom na asfaltu. Svi su veći od najmanjeg koji auto može
 * (3,9 m), da ga pogled naprijed prati bez punog volana; širi luk koristi
 * širinu raskrsnice kad uska ulica ulazi u široku.
 */
export const GRAD_BOT_POLUPRECNICI: readonly number[] = [5.5, 8, 11, 4.5];
/**
 * Rezerva oko auta [m] sa kojom bot provjerava da je luk kroz raskrsnicu na
 * asfaltu: vozač malo odstupa od putanje, a zadnji kraj u krivini ide užim
 * lukom od sredine auta (oko pola metra na luku od 5,5 m).
 */
export const GRAD_BOT_REZERVA_LUKA = 0.8;
/** Koliko bot ide unazad kad zakači ivičnjak i stane [m], i najveća brzina unazad [m/s]. */
export const GRAD_BOT_IZVLACENJE = 2;
export const GRAD_BOT_IZVLACENJE_BRZINA = 0.8;
/**
 * Koliko daleko niz ulicu [m] sudija traži stop-liniju ispred auta — i kroz
 * čvorove koji nisu raskrsnice (krak je u OSM-u često kratka ivica).
 */
export const GRAD_PRILAZ_DO = 150;
/** Najkraća nasumična ruta bota u gradu [m] — kraća ne prođe dovoljno raskrsnica. */
export const GRAD_FUZZ_NAJKRACA = 400;
/** Na komadu ulice kraćem od ovoga [m] bot ne mijenja traku. */
export const GRAD_BOT_NAJKRACA_PROMJENA = 20;
/**
 * Razdjelna linija dvosmjerne ulice se u čvoru koji nije raskrsnica pomjerila
 * (podjela traka po smjerovima se promijenila, npr. 1+2 pa 2+1): srednja traka
 * je do čvora bila suprotnog smjera. Kroz čvor se zato ostaje u svojoj traci,
 * a u novu se prelazi tek ovoliko [m] iza njega. Tako se dva vozila mimoilaze
 * u čvoru svako u svojoj spoljnoj traci, i tek onda svako na svojoj strani
 * prelazi ka sredini — udaljavajući se od drugog. Prije toga su oba klizila ka
 * sredini u samom čvoru i stajala nos uz nos.
 */
export const GRAD_BOT_RAZDJELNICA_ODMAK = 5;
/**
 * Odgođen prelazak (vidi gore) traži bar ovoliko [m] između odmaka i početka
 * pune linije (ili kraja ivice); kad toga nema, prelazi se lukom kroz čvor.
 */
export const GRAD_BOT_RAZDJELNICA_NAJKRACA = 6;
/**
 * Uz čvor u kojem se razdjelnica pomjerila vozilo se drži svoje strane OBJE
 * razdjelnice (i one prije i one poslije čvora), uz ovoliki razmak [m] od
 * boka — inače se traka užeg dijela ulice preklapa sa suprotnom trakom šireg
 * (1+1 pa 1+2: razdjelnica skoči za pola trake) i susretna vozila stanu nos
 * uz nos.
 */
export const GRAD_BOT_RAZDJELNICA_RAZMAK = 0.3;
/** Do ovoliko [m] od takvog čvora granica važi cijela (vidi gore). */
export const GRAD_BOT_RAZDJELNICA_BLIZU = 6;
/**
 * Dalje od toga granica popušta postepeno, do sredine lijeve svoje trake: 1 m
 * bočno na ovoliko [m] puta — blago suženje, ne trzaj. Najkasnije 2 m prije
 * pune linije između traka (editor), da se ne pređe.
 */
export const GRAD_BOT_RAZDJELNICA_NAGIB = 6;
/** Koliko prije raskrsnice [m] bot već vozi u traci za manevar, i kroz čvorove bez raskrsnice. */
export const GRAD_BOT_TRAKA_UNAPRIJED = 150;
/**
 * Najveći prečnik raskrsnice [m] kad se spajaju čvorovi čije se raskrsnice
 * preklapaju — veći od `GRAD_KLASTER_PRECNIK`: tu razdvajanje nije moguće.
 */
export const GRAD_KLASTER_PRECNIK_PREKLOP = 80;

// ── Editor i overlay grada (faza 6, stavka 6) ─────────────────────────────
/**
 * Sidro izmjene u overlay-u je tačka (i OSM id puta), ne indeks u paketu:
 * indeksi se mijenjaju sa svakim novim paketom iz OSM-a, tačke ne. Izmjena se
 * veže za čvor bliži od ovoga [m]…
 */
export const GRAD_SIDRO_CVOR = 4;
/** …i za ulicu čija je osovina bliža od ovoga [m]. Dalje: izmjena je „nevezana" i editor je pokazuje. */
export const GRAD_SIDRO_ULICE = 6;
/** Zebra koju overlay uklanja: postojeći prelaz na ulici bliži od ovoga sidru [m]. */
export const GRAD_SIDRO_PRELAZ = 4;
/** Vrsta OSM prelaza kojom overlay dodaje obilježeni pješački prelaz (jedna od `GRAD_ZEBRA_VRSTE`). */
export const GRAD_OVERLAY_ZEBRA = "zebra";
/** Najviše metara pune linije pred raskrsnicom koje overlay može zadati (stane u bajt paketa). */
export const GRAD_PUNA_PRIJE_NAJVISE = 250;
/**
 * Autobuskom trakom najviše ovoliko [s] (odluka korisnika 2026-10-01, kao
 * vožnja lijevom stranom): prelazak i ulazak radi skretanja desno nisu prekršaj.
 */
export const GRAD_BUS_TRAJE = 3;
/** Bot izlazi iz autobuske trake (na početku dionice sa njom) na ovoliko metara [m]. */
export const GRAD_BOT_IZ_BUSA = 12;
/** Kad je autobuska traka jedina za skretanje, bot u nju prelazi tek ovoliko pred raskrsnicom [m]. */
export const GRAD_BOT_U_BUS = 12;
/**
 * Puna linija pred raskrsnicom počinje najranije ovoliko iza čvora gdje se
 * mijenja raspored traka (proširenje za traku skretanja ili autobusku) [m]:
 * tamo se trake tek uspostavljaju.
 */
export const GRAD_PUNA_POSLIJE_PROMJENE = 15;
/** Lom osovine ulice veći od ovoga [°] je greška u OSM geometriji za punu liniju (editor upozorava). */
export const GRAD_OSTAR_LOM = 40;
/** Editor grada: klik pogađa čvor/raskrsnicu bliže od ovoga [m]… */
export const GRAD_EDITOR_POGODAK = 6;
/** …a krak raskrsnice kad je na njegovoj ivici, do ovoliko od raskrsnice [m]. */
export const GRAD_EDITOR_KRAK_DO = 30;

// ── Drugi učesnici u gradu (faza 6, stavka 7) ───────────────────────────────
/** Najviše vozila oko igrača pri punoj gustini (zadatak, odjeljak 1: 40 vozila u vidnom polju). */
export const GRAD_NPC_NAJVISE = 40;
/** Vozila se pojavljuju u prstenu oko igrača, van onoga što se vidi [m]… */
export const GRAD_NPC_POJAVA_OD = 150;
export const GRAD_NPC_POJAVA_DO = 350;
/** …nestaju kad se udalje dalje od ovoga… */
export const GRAD_NPC_NESTAJE = 450;
/** …a cilj im je van prozora, ovoliko od mjesta pojave [m]. */
export const GRAD_NPC_CILJ_OD = 250;
export const GRAD_NPC_CILJ_DO = 500;
/** Na početku vožnje vozila se pojavljuju i bliže, ali ne bliže igraču od ovoga [m]. */
export const GRAD_NPC_POCETAK_OD = 30;
/** Pojava novog vozila najčešće jednom u ovoliko [s] — plan rute košta par milisekundi. */
export const GRAD_NPC_POJAVA_RITAM = 0.2;
/** Mjesto pojave je slobodno kad nijedno vozilo nije bliže od ovoga [m]. */
export const GRAD_NPC_POJAVA_SLOBODNO = 25;
/** Ubrzanje drugih vozača [m/s²] — mirnije od `A_MAX`. */
export const GRAD_NPC_UBRZANJE = 2;
/** Razmak do vozila ispred kad stoje [m], i vrijeme reakcije za razmak u vožnji [s] (Krauss). */
export const GRAD_NPC_RAZMAK = 2.5;
export const GRAD_NPC_REAKCIJA = 1;
/** Bočna rezerva oko auta kad se gleda šta mu je na putu [m]. */
export const GRAD_NPC_BOCNO = 0.3;
/** Koliko najmanje vozač gleda naprijed svojom putanjom [m] (više pri većoj brzini). */
export const GRAD_NPC_POGLED = 25;
/** Raskrsnicu ispred vozač razmatra (kome ustupa) od ovoliko metara prije nje. */
export const GRAD_NPC_HORIZONT = 60;
/**
 * Putanje kroz raskrsnicu su u sukobu kad su im osovine bliže od ovoga [m]:
 * širina auta i rezerva za tijela pod uglom (lijevo skretanje pored susretne
 * trake). Susjedne trake su na `GRAD_SIRINA_TRAKE` — nisu u sukobu.
 */
export const GRAD_NPC_SUKOB_RAZMAK = CAR_WIDTH + 1.4;
/** Rezerva vremena kad se ulazi ispred vozila koje ima prednost [s]. */
export const GRAD_NPC_REZERVA_PROLAZA = 1.5;
/**
 * Ne ustupa se vozilu koje (preko lanca vozilo ispred / ustupanje / zatvoren
 * izlaz) čeka mene — najviše ovoliko karika se prati.
 */
export const GRAD_NPC_LANAC_CEKANJA = 8;
/**
 * …i to se pamti ovoliko [s]: dva vozila čiji lanac ide kroz onog drugog bi
 * se inače klackala (jedan korak ustupa, drugi ne) i stajala oba.
 */
export const GRAD_NPC_LANAC_PAMTI = 1;
/**
 * Isto za savršenog bota među vozilima (stavka 7d) [s]. Bot ne smije nikoga
 * natjerati na naglo kočenje (`GRAD_PRVENSTVO_KOCENJE` — sudija to sudi kao
 * oduzeto prvenstvo), pa je oprezniji od drugih vozača: kod uključivanja ispred
 * bržeg vozila ono mora i usporiti na njegovu brzinu, ne samo ne udariti.
 */
export const GRAD_BOT_REZERVA_PROLAZA = 3;
/** Vozač „čeka na liniji" kad stoji (ispod ove brzine [m/s]) bliže od ovoga mjestu čekanja [m]. */
export const GRAD_NPC_CEKA_BRZINA = 0.5;
export const GRAD_NPC_CEKA_DO = 3;
/**
 * Zastoj (zadatak, odjeljak 5): vozilo stoji duže od ovoga [s], a ne čeka ni
 * crveno ni nekoga ko vozi — zapisuje se, i najstarije u zastoju kreće.
 */
export const GRAD_NPC_ZASTOJ = 10;
/** Koliko dugo vozilo koje razrješava zastoj ne ustupa [s]; ako ni tada ne krene, najmlađe nestaje. */
export const GRAD_NPC_ZASTOJ_KRECE = 5;
/**
 * Bot provlači sudiju duž svoje putanje (gdje sudija vidi ulaz i izlaz iz
 * raskrsnice) svakih 0,5 m do ovoliko od raskrsnice [m], a dalje svakih
 * `GRAD_BOT_SUDIJA_RIJETKO` — plan je tako dvaput jeftiniji (drugi vozači ga
 * prave u hodu).
 */
export const GRAD_BOT_SUDIJA_GUSTO = 60;
export const GRAD_BOT_SUDIJA_RIJETKO = 3;
/**
 * Auto čiji je nos do ovoliko pred mjestom čekanja kraka (stop-linija, ili
 * ivica raskrsnice ispred zebre) čeka na ulaz u raskrsnicu [m] — to nije
 * zaustavljanje na stajalištu.
 */
export const GRAD_CEKA_NA_ULAZ = 4;
/** Dvosmjerna ulica uža od ovoga [m] je za jedno auto: drugi vozači njom ne idu (dva auta + rezerva). */
export const GRAD_NPC_USKA = 2 * (CAR_WIDTH + 0.6);
/** Drugi vozač traži rutu najviše kroz ovoliko smjerova ivica (A*) — nedostižan cilj ne pretražuje cijeli grad. */
export const GRAD_NPC_A_ZVIJEZDA = 4000;
/** Lom osovine ulice veći od ovoga [°] se u putanji vozila zaobljava lukom (OSM krivina je lom). */
export const GRAD_LOM_OSOVINE = 3;
/** Putanja bota i drugih vozača: petlja se traži do ovoliko tačaka dalje (≈ 40–80 m). */
export const GRAD_BOT_PETLJA_PROZOR = 40;
/** Lom putanje veći od ovoga [°] se zaobljava (sijecanje ugla, tri puta). */
export const GRAD_BOT_OSTAR_LOM = 25;
/** Vozilo je u mojoj traci (iza mene) kad mu je sredina bliže od ovoga mojoj putanji [m]. */
export const GRAD_NPC_ISTA_TRAKA = 1.5;
/** Dva vozila sa istog kraka su u susjednim trakama kad nijedno nije na putanji drugoga ovoliko naprijed i nazad [m]. */
export const GRAD_NPC_POGLED_TRAKE = 60;
/** Promjena trake: koliko naprijed vozač gleda gdje ulazi u susjednu traku [m]… */
export const GRAD_NPC_PRESTROJ_POGLED = 30;
/** …i propušta vozilo te trake koje tamo stiže prije njega ili manje od ovoliko poslije [s]. */
export const GRAD_NPC_PRESTROJ_RAZMAK = 1.5;
/** Drugi vozači idu tačno putanjom: luk kroz raskrsnicu im treba samo ovoliko od ivičnjaka [m]. */
export const GRAD_NPC_REZERVA_LUKA = 0.2;
/** Sukob u raskrsnici se traži i ovoliko prije mjesta čekanja [m] (lijevi skretač na uzak krak). */
export const GRAD_NPC_PRILAZ_SUKOBA = 15;
/**
 * Ustupanje koje počinje prekasno: kad drugi vozač ni kočenjem ovim udjelom
 * od `B_MAX` ne bi stao pred mjestom čekanja, prolazi (ustupa samo onima koji
 * su već u raskrsnici) — inače bi stao preko linije, u raskrsnici.
 */
export const GRAD_NPC_KOCENJE_UDIO = 0.8;
/**
 * Zaštita od sudara drugih vozača: tijelo na novom položaju, uvećano ovoliko
 * sa svake strane [m], ne smije dodirnuti tijelo drugog (uvećano isto) —
 * dvije rezerve pokrivaju i njegov korak u istom trenutku.
 */
export const GRAD_NPC_ZAKLON = 0.3;
/**
 * Bočno, kad se vozila mimoilaze iz suprotnih smjerova, zaštita je ovolika
 * [m] sa svake strane: njihov bočni razmak se u koraku ne mijenja, a puna
 * rezerva bi, sa malo zakošenim autom (obilazi parkirano), „dodirnula"
 * susretno vozilo metar dalje.
 */
export const GRAD_NPC_ZAKLON_SUSRET = 0.15;
/** Ugao ulice u čvoru koji nije raskrsnica veći od ovoga [°] se zaobljava (luk osovine, trake koncentrično). */
export const GRAD_BOT_UGAO_CVORA = 20;
/**
 * Broj vozila oko igrača po gustini saobraćaja zone u kojoj je (editor, 0–3;
 * odluka korisnika 2026-10-08): gustina 1 = 25, gušće do `GRAD_NPC_NAJVISE`.
 * Van nacrtanih zona (i zona bez gustine) važi gustina 1. U zoni gustine 0 se
 * vozila ne pojavljuju. Ovo se množi nivoom i dobom dana.
 */
export const GRAD_NPC_PO_GUSTINI_ZONE: readonly number[] = [0, 25, 33, 40];
/** Gustina saobraćaja van nacrtanih zona (indeks u `GRAD_NPC_PO_GUSTINI_ZONE`). */
export const GRAD_NPC_GUSTINA_ZONE_PODRAZUMIJEVANO = 1;
/** Udio broja vozila zone po nivou (stavka 7). */
export const GRAD_NPC_GUSTINA_NIVO: Readonly<Record<Level, number>> = { 1: 0.3, 2: 0.45, 3: 0.6, 4: 0.8, 5: 1 };
/** …i po satu igre (`GRAD_SAOBRACAJ_PO_SATU`, stavka 8d). */

// ── Parkiranje drugih vozača uz desni ivičnjak (stavka 7e) ─────────────────
// Odluke korisnika (2026-10-03 i 2026-10-08): na cilju, samo u stambenim i
// sporednim ulicama, bar 15 m od raskrsnice i zebre, nikad na bulevaru ni na
// stajalištu; samo gdje ulica ostaje dovoljno široka kad je auto parkiran;
// ko prolazi, obilazi ga u svojoj polovini ulice.
/** Klase ulica u kojima se parkira (OSM `highway`). */
export const GRAD_PARK_KLASE: readonly string[] = ["residential", "living_street", "unclassified"];
/** Razmak parkiranog auta od ivičnjaka [m]. */
export const GRAD_PARK_OD_IVICNJAKA = 0.15;
/** Bočni razmak vozila koje prolazi pored parkiranog [m]. */
export const GRAD_PARK_OBILAZAK = 0.4;
/**
 * Vozilo koje obilazi parkirano ostaje u svojoj polovini dvosmjerne ulice, bar
 * ovoliko [m] od razdjelne linije. Parkira se samo gdje to staje — i gdje
 * jednosmjerna ostaje šira od vozila uz obje rezerve.
 */
export const GRAD_PARK_DO_SREDINE = 0.1;
/** Najmanja udaljenost parkiranog auta (bliži kraj) od raskrsnice i od zebre [m] — zakon kaže 5, uz rezervu. */
export const GRAD_PARK_OD_RASKRSNICE = 15;
export const GRAD_PARK_OD_ZEBRE = 15;
/** Najmanja udaljenost sredine parkiranog auta od sredine stajališta na istoj strani [m]. */
export const GRAD_PARK_OD_STAJALISTA = 20;
/** Na ovoliko [m] puta vozilo prilazi ivičnjaku (i žmigavac desno). */
export const GRAD_PARK_PRILAZ = 12;
/**
 * Žmigavac za parkiranje se pali tek ovoliko [m] poslije gašenja žmigavca za
 * skretanje u tu ulicu — inače bi sudija vidio žmigavac ostavljen poslije
 * skretanja.
 */
export const GRAD_PARK_ZMIGAVAC_PAUZA = 2;
/**
 * Zaštita od sudara (`GRAD_NPC_ZAKLON`) oko parkiranog auta je ovolika [m]
 * sa svake strane: parkirani se ne pomjera, pa ne treba rezerva za njegov
 * korak — a puna bi tražila više od `GRAD_PARK_OBILAZAK` bočno.
 */
export const GRAD_PARK_ZAKLON = 0.1;
/** Vozilo koje prolazi skreće ka sredini i nazad postepeno, na ovoliko [m] puta. */
export const GRAD_PARK_NAGIB = 12;
/** Pored parkiranog, i ovoliko [m] prije i poslije njega, pomak je pun. */
export const GRAD_PARK_PUNO = 1.5;
/** Razmak između dva parkirana auta na istoj strani [m]. */
export const GRAD_PARK_RAZMAK = 1.5;
/** Osovina ulice se oko mjesta (prilaz i obilazak) ne lomi više od ovoga [°]. */
export const GRAD_PARK_PRAVO = 8;
/** Udio novih vozila koja voze do parkiranja (ostala prolaze kroz grad). */
export const GRAD_PARK_UDIO = 0.35;
/** Najviše parkiranih auta oko igrača — nestaju kad se igrač udalji `GRAD_NPC_NESTAJE`. */
export const GRAD_PARK_NAJVISE = 24;
/** Isti sudar sa istim vozilom ne prijavljuje se ponovo ovoliko [s]. */
export const GRAD_SUDAR_PONOVO = 3;
/**
 * Oduzeto prvenstvo (stavka 7c): drugi vozač koji ima prednost morao je zbog
 * igrača kočiti jače od ovoga [m/s²] — više od udobnog usporenja.
 */
export const GRAD_PRVENSTVO_KOCENJE = 3.5;
/**
 * Naglo kočenje iza igrača je oduzeto prvenstvo samo ako je igrač tek upao
 * ispred (presjekao put, uključio se) — do ovoliko [s] otkad ga vozilo vidi
 * kao vozilo ispred. Kasnije je to vožnja u koloni: razmak drži onaj iza.
 */
export const GRAD_PRESJECANJE = 1.5;
/**
 * Naglo kočenje zbog igrača se bilježi tek kad traje bar ovoliko [s]: jedan
 * korak jakog kočenja (vozilo u susretu se na trenutak primakne liniji) nije
 * „morao je naglo kočiti".
 */
export const GRAD_PRVENSTVO_TRAJE = 0.3;
/**
 * Igrač je zaustavljen saobraćajem (nije parkiranje, vidi sudiju): drugo
 * vozilo mu je ispred bliže od ovoga [m], u njegovoj traci…
 */
export const GRAD_IGRAC_KOLONA = 10;
/**
 * …ili je u raskrsnici, a kroz nju (ili do nje, bliže od ovoga [m]) prolazi
 * drugo vozilo — čeka da prođe (npr. lijevo skretanje i susretni).
 */
export const GRAD_IGRAC_CEKA_PROLAZ = 30;

// ── pješaci (faza 6, stavka 8) ─────────────────────────────────────────────

/**
 * Klase ulica bez trotoara za pješake: autoput i prilazi, servisni put i
 * poljski put. Uz njih se trotoar i dalje crta (kao i dosad), ali pješak njime
 * ne hoda — preko ušća servisnog puta prelazi kao preko kolskog ulaza.
 */
export const GRAD_PJ_KLASE_BEZ: readonly string[] = ["motorway", "motorway_link", "service", "track"];
/** Trotoar se provjerava na svakih ovoliko [m]: tačka na asfaltu druge ulice nije trotoar. */
export const GRAD_PJ_UZORAK = 3;
/** Strana ulice čiji je ovoliki dio na asfaltu druge ulice nema trotoar (npr. uzak razdjelni pojas). */
export const GRAD_PJ_NEVAZI_UDIO = 0.25;
/** Kraj prelaza se vezuje za trotoar bliži od ovoga [m]. */
export const GRAD_PJ_PRISTAJE = 1.6;
/**
 * Koliko se prelaz smije pomjeriti duž ulice od OSM čvora [m] da bi oba kraja
 * pristala na trotoar (provjera mape): čvor zna biti preblizu raskrsnici, pa
 * kraj zebre pada na zaobljeni ugao ivičnjaka.
 */
export const GRAD_PJ_ZEBRA_POMAK = 8;

/**
 * Najmanji razmak OSM autobuskog stajališta od ivice raskrsnice [m] (provjera
 * mape): tačka stajališta u raskrsnici se pomjeri duž ulice van nje — u
 * raskrsnici se ne staje.
 */
export const GRAD_STAJALISTE_VAN_RASKRSNICE = 8;

/**
 * Klase krakova čiji znak (trougao, STOP) ne traži znak „put sa pravom
 * prvenstva" na glavnoj ulici: prilaz iz dvorišta i parkinga ustupa svima, a
 * glavna ulica pored svakog prilaza nema znak (provjera mape).
 */
export const GRAD_ZNAK_GLAVNI_BEZ: readonly string[] = ["service", "track"];

/**
 * Koliko se stub znaka na kraku smije pomjeriti unazad (od raskrsnice) duž
 * desne strane kad je na mjestu linije asfalt — ugao susjednog ušća [m]
 * (provjera mape). Dalje od toga stub ide na lijevu stranu.
 */
export const GRAD_ZNAK_UNAZAD = 15;
/**
 * Razdjelni pojas bulevara: pješak njime ide samo kad mora — put po njemu se
 * računa kao ovoliko puta duži.
 */
export const GRAD_PJ_SREDNJA_CIJENA = 4;
/** Prelaz se u ruti računa kao ovoliko [m] duži (čekanje na ivičnjaku). */
export const GRAD_PJ_PRELAZ_CIJENA = 8;
/** Prelaz preko kraka semaforisane raskrsnice: do ovoliko [m] od ivice raskrsnice (`odsjeci`). */
export const GRAD_PJ_PRELAZ_UZ_RASKRSNICU = 30;
/** Brzina hoda [m/s]: od–do, po pješaku. */
export const GRAD_PJ_BRZINA_OD = 1.1;
export const GRAD_PJ_BRZINA_DO = 1.6;
/**
 * Pješak drži desnu stranu trotoara (i prelaza), do ovoliko [m] od sredine —
 * mimoilaze se. Malo: tijelo (`GRAD_PJ_POLUPRECNIK`) ostaje bar četvrt metra
 * od ivičnjaka, i auto koje ga okrzne nije na trotoaru.
 */
export const GRAD_PJ_BOCNO = 0.15;
/**
 * Pješak se crta ovoliko puta veći od stvarnog (ramena ~1 m): ulice su u igri
 * šire od stvarnih, a stvaran pješak je na ekranu telefona tačka.
 */
export const GRAD_PJ_CRTEZ = 1.6;
/** Polumjer tijela pješaka [m] (trup kako je nacrtan, bez ruku) — za sudar i za „na putu je". */
export const GRAD_PJ_POLUPRECNIK = 0.4;
/**
 * Broj pješaka oko igrača po gustini zone (`pedestrianDensity`, 0–3). Van
 * nacrtanih zona važi gustina 1. Mjerilo (zadatak, odjeljak 8): 60.
 */
export const GRAD_PJ_PO_GUSTINI_ZONE: readonly number[] = [0, 30, 45, 60];
export const GRAD_PJ_GUSTINA_ZONE_PODRAZUMIJEVANO = 1;
/** Pojava: pri prvom popunjavanju od ovoliko [m], kasnije u prstenu van kadra; nestaje dalje od `NESTAJE`. */
export const GRAD_PJ_POCETAK_OD = 10;
export const GRAD_PJ_POJAVA_OD = 70;
export const GRAD_PJ_POJAVA_DO = 200;
export const GRAD_PJ_NESTAJE = 260;
/** Najviše jedan novi pješak na ovoliko [s] (kad ih fali). */
export const GRAD_PJ_POJAVA_RITAM = 0.4;
/** Cilj pješaka: ovoliko [m] vazdušnom linijom od mjesta pojave. */
export const GRAD_PJ_CILJ_OD = 80;
export const GRAD_PJ_CILJ_DO = 350;
/** Najviše koraka A* po pješačkoj mreži za jednu rutu. */
export const GRAD_PJ_A_ZVIJEZDA = 20000;
/** Ćelija indeksa trotoara [m]. */
export const GRAD_PJ_CELIJA = 50;
/**
 * Na ivičnjaku pred zebrom pješak stoji bar ovoliko [s] prije nego što stupi
 * na kolovoz — to je „jasno pokazuje namjeru" (odluka korisnika 2026-10-08).
 */
export const GRAD_PJ_NAMJERA = 1;
/**
 * Pješački semafor na sredini ulice (stavka 8, odluka korisnika 2026-10-08):
 * zeleno za vozila, zeleno za pješake, i trepćuće zeleno za pješake (ko je na
 * prelazu završava, novi ne kreću) [s]. Žuto i „sve crveno" kao na raskrsnici.
 */
export const GRAD_PJ_SEMAFOR_VOZILA = 30;
export const GRAD_PJ_SEMAFOR_PJESACI = 12;
export const GRAD_PJ_SEMAFOR_ZAVRSI = 6;
/**
 * Sredina trotoara je bar ovoliko [m] od asfalta druge ulice — inače tu
 * trotoara nema (razdjelni pojas uži od toga, ulice jedna uz drugu).
 */
export const GRAD_PJ_REZERVA = 0.5;
/**
 * Sudija bilježi namjeru pješaka na ivičnjaku (i da li je auto tada moglo
 * udobno stati) kad je auto do ovoliko [m] od zebre.
 */
export const GRAD_PJ_NAMJERA_DO = 80;
/**
 * Van zebre (zadatak, odjeljak 6: „rijetko i van njih na nivou ≥4"): ovoliki
 * udio pješaka na nivou 4 i 5 jednom na putu pređe ulicu van prelaza — samo
 * preko dvosmjerne ulice do ove širine [m], dalje od zebre od `GRAD_PJ_VAN_OD_ZEBRE`.
 */
export const GRAD_PJ_VAN_ZEBRE_UDIO = 0.08;
export const GRAD_PJ_VAN_ZEBRE_SIRINA = 9;
export const GRAD_PJ_VAN_OD_ZEBRE = 25;
/**
 * Van zebre pješak stupa na kolovoz tek kad nijedno vozilo nije bliže od
 * ovolikog dijela udobnog zaustavnog puta (+ `GRAD_PJ_VAN_REZERVA` m) — vozač
 * ga vidi na vrijeme.
 */
export const GRAD_PJ_VAN_PUTA = 1.5;
export const GRAD_PJ_VAN_REZERVA = 10;
/** Pješak koji na ivičnjaku čeka duže od ovoga [s] odustaje od tog prelaza i ide drugim putem. */
export const GRAD_PJ_STRPLJENJE = 45;
/**
 * Prelaz ide preko kolovoza ulice zebre i njoj paralelnih (druga kolovozna
 * traka bulevara): kosinus ugla između njih bar ovoliki. Ulica koja se tu
 * priključuje nije dio prelaza.
 */
export const GRAD_PJ_PRELAZ_PARALELNO = 0.8;
/** Vozilo se ne pojavljuje bliže od ovoga [m] od pješaka (stavka 8). */
export const GRAD_PJ_POJAVA_VOZILA = 12;
/**
 * Vozilo koje je prošlo mjesto čekanja pred zebrom staje ovoliko [m] prije
 * nego tijelom dodirne zebru, ako to stigne udobnim kočenjem (stavka 8).
 */
export const GRAD_PJ_TIK_PRED_ZEBROM = 0.3;
/** Prelazi na putu vozila traže se i ovoliko [m] preko kraja njegove rute (stavka 8). */
export const GRAD_PJ_PREKO_KRAJA = 8;
/** „Pješak na putu": gdje će pješak na kolovozu biti za ovoliko [s] (stavka 8). */
export const GRAD_PJ_PREDVIDJANJE = 1.5;

// ── Autobusi (faza 6, stavka 8c) ────────────────────────────────────────────

/**
 * Koridor linije: ivica mreže je dio trase autobuske linije kad je bar ovaj
 * dio njene dužine uz neku ulicu-člana relacije (`route=bus`).
 */
export const GRAD_BUS_KORIDOR_UDIO = 0.5;
/** Uzorak ulice-člana leži uz ivicu: do ovoliko [m] od ivice kolovoza (pola širine + ovo). */
export const GRAD_BUS_KORIDOR_DO = 3;
/** Uzorkovanje ulica-članova linije [m]. */
export const GRAD_BUS_UZORAK = 4;
/**
 * Autobus vozi mrežom igre, a ivica van koridora linije košta ovoliko puta
 * više — linija drži svoje ulice, a rupe u OSM relaciji premošćava najkraćim
 * putem.
 */
export const GRAD_BUS_VAN_KORIDORA = 4;
/**
 * Dionica linije koju autobus vozi: cilj je ivica koridora na ovoliko [m]
 * vazdušne linije od početka (od, do).
 */
export const GRAD_BUS_DIONICA = [400, 800] as const;
/** Cilj dionice je na ivici dužoj od ovoga [m] — na kraćoj autobus ne stane pred linijom. */
export const GRAD_BUS_CILJ_IVICA = 60;
/**
 * Pretraga rute dionice linije — najviše ovoliko koraka A*. Uspješnoj ruti
 * (400 nasumičnih dionica) treba najviše ~3700, a 99 % ispod 900; neuspješna
 * pretraga potroši cijeli budžet, a pojava autobusa proba četiri cilja —
 * sa 20000 koraka to je bio kadar od pola sekunde na telefonu.
 */
export const GRAD_BUS_PRETRAGA = 4000;
/** Gradski autobus (stavka 8c): dužina i širina [m]. */
export const GRAD_BUS_DUZINA = 12;
export const GRAD_BUS_SIRINA = 2.55;
/** Autobusa oko igrača po gustini zone (0–3) × doba dana — dio ukupnog broja vozila. */
export const GRAD_BUS_PO_GUSTINI_ZONE = [0, 1, 2, 3] as const;
/** Stajanje na stajalištu [s] (od, do). */
export const GRAD_BUS_STAJE = [8, 15] as const;
/** Lijevi žmigavac prije polaska sa stajališta [s]. */
export const GRAD_BUS_ZMIGAVAC = 3;
/** Polazak sa stajališta traje dok autobus ne odmakne ovoliko [m]. */
export const GRAD_BUS_POLAZAK_DO = 12;
/** Platforma je uz plan autobusa: desno od putanje, bočno najviše ovoliko [m]. */
export const GRAD_BUS_PLATFORMA_DO = 15;
/**
 * Autobus na stajalištu ne stoji u raskrsnici, na zebri ni na stop-liniji:
 * tijelo mu je bar ovoliko [m] od njih.
 */
export const GRAD_BUS_STAJALISTE_RAZMAK = 8;
/** Dva stajališta na planu su bar ovoliko [m] jedno od drugog (isto mjesto oba smjera). */
export const GRAD_BUS_STAJALISTA_RAZMAK = 40;
/**
 * Polazak autobusa sa stajališta (odluka korisnika 2026-10-13): vozilo iza
 * njega, u njegovoj ili susjednoj traci do ovoliko [m] bočno, mora ga
 * propustiti ako je moglo mirno stati kad se upalio žmigavac.
 */
export const GRAD_BUS_PROPUSTI_BOCNO = 7;
/** Tijelo autobusa smije preko ivice kolovoza ovoliko [m] (zaobljen ivičnjak, uglovi). */
export const GRAD_BUS_ASFALT_REZERVA = 0.2;
/** Dio autobusa koji se pojavi kako stoji na stajalištu svoje linije (stavka 8c). */
export const GRAD_BUS_NA_STAJALISTU = 0.5;
/**
 * Obilazak parkiranog uz autobus (stavka 8c): ko obilazi, čeka prije početka
 * pomaka dok iz suprotnog smjera dolazi vozilo u zoni obilaska ili do ovoliko
 * [m] iza nje.
 */
export const GRAD_OBILAZAK_SUSRET = 40;
/** Novo mjesto za parkiranje se ne rezerviše bliže od ovoga [m] autobusu (stavka 8c). */
export const GRAD_BUS_PARKING_RAZMAK = 80;
/** Pojava autobusa se pokušava najviše jednom na ovoliko [s] (plan je skup, stavka 8c). */
export const GRAD_BUS_POJAVA_RITAM = 0.5;
/** Pješak na trotoaru kojem vozilo stoji na putu duže od ovoga [s] okreće se i ide drugim putem (stavka 8c). */
export const GRAD_PJ_BLOKIRAN = 3;
/**
 * Autobus u krivini smije proći tijesno pored vozila koje stoji (stavka 8c):
 * oba tijela uvećana za ovoliko [m] sa svake strane se ne dodiruju (između
 * njih ostaje bar dvostruko), a puni razmak (`GRAD_NPC_ZAKLON`) se vrati na
 * najviše `GRAD_BUS_TIJESNO_DO` m dalje. Krut pravougaonik autobusa u oštroj
 * krivini zamahne zadnjim krajem i do auta na stop-liniji susjednog kraka.
 */
export const GRAD_BUS_TIJESNO = 0.02;
export const GRAD_BUS_TIJESNO_DO = 6;
/**
 * Luk kroz raskrsnicu čiji je kraj (iza početka izlazne trake) dalje od nje
 * od ovoga [m] — izlazna ulica se do tu savila — zamjenjuje se glatkom krivom
 * do početka trake (stavka 8c): inače putanja sa kraja luka skače u traku.
 */
export const GRAD_BOT_LUK_VAN_TRAKE = 0.5;
/**
 * Polovina ulice vozila na prelazu (stavka 8c): sve polovine koje tijelo
 * vozila, uvećano bočno za ovoliko [m], dodiruje gdje siječe prelaz — vozač
 * (i bot) odstupa od putanje, a u uskoj ulici auto u skretanju zahvati obje.
 */
export const GRAD_PJ_POLOVINA_REZERVA = 0.5;
/**
 * Vozilo pred zebrom bez semafora čeka pješake duže od ovoga [s] (stavka 8c):
 * pješak koji tek stiže ne staje na ivičnjak dok ono ne prođe — inače, kad
 * pristižu jedan za drugim, vozilo čeka beskonačno. Oni na ivičnjaku i na
 * zebri prelaze kao i prije.
 */
export const GRAD_PJ_PROPUSTA = 8;
/** … a „pred zebrom" je nosom do ovoliko [m] od nje. */
export const GRAD_PJ_PROPUSTA_DO = 6;

// ── dnevni ciklus (faza 6, stavka 8d) ─────────────────────────────────────

/** Jedan sat igre traje ovoliko [s]: 24 min igre = 24 h (zadatak, odjeljak 6). */
export const GRAD_SAT_TRAJE = 60;
/**
 * Svjetlo po satu: od jednog sata do sljedećeg u tabeli nijansa grada, sjenke
 * i svjetla prelaze postepeno (dan → sumrak → noć i nazad). Zora 5–7 h,
 * sumrak 18:30–20:30 — Podgorica, prosjek godine.
 */
export const GRAD_SVJETLO_PO_SATU: readonly (readonly [number, "dan" | "sumrak" | "noc"])[] = [
  [0, "noc"],
  [5, "noc"],
  [6, "sumrak"],
  [7, "dan"],
  [18.5, "dan"],
  [19.5, "sumrak"],
  [20.5, "noc"],
  [24, "noc"],
];
/**
 * Udio vozila po satu (0–23 h; između sati linearno): gužva ujutru (7–9) i
 * popodne (14–17), noću rijetko. Množi se nivoom i gustinom zone.
 */
export const GRAD_SAOBRACAJ_PO_SATU: readonly number[] = [
  0.25, 0.15, 0.1, 0.1, 0.12, 0.25, 0.5, 0.9, 1, 0.8, 0.7, 0.7, 0.75, 0.8, 0.9, 1, 1, 0.95, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3,
];
/** Udio pješaka po satu: najviše oko podne i u večernjoj šetnji, noću skoro niko. */
export const GRAD_PJESACI_PO_SATU: readonly number[] = [
  0.15, 0.1, 0.05, 0.05, 0.05, 0.1, 0.3, 0.7, 0.8, 0.7, 0.8, 0.9, 1, 1, 0.9, 0.8, 0.85, 0.95, 1, 1, 0.85, 0.6, 0.4, 0.25,
];
/**
 * Kraj nastave [sat od, sat do]: prva smjena oko 13 h, druga oko 19 h. Tada
 * oko škole (do `GRAD_SKOLA_KRUG` m od igrača) ima najviše pješaka, i dio se
 * pojavljuje uz samu školu (`GRAD_SKOLA_UZ`).
 */
export const GRAD_SKOLA_KRAJ: readonly (readonly [number, number])[] = [
  [12.75, 13.75],
  [18.75, 19.5],
];
export const GRAD_SKOLA_KRUG = 300;
/** …pješak se pojavljuje do ovoliko [m] od škole, sa ovom vjerovatnoćom. */
export const GRAD_SKOLA_UZ = 150;
export const GRAD_SKOLA_UZ_UDIO = 0.6;
/** Prečice za sat igre (dugmad): jutro, dan, sumrak, noć [h]. */
export const GRAD_SAT_PRECICE = { jutro: 7.5, dan: 12, sumrak: 19.5, noc: 23 } as const;

// ── radnje (faza 6, stavka 8d) ────────────────────────────────────────────

/**
 * Radno vrijeme radnje bez `opening_hours` u OSM-u, po vrsti (`shop=*`) [h od,
 * h do]; ostale `GRAD_RADNJA_VRIJEME_OSTALO`. Igra nema dane u sedmici: važi
 * radni dan.
 */
export const GRAD_RADNJA_VRIJEME: Readonly<Record<string, readonly [number, number]>> = {
  supermarket: [7, 22],
  convenience: [7, 23],
  kiosk: [6, 22],
  bakery: [6, 21],
  pastry: [7, 21],
  butcher: [7, 19],
  greengrocer: [7, 20],
  bookmaker: [8, 24],
  tobacco: [7, 22],
  hairdresser: [9, 20],
  beauty: [9, 20],
  car_repair: [8, 17],
  car_parts: [8, 17],
  tyres: [8, 17],
  doityourself: [8, 20],
  hardware: [8, 18],
  laundry: [8, 20],
};
export const GRAD_RADNJA_VRIJEME_OSTALO: readonly [number, number] = [9, 21];
/** Izlog se stavlja na trotoar najbliži radnji — do ovoliko [m] od nje; dalje (dvorište, tržni centar) se ne crta. */
export const GRAD_RADNJA_DO = 30;
/** …pomjeren od staze hoda ka zgradama za ovoliko [m] (ivica trotoara uz zgradu). */
export const GRAD_RADNJA_ODMAK = 1.1;
/** Izlozi bliži od ovoga [m] se ne crtaju dvaput (više radnji u istoj zgradi). */
export const GRAD_RADNJA_RAZMAK = 3.5;
/** Izlog: dužina uz ulicu i dubina tende [m]. */
export const GRAD_RADNJA_DUZINA = 3.2;
export const GRAD_RADNJA_DUBINA = 0.9;
/** Prečnik sjaja osvijetljenog izloga uveče [m]. */
export const GRAD_RADNJA_SJAJ = 7;
/** Izlozi se crtaju do ovoliko [m] od kamere (po osi) — kadar je do ~80 m. */
export const GRAD_RADNJE_KADAR = 90;
/** Radnja u zgradi ili do ovoliko [m] od nje dobija izlog na njenoj fasadi ka trotoaru. */
export const GRAD_RADNJA_ZGRADA = 10;

// ── hitna vozila (faza 6, stavka 8e) ─────────────────────────────────────
// Odluke korisnika (2026-10-08, 2026-10-15): u raskrsnici im se ustupa bez
// obzira na znak i svjetlo; iza vozila — ono se skloni udesno i uspori ili
// stane; igrač koji to ne uradi pada; na crvenom smije oprezno preći liniju
// da ga propusti; u slobodnoj vožnji rijetko, oko jednom u 5 min.

/** Hitno vozilo se pojavljuje u prosjeku jednom na ovoliko [s] (nivo 1–2: `GRAD_HITNO_RITAM_NIZAK`). */
export const GRAD_HITNO_RITAM = 300;
export const GRAD_HITNO_RITAM_NIZAK = 600;
/** Pojavljuje se iza igrača, ovoliko [m] uzvodno njegovom ulicom, i vozi ovoliko [m] dalje od njega. */
export const GRAD_HITNO_IZA_POJAVA = 180;
export const GRAD_HITNO_DALJE = 260;
/** Vozi brže od ograničenja (×), ali ne brže od ovoga [m/s]. */
export const GRAD_HITNO_BRZINA = 1.25;
export const GRAD_HITNO_NAJVISE = 20;
/** Kroz crveno i STOP prolazi oprezno: na liniji najviše ovoliko [m/s]. */
export const GRAD_HITNO_KROZ = 4;
/** Vozilo ispred hitnog (u istom smjeru), do ovoliko [m] ispred njega, sklanja se udesno i staje. */
export const GRAD_HITNO_IZA = 45;
/** …za ovoliko [m] udesno; hitno ga obilazi pomjereno za `GRAD_HITNO_OBILAZI` ulijevo. */
export const GRAD_HITNO_SKLONI = 1.2;
export const GRAD_HITNO_OBILAZI = 1.4;
/** Susretno vozilo (hitno mu dolazi u susret, do ovoliko [m]) se pomjera udesno za ovoliko [m] i usporava na najviše ovoliko [m/s]. */
export const GRAD_HITNO_SUSRET = 60;
export const GRAD_HITNO_SUSRET_BOK = 0.8;
export const GRAD_HITNO_SUSRET_BRZINA = 5;
/** Bočno pomjeranje (sklanjanje i povratak) ovoliko [m/s]. */
export const GRAD_HITNO_BOK_BRZINA = 0.9;
/**
 * Sudija (stavka 8e): igrač je ispred hitnog vozila — do ovoliko [m] ispred
 * njegovog nosa, u njegovoj traci (bočno do `GRAD_HITNO_TRAKA` m od putanje).
 */
export const GRAD_HITNO_SUDI_DO = 30;
export const GRAD_HITNO_TRAKA = 2.6;
/** Sklonio se: bar ovoliko [m] udesno od putanje hitnog, i ne brže od ovoga [m/s]. */
export const GRAD_HITNO_SKLONJEN = 0.6;
export const GRAD_HITNO_SPORO = 5;
/** Prekršaj kad mu je hitno vozilo tik iza, a on se ne skloni, duže od ovoga [s]. */
export const GRAD_HITNO_TRPI = 5;
/** Na crvenom, sa hitnim iza: smije preći stop-liniju najviše ovoliko [m], da ga propusti. */
export const GRAD_HITNO_PREKO_LINIJE = 6;
/** Prečnik [m] mekog odsjaja rotacije hitnog vozila na ulici, uveče i po kiši (stavka 8e). */
export const GRAD_HITNO_SJAJ = 16;
/** Hitno vozilo bliže od ovoga [m], iz bilo kog smjera: ko stoji, stao je zbog njega — nije parkiranje (stavka 8e). */
export const GRAD_HITNO_BLIZU = 40;
/** Do ovoliko [m] pred raskrsnicom drugi vozači vide (i čuju) hitno vozilo i ustupaju mu (stavka 8e). */
export const GRAD_HITNO_VIDI = 160;
/** Dodatna rezerva [s] kad se na raskrsnici procjenjuje da li se stigne proći prije hitnog vozila (stavka 8e). */
export const GRAD_HITNO_REZERVA_PROLAZA = 4;
/** Bot pred hitnim vozilom (stavka 8e): najviše ovoliko [m/s] — ispod `GRAD_HITNO_SPORO`. */
export const GRAD_HITNO_BOT_BRZINA = 4;
/** Odredište zadatka (stavka 9) je vezano za voznu ulicu najviše ovoliko [m] od objekta. */
export const GRAD_ODREDISTE_DO_ULICE = 200;
/** Dva odredišta iste kategorije bliža od ovoga [m] su isti objekat (tačka i zgrada u OSM-u). */
export const GRAD_ODREDISTE_ISTO = 60;
/** Navigacija (stavka 9): ulica auta se traži do ovoliko [m] od njega. */
export const GRAD_NAV_TRAZI_ULICU = 30;
/** Auto je van rute kad je dalje od ovoga [m] od njene linije… */
export const GRAD_NAV_SA_RUTE = 15;
/** …duže od ovoga [s] — tada se traži nova ruta. */
export const GRAD_NAV_SA_RUTE_TRAJE = 1.5;
/** Stigao je kad je do ulaza odredišta (i do kraja rute) manje od ovoga [m]. */
export const GRAD_NAV_DOLAZAK = 20;
/** Mini mapa grada (stavka 9) crta ostatak rute do ovoliko [m] ispred auta. */
export const GRAD_MINI_RUTA = 900;
/** Statistika vožnje (stavka 9): čiste minute teku samo dok auto ide brže od ovoga [m/s]. */
export const GRAD_STAT_VOZI = 1;
/**
 * Vožnja od–do (stavka 9): po težini nivo saobraćaja i sudije, zračno
 * rastojanje nasumičnog cilja [m] i referentna prosječna brzina [m/s] (vožnja
 * po pravilima kroz grad, sa semaforima).
 */
export const GRAD_ODDO_TEZINE = {
  lako: { nivo: 1 as Level, odM: 500, doM: 1500, brzina: 5 },
  srednje: { nivo: 3 as Level, odM: 1500, doM: 3000, brzina: 6 },
  tesko: { nivo: 5 as Level, odM: 3000, doM: 6000, brzina: 7 },
} as const;
/** Bodovi za pravila (bez prekršaja), i koliko oduzima upozorenje i pad. */
export const GRAD_ODDO_PRAVILA = 700;
export const GRAD_ODDO_MINOR = 100;
export const GRAD_ODDO_FAIL = 350;
/** Bodovi za vrijeme — puni do referentnog vremena. */
export const GRAD_ODDO_VRIJEME = 300;
/** Pragovi za jednu, dvije i tri zvjezdice. */
export const GRAD_ODDO_ZVJEZDICE = [400, 700, 900] as const;

// ── ispitna ruta (faza 6, stavka 9c) ─────────────────────────────────────
// Odluke korisnika (2026-10-15, 2026-10-17): rute samo iz editora, kao prave
// ispitne rute u Podgorici; pada se na bilo koji teži prekršaj ili na više od
// `GRAD_ISPIT_LAKSIH` lakših.
/** Nivo saobraćaja i sudije na ispitu. */
export const GRAD_ISPIT_NIVO: Level = 3;
/** Najviše lakših prekršaja da bi se ispit položio. */
export const GRAD_ISPIT_LAKSIH = 3;
/** Obavezna tačka je pređena kad je auto po ruti stigao do nje bliže od ovoga [m]. */
export const GRAD_ISPIT_TACKA = 10;

// ── provjera mape (faza 6, poslije stavke 9c) ────────────────────────────
/** Kružni tok se poravna na krug samo ako mu se čvorovi i tačke ne odmiču od srednjeg poluprečnika više od ovog dijela (u Podgorici najviše 0,12). */
export const GRAD_KRUZNI_ODSTUPANJE = 0.2;
/** Luk ivice prstena: tačka na najviše ovoliko [m]. */
export const GRAD_KRUZNI_KORAK = 1.5;
