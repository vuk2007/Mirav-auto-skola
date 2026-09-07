/**
 * Generisanje segmenata za beskonačni mod „Smjena".
 *
 * Segment je običan `Scenario` — isti tip koji koriste napisane situacije. Time
 * cijela mašinerija (pravila, prekršaji, pokazivač, ponavljanje) radi bez
 * ijedne izmjene, a generator ima samo jedan posao: da napravi situaciju koja
 * je rješiva.
 *
 * Sve zavisi isključivo od sjemena i nivoa. Isti par daje isti lanac, pa se
 * neuspio slučaj iz fuzz testa može tačno ponoviti.
 */

import { perfectBot, run } from "../sim/bots";
import { DIFFICULTY, type Level } from "../sim/config";
import { rng } from "../sim/geometry";
import { TEMPLATES } from "../sim/intersection";
import type {
  ArmId,
  HighwayTemplate,
  Intent,
  Scenario,
  ScenarioHazard,
  ScenarioNpc,
} from "../sim/types";

/** Raskrsnice iz kojih se bira. */
export const SEGMENT_TEMPLATES = [
  "cross-none",
  "cross-priority-ns",
  "cross-stop-ew",
  "cross-lights",
  "kruzni",
] as const;

/**
 * Dionica autoputa u lancu.
 *
 * Stoji odvojeno od `SEGMENT_TEMPLATES` jer se ne bira ravnopravno sa
 * raskrsnicama nego po vjerovatnoći nivoa (`highwayChance`) — na prvom nivou
 * je nema uopšte.
 */
export const HIGHWAY_TEMPLATE = "autoput-smjena";

export type SegmentTemplate = (typeof SEGMENT_TEMPLATES)[number] | typeof HIGHWAY_TEMPLATE;

/**
 * Koliko sekundi poslije starta bezobzirni igrač stigne do raskrsnice.
 *
 * Izmjereno, ne pogođeno: uz `spawnDistance` od 42 m i `A_MAX`, igrač do
 * stop-linije stiže za oko sedam sekundi. Po tome se biraju prozori nastanka
 * NPC-a, da se susret stvarno desi.
 */
const DO_LINIJE = 7.1;

/** Koliko NPC-u treba do raskrsnice pri datoj brzini [s]. */
const npcDolazak = (speed: number) => 60 / speed;

/** Koliko se razmiču nailasci uzastopnih vozila [s]. */
const RAZMAK_NAILAZAKA = 1.8;

const KRAKOVI: ArmId[] = ["E", "S", "W"];

function izborNiza<T>(rand: () => number, niz: readonly T[]): T {
  return niz[Math.min(niz.length - 1, Math.floor(rand() * niz.length))]!;
}

/**
 * Jedan segment.
 *
 * Igrač uvijek ulazi sa sjevera i prolazi pravo — u kružnom toku je to drugi
 * izlaz. Time lanac ostaje jedna ulica kroz niz raskrsnica, umjesto da se
 * lomi na svakom skretanju.
 */
/**
 * Segment, uz provjeru da je rješiv.
 *
 * Generator ne obećava rješivost — on je PROVJERAVA. Svaka varijanta se pusti
 * kroz savršenog vozača i prihvata se tek ako prođe bez ijednog prekršaja i bez
 * zaglavljivanja. Bez toga je oko 2% nasumičnih segmenata na najtežim nivoima
 * bilo nerješivo, a zadatak izričito zabranjuje situacije bez ispravnog
 * rješenja. Jedna provjera je jedan prolaz simulacije — desetak milisekundi.
 */
export function generateSegment(seed: number, level: Level, index: number): Scenario {
  for (let pokusaj = 0; pokusaj < 6; pokusaj += 1) {
    const kandidat = sastavi(seed, level, index, pokusaj);
    if (rjesiv(kandidat, seed)) return kandidat;
  }
  // Ako nijedna varijanta ne prođe, ide najjednostavnija: jedno vozilo i širok
  // prozor. Nju fuzz test i dalje provjerava — ako i ona padne, nešto je u
  // pravilima, a ne u generatoru.
  return sastavi(seed, level, index, -1);
}

function rjesiv(s: Scenario, seed: number): boolean {
  const { world, finished } = run(s, perfectBot, seed);
  return finished && world.outcome === "passed" && world.violations.length === 0;
}

