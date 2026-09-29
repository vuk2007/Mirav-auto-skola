import { describe, expect, it } from "vitest";
import { crtice } from "./slikar";

const duzina = (d: { x: number; y: number }[]) =>
  d.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - d[i]!.x, p.y - d[i]!.y), 0);

describe("crtice polilinije", () => {
  it("na pravoj liniji: crta 4 m, razmak 7 m, od početka", () => {
    const d = crtice([{ x: 0, y: 0 }, { x: 30, y: 0 }], [4, 7]);
    expect(d.map((c) => [c[0]!.x, c[c.length - 1]!.x])).toEqual([
      [0, 4],
      [11, 15],
      [22, 26],
    ]);
  });

  it("pomak šablona radi kao lineDashOffset na Canvasu", () => {
    // Sa pomakom od 2 m je prva crta dugačka samo još 2 m.
    const d = crtice([{ x: 0, y: 0 }, { x: 20, y: 0 }], [4, 7], 2);
    expect(d[0]![0]!.x).toBeCloseTo(0);
    expect(d[0]![d[0]!.length - 1]!.x).toBeCloseTo(2);
    expect(d[1]![0]!.x).toBeCloseTo(9);
  });

  it("crta ide preko tjemena bez prekida", () => {
    const d = crtice([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 5 }], [4, 7]);
    expect(d).toHaveLength(1);
    expect(d[0]).toHaveLength(3);
    expect(duzina(d[0]!)).toBeCloseTo(4);
  });

  it("na sedamdesetom kilometru ne staje u mjestu", () => {
    // Prva verzija je fazu računala iz ukupne dužine i ovdje se zaglavila.
    const tacke = Array.from({ length: 200 }, (_, i) => ({ x: 70000 + i * 2, y: 0.3 * i }));
    const d = crtice(tacke, [4, 7], 69999.999999999);
    const ukupno = duzina(tacke);
    const naCrti = d.reduce((a, c) => a + duzina(c), 0);
    expect(naCrti / ukupno).toBeGreaterThan(4 / 11 - 0.02);
    expect(naCrti / ukupno).toBeLessThan(4 / 11 + 0.02);
  });

  it("završava i kad kraj segmenta ne pada tačno na zbir koraka", () => {
    // Nasumične polilinije sa „ružnim" koordinatama: druga verzija se ovdje
    // vrtjela zauvijek na ostatku segmenta od jednog ulp-a. Test koji visi pada
    // na roku.
    let sjeme = 11;
    const rnd = () => (sjeme = (sjeme * 1103515245 + 12345) >>> 0) / 2 ** 32;
    for (let k = 0; k < 300; k++) {
      const x0 = rnd() * 70000;
      const y0 = rnd() * 30000;
      const tacke = Array.from({ length: 40 }, (_, i) => ({ x: x0 + i * 1.97 + rnd() * 0.3, y: y0 + i * 0.41 + rnd() * 0.3 }));
      for (const sablon of [[4, 7], [0.6, 0.4], [1.5, 1]] as [number, number][]) {
        const d = crtice(tacke, sablon, rnd() * 70000);
        const ukupno = duzina(tacke);
        const naCrti = d.reduce((a, c) => a + duzina(c), 0);
        expect(naCrti / ukupno).toBeGreaterThan(sablon[0] / (sablon[0] + sablon[1]) - 0.15);
        expect(naCrti / ukupno).toBeLessThan(sablon[0] / (sablon[0] + sablon[1]) + 0.15);
      }
    }
  });
});
