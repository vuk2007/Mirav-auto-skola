/**
 * Jezgro simulacije: fiksni korak, fizika, NPC logika, prekršaji.
 *
 * FIKSNI KORAK (60 Hz) je uslov, ne stil. Bez njega ista igra na 144 Hz ekranu
 * i na 60 Hz ekranu daje različit ishod, pa ni snimak ni test ne znače ništa.
 * Render interpolira između koraka; simulacija ne zna za `requestAnimationFrame`.
 *
 * Stanje je običan objekat. Nema React-a, nema klasa, nema skrivenih referenci —
 * `structuredClone(world)` je valjan snimak za ponavljanje.
 */

import {
  A_MAX,
  B_MAX,
  CAR_LENGTH,
  CAR_WIDTH,
  CLEAR_TIME,
  CRAWL_SPEED,
  DRAG_COEFF,
  DT,
  FOLLOW_GAP,
  DIFFICULTY,
  GAP,
  HIGHWAY_BRAKE,
  HARD_SHOULDER_TIME,
  HIGHWAY_DRAG,
  HIGHWAY_FOLLOW_TIME,
  HIGHWAY_V_TOP,
  INDICATOR_LEAD_TIME,
  LANE_CHANGE_TIME,
  MERGE_AHEAD_TIME,
  MERGE_GAP_TIME,
  RAMP_STOP_SPEED,
  TAILGATE_GAP,
  TAILGATE_SPEED,
  TAILGATE_TIME,
  TOO_SLOW_TIME,
  HAZARD_WINDOW,
  KEEP_BEHIND,
  LOAD_AHEAD,
  MAX_SCENARIO_SECONDS,
  ROLL_RESISTANCE,
  SPEEDING_FACTOR,
  STOPPED_SPEED,
  STOP_DWELL,
  STOP_HOLD,
  STOP_MARGIN,
  STOP_ZONE,
  type DifficultyParams,
  ROAD_V_TOP,
  TRIP_SEGMENT_TIME,
  TRIP_SEGMENT_TIMEOUT_FACTOR,
  V_MAX_DEFAULT,
  V_TOP,
  YELLOW_COMMIT_TTC,
  LANE_WIDTH,
  LAT_SPEED_FAST,
  LAT_SPEED_SLOW,
  LAT_SPEED_V_FAST,
  LAT_SPEED_V_SLOW,
  DECISION_HOLD,
  DECISION_LEAD,
  DECISION_STEER,
  INDICATOR_LEAD,
  LANE_COMMIT,
  LINE_CROSS_TOL,
  CUT_IN_TIME,
  CUT_IN_WINDOW,
  MAX_OVERTAKE_TIME,
  ONCOMING_TTC,
  PRETEKNUT_POJAS,
  OFF_ROAD_FAIL_SPEED,
  OFF_ROAD_FAIL_TIME,
  OFF_ROAD_MARGIN,
  SHOULDER_WIDTH,
  STEER_DEAD_ZONE,
  AUTO_INDICATOR_HOLD,
  DIO_TIJELA,
  VOZILA,
  KAMION_ISPRED,
  USPORENJE_OGRANICENJE,
  KOLONA_ODSTOJANJE,
  OZNAKA_DOMET_PUT,
  SAOBRACAJ_MANJAK,
  SAOBRACAJ_POPRAVKA,
  SAOBRACAJ_PROZOR,
  SAOBRACAJ_U_PROZORU,
  SAOBRACAJ_VISAK,
  UBACI_ISPRED,
  type Level,
} from "./config";
import { headingAt, pointAt, polygonsOverlap, rectCorners, right, rng, valueAt } from "./geometry";
import { zabranjeno } from "../road/zabrane";
import {
  izvlacenje,
  izvuci,
  najmanjeOgranicenje,
  srednjiRazmak,
  tipicnaBrzina,
  type IzvucenoVozilo,
} from "./tok";
import {
  compile,
  crosswalkSpans,
  lightFor,
  pedestrianOnRoad,
  pedestrianSpan,
  registerTemplate,
  templateById,
  TEMPLATES,
} from "./intersection";
import { expectedIndicatorAt, phasesFor } from "./indicatorRules";
import {
  lanePathId,
  lateralX,
  occupiedLanes,
  onExitLane,
  onRamp,
  shareLane,
} from "./highway";
import { exitCountsFor, ringAngleAt, ringGap, ringSNaUglu, ringUAt } from "./roundabout";
import type {
  ArmId,
  ConflictPoint,
  Control,
  IndicatorEvent,
  Input,
  Intent,
  IzvorToka,
  TokSaobracaja,
  CrossIntent,
  Path,
  Pedestrian,
  RoadTemplate,
  RoundaboutTemplate,
  Point,
  Scenario,
  HighwayTemplate,
  ScenarioHazard,
  ScenarioOfficer,
  Severity,
  Template,
  Vehicle,
  Violation,
  World,
} from "./types";
import { bezKrakova, crossIntent } from "./types";
import { whoYields, type EffectiveControl, type YieldParty } from "@/lib/simRules";

export const PLAYER_ID = "player";

/**
 * Veza prekršaja i stavke iz kataloga kazni (`data/kazne.json`).
 *
 * Izvezeno zbog testa: pogrešan slug se ne primijeti nikako drugačije — kartica
 * kazne bi jednostavno ostala prazna i onda kad instruktorka kaznu potvrdi.
 */
export const PENALTY_REF: Readonly<Record<Violation["type"], string | null>> = {
  rightOfWay: "prvenstvo",
  stopSign: "signalizacija",
  redLight: "crveno",
  collision: "nezgoda",
  obstruction: "ometanje-vozaca",
  speeding: null, // stepenovano po brzini — bira se tek kad kazne budu potvrđene
  pedestrian: "pjesacki-prelaz",
  officer: "policija",
  // Propust oko pokazivača spada pod nepropisno skretanje — najbliža stavka u
  // katalogu. Kad instruktorka potvrdi tačan član, mijenja se ovdje.
  indicatorMissing: "skretanje",
  indicatorWrong: "skretanje",
  indicatorLate: "skretanje",
  indicatorLeftOn: "skretanje",
  // Autoput: najbliže stavke iz kataloga. Kad instruktorka potvrdi tačne
  // članove, mijenja se ovdje.
  unsafeMerge: "preticanje",
  stoppedOnRamp: "autoput",
  hardShoulder: "autoput",
  tooSlow: "autoput",
  tailgating: "autoput",
  brakingOnHighway: "autoput",
  // Izlazak sa kolovoza: najbliža stavka u katalogu je kretanje desnom stranom
  // kolovoza. Kad instruktorka potvrdi tačan član, mijenja se ovdje.
  offRoad: "desna-strana",
  // Preticanje: najbliže stavke u katalogu. Kad instruktorka potvrdi tačne
  // članove, mijenja se ovdje.
  crossingSolidLine: "signalizacija",
  unsafeOvertake: "preticanje-opasno",
  overtakeTooLong: "preticanje",
  cutIn: "preticanje",
};

/** Ključ manevra u id-u putanje. Kružni tok i autoput dodaju svoje oblike. */
export function intentKey(intent: Intent): string {
  if (typeof intent === "string") return intent;
  return intent.kind === "exit" ? `exit${intent.n}` : `lane${intent.index}`;
}

/** Da li vožnja pada. `minor` prekršaji se prijave, ali vožnju ne obaraju. */
export function hasFail(world: World): boolean {
  return world.violations.some((v) => v.severity === "fail");
}

// ── pomoćne ────────────────────────────────────────────────────────────────

function controlToEffective(
  control: Control,
  tpl: Template,
  phaseIndex: number,
): EffectiveControl {
  switch (control.kind) {
    case "light":
      return lightFor(tpl, phaseIndex, control.phaseGroup);
    case "officer":
      // Znaci policajca nijesu podržani u engine-u — vidi lib/simRules.ts.
      return "none";
    default:
      return control.kind;
  }
}

/**
 * Regulacija kraka, uz naredbu policajca ako je ima.
 *
 * Policajac poništava i znak i semafor — zato se provjerava prvi i zato se
 * `tpl` uopšte ne gleda kad je prisutan. Semafor i dalje radi svoj program i
 * dalje se crta; samo prestaje da odlučuje.
 */
function armControl(ctx: Regulacija, armId: ArmId, phaseIndex: number): EffectiveControl {
  if (ctx.officerAllow) return ctx.officerAllow.includes(armId) ? "green" : "red";
  // Ni autoput ni otvoren put nemaju regulisane krakove — tamo prvenstvo
  // uopšte ne odlučuje.
  if (bezKrakova(ctx.tpl)) return "none";
  const a = ctx.tpl.arms.find((x) => x.id === armId);
  return a ? controlToEffective(a.control, ctx.tpl, phaseIndex) : "none";
}

/** Ono što je za odluku o prvenstvu dovoljno znati o raskrsnici. */
interface Regulacija {
  tpl: Template;
  /** Krakovi koje policajac trenutno propušta; `null` kad policajca nema. */
  officerAllow: ArmId[] | null;
}

function party(ctx: Ctx, v: Vehicle, phaseIndex: number): YieldParty {
  const path = ctx.paths.get(v.pathId);
  return {
    approach: v.arm,
    // Kružni tok se ne opisuje manevrom nego time da li je vozilo već u prstenu;
    // manevar se zato svodi na „pravo" i ne učestvuje u odluci.
    intent: crossIntent(v.intent) ?? "straight",
    control: armControl(ctx, v.arm, phaseIndex),
    emergency: v.emergency,
    inRing: path ? ringAngleAt(path, v.s) !== null : false,
  };
}

/**
 * Koje krakove policajac propušta u trenutku `t`.
 *
 * Čista funkcija vremena: naredba se ponavlja ciklično i ne pamti se u stanju
 * svijeta. Zato snimak i ponavljanje ne moraju da nose nijedno dodatno polje.
 */
export function officerAllow(officer: ScenarioOfficer | undefined, t: number): ArmId[] | null {
  if (!officer || officer.phases.length === 0) return null;
  const ciklus = officer.phases.reduce((a, f) => a + f.duration, 0);
  if (ciklus <= 0) return officer.phases[0]!.allow;
  let x = t % ciklus;
  for (const faza of officer.phases) {
    if (x < faza.duration) return faza.allow;
    x -= faza.duration;
  }
  return officer.phases[officer.phases.length - 1]!.allow;
}

/**
 * Gdje je vozilo u svijetu.
 *
 * Na autoputu se bočni položaj ne čita iz putanje nego iz trake: putanja je
 * osa ciljne trake, a vozilo se u toku prelaska nalazi između dvije.
 */
export function poseOn(
  tpl: Template,
  path: Path,
  v: Vehicle,
): { pos: Point; heading: Point } {
  if (tpl.kind === "highway") {
    return {
      pos: { x: lateralX(v.lane ?? 0, v.laneFrom, v.laneT ?? 1), y: v.s },
      heading: { x: 0, y: 1 },
    };
  }
  // Na otvorenom putu je svaka traka svoja putanja i ona je kriva, pa se
  // položaj čita iz nje. Uz to dolazi poprečni pomak: sa volanom vozilo više
  // ne stoji na osi trake nego gdje ga vozač drži.
  const pos = pointAt(path.points, path.cum, v.s);
  const heading = headingAt(path.points, path.cum, v.s);
  const lat = v.lateral ?? 0;
  if (lat === 0) return { pos, heading };
  const d = right(heading);
  return { pos: { x: pos.x + d.x * lat, y: pos.y + d.y * lat }, heading };
}

/** Komad tijela vozila: pravougaonik sa središtem, smjerom i mjerama [m]. */
export interface DioTijela {
  pos: Point;
  heading: Point;
  length: number;
  width: number;
}

/**
 * Tijelo vozila kao niz pravougaonika duž njegove putanje, od zadnjeg ka
 * prednjem.
 *
 * Putnički auto i kombi su jedan pravougaonik, kao i do sada. Duže vozilo se
 * dijeli na jednake komade od najviše `DIO_TIJELA` metara, i svaki stoji na
 * svojoj tački putanje, sa smjerom putanje u toj tački. Tako kamion u krivini
 * prati svoju traku, a ne izlazi krajevima preko linije — vidi `DIO_TIJELA`.
 *
 * Isto tijelo se i sudara i crta: da se crta jedno a sudara drugo, igrač bi
 * udario u kamion kojeg na ekranu nema, ili prošao kroz onoga koji tu jeste.
 */
export function tijeloVozila(tpl: Template, path: Path, v: Vehicle): DioTijela[] {
  const komada = Math.max(1, Math.ceil(v.length / DIO_TIJELA));
  if (komada === 1) {
    const { pos, heading } = poseOn(tpl, path, v);
    return [{ pos, heading, length: v.length, width: v.width }];
  }
  const dio = v.length / komada;
  const out: DioTijela[] = [];
  for (let i = 0; i < komada; i++) {
    const { pos, heading } = poseOn(tpl, path, { ...v, s: v.s - v.length / 2 + dio * (i + 0.5) });
    out.push({ pos, heading, length: dio, width: v.width });
  }
  return out;
}

/**
 * Dokle vozilo smije poprečno, mjereno od ose svoje trake [m].
 *
 * Granice dolaze iz geometrije same putanje (`doIvice`, `doSredine`), dakle iz
 * istog računa kojim se crta asfalt. Udesno se staje na kraju bankine — nema
 * slijetanja, auto se zaustavi i to je kraj. Ulijevo se za sada staje na
 * razdjelnoj liniji: prelazak u kontra traku dolazi sa preticanjem.
 */
export function bocneGranice(path: Path, s: number): { lijevo: number; desno: number } {
  const pola = CAR_WIDTH / 2;
  // Ulijevo se ide do spoljne ivice susretne trake: puna linija se PRELAZI, ne
  // odbija. Zabrana je pravilo i prijavljuje se, a ne zid — vozilo koje bi se
  // zaustavilo na liniji bilo bi opasnije od onoga koje je pređe.
  const preko = path.doPreko ? doLinije(path, path.doPreko, s) : doLinije(path, path.doSredine, s);
  return {
    lijevo: -Math.max(0, preko - pola),
    desno: Math.max(0, doLinije(path, path.doIvice, s) + SHOULDER_WIDTH - pola),
  };
}

/**
 * Koje trake vozilo zauzima na otvorenom putu.
 *
 * Ne pita se `lane` nego TIJELO: vozilo koje je pola auta preko razdjelne
 * linije jeste u obje trake, i tako se prema njemu i ponaša ostali saobraćaj.
 * Bez ovoga bi kolona iza nas kočila i dok smo u kontra traci, jer bi po
 * `pathId`-u i dalje bila iza nas u istoj traci.
 */
