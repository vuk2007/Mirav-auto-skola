import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { bangBangBot, run } from "./bots";
import type { Scenario } from "./types";

/**
 * Scenario mora biti rješiv onim čime igrač zaista raspolaže: dva dugmeta.
 *
 * `perfectBot` dozira gas na proizvoljnu vrijednost, pa njegov prolazak ne
 * dokazuje da je zadatak igriv — samo da su pravila neprotivrječna. Ovdje se
 * traži prozor „gas – kočnica – gas" u kojem scenario prolazi bez ijednog
 * prekršaja. Ako takvog prozora nema, scenario je za čovjeka nemoguć i test
 * pada prije nego što ga neko doda u igru.
 */
const KORAK = 0.25;
const DO_KADA = 14;

function nadjiRjesenje(s: Scenario, seed: number): { from: number; to: number } | null {
  for (let from = 0; from <= DO_KADA; from += KORAK) {
    for (let to = from + KORAK; to <= DO_KADA; to += KORAK) {
      const { world } = run(s, bangBangBot(from, to), seed);
      if (world.outcome === "passed") return { from, to };
    }
  }
  return null;
}

describe("igrivost sa dvije pedale", () => {
  for (const s of SCENARIOS) {
    // Sjemena mijenjaju trenutak nastanka NPC-a unutar prozora; scenario mora
    // biti rješiv u cijelom prozoru, a ne samo za jedno sjeme.
    for (const seed of [1, 7, 42]) {
      it(`${s.id} (sjeme ${seed}): postoji prolazak bez prekršaja`, () => {
        const rj = nadjiRjesenje(s, seed);
        expect(rj, `${s.id}: nijedan raspored gas/kočnica ne prolazi`).not.toBeNull();
      });
    }
  }
});
