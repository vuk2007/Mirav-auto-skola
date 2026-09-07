import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/lib/game/scenarios";
import { perfectBot } from "./bots";
import { createWorld, step } from "./world";

/**
 * `perfectBot` radi tako što napravi kopiju svijeta, u njoj igrača predstavi
 * kao NPC i odigra jedan korak da vidi koje bi ubrzanje NPC logika izabrala.
 * Ta kopija NE SMIJE da dirne pravi svijet.
 *
 * Ovaj test postoji jer se ista greška desila tri puta: pješaci, dnevnik
 * pokazivača i problematični događaji su redom bili dijeljeni referencom, pa ih
 * je proba trošila. Svaki put se to vidjelo tek kao čudno ponašanje u igri.
 * Sad pada odmah.
 */
describe("proba savršenog bota", () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: ne mijenja pravi svijet`, () => {
      const world = createWorld(s, 1);
      // Malo odmaknuti od početka, da svijet ima šta da izgubi.
      for (let i = 0; i < 300; i++) step(world, s, perfectBot(world, s));

      const prije = JSON.stringify(world);
      perfectBot(world, s);
      expect(JSON.stringify(world), `${s.id}: proba je promijenila svijet`).toBe(prije);
    });
  }
});
