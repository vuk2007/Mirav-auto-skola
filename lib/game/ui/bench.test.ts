import { describe, expect, it } from "vitest";
import { fps, statistika } from "./bench";

describe("statistika mjerenja crtanja", () => {
  it("medijana i 95. percentil su vrijednosti iz niza, po najbližem rangu", () => {
    const niz = Array.from({ length: 100 }, (_, i) => i + 1);
    const s = statistika(niz);
    expect(s.medijana).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.najvise).toBe(100);
    expect(s.prosjek).toBeCloseTo(50.5);
  });

  it("redosljed uzoraka nije bitan i niz se ne mijenja", () => {
    const niz = [5, 1, 9, 3];
    expect(statistika(niz)).toEqual(statistika([1, 3, 5, 9]));
    expect(niz).toEqual([5, 1, 9, 3]);
  });

  it("prazan niz daje nule, ne NaN", () => {
    expect(statistika([])).toEqual({ medijana: 0, p95: 0, najvise: 0, prosjek: 0 });
    expect(fps([])).toBe(0);
  });

  it("jedan spor kadar obara fps koliko stvarno traje", () => {
    // Pedeset devet kadrova po 1000/60 ms i jedan od pola sekunde: to je
    // šezdeset kadrova za skoro sekundu i po, a ne „skoro 60 fps".
    const razmaci = [...Array.from({ length: 59 }, () => 1000 / 60), 500];
    expect(fps(razmaci)).toBeCloseTo((1000 * 60) / (59 * (1000 / 60) + 500), 6);
    expect(fps(razmaci)).toBeLessThan(45);
  });
});
