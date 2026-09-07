import type { Dict } from "./i18n";

/**
 * Model scene i rule-engine za prvenstvo prolaza.
 *
 * Engine je namjerno konzervativan: kad situacija nije jednoznačna, vraća `null`
 * umjesto da pogodi. Zahvaljujući tome se autorski `answer` može provjeriti
 * testom — ako engine i autor ne daju isto, test pada.
 */

export type Approach = "N" | "E" | "S" | "W";
export type Intent = "straight" | "left" | "right";
export type VehicleKind = "car" | "van";
export type SignKind = "priority" | "yield" | "stop";
export type LightKind = "red" | "yellow" | "green";
export type Layout = "cross" | "roundabout";

export type Family = "pravilo" | "znaci" | "semafor" | "ljevak" | "kruzni" | "pjesaci";

export interface ApproachSetup {
  sign?: SignKind;
  light?: LightKind;
}

export interface DrawnVehicle {
  /** Broj kojim je vozilo označeno u sceni. */
  id: number;
  /**
   * Gdje se vozilo nalazi. Na krstastoj raskrsnici je to prilaz sa kojeg dolazi;
   * u kružnom toku je to krak na čijoj je visini (ako je već u prstenu) ili krak
   * sa kojeg ulazi.
   */
  approach: Approach;
  /** Namjera kretanja. U kružnom toku se ne koristi — tamo putanju daje `exit`. */
  intent: Intent;
  kind: VehicleKind;
  /** Kružni tok: vozilo se već kreće kroz prsten (ima prvenstvo nad onima koji ulaze). */
  inRoundabout?: boolean;
  /** Kružni tok: krak na kojem vozilo izlazi iz prstena. */
  exit?: Approach;
}

export interface Pedestrian {
  /** Pješak prelazi kolovoz na tom prilazu. */
  crossing: Approach;
}

export interface DrawnScenario {
  id: string;
  family: Family;
  layout: Layout;
  approaches?: Partial<Record<Approach, ApproachSetup>>;
  vehicles: DrawnVehicle[];
  pedestrians?: Pedestrian[];
  /**
   * Scenariji redoslijeda: tačan redoslijed prolaska (id-jevi). Vozila koja ne
   * prolaze (crveno svjetlo) se ne navode.
   */
  answer?: number[];
  /**
   * Scenariji odluke: kandidat odgovara „Prolazim" ili „Propuštam" za svoje
   * vozilo. Koristi se kad redoslijed nije poenta (kružni tok, pješaci).
   */
  decision?: { vehicleId: number; answer: "go" | "yield" };
  /** Ključevi pravila koja se ispisuju uz rješenje. */
  rules: (keyof Dict)[];
}

/** Vozilo ustupa prvenstvo vozilu sa svoje desne strane; desna vožnja. */
export const YIELDS_TO: Readonly<Record<Approach, Approach>> = {
  N: "W",
  W: "S",
  S: "E",
  E: "N",
};

/** Suprotan (susretni) krak. */
export const OPPOSITE: Readonly<Record<Approach, Approach>> = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

/**
 * Na koji krak vozilo izlazi. Desno je isti krak kojem se ustupa prvenstvo
 * (`YIELDS_TO`), pravo je suprotni, a lijevo je suprotno od desnog.
 */
export function exitOf(approach: Approach, intent: Intent): Approach {
  if (intent === "straight") return OPPOSITE[approach];
  if (intent === "right") return YIELDS_TO[approach];
  return OPPOSITE[YIELDS_TO[approach]];
}

/**
 * Redoslijed krakova u kružnom toku, suprotno od kazaljke na satu.
 * Desna vožnja: ulazi se skretanjem udesno, ostrvo ostaje s lijeve strane,
 * pa se kruži N → W → S → E → N.
 */
export const RING_ORDER: readonly Approach[] = ["N", "W", "S", "E"] as const;

function ringIndex(a: Approach): number {
  return RING_ORDER.indexOf(a);
}

/** Koliko krakova vozilo pređe idući od `from` do `to` suprotno kazaljci. */
export function ringSteps(from: Approach, to: Approach): number {
  const steps = (ringIndex(to) - ringIndex(from) + 4) % 4;
  return steps === 0 ? 4 : steps; // isti krak = puni krug
}

/**
 * Da li vozilo koje u prstenu ide od `from` do izlaza `to` prelazi preko kraka
 * `leg` — dakle presijeca putanju vozila koje na tom kraku ulazi.
 *
 * Bitno je da NIJE dovoljno reći „svako vozilo u prstenu ima prvenstvo": vozilo
 * koje izlazi prije mog kraka mi ne prelazi put. Zato se gleda stvarni luk.
 */
