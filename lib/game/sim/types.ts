/**
 * Model igre „Prođi raskrsnicu".
 *
 * `Approach` i `Intent` se NE definišu ovdje — dolaze iz `lib/simRules.ts`, koji
 * je već model raskrsnice za statični simulator. Igra i simulator dijele pojmove
 * i pravila prvenstva; razlikuju se samo po tome što igra ima vrijeme.
 */

import type { Approach, Intent as CrossIntent } from "@/lib/simRules";
// Samo tip — uvoz se briše pri prevođenju, pa ciklus između ova dva fajla ne
// postoji u izvršnom kodu.
import type { IndicatorPhase } from "./indicatorRules";
import type { Level } from "./config";

export type ArmId = Approach;
export type { CrossIntent };

/**
 * Manevar vozila.
 *
 * Krstasta raskrsnica ima tri manevra i oni ostaju obični stringovi, isti kao u
 * `lib/simRules.ts` — pravila prvenstva su zajednička i ne smiju da se razlikuju
 * po obliku podatka. Kružni tok se ne opisuje smjerom nego rednim brojem izlaza,
 * a autoput trakom, pa oni dolaze kao zasebni oblici.
 *
 * Zašto ne sve svesti na broj izlaza: statični simulator bi ostao na starom
 * pojmu, pa bi u istom projektu postojala dva rječnika za istu stvar.
 */
export type Intent =
  | CrossIntent
  | { kind: "exit"; n: number }
  | { kind: "lane"; index: number };

/** Manevar na krstastoj raskrsnici, ili `null` ako je vozilo u kružnom toku. */
export function crossIntent(intent: Intent): CrossIntent | null {
  return typeof intent === "string" ? intent : null;
}

/**
 * Manevar sveden na stranu skretanja — jedino što treba pravilima pokazivača.
 * Kružni tok ima svoju tabelu faza, pa se ovdje ne pojavljuje.
 */
export function turnSide(intent: Intent): "left" | "right" | null {
  const c = crossIntent(intent);
  return c === "left" || c === "right" ? c : null;
}

/** Kako je krak regulisan. */
export type Control =
  | { kind: "none" } // pravilo desne strane
  | { kind: "stop" }
  | { kind: "yield" }
  | { kind: "priority" }
  | { kind: "light"; phaseGroup: string }
  | { kind: "officer" }; // policajac — kasnija faza, engine ga ne podržava

export interface Arm {
  id: ArmId;
  control: Control;
  lanes: number;
  hasCrosswalk: boolean;
}

/** Jedna faza semafora: koje grupe krakova imaju koje svjetlo i koliko dugo. */
export interface LightPhase {
  /** Grupe koje su zelene; ostale su crvene. */
  green: string[];
  /** Grupe koje su žute (prelaz). */
  yellow?: string[];
  duration: number;
}

export interface IntersectionTemplate {
  /** Diskriminator: kružni tok i autoput dolaze kao zasebni oblici. */
  kind: "cross";
  id: string;
  /** Tri ili četiri kraka. Krak kojeg nema ne postoji kao ulaz ni izlaz. */
  arms: Arm[];
  /**
   * Glavni put kad je „izlomljen" — ulazi kroz jedan krak i izlazi kroz drugi
   * koji mu nije nasuprot. Sami krakovi i dalje nose `control: priority`; ovo
   * polje služi prikazu, da se debela linija nacrta tačno.
   */
  priorityRoad?: [ArmId, ArmId];
  lightProgram?: LightPhase[];
  geometry: { size: number; laneWidth: number };
  /** Pola vidnog polja [m]; bez ovoga važi `VIEW_HALF` iz konfiguracije. */
  viewHalf?: number;
}

/**
 * Kružni tok.
 *
 * Prsten je jedna kružna traka; vozila se u njemu kreću N → W → S → E → N,
 * kako je opisano u `RING_ORDER` u `lib/simRules.ts`. Struktura već nosi broj
 * traka u prstenu iako je za sada uvijek jedan — dvotračni tok mijenja samo
 * građenje putanja, ne i pravila.
 */
export interface RoundaboutTemplate {
  kind: "roundabout";
  id: string;
  /** Tri ili četiri kraka. Regulacija je `yield` ili `stop`. */
  arms: Arm[];
  /** Radijus ose prstena [m]. */
  radius: number;
  ringLanes: number;
  geometry: { laneWidth: number };
  /** Pola vidnog polja [m]. Prilaz kružnog toka je duži nego kod krstaste. */
  viewHalf?: number;
}

