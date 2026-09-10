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

/** Na koliko sekundi se u prosjeku mimoiđe susretno vozilo. */
export const ONCOMING_GAP = 7;

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