export function trakeNaPutu(path: Path, v: Vehicle): number[] {
  const svoja = v.lane ?? 0;
  const druga = svoja === 1 ? 0 : 1;
  const lat = v.lateral ?? 0;
  if (lat === 0) return [svoja];
  const pola = CAR_WIDTH / 2;
  const doSredine = doLinije(path, path.doSredine, v.s);
  const doIvice = doLinije(path, path.doIvice, v.s);
  const preko = path.doPreko ? doLinije(path, path.doPreko, v.s) : doSredine;
  const lijevoTijelo = lat - pola;
  const desnoTijelo = lat + pola;

  const out: number[] = [];
  if (desnoTijelo > -doSredine + LINE_CROSS_TOL && lijevoTijelo < doIvice) out.push(svoja);
  if (lijevoTijelo < -doSredine - LINE_CROSS_TOL && desnoTijelo > -preko) out.push(druga);
  return out.length > 0 ? out : [svoja];
}

/** Položaj vozila mjeren duž RUTE, bez obzira na to kojom trakom ide. */
function naRuti(v: Vehicle, path: Path): number {
  return v.lane === 1 ? path.length - v.s : v.s;
}

/**
 * Koliko ima od ose trake do date linije na mjestu `s` [m].
 *
 * Nikad manje od pola auta uvećanog za `OFF_ROAD_MARGIN` — vidi tamo zašto.
 */
function doLinije(path: Path, niz: readonly number[] | undefined, s: number): number {
  const mjereno = niz ? valueAt(path.cum, niz, s) : LANE_WIDTH / 2;
  return Math.max(mjereno, CAR_WIDTH / 2 + OFF_ROAD_MARGIN);
}

/**
 * Bočna brzina pri punom volanu [m/s].
 *
 * Raste sa brzinom: na deset na sat se volan okreće mnogo a auto se pomjeri
 * malo, na osamdeset je obrnuto.
 */
export function bocnaBrzina(v: number): number {
  const t = (v - LAT_SPEED_V_SLOW) / (LAT_SPEED_V_FAST - LAT_SPEED_V_SLOW);
  const k = Math.min(1, Math.max(0, t));
  return LAT_SPEED_SLOW + (LAT_SPEED_FAST - LAT_SPEED_SLOW) * k;
}

/**
 * Jedan korak volana.
 *
 * Auto se NE vraća sam na sredinu trake — drži ga vozač. Zato ovdje nema
 * nikakvog centriranja: `lateral` se mijenja samo onoliko koliko volan kaže, i
 * ostaje gdje jeste kad se volan pusti.
 */
function volanKorak(v: Vehicle, path: Path, input: Input): void {
  const steer = input.steer ?? 0;
  const komanda = Math.abs(steer) < STEER_DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, steer));
  const g = bocneGranice(path, v.s);
  const lat = (v.lateral ?? 0) + komanda * bocnaBrzina(v.v) * DT;
  const stegnuto = Math.min(g.desno, Math.max(g.lijevo, lat));
  v.lateralV = (stegnuto - (v.lateral ?? 0)) / DT;
  v.lateral = stegnuto;

  // Koliko se drži namjera da se pređe u susjednu traku. Prelazak dolazi u
  // sljedećoj stavci; brojač postoji već sada, jer po istoj granici se sudi i
  // kada vozilo počinje da zauzima dvije trake.
  const prag = LANE_COMMIT * doLinije(path, path.doIvice, v.s);
  const drzi = komanda !== 0 && Math.abs(stegnuto) > prag && Math.sign(stegnuto) === Math.sign(komanda);
  v.lateralHeldT = drzi ? (v.lateralHeldT ?? 0) + DT : 0;
}

/** Upiši stanje pokazivača igrača; dnevnik dobija unos samo kad se promijeni. */
function postaviPokazivac(world: World, v: Vehicle, zeljeni: "left" | "right" | null): void {
  if (v.indicator === zeljeni) return;
  v.indicator = zeljeni;
  world.indicatorLog.push({ t: world.t, s: v.s, indicator: zeljeni });
}

/**
 * Pokazivač koji pali simulacija (`Scenario.pokazivaci === "auto"`).
 *
 * Na raskrsnici i u kružnom toku to je `expectedIndicatorAt` — ista funkcija po
 * kojoj se sudi i po kojoj vozi savršeni vozač, pa se tajming ne može razlikovati
 * od traženog. Pravac se zaključava tačno tamo gdje počinje faza najave, pa se
 * pokazivač pali u istom koraku u kojem je izbor postao konačan.
 *
 * Na otvorenom putu tabela nema faza — tamo pokazivač ide uz prelazak razdjelne
 * linije, vidi `pokazivacNaPutu`.
 */
function autoPokazivac(
  world: World,
  ctx: Ctx,
  scenario: Scenario,
  v: Vehicle,
  path: Path,
  input: Input,
): "left" | "right" | null {
  if (ctx.tpl.kind === "road") {
    return v.lateral === undefined ? null : pokazivacNaPutu(world, v, path, input);
  }
  return expectedIndicatorAt(path, v.intent, v.s, scenario.indicatorRules);
}

/**
 * Automatski pokazivač pri prelasku razdjelne linije.
 *
 * Simulacija ne zna šta vozač namjerava dok ne okrene volan, pa pokazivač pali
 * onda kad volan to otkrije: kad bi, ovom bočnom brzinom, sredina vozila prešla
 * liniju za `INDICATOR_LEAD_TIME` ili manje. To je isti rok koji se u ručnom
 * režimu traži od vozača, samo izmjeren unaprijed. Ko okrene volan naglo, dobije
 * pokazivač kasnije nego što bi ga upalio sam — prije pokreta ga niko ne može
 * upaliti umjesto njega.
 *
 * Gasi se kad je manevar gotov (vozilo je cijelo u traci u koju je prelazilo),
 * kad se vozač predomisli i krene nazad, i kad `AUTO_INDICATOR_HOLD` sekundi
 * stoji uz liniju a ne prelazi je.
 */
function pokazivacNaPutu(
  world: World,
  v: Vehicle,
  path: Path,
  input: Input,
): "left" | "right" | null {
  const steer = input.steer ?? 0;
  const komanda = Math.abs(steer) < STEER_DEAD_ZONE ? 0 : steer;
  const vLat = v.lateralV ?? 0;
  const lat = v.lateral ?? 0;
  const doSredine = doLinije(path, path.doSredine, v.s);
  const kretanjeKa = (strana: "left" | "right"): boolean =>
    strana === "left" ? komanda < 0 && vLat < 0 : komanda > 0 && vLat > 0;

  // Sredina vozila je već u suprotnoj traci: prelazak koji može da slijedi je
  // povratak udesno.
  const preko = lat < -doSredine;
  const ka = preko ? "right" : "left";
  const doLinijeM = preko ? -doSredine - lat : doSredine + lat;
  const krece = kretanjeKa(ka) && doLinijeM / Math.abs(vLat) <= INDICATOR_LEAD_TIME;

  const svoja = v.lane ?? 0;
  const druga = svoja === 1 ? 0 : 1;
  const zauzete = trakeNaPutu(path, v);
  const cijeloU = (traka: number) => zauzete.length === 1 && zauzete[0] === traka;

  const sada = world.volan.autoStrana;
  let sljedeca = sada;
  if (sada === null) {
    if (krece) sljedeca = ka;
  } else {
    const nazad = sada === "left" ? "right" : "left";
    if (cijeloU(sada === "left" ? druga : svoja)) {
      // Manevar je gotov.
      sljedeca = null;
    } else if (kretanjeKa(nazad)) {
      // Predomislio se. Ako je sredina već preko linije, to je novi prelazak
      // nazad; ako nije, prelaska nije ni bilo.
      sljedeca = krece && ka === nazad ? nazad : null;
    } else if (kretanjeKa(sada)) {
      world.volan.autoT = 0;
    } else {
      // Stoji uz liniju: pokazivač još kratko ostaje, pa se gasi.
      world.volan.autoT += DT;
      if (world.volan.autoT >= AUTO_INDICATOR_HOLD) sljedeca = null;
    }
  }
  if (sljedeca !== sada) world.volan.autoT = 0;
  world.volan.autoStrana = sljedeca;
  return sljedeca;
}

/**
 * Izbor pravca volanom.
 *
 * Na raskrsnici se ne bira dugmetom nego onim čime se i vozi: volan ulijevo
 * prije raskrsnice znači da se skreće lijevo. Izabrana putanja se odmah
 * iscrtava, pa igrač vidi šta je izabrao — i to je ista putanja po kojoj ostali
 * računaju šta namjeravamo.
 *
 * Izbor se zaključava `INDICATOR_LEAD` metara prije stop-linije, tamo gdje
 * počinje faza najave: da se pravac mijenja i poslije toga, pokazivač bi se
 * sudio po namjeri koju igrač u međuvremenu više nema.
 */
function izborPravca(
  world: World,
  ctx: Ctx,
  player: Vehicle,
  path: Path,
  input: Input,
): void {
  const steer = input.steer ?? 0;
  const strana: "left" | "right" | null =
    steer <= -DECISION_STEER ? "left" : steer >= DECISION_STEER ? "right" : null;
  if (strana === world.volan.izborStrana) world.volan.izborT += DT;
  else {
    world.volan.izborStrana = strana;
    world.volan.izborT = 0;
  }
  if (world.volan.izborT < DECISION_HOLD) return;

  const uPrstenu = path.ring !== undefined && player.s >= path.boxEnterS;
  const uProzoruOdluke =
    player.s >= path.stopLineS - DECISION_LEAD && player.s <= path.stopLineS - INDICATOR_LEAD;
  if (!uPrstenu && !uProzoruOdluke) return;

  const zeljena = uPrstenu
    ? izlazUPrstenu(ctx, player, path, strana)
    : ctx.tpl.kind === "roundabout"
      ? prstenPrilaz(ctx, path, strana)
      : krstastaPrilaz(ctx, path, strana);
  if (!zeljena || zeljena === player.pathId) return;
  preusmjeri(ctx, player, path, zeljena);
}

/** Putanja koju na krstastoj raskrsnici bira dati položaj volana. */
function krstastaPrilaz(ctx: Ctx, path: Path, strana: "left" | "right" | null): string | null {
  const manevar: CrossIntent = strana ?? "straight";
  const id = `${ctx.tpl.id}:${path.arm}:${manevar}`;
  // Krak kojeg nema nema ni putanju — na raskrsnici sa tri kraka se u tu
  // stranu jednostavno ne može.
  return ctx.paths.has(id) ? id : null;
}

/**
 * Izlaz iz kružnog toka koji bira volan na prilazu.
 *
 * Desno je prvi izlaz, ništa je drugi (praktično pravo), lijevo je treći ili
 * dalji — isto onako kako se u kružni tok i ulazi.
 */
function prstenPrilaz(ctx: Ctx, path: Path, strana: "left" | "right" | null): string | null {
  const tpl = ctx.tpl as RoundaboutTemplate;
  const moguci = exitCountsFor(tpl, path.arm);
  const n = strana === "right" ? 1 : strana === null ? 2 : 3;
  const izabran = moguci.includes(n) ? n : (moguci[moguci.length - 1] ?? null);
  if (izabran === null) return null;
  const id = `${tpl.id}:${path.arm}:exit${izabran}`;
  return ctx.paths.has(id) ? id : null;
}

/**
 * Promjena izlaza dok se već kruži.
 *
 * Desno znači „izlazim ranije" — nikad „ostajem duže". Izlaz koji je prošao se
 * ne može izabrati, zato se poredi po UGLU, a ne po rednom broju; a izlaz dalji
 * od već izabranog se ne bira jer se pred svojim izlazom volan i tako drži
 * udesno. Bez tog uslova bi svako izlaženje iz kružnog toka značilo još jedan
 * krug.
 */
function izlazUPrstenu(
  ctx: Ctx,
  player: Vehicle,
  path: Path,
  strana: "left" | "right" | null,
): string | null {
  if (strana !== "right" || ctx.tpl.kind !== "roundabout") return null;
  const sada = ringAngleAt(path, player.s);
  if (sada === null) return null;
  let najblizi: Path | null = null;
  for (const n of exitCountsFor(ctx.tpl, path.arm)) {
    const kandidat = ctx.paths.get(`${ctx.tpl.id}:${path.arm}:exit${n}`);
    if (!kandidat?.ring) continue;
    // Ugao OPADA duž kretanja, pa je izlaz ispred nas onaj sa manjim uglom.
    if (kandidat.ring.angleTo > sada - IZLAZ_MARGINA) continue;
    // Dalje od onoga što je već izabrano se ne ide.
    if (path.ring && kandidat.ring.angleTo <= path.ring.angleTo) continue;
    if (!najblizi?.ring || kandidat.ring.angleTo > najblizi.ring.angleTo) najblizi = kandidat;
  }
  return najblizi?.id ?? null;
}

/** Koliko prije izlaza je prekasno da se on izabere [rad]. */
const IZLAZ_MARGINA = 0.25;

/**
 * Prebaci vozilo na drugu putanju, bez skoka u prostoru.
 *
 * Sve putanje sa istog kraka dijele prilaz, pa se `s` prenosi kakav jest. U
 * prstenu se ne prenosi `s` nego UGAO: dvije putanje kroz isti prsten uzorkuju
 * luk različito gustim korakom, pa bi isti `s` značio drugo mjesto.
 */
function preusmjeri(ctx: Ctx, player: Vehicle, stara: Path, noviId: string): void {
  const nova = ctx.paths.get(noviId);
  if (!nova) return;
  const ugao = ringAngleAt(stara, player.s);
  if (ugao !== null) {
    const s = ringSNaUglu(nova, ugao);
    if (s === null) return;
    player.s = s;
  }
  player.pathId = nova.id;
  player.intent = nova.intent;
}

/**
 * Pravila preticanja.
 *
 * Sve se mjeri od RAZDJELNE LINIJE, jer je ona jedina stvarna granica na
 * dvosmjernom putu: tijelo preko nje je prelazak, sredina preko nje je vožnja
 * kontra trakom.
 *
 * Zabrana se ne čita iz krivine u trenutku vožnje nego iz šablona — iz istog
 * podatka iz kojeg se linija i crta. Vidi `lib/game/road/zabrane.ts`.
 */