/**
 * Dionica autoputa.
 *
 * Nema krakova ni prvenstva — ima trake, odstojanje i brzinu. `vMin` postoji
 * jer je prespora vožnja na autoputu prekršaj, a ne samo nespretnost.
 */
export interface HighwayTemplate {
  kind: "highway";
  id: string;
  /** Dužina dionice [m]. */
  length: number;
  /** Broj voznih traka (bez spoljne). Za sada 2. */
  lanes: number;
  /** Dio dionice na kojem je spoljna traka traka za ubrzavanje [m]. */
  rampRange: [number, number];
  /** Dio dionice na kojem je spoljna traka traka za usporavanje [m]. */
  exitRange: [number, number];
  /** Najmanja i najveća dozvoljena brzina [m/s]. */
  vMin: number;
  vMax: number;
  geometry: { laneWidth: number };
  viewHalf?: number;
}

/** Jedna krivina na otvorenom putu. */
export interface RoadCurve {
  /** Sredina luka na putanji [m]. */
  atS: number;
  /** Dužina luka [m]. */
  arc: number;
  /**
   * Poluprečnik [m].
   *
   * Ne pogađa se: dobija se iz preporučene brzine i dozvoljenog bočnog
   * ubrzanja, pa ono što piše na tabli i ono što je nacrtano opisuju istu
   * krivinu.
   */
  radius: number;
  side: "left" | "right";
  /** Preporučena brzina [km/h] — ono što stoji na tabli. */
  advisorySpeed: number;
}

/**
 * Znamenitost postavljena uz dionicu.
 *
 * U šablonu stoji već preračunata — položaj duž putanje i strana puta, oboje
 * u smjeru vožnje. Crtanje time ne mora da poznaje ni graf ni to u kom se
 * smjeru ide.
 */
export interface RoadLandmark {
  /** Položaj duž dionice [m]. */
  atS: number;
  side: "left" | "right";
  /** Putanja do ikone 64×64. */
  icon: string;
  name: string;
}

/**
 * Otvorena dionica između dva čvora grafa puteva.
 *
 * Nema krakova, nema prvenstva i nema prestrojavanja: dvije trake, jedna u
 * svakom smjeru, i krivine. Traka 0 je naša, traka 1 je susretna i njena je
 * putanja obrnuta, pa susretnom vozilu `s` raste dok nam se približava.
 *
 * `length` je koliko se STVARNO vozi, a `edgeKm` koliko ivica ima na karti.
 * Razlika je namjerna — vidi `TRIP_SEGMENT_TIME`.
 */
export interface RoadTemplate {
  kind: "road";
  id: string;
  /** Dužina koja se vozi [m]. */
  length: number;
  /** Ivica iz grafa i njena stvarna dužina [km]. */
  edgeId: string;
  edgeKm: number;
  /** Dozvoljena brzina [m/s]. */
  vMax: number;
  curves: RoadCurve[];
  /**
   * Osovina puta, kad dolazi iz stvarne geometrije.
   *
   * Kad je zadata, `curves` više NE opisuju oblik puta nego samo table sa
   * preporučenom brzinom — oblik dolazi odavde. Bez ovoga bi se ista krivina
   * opisivala dvaput, iz dva izvora koji se mogu razići.
   */
  centerline?: Point[];
  /** Znamenitosti pored puta, u smjeru vožnje. */
  landmarks: RoadLandmark[];
  geometry: { laneWidth: number };
  viewHalf?: number;
}

/** Sve vrste raskrsnica koje simulacija poznaje. */
export type Template =
  | IntersectionTemplate
  | RoundaboutTemplate
  | HighwayTemplate
  | RoadTemplate;

/** Šablon bez krakova: odnos među vozilima nije prvenstvo nego traka. */
export const bezKrakova = (tpl: Template): tpl is HighwayTemplate | RoadTemplate =>
  tpl.kind === "highway" || tpl.kind === "road";

// ── Putanja ─────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/**
 * Putanja kroz raskrsnicu, parametrizovana po pređenoj dužini `s`.
 *
 * Polilinija je uzorkovana tako da je razmak između tačaka poznat, pa se
 * `pointAt(s)` računa linearnom interpolacijom bez traženja korijena.
 */
