import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NO_OVERTAKE_BEFORE_JUNCTION,
  NO_OVERTAKE_CURVE_LEAD,
  SETTLEMENT_V,
} from "../sim/config";
import type { RoadCurve } from "../sim/types";
import { EDGES, NODES } from "./roadGraph";
import { parseGeometry, type EdgeGeometry } from "./edgeGeometry";
import { parseKicma, type Kicma } from "./kicma";
import { nadjiRutu, napraviRutu } from "../world/ruta";
import { rutaTemplate } from "../world/svijet";
import { udioZabrane, zabraneNaPutu, zabranjeno } from "./zabrane";

/**
 * Puna i isprekidana linija.
 *
 * Prvi sloj su izmišljeni ulazi, gdje se tačno zna šta mora ispasti. Drugi je
 * stvarna Crna Gora: tamo se mjeri KOLIKO puta ostane bez zabrane, jer pravilo
 * koje zabrani preticanje svuda nije pravilo nego zid.
 */

const krivina = (atS: number, radius: number, arc = 60): RoadCurve => ({
  atS,
  arc,
  radius,
  side: "left",
  advisorySpeed: 40,
});

describe("gdje je linija puna", () => {
  it("oštra krivina nosi punu liniju, i to prije i poslije luka", () => {
    const z = zabraneNaPutu({ duzina: 2000, krivine: [krivina(1000, 120)] });
    expect(z.length).toBe(1);
    expect(z[0]!.from).toBeCloseTo(1000 - 30 - NO_OVERTAKE_CURVE_LEAD, 6);
    expect(z[0]!.to).toBeCloseTo(1000 + 30 + NO_OVERTAKE_CURVE_LEAD, 6);
  });

  it("blaga krivina je ne nosi", () => {
    expect(zabraneNaPutu({ duzina: 2000, krivine: [krivina(1000, 400)] })).toEqual([]);
  });

  it("naselje se prepoznaje po ograničenju", () => {
    const z = zabraneNaPutu({
      duzina: 3000,
      krivine: [],
      vMaxNa: (s) => (s > 1000 && s < 2000 ? SETTLEMENT_V : 22),
    });
    expect(z.length).toBe(1);
    expect(z[0]!.from).toBeGreaterThanOrEqual(980);
    expect(z[0]!.to).toBeLessThanOrEqual(2020);
  });

  it("pred raskrsnicom se ne pretiče", () => {
    const z = zabraneNaPutu({ duzina: 1000, krivine: [], raskrsnice: [1000] });
    expect(z).toEqual([{ from: 1000 - NO_OVERTAKE_BEFORE_JUNCTION, to: 1000 }]);
  });

  it("preklopljene zabrane se spajaju u jednu", () => {
    // Krivina pred raskrsnicom je oboje odjednom; dvije kartice za istu
    // dionicu puta značile bi dvije linije jedna preko druge.
    const z = zabraneNaPutu({
      duzina: 1200,
      krivine: [krivina(1000, 100)],
      raskrsnice: [1100],
    });
    expect(z.length).toBe(1);
  });

  it("ništa ne izlazi iz dionice", () => {
    const z = zabraneNaPutu({ duzina: 500, krivine: [krivina(20, 100)], raskrsnice: [500] });
    for (const x of z) {
      expect(x.from).toBeGreaterThanOrEqual(0);
      expect(x.to).toBeLessThanOrEqual(500);
      expect(x.to).toBeGreaterThan(x.from);
    }
  });

  it("pitanje „smijem li ovdje“ pogađa i na ivici", () => {
    const z = zabraneNaPutu({ duzina: 1000, krivine: [], raskrsnice: [1000] });
    expect(zabranjeno(z, 900)).toBe(false);
    expect(zabranjeno(z, 951)).toBe(true);
    expect(zabranjeno(z, 1000)).toBe(true);
    expect(zabranjeno(undefined, 500)).toBe(false);
  });
});

describe("stvarni putevi Crne Gore", () => {
  const GEOM: ReadonlyMap<string, EdgeGeometry> = new Map(
    EDGES.map((e) => {
      const g = parseGeometry(
        JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${e.id}.json`, "utf8")),
      );
      if (!g) throw new Error(`Neispravna geometrija: ${e.id}`);
      return [e.id, g] as const;
    }),
  );
  const KICME: ReadonlyMap<string, Kicma> = new Map(
    NODES.filter((n) => n.kind === "opstina").map((n) => {
      const k = parseKicma(JSON.parse(readFileSync(`public/data/osm/kicme/${n.id}.json`, "utf8")));
      if (!k) throw new Error(`Neispravna kičma: ${n.id}`);
      return [n.id, k] as const;
    }),
  );

  const tplZa = (a: string, b: string) => {
    const cvorovi = nadjiRutu(a, b);
    if (!cvorovi) throw new Error(`Nema rute ${a} — ${b}`);
    return rutaTemplate(napraviRutu(cvorovi, GEOM, KICME));
  };

  it("na ravnoj magistrali ostaje gdje se smije preticati", () => {
    // Podgorica — Danilovgrad je najravniji komad magistrale koji imamo. Da je
    // i tu sve puno, pravilo bi bilo zid: preticanje ne bi postojalo nigdje.
    const tpl = tplZa("podgorica", "danilovgrad");
    const udio = udioZabrane(tpl.zabrane ?? [], tpl.length);
    expect(udio).toBeLessThan(0.8);
  });

  it("na serpentini je puna linija pravilo, a ne izuzetak", () => {
    const tpl = tplZa("kotor", "cetinje");
    expect(udioZabrane(tpl.zabrane ?? [], tpl.length)).toBeGreaterThan(0.5);
  });

  it("kroz grad se ne pretiče", () => {
    // Ruta koja PROLAZI kroz grad (Cetinje i Podgorica na putu za Kolašin)
    // mora imati punu liniju tamo gdje je ograničenje gradsko.
    const tpl = tplZa("budva", "kolasin");
    let uzorak = 0;
    for (let s = 0; s < tpl.length; s += 25) {
      if ((tpl.vMaxNa?.(s) ?? tpl.vMax) <= SETTLEMENT_V + 0.01) {
        expect(zabranjeno(tpl.zabrane, s)).toBe(true);
        uzorak += 1;
      }
    }
    expect(uzorak, "ruta nije prošla kroz naselje").toBeGreaterThan(0);
  });

  it("zabrane su sređene i ne preklapaju se", () => {
    for (const [a, b] of [
      ["budva", "kolasin"],
      ["herceg-novi", "rozaje"],
    ] as const) {
      const tpl = tplZa(a, b);
      let prije = -1;
      for (const z of tpl.zabrane ?? []) {
        expect(z.from, `${a}-${b}`).toBeGreaterThan(prije);
        expect(z.to, `${a}-${b}`).toBeGreaterThan(z.from);
        prije = z.to;
      }
    }
  });
});