function preticanje(
  world: World,
  ctx: Ctx,
  player: Vehicle,
  path: Path,
  sudiPokazivac: boolean,
): void {
  const tpl = ctx.tpl as RoadTemplate;
  const lat = player.lateral ?? 0;
  const doSredine = doLinije(path, path.doSredine, player.s);
  const tijeloPreko = lat - CAR_WIDTH / 2 < -doSredine - LINE_CROSS_TOL;
  const uKontra = lat < -doSredine;

  if (tijeloPreko && zabranjeno(tpl.zabrane, player.s)) {
    add(world, {
      type: "crossingSolidLine",
      t: world.t,
      details: "Prešao preko pune razdjelne linije.",
    });
  }

  if (uKontra) {
    // Prelazak u suprotnu traku je promjena trake, pa se traži pokazivač —
    // tačno u koraku u kojem je sredina vozila prešla liniju.
    if (sudiPokazivac && world.volan.kontraT === 0) pokazivacPriPrelasku(world, player, "left");
    world.volan.kontraT += DT;
    if (world.volan.kontraT > MAX_OVERTAKE_TIME) {
      add(world, {
        type: "overtakeTooLong",
        t: world.t,
        severity: "minor",
        details: `Zadržao se u suprotnoj traci ${world.volan.kontraT.toFixed(0)} s.`,
      });
    }

    // Susretno vozilo: prilazi se ZBIROM brzina, pa je vrijeme do susreta
    // mnogo kraće nego što razdaljina sugeriše.
    let najblize = Infinity;
    let ko: Vehicle | null = null;
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.lane !== 1) continue;
      const oPath = ctx.paths.get(o.pathId);
      if (!oPath) continue;
      const d = naRuti(o, oPath) - player.s;
      if (d > 0 && d < najblize) {
        najblize = d;
        ko = o;
      }
    }
    if (ko) {
      const ttc = najblize / Math.max(1, player.v + ko.v);
      if (ttc < ONCOMING_TTC) {
        add(world, {
          type: "unsafeOvertake",
          t: world.t,
          details: `U suprotnoj traci, a susretno vozilo stiže za ${ttc.toFixed(1)} s.`,
          otherVehicleId: ko.id,
        });
      }
    }

    // Koga pretičemo: vozilo u našem smjeru koje nam je pod bokom ili tik
    // ispred. Pamti se da bi se pri povratku znalo ispred koga smo se vratili.
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.lane === 1) continue;
      const oPath = ctx.paths.get(o.pathId);
      if (!oPath) continue;
      const d = naRuti(o, oPath) - player.s;
      if (d > -PRETEKNUT_POJAS && d < PRETEKNUT_POJAS) world.volan.preticao = o.id;
    }
    return;
  }

  // Vratili smo se u svoju traku.
  if (world.volan.kontraT > 0) {
    if (sudiPokazivac) pokazivacPriPrelasku(world, player, "right");
    const preteknuti = world.vehicles.find((o) => o.id === world.volan.preticao && !o.done);
    if (preteknuti) {
      const oPath = ctx.paths.get(preteknuti.pathId);
      const iza = oPath ? player.s - naRuti(preteknuti, oPath) : -1;
      // Samo ako smo se stvarno vratili ISPRED njega.
      if (iza > 0) {
        // Od njegovog prednjeg branika do našeg zadnjeg: `s` je sredina vozila,
        // pa se oduzimaju dvije polovine dužine. Ispred kamiona bi cijela dužina
        // auta pokazala skoro četiri metra više praznine nego što je ima.
        const razmak = (iza - (player.length + preteknuti.length) / 2) / Math.max(1, preteknuti.v);
        if (razmak < CUT_IN_TIME) {
          add(world, {
            type: "cutIn",
            t: world.t,
            severity: "minor",
            details: `Vratio se ispred preteknutog na ${razmak.toFixed(1)} s razmaka.`,
            otherVehicleId: preteknuti.id,
          });
        }
        // Da li je zbog toga morao da koči, vidi se tek u sljedećim koracima.
        world.volan.cutInDo = world.t + CUT_IN_WINDOW;
      }
    }
    world.volan.kontraT = 0;
    world.volan.preticao = null;
  }

  // Vraćanje koje je natjeralo preteknutog na kočnicu nije sitnica.
  if (world.t < world.volan.cutInDo) {
    const zakocio = world.events.some(
      (e) => e.type === "forcedBrake" && e.by === PLAYER_ID && e.t >= world.volan.cutInDo - CUT_IN_WINDOW,
    );
    const kartica = world.violations.find((x) => x.type === "cutIn");
    if (zakocio && kartica && kartica.severity !== "fail") {
      kartica.severity = "fail";
      kartica.details = "Vratio se ispred preteknutog, koji je zbog toga morao da koči.";
    }
  }
}

/**
 * Pokazivač pri prelasku razdjelne linije, kad ga pali vozač.
 *
 * Isto pravilo kao pri promjeni trake na autoputu (`laneStep`): pokazivač mora
 * biti uključen na stranu prelaska, i to bar `INDICATOR_LEAD_TIME` prije nego
 * što sredina vozila pređe liniju. Sudi se u koraku prelaska — jedan trenutak,
 * jedno pravilo. Ulazak u suprotnu traku i povratak su dva manevra, pa nose i
 * dvije oznake faze.
 */
function pokazivacPriPrelasku(world: World, v: Vehicle, strana: "left" | "right"): void {
  const faza = strana === "left" ? "prelazak" : "povratak";
  const upaljen = world.indicatorLog.filter((e) => e.indicator === strana).at(-1);
  if (v.indicator !== strana || !upaljen) {
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: faza,
      details:
        strana === "left"
          ? "Prelazak u suprotnu traku bez pokazivača."
          : "Povratak u svoju traku bez pokazivača.",
    });
    return;
  }
  const unaprijed = world.t - upaljen.t;
  if (unaprijed < INDICATOR_LEAD_TIME) {
    const manevar = strana === "left" ? "prelaska u suprotnu traku" : "povratka u svoju traku";
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: faza,
      details: `Pokazivač je uključen prekasno — ${unaprijed.toFixed(1)} s prije ${manevar}.`,
    });
  }
}

/**
 * Izlazak sa kolovoza.
 *
 * Sudi se po tijelu vozila, ne po njegovoj sredini: prekršaj je kad točak pređe
 * ivičnu liniju. Kratko i sporo je greška koja se prijavi; dugo ili brzo obara
 * vožnju, jer je to već slijetanje.
 */
function volanPrekrsaji(
  world: World,
  ctx: Ctx,
  player: Vehicle,
  path: Path,
  sudiPokazivac: boolean,
): void {
  preticanje(world, ctx, player, path, sudiPokazivac);
  const izvan = (player.lateral ?? 0) + CAR_WIDTH / 2 - doLinije(path, path.doIvice, player.s);
  if (izvan <= 0) {
    world.volan.offRoadT = 0;
    return;
  }
  world.volan.offRoadT += DT;
  const tesko =
    world.volan.offRoadT > OFF_ROAD_FAIL_TIME || player.v > OFF_ROAD_FAIL_SPEED;
  const postojeci = world.violations.find((x) => x.type === "offRoad");
  if (!postojeci) {
    add(world, {
      type: "offRoad",
      t: world.t,
      severity: tesko ? "fail" : "minor",
      details: `Izašao sa kolovoza (${izvan.toFixed(1)} m preko ivične linije).`,
    });
    return;
  }
  // Ista greška, ali je u međuvremenu postala teška: kartica ostaje jedna, a
  // njena težina prati ono što se stvarno desilo.
  if (tesko && postojeci.severity !== "fail") {
    postojeci.severity = "fail";
    postojeci.details = `Vozio van kolovoza ${world.volan.offRoadT.toFixed(1)} s.`;
  }
}

/** Trake koje vozilo zauzima; van autoputa je to prazan spisak. */
const trake = (v: Vehicle): number[] =>
  v.lane === undefined ? [] : occupiedLanes(v.lane, v.laneFrom, v.laneT ?? 1);

/** Koliko sekundi vozilu treba da stigne do `s`; `Infinity` ako stoji. */
function timeTo(v: Vehicle, s: number): number {
  const d = s - v.s;
  if (d <= 0) return 0;
  return v.v > 0.05 ? d / v.v : Infinity;
}

/** Da li je vozilo trenutno u tijelu raskrsnice. */
function inBox(v: Vehicle, path: Path): boolean {
  return v.s >= path.boxEnterS && v.s <= path.boxExitS;
}

// ── stvaranje svijeta ───────────────────────────────────────────────────────

export function createWorld(scenario: Scenario, seed: number): World {
  const tpl = scenario.template ?? TEMPLATES[scenario.intersection];
  if (!tpl) throw new Error(`Nepoznata raskrsnica: ${scenario.intersection}`);
  // Automatski pokazivač se pali po tabeli faza ili uz prelazak razdjelne
  // linije. Na autoputu se traži uz ZAHTJEV za promjenu trake, a taj zahtjev
  // simulacija ne može da predvidi — pa se kombinacija odbija, umjesto da se
  // tamo tiho sudi po pokazivaču koji niko nije palio.
  if (scenario.pokazivaci === "auto" && tpl.kind === "highway") {
    throw new Error("Automatski pokazivači ne postoje na autoputu.");
  }
  // Napravljeni šablon mora biti dostupan i po `id`-u — vidi `templateById`.
  if (scenario.template) registerTemplate(scenario.template);
  const { paths } = compile(tpl);

  const pathId = (arm: ArmId, intent: Intent) => `${tpl.id}:${arm}:${intentKey(intent)}`;
  const need = (id: string): Path => {
    const p = paths.get(id);
    if (!p) throw new Error(`Nema putanje ${id} — provjeri krakove šablona.`);
    return p;
  };

  const jeAutoput = bezKrakova(tpl);
  const trakaIz = (intent: Intent): number | undefined =>
    typeof intent !== "string" && intent.kind === "lane" ? intent.index : undefined;

  const playerPath = need(
    jeAutoput
      ? lanePathId(tpl.id, trakaIz(scenario.player.intent) ?? 0)
      : pathId(scenario.player.arm, scenario.player.intent),
  );
  const vehicles: Vehicle[] = [
    {
      id: PLAYER_ID,
      kind: "player",
      pathId: playerPath.id,
      s: jeAutoput
        ? (scenario.player.startS ?? 0)
        : Math.max(0, playerPath.stopLineS - scenario.player.spawnDistance),
      v: jeAutoput ? (scenario.player.startV ?? 0) : 0,
      length: CAR_LENGTH,
      width: CAR_WIDTH,
      intent: scenario.player.intent,
      arm: scenario.player.arm,
      // Pokazivač igrača je od sada KOMANDA, ne posljedica namjere — počinje
      // ugašen i pali ga igrač.
      indicator: null,
      stopHeld: 0,
      done: false,
      spawnT: 0,
      lane: jeAutoput ? (trakaIz(scenario.player.intent) ?? 0) : undefined,
      laneT: 1,
      // Poprečni položaj postoji samo tamo gdje se upravlja volanom. Vozilo
      // koje ide po šini nema šta da mu radi — i zato se zatečeni scenariji ne
      // mijenjaju ni za jedan podatak.
      lateral: scenario.upravljanje === "traka" ? 0 : undefined,
      lateralHeldT: scenario.upravljanje === "traka" ? 0 : undefined,
    },
  ];

  // Vrijeme nastanka NPC-a se bira po sjemenu — isto sjeme, isti scenario,
  // ista simulacija. Bez toga nema ni ponavljanja snimka ni testova.
  const rand = rng(seed);
  scenario.npcs.forEach((n, i) => {
    const p = need(jeAutoput ? lanePathId(tpl.id, trakaIz(n.intent) ?? 0) : pathId(n.arm, n.intent));
    const [lo, hi] = n.spawnAt;
    const t = lo + rand() * (hi - lo);
    // Vozilo bez vrste je srednji putnički auto — tačno ono što je do sada bilo
    // svako vozilo, pa se zatečeni scenariji ne mijenjaju.
    const mjere = VOZILA[n.vrsta ?? "auto"];
    vehicles.push({
      id: `npc${i + 1}`,
      kind: "npc",
      pathId: p.id,
      s: n.startS ?? 0,
      v: n.speed,
      length: mjere.duzina,
      width: mjere.sirina,
      ...(n.vrsta ? { vrsta: n.vrsta } : {}),
      intent: n.intent,
      arm: n.arm,
      // NPC su idealni vozači: pokazivač im vodi ista tabela po kojoj se sudi
      // igraču, pa uz put i pokazuju kako treba.
      indicator: expectedIndicatorAt(p, n.intent, 0),
      stopHeld: 0,
      done: false,
      spawnT: t,
      emergency: n.emergency,
      lane: jeAutoput ? (trakaIz(n.intent) ?? 0) : undefined,
      laneT: 1,
      postavljen: n.fiksno ?? false,
      cruise: jeAutoput ? n.speed : undefined,
    });
  });

  // Pješaci kreću sa trotoara i idu poprečno preko kolovoza.
  const pedestrians: Pedestrian[] = (scenario.pedestrians ?? []).map((ped, i) => {
    const [lo, hi] = ped.spawnAt;
    const span = pedestrianSpan(tpl, ped.arm);
    return {
      id: `ped${i + 1}`,
      arm: ped.arm,
      u: -ped.dir * span,
      dir: ped.dir,
      speed: ped.speed,
      spawnT: lo + rand() * (hi - lo),
      done: false,
    };
  });

  const world: World = {
    t: 0,
    scenarioId: scenario.id,
    templateId: tpl.id,
    vehicles,
    pedestrians,
    phaseIndex: scenario.lightStartPhase ?? 0,
    phaseT: scenario.lightStartT ?? 0,
    events: [],
    violations: [],
    outcome: "running",
    idleT: 0,
    yellowCommitted: false,
    indicatorLog: [],
    indicatorDone: [],
    hazardsFired: [],
    reaction: [],
    highway: { tooSlowT: 0, tailgateT: 0, shoulderT: 0 },
    volan: {
      offRoadT: 0,
      kontraT: 0,
      preticao: null,
      cutInDo: 0,
      izborStrana: null,
      izborT: 0,
      autoStrana: null,
      autoT: 0,
    },
  };
  // Saobraćaj na otvorenom putu postoji i prije prvog koraka: prozor oko igrača
  // se puni odmah, inače bi put na startu bio prazan.
  const tp = tokPut(tpl, paths, scenario);
  if (tp) napuniTok(world, tp, vehicles[0]!);
  return world;
}

// ── jedan korak ─────────────────────────────────────────────────────────────

/** Granica dokle se smije stići i brzina onoga ko je postavlja. */
interface Target {
  limit: number;
  vLead: number;
  /** Ko je postavio granicu — po tome se zna zbog koga se koči. */
  blame?: string;
}

interface Ctx extends Regulacija {
  paths: Map<string, Path>;
  conflicts: Map<string, ConflictPoint[]>;
  vMax: number;
  /** Najveća brzina koju vozilo može da razvije [m/s] — nije isto što i propis. */
  vTop: number;
  drag: number;
  /** Parametri težine za nivo ovog scenarija. */
  dif: DifficultyParams;
}