export interface Path {
  id: string;
  arm: ArmId;
  intent: Intent;
  exitArm: ArmId;
  points: Point[];
  /** Kumulativna dužina do svake tačke; `cum[0] === 0`. */
  cum: number[];
  length: number;
  /** `s` na kojem putanja prelazi stop-liniju. */
  stopLineS: number;
  /**
   * `s` na kojem prestaje traka za ubrzavanje — samo spoljna traka autoputa.
   *
   * Postoji da bi se zona uključenja mogla napisati u tabeli pravila, kao i
   * sve ostale zone, umjesto da je crtanje računa napamet.
   */
  rampEndS?: number;
  /** `s` na kojem putanja ulazi u tijelo raskrsnice i na kojem ga napušta. */
  boxEnterS: number;
  boxExitS: number;
  /**
   * Dionica putanje koja leži u prstenu kružnog toka.
   *
   * Uglovi su potrebni da bi se dvije putanje mogle uporediti duž prstena: one
   * dijele istu kružnicu, pa „ko je ispred koga" nije pitanje presjeka nego
   * pitanje ugla.
   */
  ring?: {
    from: number;
    to: number;
    angleFrom: number;
    angleTo: number;
    radius: number;
  };
  /**
   * `s` izlaza koji prethodi mom — po njemu se sudi kad najkasnije mora da se
   * upali desni pokazivač u kružnom toku.
   */
  prevExitS?: number;
}

/**
 * Tačka u kojoj se dvije putanje sudaraju, sa `s` na svakoj od njih.
 * Računa se jednom po šablonu i kešira — vidi `intersection.ts`.
 */
export interface ConflictPoint {
  pathA: string;
  pathB: string;
  sA: number;
  sB: number;
  /** `merge` je ulazak u istu izlaznu traku, `cross` je presijecanje putanja. */
  kind: "cross" | "merge";
}

// ── Vozilo ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  kind: "player" | "npc";
  pathId: string;
  /** Pozicija duž putanje [m]. */
  s: number;
  /** Brzina [m/s]. */
  v: number;
  length: number;
  width: number;
  intent: Intent;
  arm: ArmId;
  indicator: "left" | "right" | null;
  /** Koliko je već stajalo na STOP liniji [s]. */
  stopHeld: number;
  /** Da li je vozilo napustilo raskrsnicu. */
  done: boolean;
  /** Tren u kojem vozilo ulazi u simulaciju [s]. Prije toga ga nema. */
  spawnT: number;
  /** Vozilo pod pratnjom — rotacija i sirena. Prvenstvo nad svima. */
  emergency?: boolean;
  /** Traka na autoputu. Nedefinisano na raskrsnicama. */
  lane?: number;
  /** Traka iz koje se prelazi, dok prelazak traje. */
  laneFrom?: number;
  /** Napredak prelaska iz trake u traku, 0–1. */
  laneT?: number;
  /** Brzina koju vozilo drži na autoputu [m/s]. */
  cruise?: number;
  /**
   * Vozilo se ponaša neispravno: ne ustupa i ne poštuje znak.
   *
   * Postoji zbog vježbe defanzivne vožnje. Kad je uključeno, igraču se NE
   * računa zadržavanje saobraćaja dok prekršilac prolazi — inače bi ga igra
   * kaznila baš za ono što je ispravno uradio.
   */
  reckless?: boolean;
}

/**
 * Pješak na prelazu jednog kraka.
 *
 * Kreće se poprečno na kolovoz, pa mu je pozicija jedan broj: `u` je odmak od
 * ose kraka [m]. Van kolovoza je bezopasan; dok je na njemu, vozilo koje prelazi
 * taj prelaz mora da ga propusti.
 */
export interface Pedestrian {
  id: string;
  arm: ArmId;
  /** Odmak od ose kraka [m]. Kreće se od `-start` ka `+start` ili obrnuto. */
  u: number;
  /** Smjer kretanja duž prelaza. */
  dir: 1 | -1;
  speed: number;
  spawnT: number;
  done: boolean;
}

// ── Scenario ────────────────────────────────────────────────────────────────

export interface ScenarioNpc {
  arm: ArmId;
  intent: Intent;
  /** Gdje vozilo počinje duž dionice [m]. Na raskrsnicama je uvijek 0. */
  startS?: number;
  /** Opseg sekundi u kojem vozilo nastaje; bira se po sjemenu. */
  spawnAt: [number, number];
  speed: number;
  /** Vozilo pod pratnjom — prolazi i na crveno, svi mu ustupaju. */
  emergency?: boolean;
}

export interface ScenarioPedestrian {
  arm: ArmId;
  /** Sa koje strane kreće: `-1` sa lijeve ivice gledano niz krak, `1` sa desne. */
  dir: 1 | -1;
  spawnAt: [number, number];
  /** Brzina hoda [m/s]; oko 1,3 za odraslu osobu. */
  speed: number;
}