export function ringArcPasses(from: Approach, to: Approach, leg: Approach): boolean {
  if (from === leg) return true; // već je na mom ulazu
  const total = ringSteps(from, to);
  const upToLeg = (ringIndex(leg) - ringIndex(from) + 4) % 4;
  return upToLeg <= total;
}

/**
 * Regulacija kraka svedena na jedan pojam, nezavisno od toga ko pita.
 *
 * Postoje dva korisnika ovih pravila: statični simulator (`DrawnScenario`) i
 * igra „Prođi raskrsnicu" (`IntersectionTemplate`). Modeli su im različiti, ali
 * pravila prvenstva su ista, pa se oba svode na ovaj tip i zovu `whoYields`.
 */
export type EffectiveControl =
  | "priority"
  | "yield"
  | "stop"
  | "none"
  | "green"
  | "yellow"
  | "red";

/** Jedna strana u poređenju prvenstva. */
export interface YieldParty {
  approach: Approach;
  intent: Intent;
  control: EffectiveControl;
  /**
   * Vozilo pod pratnjom ili sa pravom prvenstva (rotacija i sirena).
   *
   * Nije vrsta regulacije kraka nego osobina vozila, pa stoji ovdje, a ne u
   * `EffectiveControl`: isti krak u istom trenutku može imati i obično vozilo
   * i vozilo pod pratnjom, i ona se ne sude isto.
   */
  emergency?: boolean;
  /**
   * Vozilo je već u prstenu kružnog toka.
   *
   * Kao i `emergency`, ovo nije regulacija kraka nego stanje vozila: isti krak
   * u istom trenutku ima i vozilo koje ulazi i vozilo koje kruži, a ne sude se
   * isto. Statični simulator istu razliku već pravi kroz `inRoundabout`.
   */
  inRing?: boolean;
}

/**
 * Nivo prvenstva: manji broj = ide ranije. `null` znači da vozilo uopšte ne
 * prolazi (crveno ili žuto svjetlo).
 *
 * Hijerarhija (od jače ka slabijoj): semafor → znaci → nema regulacije.
 * `yield` i `stop` su NAMJERNO isti nivo — razlikuju se po ponašanju (STOP traži
 * potpuno zaustavljanje), ne po prvenstvu.
 */
export function priorityTier(control: EffectiveControl): number | null {
  switch (control) {
    case "green":
      return 0;
    case "red":
    case "yellow":
      return null;
    case "priority":
      return 0;
    case "yield":
    case "stop":
      return 1;
    case "none":
      return 0;
  }
}

/**
 * Ko od dvojice ustupa prvenstvo. Vraća `"a"`, `"b"`, ili `null` kad se putanje
 * ne sudaraju po pravilima (npr. oba skreću lijevo iz suprotnih krakova).
 *
 * Ovo je jedina tačka u kojoj se odlučuje o prvenstvu — i `solveOrder` i NPC
 * logika u igri je zovu, da pravila ne mogu da se raziđu na dva mjesta.
 */
export function whoYields(a: YieldParty, b: YieldParty): "a" | "b" | null {
  // Vozilo pod pratnjom ima prvenstvo nad svima, bez obzira na znakove i
  // semafor — zato se provjerava prije nivoa regulacije, a ne unutar njega.
  if (Boolean(a.emergency) !== Boolean(b.emergency)) return a.emergency ? "b" : "a";

  // Vozilo u prstenu ima prvenstvo nad onim koje ulazi. Znak na ulazu (trougao
  // ili STOP) mijenja PONAŠANJE pri ulasku, ne redosljed — zato i ovo ide prije
  // nivoa regulacije.
  if (Boolean(a.inRing) !== Boolean(b.inRing)) return a.inRing ? "b" : "a";

  const ta = priorityTier(a.control);
  const tb = priorityTier(b.control);

  // Vozilo koje uopšte ne prolazi (crveno) ustupa svakome ko prolazi.
  if (ta === null && tb === null) return null;
  if (ta === null) return "a";
  if (tb === null) return "b";

  if (ta !== tb) return ta > tb ? "a" : "b";

  // Isti nivo — odlučuju pravilo desne strane pa ljevak.
  if (YIELDS_TO[a.approach] === b.approach) return "a";
  if (YIELDS_TO[b.approach] === a.approach) return "b";

  if (a.intent === "left" && b.approach === OPPOSITE[a.approach] && b.intent !== "left") {
    return "a";
  }
  if (b.intent === "left" && a.approach === OPPOSITE[b.approach] && a.intent !== "left") {
    return "b";
  }

  return null;
}

