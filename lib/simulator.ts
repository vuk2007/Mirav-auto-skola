import type { OrderingQuestion, Question } from "./types";

/**
 * Simulator raskrsnica — V1.
 *
 * Scena je postojeća fotografija iz kataloga sa označenim vozilima, a kandidat
 * tapne vozila redom kojim prolaze (umjesto da kuca „3-4-2-1").
 *
 * Broj vozila u sceni se NE može izvesti iz `answer_sequence`: kod scena sa
 * policajcem dio vozila uopšte ne prolazi, pa je niz kraći od broja vozila
 * (npr. scena p015_q48 ima 4 vozila, a tačan redoslijed je [1,4]). Zato je
 * broj vozila po sceni popisan ručno, pregledom svake slike.
 *
 * Ako se doda nova `ordering` scena, upiši je ovdje — inače se preskače.
 */
const SCENE_VEHICLES: Readonly<Record<number, number>> = {
  101: 4, // p010_q06 — prvenstvo, sva 4 vozila prolaze
  105: 3, // p011_q10 — tramvaj + taksi
  112: 3, // p012_q17 — glavni put
  137: 3, // p015_q42 — ustupi prvenstvo
  139: 4, // p015_q44 — prvenstvo, sva 4 prolaze
  143: 4, // p015_q48 — policajac zaustavlja 2 i 3; prolaze samo 1 i 4
  151: 4, // p016_q56 — policajac; prolaze samo 4 i 3
  159: 4, // p017_q64 — STOP
  165: 3, // p018_q70 — policijsko vozilo
  172: 3, // p019_q77 — kružni tok
};

export interface SimScenario {
  question: OrderingQuestion;
  /** Koliko je vozila označeno na slici (1..vehicleCount). */
  vehicleCount: number;
  /** Da li sva označena vozila prolaze — ako ne, kandidat bira podskup. */
  allPass: boolean;
}

function isOrdering(q: Question): q is OrderingQuestion {
  return q.type === "ordering";
}

/** Scene za simulator, iz postojećih `ordering` pitanja. */
export function buildScenarios(questions: readonly Question[]): SimScenario[] {
  const out: SimScenario[] = [];
  for (const q of questions) {
    if (!isOrdering(q)) continue;
    const vehicleCount = SCENE_VEHICLES[q.id];
    // Scena bez popisanog broja vozila se preskače — bolje nego pogađati.
    if (vehicleCount === undefined) continue;
    out.push({
      question: q,
      vehicleCount,
      allPass: q.answer_sequence.length === vehicleCount,
    });
  }
  return out;
}

/** Da li se izabrani redoslijed poklapa sa tačnim. */
export function isOrderCorrect(scenario: SimScenario, picked: readonly number[]): boolean {
  const answer = scenario.question.answer_sequence;
  if (picked.length !== answer.length) return false;
  return picked.every((v, i) => String(v) === answer[i]);
}