/**
 * Naredba policijskog službenika.
 *
 * Policajac nije dio raskrsnice nego okolnosti tog trenutka, pa stoji u
 * scenariju, a ne u šablonu.
 *
 * `allow` su krakovi kojima je u toj fazi dozvoljen prolaz; svi ostali stoje.
 * Uvijek su to dva nasuprotna kraka, jer policajac raširenim rukama propušta
 * jedan pravac — a to je i jedino što se sa slike može pročitati. Semantika
 * ostalih znakova rukama nije modelovana i namjerno se ne pretpostavlja.
 *
 * Faze se ponavljaju ciklično i zavise samo od vremena, pa u stanju svijeta ne
 * ostavljaju ništa — ponavljanje snimka ih dobija tačnim bez ijednog dodatnog
 * polja.
 */
export interface ScenarioOfficer {
  phases: { allow: ArmId[]; duration: number }[];
}

/** Vrste problematičnih događaja u saobraćaju. */
export type HazardKind =
  /** Vozilo prolazi STOP ili trougao bez ustupanja. */
  | "npcRunsStop"
  /** Vozilo iskrsava iza zaklona, sa malim vremenom do susreta. */
  | "npcLateSpawn"
  /** Pješak stupa na prelaz iz zaklona. */
  | "pedestrianSteps"
  /** Vozilo pod pratnjom se pojavljuje. */
  | "emergencyVehicle";

/**
 * Skriptovan problematičan događaj.
 *
 * Okidač je ili vrijeme ili mjesto igrača na putanji — oba su determinisana,
 * pa ponavljanje snimka daje isti događaj u istom trenutku. Nasumičnost bi
 * pokvarila i snimak i testove.
 */
export interface ScenarioHazard {
  kind: HazardKind;
  /** Indeks vozila u `npcs`, odnosno pješaka u `pedestrians`. */
  target: number;
  atTime?: number;
  /** Okida se kad igrač pređe ovo mjesto na svojoj putanji [m]. */
  atPlayerS?: number;
  /**
   * Gdje se vozilo pojavljuje na svojoj putanji [m].
   *
   * Postoji zbog `npcLateSpawn`: vozilo koje iskrsne sa početka svoje putanje
   * ima šezdeset metara zaleta i nikoga ne iznenadi. Zaklon se modeluje time
   * što se pojavi bliže raskrsnici.
   */
  npcS?: number;
}

export interface Scenario {
  id: string;
  intersection: string;
  /**
   * Šablon koji ide uz scenario, umjesto onoga iz `TEMPLATES`.
   *
   * Postoji zbog putovanja: dionica se pravi iz ivice grafa i sjemena, pa je
   * nemoguće da stoji u spisku napisanih raskrsnica. Scenario je ulaz u
   * simulaciju, ne njeno stanje, pa ovo ne ulazi ni u jedan snimak.
   */
  template?: Template;
  player: { arm: ArmId; intent: Intent; spawnDistance: number; startS?: number; startV?: number };
  npcs: ScenarioNpc[];
  pedestrians?: ScenarioPedestrian[];
  officer?: ScenarioOfficer;
  hazards?: ScenarioHazard[];
  lightStartPhase?: number;
  /**
   * Koliko je već proteklo u početnoj fazi semafora [s].
   *
   * Bez ovoga scenario može da počne samo na početku faze, pa se „žuto te
   * zateklo na prilazu" ne može ni napraviti: zeleno traje dvanaest sekundi, a
   * igrač do linije stigne za sedam.
   */
  lightStartT?: number;
  difficulty: Level;
  vMax?: number;
  /**
   * Zamjena za `INDICATOR_RULES`, samo za testove.
   *
   * Stoji u scenariju, a ne u stanju svijeta: tabela je ulaz u simulaciju kao i
   * raskrsnica, i ne treba da se kopira u svaki snimak za ponavljanje.
   */
  indicatorRules?: readonly IndicatorPhase[];
  /**
   * Naziv i objašnjenje po jeziku.
   *
   * Ovo NE ide u `lib/i18n.ts` iako je tekst za korisnika: to je sadržaj
   * scenarija, kao i putanja ili težina, pa mora da putuje zajedno sa njim.
   * Kad se doda deveti scenario, dovoljan je jedan fajl — bez diranja rječnika.
   */
  title: Record<string, string>;
  /** Tekst tačnog rješenja po jeziku. */
  explanation: Record<string, string>;
  /**
   * Ključ u rječniku za rečenicu „šta treba uraditi".
   *
   * Postoji zbog autoputa: tamo namjera nosi samo traku u kojoj se počinje, pa
   * se iz nje ne vidi da li je zadatak uključivanje, preticanje ili isključenje.
   * Ključ, a ne tekst, jer su te rečenice opšte i trebaće ih i generator smjene.
   */
  taskKey?: string;
}

