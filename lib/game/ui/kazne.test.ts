import { describe, expect, it } from "vitest";
import biblioteka from "@/data/kazne.json";
import { PENALTY_REF } from "@/lib/game/sim/world";
import type { BibliotekaKazni } from "@/lib/kazne";

/**
 * Prekršaj u igri pokazuje na kaznu slug-om, a slug se nigdje ne provjerava u
 * vrijeme prevođenja. Ako se u katalogu preimenuje unos, kartica kazne prestane
 * da se prikazuje — i to tiho, jer je prazna kazna ionako uredno stanje dok
 * instruktorka nije potvrdila. Zato veza mora da ima test.
 */
const KATALOG = biblioteka as BibliotekaKazni;

describe("veza prekršaja i kataloga kazni", () => {
  it("svaki `penaltyRef` postoji u biblioteci", () => {
    const ids = new Set(KATALOG.kazne.map((k) => k.id));
    for (const [tip, ref] of Object.entries(PENALTY_REF)) {
      if (ref === null) continue;
      expect(ids.has(ref), `prekršaj „${tip}" pokazuje na nepostojeću kaznu „${ref}"`).toBe(true);
    }
  });

  it("prekršaj bez veze je namjerno takav, a ne zaboravljen", () => {
    // `speeding` je stepenovan po brzini, pa se ne može svesti na jedan unos —
    // bira se tek kad kazne budu potvrđene. Ostali moraju imati vezu.
    const bez = Object.entries(PENALTY_REF)
      .filter(([, ref]) => ref === null)
      .map(([tip]) => tip);
    expect(bez).toEqual(["speeding"]);
  });
});