function ctxFor(world: World, scenario: Scenario): Ctx {
  const tpl = scenario.template ?? templateById(world.templateId)!;
  const c = compile(tpl);
  return {
    tpl,
    officerAllow: officerAllow(scenario.officer, world.t),
    paths: c.paths,
    conflicts: c.conflicts,
    vMax: bezKrakova(tpl) ? tpl.vMax : (scenario.vMax ?? V_MAX_DEFAULT),
    // Gradski `V_TOP` je ispod dozvoljene brzine na magistrali, pa bi na
    // otvorenom putu ograničenje bilo nedostižno — vidi `ROAD_V_TOP_FACTOR`.
    vTop:
      tpl.kind === "highway"
        ? HIGHWAY_V_TOP
        : tpl.kind === "road"
          ? ROAD_V_TOP
          : V_TOP,
    drag: bezKrakova(tpl) ? HIGHWAY_DRAG : DRAG_COEFF,
    dif: DIFFICULTY[scenario.difficulty],
  };
}

/**
 * Koliko `s` NPC smije da dostigne prije nego što mora da stane.
 * `Infinity` znači „put je slobodan".
 */
function npcTarget(world: World, ctx: Ctx, me: Vehicle, mePath: Path): Target {
  // Autoput i otvoren put: nema prvenstva ni znakova, samo traka i odstojanje.
  if (ctx.tpl.kind === "road") return roadFollowLimit(world, ctx, me, mePath);
  if (bezKrakova(ctx.tpl)) return highwayFollowLimit(world, ctx, me);

  let limit = Infinity;

  // Vozilo koje se ponaša neispravno ne poštuje ni znak ni prvenstvo. Pješake
  // i dalje propušta — „prolazi STOP" nije isto što i „gazi pješake".
  const bezobzirno = Boolean(me.reckless);

  // STOP znak: potpuno zaustavljanje na liniji, pa nastavak po pravilima.
  const control = armControl(ctx, me.arm, world.phaseIndex);
  // Cilja se ISPRED linije, ne na nju — vidi `STOP_MARGIN`.
  if (!bezobzirno && control === "stop" && me.stopHeld < STOP_DWELL && me.s < mePath.stopLineS) {
    limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }
  // Semafor. Na žuto se staje SAMO ako se stigne bezbjedno stati — isti prag
  // (`YELLOW_COMMIT_TTC`) po kojem se sudi i igraču. Da NPC koči na svako žuto,
  // sudio bi mu se drugi aršin nego čovjeku, a uz to bi kočio jače nego što
  // vozilo može i završio nasred raskrsnice.
  //
  // Vozilo pod pratnjom se ovdje ne zaustavlja: ono prolazi i na crveno, uz
  // obavezu da se uvjeri da može bezbjedno. Ostali mu ustupaju kroz `whoYields`.
  if (me.s < mePath.stopLineS && !me.emergency && !bezobzirno) {
    const staje =
      control === "red" ||
      (control === "yellow" && timeTo(me, mePath.stopLineS) >= YELLOW_COMMIT_TTC);
    if (staje) limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }

  // Ulazak u kružni tok: prilazi se SPREMAN DA SE STANE.
  //
  // Bez ovoga vozilo donese odluku tek kad drugi uđe u prsten — a tada je već
  // prešlo svoju liniju ustupanja i staje unutar kružne trake, gdje ga pokosi
  // onaj ko kruži. Fuzz test je to izvukao kao sudar bez ičije greške.
  if (mePath.ring && me.s < mePath.stopLineS && !me.emergency && !bezobzirno) {
    const nekoKruzi = (ctx.conflicts.get(mePath.id) ?? []).some((c) => {
      // Samo konflikt na MOM ulasku u prsten; vozilo koje izlazi prije njega mi
      // ne prelazi put.
      if (Math.abs(c.sA - mePath.boxEnterS) > 0.5) return false;
      return world.vehicles.some((o) => {
        if (o.id === me.id || o.done || world.t < o.spawnT) return false;
        if (o.pathId !== c.pathB) return false;
        const oPath = ctx.paths.get(o.pathId);
        if (!oPath?.ring) return false;
        // Već u prstenu, prije moje ulazne tačke.
        if (o.s >= oPath.boxEnterS && o.s <= c.sB) return true;
        // Ili tek stiže, ali će ući PRIJE mene. Poređenje ide po vremenu do
        // prstena, pa je poredak strog i ne može doći do uzajamnog čekanja:
        // vozilo koje stoji ima beskonačno vrijeme i nikoga ne blokira.
        if (o.s >= oPath.boxEnterS) return false;
        const tOn = timeTo(o, oPath.boxEnterS);
        const tJa = timeTo(me, mePath.boxEnterS);
        return tOn < tJa;
      });
    });
    if (nekoKruzi) limit = Math.min(limit, mePath.stopLineS - STOP_MARGIN);
  }

  // Pješak na prelazu preko kojeg prolazim — staje se prije prelaza.
  limit = Math.min(limit, pedestrianLimit(world, ctx, me, mePath));

  // Vozilo ispred u istoj traci.
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.pathId !== me.pathId || o.s <= me.s) continue;
    limit = Math.min(limit, o.s - o.length - FOLLOW_GAP);
  }

  // Vozilo ispred u ISTOJ IZLAZNOJ TRACI, i kad mu je putanja druga.
  // Dva vozila koja izlaze na isti krak voze jednu za drugim po istom asfaltu;
  // to nije pitanje prvenstva nego odstojanja. Na krstastoj raskrsnici je taj
  // slučaj do sad pokrivala `merge` konfliktna tačka, koja odlučuje KO PRVI —
  // a poslije raskrsnice više nema „ko prvi", nego samo „ko je ispred".
  limit = Math.min(limit, exitLaneFollowLimit(world, ctx, me, mePath));

  // Vozilo ispred U PRSTENU. Putanje kroz prsten se poklapaju na dužini, pa ovo
  // nije pitanje prvenstva nego odstojanja — i ne može se svesti na „ista
  // putanja", jer dva vozila mogu dijeliti luk a izlaziti na različitim
  // krakovima.
  limit = Math.min(limit, ringFollowLimit(world, ctx, me, mePath));

  // Prvenstvo na konfliktnim tačkama. Bezobzirno vozilo ga preskače — u tome i
  // jeste poenta vježbe defanzivne vožnje.
  if (bezobzirno) return { limit, vLead: 0 };
  for (const c of ctx.conflicts.get(mePath.id) ?? []) {
    if (c.sA < me.s) continue; // konflikt je iza nas
    for (const o of world.vehicles) {
      if (o.id === me.id || o.done || world.t < o.spawnT) continue;
      if (o.pathId !== c.pathB) continue;

      const oPath = ctx.paths.get(o.pathId)!;
      const decision = whoYields(
        party(ctx, me, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision !== "a") continue; // ja imam prednost ili se ne tičemo

      // Ustupa se ako je drugi već u raskrsnici, ili bi stigao prije nego što
      // ja stignem da očistim konfliktnu tačku. Sam `TTC_THRESHOLD` nije
      // dovoljan — vidi `CLEAR_TIME`.
      const oPast = o.s > c.sB + o.length;
      if (oPast) continue;
      const tMe = timeTo(me, c.sA);
      const tThem = timeTo(o, c.sB);
      const oNear = inBox(o, oPath) || tThem < Math.max(ctx.dif.ttcThreshold, tMe + CLEAR_TIME);
      if (!oNear) continue;
      // Vozilo koje ustupa nikad ne planira da stane IZA svoje linije. Bez ovog
      // ograničenja odluka doneseta kasno (jer je treće vozilo tek ušlo u prag)
      // ostavlja vozilo zaustavljeno nasred raskrsnice — a tamo ga zakuca onaj
      // ko ima prednost.
      const svoja = me.s < mePath.stopLineS ? mePath.stopLineS - STOP_MARGIN : Infinity;
      limit = Math.min(limit, Math.min(c.sA - GAP, svoja));
    }
  }

  return { limit, vLead: 0 };
}

/**
 * Do kojeg `s` se smije ići zbog vozila ispred u zajedničkoj izlaznoj traci.
 *
 * Rastojanje se mjeri preostalim putem do izlaza: ko ima manje preostalo, taj
 * je ispred. Time se ne mora znati ništa o obliku putanja — samo da vode na
 * isti krak.
 */
function exitLaneFollowLimit(world: World, ctx: Ctx, me: Vehicle, mePath: Path): number {
  let limit = Infinity;
  const doIzlaza = mePath.boxExitS - me.s;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.pathId === me.pathId) continue; // već pokriveno pravilom iste trake
    const oPath = ctx.paths.get(o.pathId);
    if (!oPath || oPath.exitArm !== mePath.exitArm) continue;
    // Vozilo koje još nije ušlo u raskrsnicu nije u zajedničkoj traci.
    if (o.s < oPath.boxEnterS) continue;
    const njegovo = oPath.boxExitS - o.s;
    const razmak = doIzlaza - njegovo;
    if (razmak <= 0 || razmak > 40) continue; // iza mene, ili predaleko
    limit = Math.min(limit, me.s + razmak - o.length - FOLLOW_GAP);
  }
  return limit;
}

/**
 * Do kojeg `s` se smije ići zbog vozila ispred u prstenu.
 *
 * Položaj duž prstena je jedan broj (`ringU`), pa je „ko je ispred" obično
 * poređenje po modulu obima. Razmak se onda prevede nazad u `s` na mojoj
 * putanji — u prstenu su to iste jedinice.
 */
function ringFollowLimit(world: World, ctx: Ctx, me: Vehicle, mePath: Path): number {
  const uMe = ringUAt(mePath, me.s);
  if (uMe === null) return Infinity;
  const radius = mePath.ring!.radius;
  let limit = Infinity;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId);
    if (!oPath) continue;
    const uO = ringUAt(oPath, o.s);
    if (uO === null) continue;
    const gap = ringGap(uMe, uO, radius);
    // Nula znači „na istom mjestu"; pola obima i više je vozilo iza mene.
    if (gap <= 0 || gap > Math.PI * radius) continue;
    limit = Math.min(limit, me.s + gap - o.length - FOLLOW_GAP);
  }
  return limit;
}

/**
 * Do kojeg `s` se smije ići zbog pješaka na prelazu ispred.
 *
 * Prelaz blokira dok je pješak NA KOLOVOZU, bez obzira na to koju polovinu je
 * prešao. Prolazak iza pješaka je u praksi čest, ali polazniku se uči sigurnija
 * verzija — i ista ona koju već primjenjuje statični simulator.
 */
function pedestrianLimit(world: World, ctx: Ctx, v: Vehicle, path: Path): number {
  let limit = Infinity;
  for (const span of crosswalkSpans(ctx.tpl, path)) {
    if (span.to < v.s) continue; // prelaz je iza nas
    const zauzet = world.pedestrians.some(
      (p) =>
        !p.done &&
        world.t >= p.spawnT &&
        p.arm === span.arm &&
        pedestrianOnRoad(ctx.tpl, p),
    );
    if (zauzet) limit = Math.min(limit, span.from - GAP);
  }
  return limit;
}

/**
 * Dokle vozilo na autoputu smije da stigne zbog vozila ispred u svojoj traci.
 *
 * Odstojanje se mjeri u sekundama, ne u metrima: na sto na sat dva metra nisu
 * isto što i na trideset. `FOLLOW_GAP` ostaje kao donja granica za male brzine.
 */
function highwayFollowLimit(world: World, ctx: Ctx, me: Vehicle): Target {
  let limit = Infinity;
  let vLead = 0;
  const mojeTrake = trake(me);
  const razmak = Math.max(FOLLOW_GAP, HIGHWAY_FOLLOW_TIME * me.v);
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (o.s <= me.s) continue;
    if (!shareLane(mojeTrake, trake(o))) continue;
    const kandidat = o.s - o.length - razmak;
    if (kandidat < limit) {
      limit = kandidat;
      vLead = o.v;
    }
  }
  return { limit, vLead };
}

/**
 * Dokle vozilo na otvorenom putu smije zbog onoga što mu je u traci.
 *
 * Dvije razlike u odnosu na autoput. Prva: traka se ne čita iz `lane` nego iz
 * tijela vozila, jer igrač sa volanom može biti i između dvije. Druga:
 * susretna traka ima okrenutu putanju, pa se „ko je ispred koga" ne može
 * porediti po `s` — poredi se po položaju NA RUTI, u smjeru u kojem se ide.
 *
 * Vozilo koje nam ide u susret u našoj traci nije kolona ispred nego prepreka:
 * ne izjednačava se brzina nego se koči do zaustavljanja.
 */
function roadFollowLimit(world: World, ctx: Ctx, me: Vehicle, mePath: Path): Target {
  let limit = Infinity;
  let vLead = 0;
  let blame: string | undefined;
  const mojeTrake = trakeNaPutu(mePath, me);
  const mojSmjer = me.lane === 1 ? -1 : 1;
  const mojeNaRuti = naRuti(me, mePath);
  const razmak = Math.max(FOLLOW_GAP, HIGHWAY_FOLLOW_TIME * me.v);

  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId);
    if (!oPath) continue;
    if (!shareLane(mojeTrake, trakeNaPutu(oPath, o))) continue;
    // Koliko je ispred mene, mjereno u mom smjeru vožnje.
    const d = (naRuti(o, oPath) - mojeNaRuti) * mojSmjer;
    if (d <= 0) continue;
    const istiSmjer = (o.lane === 1) === (me.lane === 1);
    // `s` je sredina vozila, pa se od razmaka središta oduzimaju dvije polovine
    // dužine — od branika do branika. Za dva ista auta je to isto što i jedna
    // cijela dužina, kako je ranije i pisalo; za auto iza kamiona nije.
    const kandidat = me.s + d - (me.length + o.length) / 2 - (istiSmjer ? razmak : razmak * 1.5);
    if (kandidat < limit) {
      limit = kandidat;
      vLead = istiSmjer ? o.v : 0;
      blame = o.id;
    }
  }
  return { limit, vLead, blame };
}

/**
 * Ubrzanje kojim se stiže do `limit` i tu staje, ograničeno na [−B_MAX, A_MAX].
 *
 * `vLead` je brzina onoga zbog koga je granica postavljena. Kod stop-linije i
 * kod prvenstva je to nula i formula je klasična „stani tačno tu". Kod vožnje
 * iza drugog vozila nije: tada se ne mora izgubiti cijela brzina nego samo
 * razlika. Bez toga vozilo koči i kad je granica ispred njega sto metara i sama
 * bježi — izmjereno na autoputu, gdje se savršen vozač zaglavljivao na
 * pedesetak km/h iza kamiona sa sto metara praznine.
 */