// ── Događaji i prekršaji ────────────────────────────────────────────────────

export type ViolationType =
  | "rightOfWay"
  | "stopSign"
  | "redLight"
  | "collision"
  | "obstruction"
  | "speeding"
  | "pedestrian"
  | "officer"
  | "indicatorMissing"
  | "indicatorWrong"
  | "indicatorLate"
  | "indicatorLeftOn"
  | "unsafeMerge"
  | "stoppedOnRamp"
  | "tooSlow"
  | "tailgating"
  | "brakingOnHighway"
  | "hardShoulder";

/**
 * Koliko prekršaj košta.
 *
 * `fail` obara vožnju, `minor` se prijavi i objasni ali vožnja ostaje ispravna.
 * Razlika postoji zbog pokazivača: ostavljen žmigavac poslije skretanja jeste
 * greška, ali nije istog reda kao ulazak u raskrsnicu bez prava prolaza, i ne
 * bi bilo pošteno da ista kartica znači isto.
 */
export type Severity = "fail" | "minor";

export interface Violation {
  type: ViolationType;
  severity: Severity;
  /** Trenutak u simulaciji [s]. */
  t: number;
  details: string;
  /**
   * Id kazne iz `data/kazne.json`. Prikazuje se samo ako je ta kazna potvrđena —
   * dok nije, kartica prekršaja pokazuje samo pravilo, bez iznosa.
   */
  penaltyRef: string | null;
  /** Vozilo kojem je oduzeta prednost, ako ga ima — za crveni highlight. */
  otherVehicleId?: string;
  /** Id faze pokazivača, kad je prekršaj iz te porodice — za timeline. */
  phaseId?: string;
}

export type SimEvent =
  | { type: "forcedBrake"; t: number; vehicleId: string; by: string }
  | { type: "spawn"; t: number; vehicleId: string }
  | { type: "exit"; t: number; vehicleId: string }
  | { type: "hazard"; t: number; kind: HazardKind; index: number };

export type Outcome = "running" | "passed" | "failed";

export interface World {
  t: number;
  scenarioId: string;
  templateId: string;
  vehicles: Vehicle[];
  pedestrians: Pedestrian[];
  /** Indeks tekuće faze semafora i koliko je u njoj proteklo. */
  phaseIndex: number;
  phaseT: number;
  events: SimEvent[];
  violations: Violation[];
  outcome: Outcome;
  /** Koliko dugo igrač stoji na slobodnom putu [s] — za `obstruction`. */
  idleT: number;
  /** Da li je žuto počelo dok je igrač bio dovoljno blizu da nastavi. */
  yellowCommitted: boolean;
  /**
   * Svaka promjena pokazivača igrača, sa trenutkom i mjestom na putanji.
   *
   * Pamti se i `s`, ne samo `t`: pravila pokazivača su vezana za mjesto na
   * putanji („prije stop-linije", „poslije izlaza"), a ne za vrijeme, pa bi
   * računanje unazad iz vremena bilo izvedeno i lomljivo.
   */
  indicatorLog: IndicatorEvent[];
  /** Faze pokazivača koje su već ocijenjene — svaka se ocjenjuje jednom. */
  indicatorDone: string[];
  /** Indeksi već okinutih problematičnih događaja. */
  hazardsFired: number[];
  /** Tajmeri za prekršaje na autoputu koji traju u vremenu. */
  highway: { tooSlowT: number; tailgateT: number; shoulderT: number };
  /**
   * Mjerenje reakcije: kad je događaj postao vidljiv i kad je igrač prvi put
   * zakočio poslije toga. `null` znači da još nije zakočio.
   */
  reaction: { at: number; kind: HazardKind; brakedAt: number | null }[];
}

export interface IndicatorEvent {
  t: number;
  s: number;
  indicator: "left" | "right" | null;
}

export interface Input {
  throttle: number;
  brake: number;
  /** Pokazivač pravca. `null` je isključen. */
  indicator: "left" | "right" | null;
  /**
   * Zahtjev za promjenu trake, samo na autoputu.
   *
   * Nije stanje nego namjera u tom kadru: simulacija je prihvati ili odbije, pa
   * je vozilo ili počelo prelazak ili nije. Držanje dugmeta ne mijenja ništa
   * dok prelazak traje.
   */
  changeLane?: "left" | "right" | null;
}
