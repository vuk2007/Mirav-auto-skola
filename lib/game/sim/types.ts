/**
 * Model igre „Prođi raskrsnicu".
 *
 * `Approach` i `Intent` se NE definišu ovdje — dolaze iz `lib/simRules.ts`, koji
 * je već model raskrsnice za statični simulator. Igra i simulator dijele pojmove
 * i pravila prvenstva; razlikuju se samo po tome što igra ima vrijeme.
 */

import type { Approach, Intent } from "@/lib/simRules";

export type ArmId = Approach;
export type { Intent };

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
}

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
  /** `s` na kojem putanja ulazi u tijelo raskrsnice i na kojem ga napušta. */
  boxEnterS: number;
  boxExitS: number;
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

export interface Scenario {
  id: string;
  intersection: string;
  player: { arm: ArmId; intent: Intent; spawnDistance: number };
  npcs: ScenarioNpc[];
  pedestrians?: ScenarioPedestrian[];
  officer?: ScenarioOfficer;
  lightStartPhase?: number;
  /**
   * Koliko je već proteklo u početnoj fazi semafora [s].
   *
   * Bez ovoga scenario može da počne samo na početku faze, pa se „žuto te
   * zateklo na prilazu" ne može ni napraviti: zeleno traje dvanaest sekundi, a
   * igrač do linije stigne za sedam.
   */
  lightStartT?: number;
  difficulty: 1 | 2 | 3;
  vMax?: number;
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
  | "officer";

export interface Violation {
  type: ViolationType;
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
}

export type SimEvent =
  | { type: "forcedBrake"; t: number; vehicleId: string; by: string }
  | { type: "spawn"; t: number; vehicleId: string }
  | { type: "exit"; t: number; vehicleId: string };

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
}

export interface Input {
  throttle: number;
  brake: number;
}