function accelToward(v: Vehicle, limit: number, vMax: number, vLead = 0): number {
  if (limit === Infinity) {
    return v.v < vMax ? A_MAX : 0;
  }
  const d = limit - v.s;
  if (d <= 0) return -B_MAX;
  // (v − vLead)² = 2·a·d  →  a potrebno da se razlika brzina izgubi do `limit`.
  const razlika = Math.max(0, v.v - vLead);
  const need = (razlika * razlika) / (2 * Math.max(d, 0.01));
  if (need >= B_MAX) return -B_MAX;
  if (need > A_MAX * 0.5) return -need;
  return v.v < vMax ? A_MAX : 0;
}

/**
 * Brzina se steže na ono što vozilo MOŽE (`V_TOP`), ne na ono što SMIJE.
 * Zbog toga prekoračenje uopšte može da se desi i da se prijavi.
 */
function integrate(v: Vehicle, a: number, top = V_TOP, coeff = DRAG_COEFF): void {
  const drag = coeff * v.v + (v.v > 0.01 ? ROLL_RESISTANCE : 0);
  const acc = a - (a > 0 ? drag : 0);
  v.v = Math.max(0, Math.min(top, v.v + acc * DT));
  v.s += v.v * DT;
}

/** Jedan korak simulacije. Mijenja `world` na mjestu. */
export function step(world: World, scenario: Scenario, input: Input): void {
  if (world.outcome !== "running") return;
  const ctx = ctxFor(world, scenario);

  // ── semafor ───────────────────────────────────────────────────────────────
  const program = ctx.tpl.kind === "cross" ? ctx.tpl.lightProgram : undefined;
  if (program && program.length > 0) {
    const before = armControl(ctx, scenario.player.arm, world.phaseIndex);
    world.phaseT += DT;
    const dur = program[world.phaseIndex]!.duration;
    if (world.phaseT >= dur) {
      world.phaseT -= dur;
      world.phaseIndex = (world.phaseIndex + 1) % program.length;
    }
    const after = armControl(ctx, scenario.player.arm, world.phaseIndex);
    // Trenutak kad se upali žuto: ako je igrač bio preblizu liniji da bezbjedno
    // stane, prolazak mu se ne računa kao prekršaj.
    if (before === "green" && after === "yellow") {
      const p = world.vehicles.find((x) => x.id === PLAYER_ID)!;
      const path = ctx.paths.get(p.pathId)!;
      world.yellowCommitted = timeTo(p, path.stopLineS) < YELLOW_COMMIT_TTC;
    }
    if (after === "green") world.yellowCommitted = false;
  }

  // ── pješaci ───────────────────────────────────────────────────────────────
  for (const ped of world.pedestrians) {
    if (ped.done || world.t < ped.spawnT) continue;
    ped.u += ped.dir * ped.speed * DT;
    if (Math.abs(ped.u) >= pedestrianSpan(ctx.tpl, ped.arm)) ped.done = true;
  }

  const player = world.vehicles.find((x) => x.id === PLAYER_ID)!;
  const playerPath = ctx.paths.get(player.pathId)!;
  const playerBefore = player.s;
  const volanom = scenario.upravljanje === "traka";
  const autoPokazivaci = scenario.pokazivaci === "auto";
  const naVolan = volanom && ctx.tpl.kind === "road";
  const naRaskrsnici =
    volanom && (ctx.tpl.kind === "cross" || ctx.tpl.kind === "roundabout");

  fireHazards(world, scenario, player);
  // Tok saobraćaja pušta nova vozila PRIJE kretanja, pa se i ona pomjere u
  // istom koraku kao i ostala.
  const tp = tokPut(ctx.tpl, ctx.paths, scenario);
  if (tp) pustiTok(world, tp, player);
  // Reakcija se mjeri od trenutka kad je događaj postao vidljiv do prvog
  // kočenja. Gas se ne broji: reakcija na opasnost je kočnica.
  if (input.brake > 0) {
    for (const r of world.reaction) if (r.brakedAt === null) r.brakedAt = world.t;
  }

  // ── kretanje ──────────────────────────────────────────────────────────────
  for (const v of world.vehicles) {
    if (v.done || world.t < v.spawnT) continue;
    // Putanja igrača se u toku prilaza može promijeniti — volanom se bira
    // pravac — pa ovo nije konstanta.
    let path = ctx.paths.get(v.pathId)!;
    // Igrač se nikad ne premješta — a u probi savršenog vozača on je označen
    // kao NPC, pa se mora prepoznati po `id`-u, ne po vrsti.
    if (ctx.tpl.kind === "road" && v.id !== PLAYER_ID && !v.postavljen) {
      postaviUProzor(world, v, path, player);
    }

    if (v.kind === "player") {
      // Pokazivač je komanda: svaka promjena ide u dnevnik, sa mjestom na
      // putanji, jer se pravila vezuju za mjesto a ne za vrijeme. Kad ga pali
      // simulacija, upisuje se tek kad se zna kuda se ide — vidi niže.
      if (!autoPokazivaci) postaviPokazivac(world, v, input.indicator ?? null);
      if (ctx.tpl.kind === "highway") laneStep(world, ctx, v, input);
      // Volan radi samo tamo gdje ga scenario daje. Bez ovog uslova bi isti
      // ulaz pomjerao vozilo i u ispitnim scenarijima, gdje putanja mora da
      // ostane šina.
      //
      // Pravac se bira PRIJE poprečnog pomjeranja: izbor mijenja putanju, a
      // granice u traci se čitaju iz nje.
      if (naRaskrsnici) {
        izborPravca(world, ctx, v, path, input);
        path = ctx.paths.get(v.pathId)!;
      }
      if (volanom) volanKorak(v, path, input);
      // Automatski pokazivač se računa POSLIJE izbora pravca i poprečnog koraka,
      // jer oba mijenjaju ono po čemu se zna šta treba: putanju i položaj u
      // traci. Mjesto upisano u dnevnik je i dalje ono prije pomjeranja, kao i
      // kod ručnog.
      if (autoPokazivaci) {
        postaviPokazivac(world, v, autoPokazivac(world, ctx, scenario, v, path, input));
      }
      const a = input.throttle * A_MAX - input.brake * B_MAX;
      integrate(v, a, ctx.vTop, ctx.drag);
    } else {
      v.indicator = expectedIndicatorAt(path, v.intent, v.s);
      const { limit, vLead, blame } = npcTarget(world, ctx, v, path);
      // Vozilo toka ne vozi jednu zadatu brzinu nego dio ograničenja koje važi
      // tamo gdje jeste — ruta prolazi i magistralom i kroz grad.
      const cilj =
        v.udioBrzine !== undefined && scenario.tok
          ? zeljenaBrzina(scenario.tok, v, path)
          : (v.cruise ?? ctx.vMax);
      let a = accelToward(v, limit, cilj, vLead);
      // Bez gasa brzina u modelu ostaje ista, pa vozilo koje je brže od novog
      // ograničenja mora da uspori samo — blago, kao pred tablom.
      if (v.udioBrzine !== undefined && v.v > cilj + PREKO_ZELJENE) {
        a = Math.min(a, -USPORENJE_OGRANICENJE);
      }
      // Naglo kočenje zbog igrača je događaj, ne samo usporenje — po njemu se
      // prepoznaje oduzeta prednost i kad do sudara ne dođe. Na otvorenom putu
      // nema prvenstva, pa se krivac ne traži po konfliktnim tačkama nego po
      // tome ko je postavio granicu.
      if (a <= -B_MAX + 1e-6 && v.v > 1) {
        const culprit =
          ctx.tpl.kind === "road"
            ? blame === PLAYER_ID
            : blamePlayer(world, ctx, v, path, player, playerPath);
        if (culprit) {
          world.events.push({ type: "forcedBrake", t: world.t, vehicleId: v.id, by: PLAYER_ID });
        }
      }
      integrate(v, a, ctx.vTop, ctx.drag);
    }

    // Zaustavljanje na STOP liniji se broji samo dok je vozilo pred njom.
    if (v.v < STOPPED_SPEED && v.s < path.stopLineS && v.s > path.stopLineS - STOP_ZONE) {
      v.stopHeld += DT;
    }

    if (v.s >= path.length) {
      v.done = true;
      world.events.push({ type: "exit", t: world.t, vehicleId: v.id });
    }
  }

  // Vozila koja su ostala predaleko iza igrača napuštaju svijet. Na otvorenom
  // putu ona više ne mogu ni na šta uticati — ni na odstojanje, ni na sudar, ni
  // na prvenstvo, jer prvenstva tu nema — a računaju se u svakom koraku.
  if (ctx.tpl.kind === "road") odnesiZaostale(world, ctx, player);

  // Putanja se u međuvremenu mogla promijeniti: volanom se bira pravac.
  const putIgraca = ctx.paths.get(player.pathId) ?? playerPath;
  detectViolations(world, ctx, scenario, player, putIgraca, playerBefore);
  if (ctx.tpl.kind === "highway" && !player.done) highwayViolations(world, ctx, player, input);
  if (naVolan && !player.done) volanPrekrsaji(world, ctx, player, putIgraca, !autoPokazivaci);
  // Pokazivač se ocjenjuje van `detectViolations` jer ta funkcija odustaje čim
  // igrač izađe sa putanje — a posljednja faza (gašenje) se završava baš tada.
  evaluateIndicator(world, scenario, player, putIgraca);

  world.t += DT;

  if (world.outcome === "running") {
    if (player.done) {
      // Blagi prekršaji se prijave i objasne, ali vožnju ne obaraju.
      world.outcome = hasFail(world) ? "failed" : "passed";
    } else if (world.t > maxSecondsFor(ctx.tpl)) {
      world.outcome = "failed";
    }
  }
}

/**
 * Briše vozila koja su daleko iza igrača.
 *
 * Mjeri se položaj NA RUTI, ne po putanji: susretna traka je okrenuta, pa
 * njeno `s` raste u suprotnom smjeru. Vozilo koje je prošlo pored igrača i
 * odmaklo `KEEP_BEHIND` metara više se neće vratiti.
 */
function odnesiZaostale(world: World, ctx: Ctx, player: Vehicle): void {
  for (const v of world.vehicles) {
    if (v.kind === "player" || v.done || world.t < v.spawnT) continue;
    const path = ctx.paths.get(v.pathId);
    if (!path) continue;
    const gdje = v.lane === 1 ? path.length - v.s : v.s;
    if (gdje < player.s - KEEP_BEHIND) {
      v.done = true;
      continue;
    }
    // Vozilo u NAŠEM smjeru koje je daleko ispred prozora takođe odlazi.
    // Bez toga se kolona gomila: sporo vozilo se pravi po rasporedu koji
    // računa da vozimo na ograničenju, a mi u međuvremenu vozimo iza nekog
    // drugog — pa nas ispred čeka pet vozila koja niko nikad neće vidjeti.
    if (v.lane !== 1 && gdje > player.s + LOAD_AHEAD * DALEKO_ISPRED) v.done = true;
  }
  // Vozila toka koja su otišla ne ostaju ni kao zapis: tok ih u toku jedne rute
  // napravi stotine, a svaki snimak za ponavljanje bi ih inače nosio sve.
  // Vozila zadata u scenariju ostaju — po njihovom `id`-u se čitaju i događaji.
  if (world.vehicles.some((v) => v.done && v.udioBrzine !== undefined)) {
    world.vehicles = world.vehicles.filter((v) => !(v.done && v.udioBrzine !== undefined));
  }
}

/** Koliko prozora ispred nas vozilo smije biti prije nego što nas se ne tiče. */
const DALEKO_ISPRED = 1;

/**
 * Koliko vozilo toka smije biti brže od brzine koju želi prije nego što počne da
 * usporava [m/s]. Bez ove margine bi na samoj granici naizmjenično kočilo i
 * davalo gas.
 */
const PREKO_ZELJENE = 0.3;

/** Koliko ispred igrača se pojavi sporije vozilo koje treba sustići [m]. */
const SPORI_ISPRED = 450;

/**
 * Vozilo se rađa u PROZORU oko igrača, ma šta raspored govorio.
 *
 * Raspored je napravljen po ograničenju dionice, a igrač ne vozi po njemu: čim
 * se nađe iza sporijeg vozila, zaostane za računom i sve što slijedi se pojavi
 * kilometrima ispred njega. Izmjereno na Herceg Novi — Rožaje: 71 vozilo u
 * pogonu, od toga 58 van prozora — sve sam račun bez ijednog susreta.
 *
 * Zato raspored zadržava samo ono što zna: KAD se vozilo pojavljuje. Gdje se
 * pojavljuje odlučuje mjesto igrača u tom trenutku.
 */
function postaviUProzor(world: World, v: Vehicle, path: Path, player: Vehicle): void {
  v.postavljen = true;
  const cilj =
    v.lane === 1
      ? // Susretno: ulazi na daljem kraju prozora i vozi nam u susret.
        Math.max(0, path.length - (player.s + LOAD_AHEAD))
      : // U našoj traci: tek toliko ispred da ga stignemo, a da ne iskrsne
        // pred haubom.
        Math.min(path.length, player.s + SPORI_ISPRED);

  // Više vozila zna da dobije isti trenutak nastanka (raspored ih je stegnuo
  // na nulu), a dva vozila na istom mjestu su sudar prije nego što je iko
  // krenuo. Zato se traži prvo slobodno mjesto iza, uvijek istim korakom —
  // determinizam ostaje.
  let mjesto = cilj;
  for (let i = 0; i < RAZMICANJE_KORAKA; i++) {
    const zauzeto = world.vehicles.some(
      (o) =>
        o.id !== v.id &&
        !o.done &&
        o.postavljen &&
        o.lane === v.lane &&
        Math.abs(o.s - mjesto) < RAZMICANJE,
    );
    if (!zauzeto) break;
    mjesto = Math.max(0, Math.min(path.length, mjesto + RAZMICANJE));
  }
  v.s = mjesto;
}

/** Najmanji razmak dva vozila koja se u istom trenutku pojave [m]. */
const RAZMICANJE = 30;
const RAZMICANJE_KORAKA = 20;

// ── tok saobraćaja ─────────────────────────────────────────────────────────

/** Koliko prije kraja puta tok više ne pušta vozila [m]. */
const KRAJ_PUTA = 30;
/**
 * Koliko oko igrača na startu nema vozila našeg smjera [m].
 *
 * Igrač kreće u vožnji: vozilo tik pred haubom bi značilo kočenje u prvoj
 * sekundi, a tik iza njega sudar prije nego što se išta vidi.
 */
const PRAZNO_ISPRED = 80;
const PRAZNO_IZA = 30;
/** Najviše vozila koje jedan izvor pusti u jednom koraku — zaštita, ne pravilo. */
const NAJVISE_PO_KORAKU = 8;
/** Koliko vozila najviše može imati početno punjenje jednog izvora — zaštita. */
const NAJVISE_NA_STARTU = 500;