function sastavi(seed: number, level: Level, index: number, pokusaj: number): Scenario {
  const rand = rng(seed * 7919 + index * 104729 + 17);
  const dif = DIFFICULTY[level];
  // Odluka o autoputu je prvi potez sjemena, prije svega ostalog. Time je
  // izbor stabilan: `highwayChance` se mijenja po nivou, a ne po tome šta je
  // generator prije toga izvukao.
  if (rand() < dif.highwayChance) return autoput(rand, level, index, pokusaj);
  const tpl = izborNiza(rand, SEGMENT_TEMPLATES);
  const kruzni = tpl === "kruzni";
  const intent: Intent = kruzni ? { kind: "exit", n: 2 } : "straight";

  // Broj vozila raste sa gustinom, ali ne preko granice šablona.
  //
  // Na neregulisanoj raskrsnici i u kružnom toku je granica DVA, i to nije
  // podešavanje osjećaja nego pravila: tri vozila plus igrač na sva četiri
  // kraka čine pravilo desne strane kružnim — nema onoga ko nikoga nema sa
  // svoje desne strane, pa situacija nema ispravno rješenje. `solveOrder` u
  // `lib/simRules.ts` za taj slučaj i vraća `null`. Fuzz test je to izvukao:
  // bez ove granice je oko 6% generisanih segmenata bilo nerješivo.
  const granica = tpl === "cross-none" || kruzni ? 2 : 3;
  const osnovni = 1 + Math.floor(rand() * 2);
  // Svaki sljedeći pokušaj je blaži: manje vozila i veći razmak između njih.
  const popust = pokusaj < 0 ? 9 : Math.floor(pokusaj / 2);
  const koliko = Math.max(
    1,
    Math.min(granica, Math.round(osnovni * dif.densityMultiplier)) - popust,
  );
  const razmak = RAZMAK_NAILAZAKA + 0.6 * Math.max(0, pokusaj);

  const npcs: ScenarioNpc[] = [];
  const zauzeti = new Set<ArmId>();
  for (let i = 0; i < koliko; i++) {
    const slobodni = KRAKOVI.filter((a) => !zauzeti.has(a));
    if (slobodni.length === 0) break;
    const arm = izborNiza(rand, slobodni);
    zauzeti.add(arm);

    const speed = Math.round((9 + rand() * 3) * dif.speedMultiplier * 10) / 10;
    // Prozor se bira tako da NPC stigne do raskrsnice otprilike kad i igrač.
    // Sa gustinom se sužava — manje sreće, više odlučivanja.
    // Razmak između nailazaka je namjerno velik: kad tri vozila stignu u istoj
    // sekundi, igrač nema šta da odluči nego samo da čeka da se raspetlja.
    const sredina = Math.max(0, DO_LINIJE + razmak * i - npcDolazak(speed));
    const pola = Math.max(0.2, 0.4 / dif.densityMultiplier);
    npcs.push({
      arm,
      intent: kruzni ? { kind: "exit", n: 2 } : "straight",
      spawnAt: [Math.round((sredina - pola) * 100) / 100, Math.round((sredina + pola) * 100) / 100],
      speed,
    });
  }

  // Problematičan događaj se bira po vjerovatnoći nivoa, ali sjemenom — tako da
  // je isti lanac uvijek isti. Nasumičnost postoji samo pri pravljenju lanca,
  // nikad u toku vožnje.
  const hazards: ScenarioHazard[] = [];
  if (pokusaj >= 0 && npcs.length > 0 && rand() < dif.ruleBreakerChance) {
    hazards.push({ kind: "npcRunsStop", target: 0, atPlayerS: 30 });
  }

  return {
    id: `smjena-${index}`,
    intersection: tpl,
    difficulty: level,
    title: { me: `Segment ${index + 1}` },
    player: { arm: "N", intent, spawnDistance: 42 },
    npcs,
    hazards: hazards.length > 0 ? hazards : undefined,
    explanation: { me: "" },
  };
}

/**
 * Dionica autoputa: ili uključivanje sa trake za ubrzavanje, ili vožnja u
 * koloni.
 *
 * Oba zadatka su ono što savršen vozač zna sam: uključivanje jer se zaustavnom
 * trakom ne vozi, kolona jer se odstojanje drži. Preticanja i isključenja u
 * lancu NEMA, i to nije previd — oni nisu pravilo nego namjera, pa generator ne
 * bi imao čime da dokaže da su rješivi. Provjera rješivosti je ista za sve
 * segmente i mora ostati poštena.
 *
 * Problematičnih događaja ovdje takođe nema: sva četiri su vezana za
 * raskrsnicu (prolazak STOP-a, pješak na prelazu, vozilo iza zaklona), a
 * izmišljati peti samo da bi ga autoput imao značilo bi pravilo bez pokrića.
 */