/**
 * Nivo prvenstva vozila u sceni statičnog simulatora.
 * Tanak omotač oko `priorityTier` — vidi tamo.
 */
function controlOf(scenario: DrawnScenario, v: DrawnVehicle): EffectiveControl {
  const setup = scenario.approaches?.[v.approach];
  if (setup?.light) return setup.light; // semafor poništava znakove
  if (setup?.sign) return setup.sign;
  return "none";
}

function tierOf(scenario: DrawnScenario, v: DrawnVehicle): number | null {
  if (scenario.layout === "roundabout") {
    // U kružnom toku prvenstvo ima vozilo koje se već kreće kroz tok.
    return v.inRoundabout ? 0 : 1;
  }
  return priorityTier(controlOf(scenario, v));
}

/**
 * Računa redoslijed prolaska.
 *
 * Vraća `null` kad rezultat nije jednoznačan, i to namjerno u ovim slučajevima:
 *  - naredba policijskog službenika (semantika znakova rukama nije podržana),
 *  - u nekom koraku je više vozila slobodno (više valjanih redoslijeda),
 *  - zaglavljeni krug („bešavna petlja" — sva četiri kraka zauzeta).
 */
export function solveOrder(scenario: DrawnScenario): number[] | null {
  const passing = scenario.vehicles.filter((v) => tierOf(scenario, v) !== null);
  if (passing.length === 0) return null;

  const tier = new Map<number, number>();
  for (const v of passing) tier.set(v.id, tierOf(scenario, v) as number);

  const byApproach = new Map<Approach, DrawnVehicle>();
  for (const v of passing) byApproach.set(v.approach, v);

  const remaining = new Set(passing.map((v) => v.id));
  const order: number[] = [];

  /**
   * Kome `v` mora da ustupi, a da taj još nije prošao.
   *
   * Pravila se NE ponavljaju ovdje — sva odluka je u `whoYields`, da statični
   * simulator i igra ne mogu da se raziđu.
   */
  const party = (v: DrawnVehicle): YieldParty => ({
    approach: v.approach,
    intent: v.intent,
    control: controlOf(scenario, v),
  });

  const blockers = (v: DrawnVehicle): number[] => {
    const out: number[] = [];
    for (const o of passing) {
      if (o.id === v.id || !remaining.has(o.id)) continue;
      if (whoYields(party(v), party(o)) === "a") out.push(o.id);
    }
    return out;
  };
  void byApproach;

  while (remaining.size > 0) {
    const free = passing.filter((v) => remaining.has(v.id) && blockers(v).length === 0);
    if (free.length === 0) return null; // zaglavljeni krug
    if (free.length > 1) return null; // više valjanih redoslijeda — nije za vježbu
    const next = free[0] as DrawnVehicle;
    order.push(next.id);
    remaining.delete(next.id);
  }

  return order;
}

/**
 * Provjerava scenarij odluke: da li „moje" vozilo smije da prođe prvo.
 * Vraća `null` ako se ne može odrediti.
 */
export function solveDecision(scenario: DrawnScenario): "go" | "yield" | null {
  const mine = scenario.decision
    ? scenario.vehicles.find((v) => v.id === scenario.decision?.vehicleId)
    : undefined;
  if (!mine) return null;

  // Pješak na prelazu kojim vozilo prolazi ima prvenstvo — i na ulazu u
  // raskrsnicu (svoj krak) i na izlazu (krak na koji se izlazi).
  const exit = exitOf(mine.approach, mine.intent);
  const pedOnPath = scenario.pedestrians?.some(
    (p) => p.crossing === mine.approach || p.crossing === exit,
  );
  if (pedOnPath) return "yield";

  if (scenario.layout === "roundabout") {
    if (mine.inRoundabout) return "go"; // već u prstenu — ima prvenstvo

    // Ulazak: propušta se vozilo u prstenu čiji luk prelazi preko mog kraka.
    // Vozilo koje izlazi prije mog ulaza mi ne prelazi put.
    const conflict = scenario.vehicles.some((v) => {
      if (v.id === mine.id || !v.inRoundabout) return false;
      const to = v.exit;
      if (!to) return true; // izlaz nepoznat — konzervativno se propušta
      return ringArcPasses(v.approach, to, mine.approach);
    });
    return conflict ? "yield" : "go";
  }

  const order = solveOrder(scenario);
  if (!order) return null;
  return order[0] === mine.id ? "go" : "yield";
}

export function isOrderCorrect(
  scenario: DrawnScenario,
  picked: readonly number[],
): boolean {
  const answer = scenario.answer;
  if (!answer) return false;
  return picked.length === answer.length && picked.every((v, i) => v === answer[i]);
}