/** Ono što tok treba o putu: opis, nivo i obje trake. */
interface TokPut {
  tok: TokSaobracaja;
  nivo: Level;
  nasa: Path;
  susretna: Path;
}

function tokPut(tpl: Template, paths: ReadonlyMap<string, Path>, scenario: Scenario): TokPut | null {
  if (!scenario.tok || tpl.kind !== "road") return null;
  const nasa = paths.get(lanePathId(tpl.id, 0));
  const susretna = paths.get(lanePathId(tpl.id, 1));
  if (!nasa || !susretna) return null;
  return { tok: scenario.tok, nivo: scenario.difficulty, nasa, susretna };
}

/** Mjesto vozila na putu, u metrima naše trake, bez obzira na to kojom trakom ide. */
const naPutu = (tp: TokPut, v: Vehicle): number => naRuti(v, v.lane === 1 ? tp.susretna : tp.nasa);

/**
 * Brzina koju vozilo toka želi na mjestu na kojem jeste [m/s].
 *
 * Gleda se toliko unaprijed koliko treba da se blago uspori: vozač tablu vidi
 * prije nego što ograničenje počne, pa ni vozilo toka ne ulazi u naselje brzinom
 * sa magistrale.
 */
function zeljenaBrzina(tok: TokSaobracaja, v: Vehicle, put: Path): number {
  const x = naRuti(v, put);
  const pogled = (v.v * v.v) / (2 * USPORENJE_OGRANICENJE) + v.v;
  const smjer = v.lane === 1 ? -1 : 1;
  const ogranicenje = najmanjeOgranicenje(tok.dionice, x, x + smjer * pogled);
  return Math.min(v.kapaBrzine ?? Infinity, ogranicenje * (v.udioBrzine ?? 1));
}

/**
 * Prvo slobodno mjesto za novo vozilo, polazeći od `x` u smjeru `smjer`.
 *
 * Slobodno je kad do svakog vozila u traci ima bar `FOLLOW_GAP` od branika do
 * branika. Ako slobodnog mjesta nema prije `granica`, vraća `null`: izvor tada
 * čeka sljedeći korak, a ne gura vozilo u drugo.
 */
function slobodnoMjesto(
  world: World,
  tp: TokPut,
  traka: 0 | 1,
  x: number,
  duzina: number,
  smjer: 1 | -1,
  granica: number,
): number | null {
  let mjesto = x;
  for (let i = 0; i < NAJVISE_PO_KORAKU * 4; i++) {
    if (smjer > 0 ? mjesto > granica : mjesto < granica) return null;
    const smeta = world.vehicles.find(
      (o) =>
        !o.done &&
        world.t >= o.spawnT &&
        (o.lane ?? 0) === traka &&
        Math.abs(naPutu(tp, o) - mjesto) < (o.length + duzina) / 2 + FOLLOW_GAP,
    );
    if (!smeta) return mjesto;
    mjesto = naPutu(tp, smeta) + smjer * ((smeta.length + duzina) / 2 + FOLLOW_GAP);
  }
  return null;
}

/**
 * Brzina sa kojom vozilo toka nastaje: željena, ali ne veća od one sa koje
 * stigne blago da uspori iza vozila ispred sebe.
 */
function brzinaNastanka(
  world: World,
  tp: TokPut,
  traka: 0 | 1,
  x: number,
  duzina: number,
  zeljena: number,
): number {
  const smjer = traka === 1 ? -1 : 1;
  let najblize = Infinity;
  let prostor = Infinity;
  let vIspred = zeljena;
  for (const o of world.vehicles) {
    if (o.done || world.t < o.spawnT || (o.lane ?? 0) !== traka) continue;
    const ispred = (naPutu(tp, o) - x) * smjer;
    if (ispred <= 0 || ispred >= najblize) continue;
    najblize = ispred;
    prostor = ispred - (o.length + duzina) / 2 - FOLLOW_GAP;
    vIspred = o.v;
  }
  if (!Number.isFinite(najblize)) return zeljena;
  return Math.min(
    zeljena,
    Math.sqrt(vIspred * vIspred + 2 * USPORENJE_OGRANICENJE * Math.max(0, prostor)),
  );
}

/** Napravi vozilo toka na mjestu `x`; vraća brzinu koju ono želi. */
function pustiVozilo(
  world: World,
  tp: TokPut,
  id: string,
  traka: 0 | 1,
  x: number,
  iz: IzvucenoVozilo,
): number {
  const put = traka === 1 ? tp.susretna : tp.nasa;
  const mjere = VOZILA[iz.vrsta];
  const zeljena = Math.min(iz.kapa ?? Infinity, najmanjeOgranicenje(tp.tok.dionice, x, x) * iz.udio);
  world.vehicles.push({
    id,
    kind: "npc",
    pathId: put.id,
    s: traka === 1 ? put.length - x : x,
    v: brzinaNastanka(world, tp, traka, x, mjere.duzina, zeljena),
    length: mjere.duzina,
    width: mjere.sirina,
    vrsta: iz.vrsta,
    intent: { kind: "lane", index: traka },
    arm: traka === 1 ? "S" : "N",
    indicator: null,
    stopHeld: 0,
    done: false,
    spawnT: world.t,
    lane: traka,
    laneT: 1,
    postavljen: true,
    cruise: zeljena,
    udioBrzine: iz.udio,
    ...(iz.kapa === undefined ? {} : { kapaBrzine: iz.kapa }),
  });
  return zeljena;
}

/** Izvor je pustio (ili preskočio) vozilo na mjestu `x`. */
function pomjeriIzvor(izvor: IzvorToka, x: number, v: number, duzina: number): void {
  izvor.k += 1;
  izvor.x = x;
  izvor.v = v;
  izvor.duzina = duzina;
}

/**
 * Saobraćaj koji već postoji kad vožnja počne: cijeli prozor oko igrača.
 *
 * Bez ovoga bi put na startu bio prazan, a gustina bi rasla prvih minut-dva,
 * dok susretna vozila ne stignu od ivice prozora do igrača.
 */
function napuniTok(world: World, tp: TokPut, player: Vehicle): void {
  const { tok, nivo } = tp;
  const gdje = player.s;
  const ispred = Math.min(gdje + LOAD_AHEAD, tp.nasa.length - KRAJ_PUTA);
  const iza = Math.max(0, gdje - KEEP_BEHIND);
  // Prvo vozilo ne stoji tačno na ivici prozora: početak se pomjeri za dio
  // srednjeg razmaka, izvučen iz sjemena, da svaka vožnja ne počne istom slikom.
  const pomak = izvlacenje(tok.seed, "s", -1)() * srednjiRazmak(nivo);
  const prazan = (x: number): IzvorToka => ({
    k: 0,
    x,
    v: tipicnaBrzina(tok.dionice, Math.max(0, x)),
    duzina: VOZILA.auto.duzina,
  });
  world.tok = { susretni: prazan(iza - pomak), nas: { k: 0, t: 0 }, kamiona: 0 };

  // Susretna traka, cijelom dužinom prozora.
  const s = world.tok.susretni;
  for (let i = 0; i < NAJVISE_NA_STARTU; i++) {
    const iz = izvuci(tok.seed, tok.dionice, nivo, "s", s.k, s.x, s.duzina);
    const duzina = VOZILA[iz.vrsta].duzina;
    const cilj = s.x + iz.razmak;
    if (cilj > ispred) break;
    if (cilj < iza) {
      pomjeriIzvor(s, cilj, tipicnaBrzina(tok.dionice, Math.max(0, cilj)), duzina);
      continue;
    }
    const x = slobodnoMjesto(world, tp, 1, cilj, duzina, 1, ispred);
    if (x === null) break;
    pomjeriIzvor(s, x, pustiVozilo(world, tp, `tok-s-${s.k}`, 1, x, iz), duzina);
  }

  // Naš smjer: isto, samo što oko igrača ostaje prazno. Dalje ga, u toku vožnje,
  // drži `regulisiNasSmjer`.
  const nas = world.tok.nas;
  let mjesto = iza - pomak;
  let prethodna: number = VOZILA.auto.duzina;
  for (let i = 0; i < NAJVISE_NA_STARTU; i++) {
    const iz = izvuci(tok.seed, tok.dionice, nivo, "n", nas.k, mjesto, prethodna);
    const id = `tok-n-${nas.k}`;
    nas.k += 1;
    const duzina = VOZILA[iz.vrsta].duzina;
    const cilj = mjesto + iz.razmak;
    if (cilj > ispred) break;
    mjesto = cilj;
    prethodna = duzina;
    const kodIgraca =
      cilj + duzina / 2 > gdje - player.length / 2 - PRAZNO_IZA &&
      cilj - duzina / 2 < gdje + player.length / 2 + PRAZNO_ISPRED;
    if (cilj < iza || kodIgraca) continue;
    const x = slobodnoMjesto(world, tp, 0, cilj, duzina, 1, ispred);
    if (x === null) break;
    pustiVozilo(world, tp, id, 0, x, iz);
    mjesto = x;
  }
}

/** Koliko vozila u traci ima u prozoru gustine oko igrača, ne računajući igrača. */
function uProzoruTrake(world: World, tp: TokPut, player: Vehicle, traka: 0 | 1): number {
  const od = player.s - KEEP_BEHIND;
  const doK = od + SAOBRACAJ_PROZOR;
  let broj = 0;
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT || (o.lane ?? 0) !== traka) continue;
    const x = naPutu(tp, o);
    if (x >= od && x <= doK) broj += 1;
  }
  return broj;
}

/**
 * Sredina najveće praznine u našoj traci između `od` i `doK` [m].
 *
 * Praznina se mjeri od branika do branika stvarnih vozila — i onih van zadatog
 * dijela puta, da novo vozilo ne sjedne tik uz nekoga preko granice. `null` ako
 * nijedna praznina nije dovoljna da novo vozilo sa obje strane ima odstojanje
 * kakvo se drži u koloni.
 */