function autoput(rand: () => number, level: Level, index: number, pokusaj: number): Scenario {
  const tpl = TEMPLATES[HIGHWAY_TEMPLATE] as HighwayTemplate;
  const dif = DIFFICULTY[level];
  const popust = pokusaj < 0 ? 9 : Math.floor(pokusaj / 2);
  const ukljucenje = rand() < 0.6;
  const brzina = Math.round(22 * dif.speedMultiplier * 10) / 10;
  const koliko = Math.max(
    1,
    Math.min(3, Math.round((1 + Math.floor(rand() * 2)) * dif.densityMultiplier)) - popust,
  );
  // Svaki sljedeći pokušaj razmiče vozila; poslednji ih razmiče toliko da
  // praznine mora biti.
  const razmak = 90 + 35 * Math.max(0, pokusaj) + (pokusaj < 0 ? 200 : 0);
  const npcs: ScenarioNpc[] = [];
  const vozilo = (traka: number, startS: number, speed: number): ScenarioNpc => ({
    arm: "N",
    intent: { kind: "lane", index: traka },
    startS: Math.round(startS),
    spawnAt: [0, 0],
    speed: Math.round(speed * 10) / 10,
  });

  if (ukljucenje) {
    // Igrač je na traci za ubrzavanje, a jedno vozilo ga sustiže s leđa: zbog
    // njega se uključenje ne smije samo „ugurati". Rastojanje je namjerno često
    // manje od `MERGE_GAP_TIME` puta brzina — izmjereno je da je sa širim
    // razmakom svako uključenje bilo bezbjedno već u prvoj sekundi, pa se
    // praznina nije ni tražila. Sa gustinom se skuplja.
    // Svaki sljedeći pokušaj daje više prostora, a posljednji uklanja vozilo
    // sa leđa i ostavlja jedno daleko ispred. Bez toga rezervna varijanta nije
    // bila lakša od one koja je pala — mjenjali su se razmaci među vozilima
    // kojih u uključivanju ima jedno.
    const iza = Math.min(120, 15 + (50 / dif.densityMultiplier) * rand() + 40 * Math.max(0, pokusaj));
    for (let i = 0; i < koliko; i++) {
      const gdje =
        pokusaj < 0 ? iza + 250 : i === 0 ? 0 : iza + razmak * i + rand() * 30;
      npcs.push(vozilo(0, gdje, brzina));
    }
    return {
      id: `smjena-${index}`,
      intersection: HIGHWAY_TEMPLATE,
      difficulty: level,
      title: { me: `Segment ${index + 1}` },
      taskKey: "gameTaskMerge",
      player: {
        arm: "N",
        intent: { kind: "lane", index: -1 },
        spawnDistance: 0,
        startS: Math.round(iza),
        startV: Math.round(tpl.vMin * dif.speedMultiplier * 10) / 10,
      },
      npcs,
      explanation: { me: "" },
    };
  }

  // Kolona: sporije vozilo ispred u istoj traci. Zadatak je odstojanje, a ono
  // se mjeri u sekundama — zato je razmak među vozilima kolone vezan za brzinu.
  const sporije = brzina * (0.7 + rand() * 0.15);
  const kolona = Math.max(45, sporije * 2 + 10);
  for (let i = 0; i < koliko; i++) {
    npcs.push(vozilo(0, 70 + rand() * 40 + kolona * i, sporije));
  }
  // Od trećeg nivoa se lijevom trakom neko i vozi — preticanje nije zadatak,
  // ali ko ga se lati mora da pogleda iza sebe.
  if (level >= 3 && rand() < 0.5) npcs.push(vozilo(1, 20 + rand() * 40, brzina * 1.25));

  return {
    id: `smjena-${index}`,
    intersection: HIGHWAY_TEMPLATE,
    difficulty: level,
    title: { me: `Segment ${index + 1}` },
    taskKey: "gameTaskFollow",
    player: {
      arm: "N",
      intent: { kind: "lane", index: 0 },
      spawnDistance: 0,
      startS: 0,
      startV: Math.round(brzina * 10) / 10,
    },
    npcs,
    explanation: { me: "" },
  };
}

/** Cio lanac za dati broj segmenata i fiksan nivo — koristi ga fuzz test. */
export function generateChain(seed: number, level: Level, count: number): Scenario[] {
  return Array.from({ length: count }, (_, i) => generateSegment(seed, level, i));
}

// ── Prilagođavanje težine ───────────────────────────────────────────────────

export const CLEAN_TO_LEVEL_UP = 3;

/**
 * Novi nivo poslije jednog segmenta.
 *
 * Tri čista segmenta zaredom podižu nivo; izgubljen život ga spušta. Nikad
 * ispod jedan i nikad iznad pet — igra se prilagođava vozaču, ne obratno.
 */
export function nextLevel(level: Level, cleanStreak: number, lostLife: boolean): Level {
  if (lostLife) return Math.max(1, level - 1) as Level;
  if (cleanStreak > 0 && cleanStreak % CLEAN_TO_LEVEL_UP === 0) {
    return Math.min(5, level + 1) as Level;
  }
  return level;
}
