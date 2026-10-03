import { describe, expect, it } from "vitest";
import { headingAt, pointAt } from "../sim/geometry";
import { zaobliOsovinu } from "./osovina";

/** Zaobljena osovina ulice (stavka 7): lom postaje luk, traka nema petlju. */
describe("zaobljena osovina", () => {
  // Ulica ide na istok pa skreće pod pravim uglom na jug (y raste na jug).
  const lom = [
    { x: -50, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 50 },
  ];

  it("pravi ugao: krajevi ostaju, luk je kraći od loma za R(2 − π/2)", () => {
    const o = zaobliOsovinu(lom, 5);
    expect(o.tacke[0]).toEqual({ x: -50, y: 0 });
    expect(o.tacke[o.tacke.length - 1]).toEqual({ x: 0, y: 50 });
    expect(o.duzina).toBeCloseTo(100 - 5 * (2 - Math.PI / 2), 1);
  });

  it("traka na unutrašnjoj strani (pomak manji od R) ide samo naprijed — bez petlje", () => {
    const o = zaobliOsovinu(lom, 5);
    const w = 3; // desno od smjera vožnje — unutrašnja strana desnog skretanja
    let prosla: { x: number; y: number } | null = null;
    let prosliPravac: { x: number; y: number } | null = null;
    // Na svaka 2 m, kao što plan uzima tačke trake.
    for (let s = 0; s <= o.duzina; s += 2) {
      const c = pointAt(o.tacke, o.cum, s);
      const h = headingAt(o.tacke, o.cum, s);
      const q = { x: c.x - h.y * w, y: c.y + h.x * w };
      if (prosla && prosliPravac) {
        // Svaki korak trake je naprijed u odnosu na pravac ulice.
        expect((q.x - prosla.x) * prosliPravac.x + (q.y - prosla.y) * prosliPravac.y).toBeGreaterThan(0);
      }
      prosla = q;
      prosliPravac = h;
    }
  });

  it("kratki segmenti: tangenta najviše pola segmenta; blag lom ostaje tačka", () => {
    const o = zaobliOsovinu(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ],
      10,
    );
    expect(o.tacke[0]).toEqual({ x: 0, y: 0 });
    // Luk počinje na pola prvog segmenta.
    expect(o.tacke[1]!.x).toBeCloseTo(2, 5);
    const blag = zaobliOsovinu(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0.1 },
      ],
      5,
    );
    expect(blag.tacke).toHaveLength(3);
  });
});