function najvecaPraznina(
  world: World,
  tp: TokPut,
  od: number,
  doK: number,
  duzina: number,
  brzina: number,
): number | null {
  if (doK <= od) return null;
  const tijela = world.vehicles
    .filter((o) => !o.done && world.t >= o.spawnT && (o.lane ?? 0) === 0)
    .map((o) => {
      const x = naPutu(tp, o);
      return [x - o.length / 2, x + o.length / 2] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  let najveca = duzina + 2 * (FOLLOW_GAP + brzina * KOLONA_ODSTOJANJE[0]);
  let najbolja: number | null = null;
  let slobodnoOd = -Infinity;
  for (let i = 0; i <= tijela.length; i++) {
    const tijelo = tijela[i];
    const lo = Math.max(slobodnoOd, od);
    const hi = Math.min(tijelo ? tijelo[0] : Infinity, doK);
    if (hi - lo >= najveca) {
      najveca = hi - lo;
      najbolja = (lo + hi) / 2;
    }
    if (tijelo) slobodnoOd = Math.max(slobodnoOd, tijelo[1]);
  }
  return najbolja;
}

/**
 * Gustina našeg smjera: dopuni kad fali, skloni kad je previše. Zašto se naš
 * smjer drži broja, a susretni teče sam, stoji u `sim/tok.ts`.
 *
 * Novo vozilo nastaje u najvećoj praznini ispred igrača, ali ne bliže od
 * `UBACI_ISPRED` — van kadra i van dometa oznake, kao da je ušlo sa sporednog
 * puta. Tek ako ispred nema mjesta, traži se iza, isto van dometa. Sklanja se
 * vozilo toka najdalje od igrača, i to samo van tog istog dometa: ono što igrač
 * vidi ili na što ga oznaka upozorava ne nestaje.
 */
function regulisiNasSmjer(world: World, tp: TokPut, player: Vehicle, cilj: number): void {
  const nas = world.tok!.nas;
  if (world.t - nas.t < SAOBRACAJ_POPRAVKA) return;
  const broj = uProzoruTrake(world, tp, player, 0);
  const gdje = player.s;
  const od = gdje - KEEP_BEHIND;
  const doK = Math.min(od + SAOBRACAJ_PROZOR, tp.nasa.length - KRAJ_PUTA);

  if (broj < cilj - SAOBRACAJ_MANJAK) {
    nas.t = world.t;
    const iz = izvuci(tp.tok.seed, tp.tok.dionice, tp.nivo, "n", nas.k, gdje + UBACI_ISPRED, VOZILA.auto.duzina);
    const duzina = VOZILA[iz.vrsta].duzina;
    const brzina = tipicnaBrzina(tp.tok.dionice, gdje);
    const x =
      najvecaPraznina(world, tp, gdje + UBACI_ISPRED, doK, duzina, brzina) ??
      najvecaPraznina(world, tp, Math.max(0, od), gdje - OZNAKA_DOMET_PUT, duzina, brzina);
    if (x === null) return;
    pustiVozilo(world, tp, `tok-n-${nas.k}`, 0, x, iz);
    nas.k += 1;
    return;
  }

  if (broj > cilj + SAOBRACAJ_VISAK) {
    nas.t = world.t;
    let najdalje: Vehicle | null = null;
    let daljina = 0;
    for (const o of world.vehicles) {
      if (o.done || world.t < o.spawnT || (o.lane ?? 0) !== 0 || o.udioBrzine === undefined) continue;
      const d = naPutu(tp, o) - gdje;
      if (d < -KEEP_BEHIND || d > SAOBRACAJ_PROZOR - KEEP_BEHIND) continue;
      if (d <= UBACI_ISPRED && d >= -OZNAKA_DOMET_PUT) continue;
      if (Math.abs(d) > daljina) {
        daljina = Math.abs(d);
        najdalje = o;
      }
    }
    if (najdalje) najdalje.done = true;
  }
}

/**
 * Tok saobraćaja u jednom koraku.
 *
 * Zamišljeno posljednje vozilo svakog izvora se pomjeri svojom brzinom, pa izvor
 * pušta nova vozila dok između njega i ivice prozora ima praznine veće od
 * sljedeće izvučene. Razlog zašto ovako, a ne po rasporedu, stoji u `sim/tok.ts`.
 */
function pustiTok(world: World, tp: TokPut, player: Vehicle): void {
  const stanje = world.tok;
  if (!stanje) return;
  const { tok, nivo } = tp;
  const gdje = player.s;
  const ispred = Math.min(gdje + LOAD_AHEAD, tp.nasa.length - KRAJ_PUTA);
  const [najmanje, najvise] = SAOBRACAJ_U_PROZORU[nivo];
  // U prozoru se broje oba smjera, pa na jedan smjer ide polovina.
  const ciljPoSmjeru = (najmanje + najvise) / 4;

  // Susretni: zamišljeno posljednje vozilo ide nama u susret, a novo nastaje
  // iza njega — dalje od nas.
  const s = stanje.susretni;
  s.x -= s.v * DT;
  let susretnih = uProzoruTrake(world, tp, player, 1);
  const krajProzora = gdje - KEEP_BEHIND + SAOBRACAJ_PROZOR;
  for (let i = 0; i < NAJVISE_PO_KORAKU; i++) {
    const iz = izvuci(tok.seed, tok.dionice, nivo, "s", s.k, s.x, s.duzina);
    const duzina = VOZILA[iz.vrsta].duzina;
    const x = slobodnoMjesto(world, tp, 1, s.x + iz.razmak, duzina, 1, ispred);
    if (x === null) break;
    // Previše susretnih u prozoru: zbiju se tamo gdje je put sporiji. Izvor tada
    // vozilo preskoči — zamišljeno mjesto ide dalje, a vozila nema.
    if (susretnih > ciljPoSmjeru + SAOBRACAJ_VISAK) {
      pomjeriIzvor(s, x, tipicnaBrzina(tok.dionice, x), duzina);
      continue;
    }
    pomjeriIzvor(s, x, pustiVozilo(world, tp, `tok-s-${s.k}`, 1, x, iz), duzina);
    if (x <= krajProzora) susretnih += 1;
  }

  // Naš smjer se drži broja — vidi `regulisiNasSmjer`.
  regulisiNasSmjer(world, tp, player, ciljPoSmjeru);

  // Kamion na planinskom putu: pojavi se ispred igrača, van kadra.
  while (stanje.kamiona < tok.kamioni.length && gdje >= tok.kamioni[stanje.kamiona]!) {
    const k = stanje.kamiona;
    stanje.kamiona += 1;
    const cilj = gdje + KAMION_ISPRED;
    // Kamion koji već vozi ispred je dovoljan: zadatak je da se jedan prati ili
    // pretekne, a ne da se nanižu jedan za drugim.
    const vecIma = world.vehicles.some(
      (o) =>
        !o.done &&
        world.t >= o.spawnT &&
        (o.lane ?? 0) === 0 &&
        o.vrsta === "kamion" &&
        naPutu(tp, o) > gdje &&
        naPutu(tp, o) < cilj + 2 * KAMION_ISPRED,
    );
    if (vecIma) continue;
    const iz = izvuci(tok.seed, tok.dionice, nivo, "k", k, cilj, VOZILA.auto.duzina);
    const x = slobodnoMjesto(world, tp, 0, cilj, VOZILA.kamion.duzina, 1, ispred);
    if (x !== null) pustiVozilo(world, tp, `tok-k-${k}`, 0, x, iz);
  }
}

/**
 * Poslije koliko sekundi se scenario prekida.
 *
 * Raskrsnica se rješava u sekundama i dvije minute su tamo znak da je nešto
 * zaglavljeno. Dionica putovanja po zadatku traje četiri minuta, pa bi je isti
 * broj obarao uvijek — vidi `TRIP_SEGMENT_TIMEOUT_FACTOR`.
 */
export function maxSecondsFor(tpl: Template): number {
  // Rok se računa iz DUŽINE dionice, ne iz dogovorenog trajanja: sa stvarnom
  // geometrijom dionice više nisu jednako duge, pa bi fiksnih deset minuta
  // obaralo Žabljak — Plužine svaki put.
  if (tpl.kind !== "road") return MAX_SCENARIO_SECONDS;
  const trajanje = tpl.trajanje ?? (tpl.vMax > 0 ? tpl.length / tpl.vMax : TRIP_SEGMENT_TIME);
  return Math.max(trajanje, TRIP_SEGMENT_TIME) * TRIP_SEGMENT_TIMEOUT_FACTOR;
}

/** Da li je NPC zakočio baš zbog igrača (a ne zbog drugog NPC-a). */
function blamePlayer(
  world: World,
  ctx: Ctx,
  npc: Vehicle,
  npcPath: Path,
  player: Vehicle,
  playerPath: Path,
): boolean {
  for (const c of ctx.conflicts.get(npcPath.id) ?? []) {
    if (c.pathB !== playerPath.id || c.sA < npc.s) continue;
    const playerNear = inBox(player, playerPath) || timeTo(player, c.sB) < ctx.dif.ttcThreshold;
    if (!playerNear) continue;
    // Kriv je samo ako je NPC imao prednost.
    const decision = whoYields(
      party(ctx, npc, world.phaseIndex),
      party(ctx, player, world.phaseIndex),
    );
    if (decision === "b") return true;
  }
  return false;
}

// ── prekršaji ───────────────────────────────────────────────────────────────

/**
 * Upisuje prekršaj. Jedan po vrsti — a kod pokazivača jedan po vrsti I fazi,
 * jer „nema žmigavca pri najavi" i „ugašen prije kraja skretanja" nisu ista
 * greška iako nose isti tip.
 */
function add(
  world: World,
  v: Omit<Violation, "penaltyRef" | "severity"> & { severity?: Severity },
): void {
  const kljuc = `${v.type}:${v.phaseId ?? ""}`;
  if (world.violations.some((x) => `${x.type}:${x.phaseId ?? ""}` === kljuc)) return;
  world.violations.push({
    ...v,
    severity: v.severity ?? "fail",
    penaltyRef: PENALTY_REF[v.type],
  });
}

function detectViolations(
  world: World,
  ctx: Ctx,
  scenario: Scenario,
  player: Vehicle,
  path: Path,
  sBefore: number,
): void {
  if (player.done) return;
  const control = armControl(ctx, player.arm, world.phaseIndex);
  const crossedStopLine = sBefore < path.stopLineS && player.s >= path.stopLineS;

  // ── STOP znak ─────────────────────────────────────────────────────────────
  if (crossedStopLine && control === "stop" && player.stopHeld < STOP_HOLD) {
    add(world, {
      type: "stopSign",
      t: world.t,
      details: `Prošao stop-liniju bez zaustavljanja (stajao ${player.stopHeld.toFixed(2)} s).`,
    });
  }

  // ── naredba policajca ─────────────────────────────────────────────────────
  // Kad je policajac na raskrsnici, on je taj koji zabranjuje prolaz, pa i
  // prekršaj mora tako da se zove: „prošao na crveno" bi bilo netačno, jer
  // svjetlo u tom trenutku može biti i zeleno.
  if (crossedStopLine && ctx.officerAllow && control === "red") {
    add(world, {
      type: "officer",
      t: world.t,
      details: "Prošao iako policajac zaustavlja saobraćaj sa tog pravca.",
    });
    world.outcome = "failed";
    return;
  }

  // ── crveno svjetlo ────────────────────────────────────────────────────────
  if (
    crossedStopLine &&
    !ctx.officerAllow &&
    (control === "red" || (control === "yellow" && !world.yellowCommitted))
  ) {
    add(world, {
      type: "redLight",
      t: world.t,
      details: control === "red" ? "Ušao na crveno svjetlo." : "Ušao na žuto, a mogao je stati.",
    });
    world.outcome = "failed";
  }

  // ── pješak na prelazu ─────────────────────────────────────────────────────
  for (const span of crosswalkSpans(ctx.tpl, path)) {
    // Prekršaj je ULAZAK na prelaz dok je pješak na kolovozu, a ne blizina.
    if (sBefore >= span.from || player.s < span.from) continue;
    const ped = world.pedestrians.find(
      (x) => !x.done && world.t >= x.spawnT && x.arm === span.arm && pedestrianOnRoad(ctx.tpl, x),
    );
    if (!ped) continue;
    add(world, {
      type: "pedestrian",
      t: world.t,
      details: "Ušao na pješački prelaz dok je pješak na kolovozu.",
    });
    world.outcome = "failed";
    return;
  }

  // ── sudar ─────────────────────────────────────────────────────────────────
  // Tijelo se sudara komad po komad: dugo vozilo prati svoju traku i u krivini,
  // pa se sudar računa po onome što je i nacrtano — vidi `tijeloVozila`.
  const mojeTijelo = tijeloVozila(ctx.tpl, path, player).map((d) =>
    rectCorners(d.pos, d.heading, d.length, d.width),
  );
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    const oPath = ctx.paths.get(o.pathId)!;
    const udaren = tijeloVozila(ctx.tpl, oPath, o).some((d) => {
      const oRect = rectCorners(d.pos, d.heading, d.length, d.width);
      return mojeTijelo.some((p) => polygonsOverlap(p, oRect));
    });
    if (udaren) {
      add(world, { type: "collision", t: world.t, details: "Sudar.", otherVehicleId: o.id });
      world.outcome = "failed";
      return;
    }
  }

  // ── oduzeto prvenstvo ─────────────────────────────────────────────────────
  // Na otvorenom putu prvenstva nema: tamo kočenje zbog nas znači ulazak u
  // tuđu traku ili prerano vraćanje, i o tome sude pravila preticanja. Da se
  // ovdje ne stane, svako preticanje bi se prijavilo kao „oduzeto prvenstvo" —
  // pravilo koje na dionici puta ne postoji.
  const forced =
    ctx.tpl.kind === "road"
      ? undefined
      : world.events.find((e) => e.type === "forcedBrake" && e.by === PLAYER_ID);
  if (forced && forced.type === "forcedBrake") {
    add(world, {
      type: "rightOfWay",
      t: world.t,
      details: "Vozilo koje ima prednost moralo je naglo da koči.",
      otherVehicleId: forced.vehicleId,
    });
    world.outcome = "failed";
    return;
  }

  for (const c of ctx.conflicts.get(path.id) ?? []) {
    // Zona u kojoj se sudi „ušao je ispred onoga ko ima prednost".
    //
    // Na krstastoj raskrsnici je konflikt duboko u tijelu raskrsnice, pa je
    // dovoljno gledati metar prije njega. U kružnom toku je konflikt SAM ULAZ,
    // pa bi ta ista zona bila široka jedan metar — a igrač bi u njoj već važio
    // za vozilo u prstenu i dobio bi ravnopravan tretman. Zato tamo zona
    // počinje na liniji ustupanja, gdje se odluka i donosi.
    const naUlasku = Boolean(path.ring) && Math.abs(c.sA - path.boxEnterS) < 0.5;
    const odKada = naUlasku ? path.stopLineS : c.sA - 1;
    if (player.s < odKada || player.s > c.sA + player.length) continue;
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.pathId !== c.pathB) continue;
      if (o.s > c.sB + o.length) continue; // već prošao
      const decision = whoYields(
        party(ctx, player, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision !== "a") continue;
      if (timeTo(o, c.sB) < ctx.dif.ttcThreshold || inBox(o, ctx.paths.get(o.pathId)!)) {
        add(world, {
          type: "rightOfWay",
          t: world.t,
          details: "Ušao u raskrsnicu ispred vozila koje ima prednost.",
          otherVehicleId: o.id,
        });
        world.outcome = "failed";
        return;
      }
    }
  }

  // ── zadržavanje saobraćaja ────────────────────────────────────────────────
  // Tajmer teče SAMO kad je put stvarno slobodan: ne smije da kazni ispravno
  // čekanje dok vozilo kojem se ustupa još prelazi raskrsnicu.
  const blocked = pathBlocked(world, ctx, player, path);
  if (player.v < CRAWL_SPEED && !blocked && control !== "red" && control !== "yellow") {
    world.idleT += DT;
    if (world.idleT > ctx.dif.obstructionTimeout) {
      add(world, {
        type: "obstruction",
        t: world.t,
        details: `Stajao ${ctx.dif.obstructionTimeout} s na slobodnom putu i zadržavao saobraćaj.`,
      });
    }
  } else {
    world.idleT = 0;
  }

  // ── prekoračenje brzine ───────────────────────────────────────────────────
  // Ograničenje se na ruti mijenja od dionice do dionice, pa se uzima ono koje
  // važi TU GDJE JE VOZILO. Bez toga se sto osam kroz Cetinje sudi po
  // magistrali, jer je ona najbrža dionica na toj ruti.
  const dozvoljeno =
    ctx.tpl.kind === "road" && ctx.tpl.vMaxNa ? ctx.tpl.vMaxNa(player.s) : ctx.vMax;
  if (player.v > dozvoljeno * SPEEDING_FACTOR) {
    add(world, {
      type: "speeding",
      t: world.t,
      details: `Brzina ${(player.v * 3.6).toFixed(0)} km/h iznad dozvoljene (${(dozvoljeno * 3.6).toFixed(0)}).`,
    });
  }
}

// ── autoput ────────────────────────────────────────────────────────────────

/**
 * Prelazak iz trake u traku.
 *
 * Zahtjev se prihvata samo kad prelazak već ne traje — držanje dugmeta ne znači
 * ništa. Uslov za prelazak je pokazivač uključen bar `INDICATOR_LEAD_TIME`
 * ranije; bez njega ostali ne znaju šta namjeravaš, a to je cijela poenta.
 */
function laneStep(world: World, ctx: Ctx, v: Vehicle, input: Input): void {
  const tpl = ctx.tpl as HighwayTemplate;

  // Prelazak u toku — samo napreduje.
  if (v.laneFrom !== undefined && (v.laneT ?? 1) < 1) {
    v.laneT = Math.min(1, (v.laneT ?? 0) + DT / LANE_CHANGE_TIME);
    if (v.laneT >= 1) v.laneFrom = undefined;
    return;
  }

  const strana = input.changeLane ?? null;
  if (!strana) return;
  const iz = v.lane ?? 0;
  const u = strana === "left" ? iz + 1 : iz - 1;
  if (u < -1 || u > tpl.lanes - 1) return;

  // Pokazivač: mora biti na pravu stranu i uključen dovoljno rano.
  const upaljen = world.indicatorLog.filter((e) => e.indicator === strana).at(-1);
  const trenutni = v.indicator;
  if (trenutni !== strana || !upaljen) {
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: "traka",
      details: "Promjena trake bez pokazivača.",
    });
  } else if (world.t - upaljen.t < INDICATOR_LEAD_TIME) {
    add(world, {
      type: "indicatorMissing",
      t: world.t,
      phaseId: "traka",
      details: "Pokazivač je uključen prekasno prije promjene trake.",
    });
  }

  // Odstojanje u traci u koju se ulazi.
  const praznina = mergeGap(world, v, u);
  if (!praznina.safe) {
    add(world, {
      type: "unsafeMerge",
      t: world.t,
      details:
        praznina.behind < MERGE_GAP_TIME
          ? "Uključenje ispred vozila koje je bilo preblizu."
          : "Uključenje preblizu vozilu ispred.",
      otherVehicleId: praznina.blame ?? undefined,
    });
  }

  v.laneFrom = iz;
  v.lane = u;
  v.laneT = 0;
}

