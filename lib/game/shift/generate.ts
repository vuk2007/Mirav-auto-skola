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
import type { ArmId, Intent, Scenario, ScenarioHazard, ScenarioNpc } from "../sim/types";

/** Šabloni iz kojih se bira. Autoput nije među njima — vidi fazu autoputa. */
export const SEGMENT_TEMPLATES = [
  "cross-none",
  "cross-priority-ns",
  "cross-stop-ew",
  "cross-lights",
  "kruzni",
] as const;

export type SegmentTemplate = (typeof SEGMENT_TEMPLATES)[number];

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
