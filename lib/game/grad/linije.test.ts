import { describe, expect, it } from "vitest";
import { GRAD_PUNA_POSLIJE_PROMJENE } from "../sim/config";
import { linijeSaVrstom, ostarLom, produzeci, puniDijelovi } from "./linije";
import { napraviMrezu } from "./mreza";
import { krajeviLinija } from "./oznake";
import { LINIJA_PUNA } from "./paket";
import { testPaket } from "./testMreza";

/**
 * Pune linije (stavka 6b): gdje počinju i završavaju — iste funkcije za
 * crtež, sudiju i bota.
 */
describe("linije: promjena rasporeda traka i oštar lom", () => {
  // Ulica od (0, 0) do (200, 0) kroz čvor 1 na x = 100 (nije raskrsnica):
  // ivica 0 sa dvije trake, ivica 1 sa četiri — raspored se mijenja u čvoru 1.
  const { paket } = testPaket(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ],
    [
      { a: 0, b: 1, trake: 2 },
      { a: 1, b: 2, trake: 4 },
    ],
  );
  paket.n.ivLinija = Uint8Array.from([LINIJA_PUNA, LINIJA_PUNA]);
  const m = napraviMrezu(paket);
  const p = produzeci(m, krajeviLinija(m));

  it("promjena rasporeda je izmjerena od svakog kraja", () => {
    expect(p.doPromjene[0 * 2 + 1]).toBe(0);
    expect(p.doPromjene[1 * 2 + 0]).toBe(0);
    expect(p.doPromjene[0 * 2 + 0]).toBe(Infinity);
  });

  it("puna razdjelna nije puna T metara oko promjene — trake se tu prestrojavaju", () => {
    const T = GRAD_PUNA_POSLIJE_PROMJENE;
    const srednja0 = linijeSaVrstom(m.ivice[0]!).find((l) => l.vrsta === "srednja")!;
    const srednja1 = linijeSaVrstom(m.ivice[1]!).find((l) => l.vrsta === "srednja")!;
    expect(puniDijelovi(m.ivice[0]!, srednja0, p)).toEqual([[-Infinity, 100 - T]]);
    expect(puniDijelovi(m.ivice[1]!, srednja1, p)).toEqual([[T, Infinity]]);
  });

  it("oštar lom osovine: stepenik da, blaga krivina ne", () => {
    const st = testPaket([{ x: 0, y: 0 }, { x: 30, y: 0 }], [{ a: 0, b: 1 }]).paket;
    st.n.ivOd = Uint32Array.from([0, 4]);
    st.n.ivXY = Float32Array.from([0, 0, 13, 0, 15, 4, 30, 4]);
    expect(ostarLom(napraviMrezu(st).ivice[0]!)).toBe(true);
    st.n.ivXY = Float32Array.from([0, 0, 10, 0, 20, 2, 30, 6]);
    expect(ostarLom(napraviMrezu(st).ivice[0]!)).toBe(false);
  });
});