/**
 * Praznina u traci u koju se prelazi, mjerena u sekundama.
 *
 * Izdvojeno zato što isto pitanje postavljaju dvije strane: simulacija kad
 * sudi igraču, i savršen vozač kad odlučuje da li smije da se uključi. Da
 * svaka ima svoju kopiju, bot bi mogao da prolazi test i po pravilu koje se u
 * međuvremenu promijenilo.
 */
export function mergeGap(
  world: World,
  me: Vehicle,
  target: number,
): {
  behind: number;
  ahead: number;
  safe: boolean;
  blame: string | null;
  /** Brzine prvog vozila ispred i prvog iza u toj traci; `null` ako ih nema. */
  aheadV: number | null;
  behindV: number | null;
} {
  let iza: Vehicle | null = null;
  let ispred: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === me.id || o.done || world.t < o.spawnT) continue;
    if (!trake(o).includes(target)) continue;
    if (o.s < me.s && (!iza || o.s > iza.s)) iza = o;
    if (o.s > me.s && (!ispred || o.s < ispred.s)) ispred = o;
  }
  const behind = iza && iza.v > 0.5 ? (me.s - iza.s) / iza.v : Infinity;
  const ahead = ispred && me.v > 0.5 ? (ispred.s - me.s) / me.v : Infinity;
  const safe = behind >= MERGE_GAP_TIME && ahead >= MERGE_AHEAD_TIME;
  return {
    behind,
    ahead,
    safe,
    blame: safe ? null : ((behind < MERGE_GAP_TIME ? iza?.id : ispred?.id) ?? null),
    aheadV: ispred?.v ?? null,
    behindV: iza?.v ?? null,
  };
}

/**
 * Prekršaji koji postoje samo na autoputu.
 *
 * Nijedan se ne oslanja na prvenstvo — tamo ga nema. Sve je brzina, odstojanje
 * i to da li si u traci u kojoj smiješ da budeš.
 */
function highwayViolations(world: World, ctx: Ctx, player: Vehicle, input: Input): void {
  const tpl = ctx.tpl as HighwayTemplate;
  const uTraci = player.lane ?? 0;
  const vozna = uTraci >= 0;

  // Vozilo ispred u istoj traci — nekoliko pravila zavisi od njega.
  let ispred: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    if (o.s <= player.s || !shareLane(trake(player), trake(o))) continue;
    if (!ispred || o.s < ispred.s) ispred = o;
  }
  const razmak =
    ispred && player.v > 0.5 ? (ispred.s - player.s - ispred.length) / player.v : Infinity;

  /**
   * Prespora vožnja u voznoj traci — ali samo kad je put ispred slobodan.
   *
   * Donja granica na autoputu ne važi kad te usporava saobraćaj: vozilo iza
   * kolone koja stoji ne krši ništa. Bez ovog uslova bi se kažnjavalo baš ono
   * ponašanje koje se traži — držanje odstojanja iza sporijeg vozila.
   */
  const putSlobodan = razmak > HIGHWAY_FOLLOW_TIME * 3;
  if (vozna && putSlobodan && player.v < tpl.vMin) {
    world.highway.tooSlowT += DT;
    if (world.highway.tooSlowT > TOO_SLOW_TIME) {
      add(world, {
        type: "tooSlow",
        t: world.t,
        details: `Vožnja ispod donje granice (${Math.round(tpl.vMin * 3.6)} km/h).`,
      });
    }
  } else {
    world.highway.tooSlowT = 0;
  }

  // Zaustavljanje na traci za ubrzavanje, poslije njene polovine.
  const polovina = (tpl.rampRange[0] + tpl.rampRange[1]) / 2;
  if (!vozna && onRamp(tpl, player.s) && player.s > polovina && player.v < RAMP_STOP_SPEED) {
    add(world, {
      type: "stoppedOnRamp",
      t: world.t,
      details: "Zaustavljanje na traci za ubrzavanje.",
    });
  }

  // Vožnja spoljnom trakom tamo gdje ona nije ni ulaz ni izlaz.
  const trakaVazi = onRamp(tpl, player.s) || onExitLane(tpl, player.s);
  if (!vozna && !trakaVazi) {
    world.highway.shoulderT += DT;
    if (world.highway.shoulderT > HARD_SHOULDER_TIME) {
      add(world, {
        type: "hardShoulder",
        t: world.t,
        details: "Vožnja zaustavnom trakom van ulaza i izlaza.",
      });
    }
  } else {
    world.highway.shoulderT = 0;
  }

  // Odstojanje do vozila ispred.
  if (player.v > TAILGATE_SPEED && razmak < TAILGATE_GAP) {
    world.highway.tailgateT += DT;
    if (world.highway.tailgateT > TAILGATE_TIME) {
      add(world, { type: "tailgating", t: world.t, details: "Vožnja preblizu vozilu ispred." });
    }
  } else {
    world.highway.tailgateT = 0;
  }

  /**
   * Naglo kočenje bez razloga.
   *
   * Dva uslova, i oba su nužna: put ispred je slobodan (znači nema razloga) i
   * neko je odmah iza (znači da to nekoga ugrožava). Bez drugog uslova bi se
   * kažnjavalo svako usporavanje na praznom autoputu, a to nije prekršaj nego
   * način da se vozi sporije.
   */
  let iza: Vehicle | null = null;
  for (const o of world.vehicles) {
    if (o.id === player.id || o.done || world.t < o.spawnT) continue;
    if (o.s >= player.s || !shareLane(trake(player), trake(o))) continue;
    if (!iza || o.s > iza.s) iza = o;
  }
  const razmakIza = iza && iza.v > 0.5 ? (player.s - player.length - iza.s) / iza.v : Infinity;
  if (
    vozna &&
    input.brake * B_MAX > HIGHWAY_BRAKE &&
    razmak > TAILGATE_GAP * 2 &&
    razmakIza < TAILGATE_GAP * 1.5
  ) {
    add(world, {
      type: "brakingOnHighway",
      t: world.t,
      details: "Naglo kočenje bez vozila ispred, a sa vozilom neposredno iza.",
      otherVehicleId: iza?.id,
    });
  }
}

// ── problematični događaji ─────────────────────────────────────────────────

/**
 * Okida događaje kojima je došlo vrijeme.
 *
 * Okidač je vrijeme ili mjesto igrača — oboje determinisano, pa ponavljanje
 * snimka daje isti događaj u istom trenutku. Nasumičnost bi pokvarila i snimak
 * i testove, pa je ovdje nema: nivo težine bira KOJI scenariji nose događaje,
 * ne hoće li se dogoditi.
 */
function fireHazards(world: World, scenario: Scenario, player: Vehicle): void {
  const spisak = scenario.hazards ?? [];
  spisak.forEach((h, i) => {
    if (world.hazardsFired.includes(i)) return;
    const vrijeme = h.atTime !== undefined && world.t >= h.atTime;
    const mjesto = h.atPlayerS !== undefined && player.s >= h.atPlayerS;
    if (!vrijeme && !mjesto) return;

    world.hazardsFired.push(i);
    world.events.push({ type: "hazard", t: world.t, kind: h.kind, index: i });
    world.reaction.push({ at: world.t, kind: h.kind, brakedAt: null });
    applyHazard(world, h);
  });
}

function applyHazard(world: World, h: ScenarioHazard): void {
  if (h.kind === "pedestrianSteps") {
    const ped = world.pedestrians[h.target];
    if (ped) ped.spawnT = world.t;
    return;
  }
  const v = world.vehicles.find((x) => x.id === `npc${h.target + 1}`);
  if (!v) return;
  switch (h.kind) {
    case "npcRunsStop":
      v.reckless = true;
      break;
    case "npcLateSpawn":
      v.spawnT = world.t;
      if (h.npcS !== undefined) v.s = h.npcS;
      break;
    case "emergencyVehicle":
      v.emergency = true;
      v.spawnT = Math.min(v.spawnT, world.t);
      break;
  }
}

// ── pokazivač pravca ───────────────────────────────────────────────────────

/** Stanje pokazivača na mjestu `s` — posljednja promjena prije tog mjesta. */
function indicatorAt(log: readonly IndicatorEvent[], s: number): "left" | "right" | null {
  let cur: "left" | "right" | null = null;
  for (const e of log) if (e.s <= s) cur = e.indicator;
  return cur;
}

/** Sva stanja kroz koja je pokazivač prošao na dionici `[from, to)`. */
function statesOver(
  log: readonly IndicatorEvent[],
  from: number,
  to: number,
): ("left" | "right" | null)[] {
  const out: ("left" | "right" | null)[] = [indicatorAt(log, from)];
  for (const e of log) if (e.s > from && e.s < to) out.push(e.indicator);
  return out;
}

/** Gdje je pokazivač PRVI put bio u traženom stanju na toj dionici. */
function firstAt(
  log: readonly IndicatorEvent[],
  want: "left" | "right",
  from: number,
  to: number,
): number | null {
  if (indicatorAt(log, from) === want) return from;
  for (const e of log) if (e.s > from && e.s < to && e.indicator === want) return e.s;
  return null;
}

/**
 * Ocjenjuje faze pokazivača čim ih igrač pređe.
 *
 * Ova funkcija ne zna nijedno pravilo napamet — sve čita iz `phasesFor`, koji
 * čita iz tabele. Zbog toga izmjena tabele mijenja ocjenu bez ijedne izmjene
 * ovdje, što `indicator.test.ts` i provjerava.
 */
function evaluateIndicator(
  world: World,
  scenario: Scenario,
  player: Vehicle,
  path: Path,
): void {
  // Kad pokazivač pali simulacija, igrač nije mogao da pogriješi, pa bi ocjena
  // sudila simulaciji. Dnevnik se i dalje piše — za prikaz i za ponavljanje.
  if (scenario.pokazivaci === "auto") return;
  const grace = DIFFICULTY[scenario.difficulty].indicatorGrace;
  const prekinuto = world.outcome !== "running";
  for (const ph of phasesFor(path, player.intent, scenario.indicatorRules)) {
    if (world.indicatorDone.includes(ph.id)) continue;

    const predjena = player.s >= ph.to || player.done;
    // Kad se vožnja prekine usred faze (sudar, oduzeto prvenstvo), ocjenjuje se
    // samo ono što je stvarno odvezeno, i samo ono što je do tog mjesta već
    // bilo dužno. Bez toga bi propušten žmigavac nestao svaki put kad scenario
    // padne prije izlaska iz raskrsnice — a upravo tada je najvažniji.
    const dospjelo = ph.mustBeSetBefore === null ? predjena : player.s >= ph.mustBeSetBefore;
    const usla = player.s > ph.from;
    if (!predjena && !(prekinuto && usla && dospjelo)) continue;
    world.indicatorDone.push(ph.id);

    const kraj = Math.min(ph.to, Math.max(player.s, ph.from));
    if (kraj <= ph.from) continue;
    // Zahtjev faze stupa na snagu `INDICATOR_GRACE` metara poslije njenog
    // početka. Bez toga se prelaz iz jedne faze u drugu prijavljuje kao greška:
    // vozač koji prebaci žmigavac TAČNO na granici biva zabilježen metar
    // kasnije, jer se simulacija odvija u koracima.
    const pocetak = Math.min(ph.from + grace, kraj);
    const stanja = statesOver(world.indicatorLog, pocetak, kraj);
    const detalj = (x: string) => x;

    if (ph.expected === null) {
      if (stanja.some((x) => x !== null)) {
        add(world, {
          type: ph.mismatchType,
          severity: ph.severity,
          t: world.t,
          phaseId: ph.id,
          details: detalj("Pokazivač je bio uključen tamo gdje se ne očekuje."),
        });
      }
      continue;
    }

    if (stanja.some((x) => x !== null && x !== ph.expected)) {
      add(world, {
        type: "indicatorWrong",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Uključen je pokazivač na pogrešnu stranu."),
      });
      continue;
    }

    if (!stanja.includes(ph.expected)) {
      add(world, {
        type: "indicatorMissing",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač uopšte nije bio uključen."),
      });
      continue;
    }

    const prvi = firstAt(world.indicatorLog, ph.expected, pocetak, kraj);
    if (
      ph.mustBeSetBefore !== null &&
      prvi !== null &&
      prvi > ph.mustBeSetBefore + grace
    ) {
      add(world, {
        type: "indicatorLate",
        severity: "minor",
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač je uključen prekasno — poslije mjesta na kojem se traži."),
      });
      continue;
    }

    if (predjena && indicatorAt(world.indicatorLog, kraj - 0.01) !== ph.expected) {
      add(world, {
        type: "indicatorMissing",
        severity: ph.severity,
        t: world.t,
        phaseId: ph.id,
        details: detalj("Pokazivač je ugašen prije nego što je manevar završen."),
      });
    }
  }
}

/**
 * Da li igrač ima razlog da stoji: neko kome mora ustupiti nailazi, ili neko
 * fizički zauzima konfliktnu tačku na njegovoj putanji.
 */
function pathBlocked(world: World, ctx: Ctx, player: Vehicle, path: Path): boolean {
  // Dok traje problematičan događaj, zadržavanje saobraćaja se NE broji.
  // Igrač tada ispravno stoji i čeka da prekršilac prođe; kazniti ga za to bilo
  // bi tačno ono što se ovom igrom uči da se ne radi.
  if (world.reaction.some((r) => world.t - r.at < HAZARD_WINDOW)) return true;

  // Pješak na prelazu ispred je razlog da se stoji — čekanje tada nije
  // zadržavanje saobraćaja nego propisno ustupanje.
  if (Number.isFinite(pedestrianLimit(world, ctx, player, path))) return true;

  for (const c of ctx.conflicts.get(path.id) ?? []) {
    if (c.sA < player.s) continue;
    for (const o of world.vehicles) {
      if (o.id === player.id || o.done || world.t < o.spawnT || o.pathId !== c.pathB) continue;
      if (o.s > c.sB + o.length) continue;

      const oPath = ctx.paths.get(o.pathId)!;
      // Vozilo koje trenutno zauzima konfliktnu tačku blokira bez obzira na to
      // ko ima prednost — čekanje da prođe nije zadržavanje saobraćaja.
      if (Math.abs(o.s - c.sB) < o.length + GAP) return true;
      if (inBox(o, oPath)) return true;

      const decision = whoYields(
        party(ctx, player, world.phaseIndex),
        party(ctx, o, world.phaseIndex),
      );
      if (decision === "a" && timeTo(o, c.sB) < ctx.dif.ttcThreshold) return true;
    }
  }
  return false;
}

// ── pomoć za render i testove ───────────────────────────────────────────────

export function vehiclePose(world: World, v: Vehicle): { pos: { x: number; y: number }; heading: { x: number; y: number } } {
  const tpl = templateById(world.templateId)!;
  const path = compile(tpl).paths.get(v.pathId)!;
  return {
    pos: pointAt(path.points, path.cum, v.s),
    heading: headingAt(path.points, path.cum, v.s),
  };
}
