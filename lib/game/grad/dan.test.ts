import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAD_PJ_PO_GUSTINI_ZONE, GRAD_SAT_TRAJE } from "../sim/config";
import { krajNastave, pjesaciSata, saobracajSata, satIgre, satTekst, svjetloSata } from "./dan";
import { procitaj } from "./paket";
import { ciljniBrojPjesaka, noviPjesaci } from "./pjesaci";
import { svijetGrada } from "./svijet";

describe("dnevni ciklus (stavka 8d)", () => {
  it("24 min igre = 24 h, i dan se nastavlja preko ponoći", () => {
    expect(satIgre(8, 0)).toBe(8);
    expect(satIgre(8, 0.5 * GRAD_SAT_TRAJE)).toBeCloseTo(8.5);
    expect(satIgre(23, 2 * GRAD_SAT_TRAJE)).toBeCloseTo(1);
    expect(satIgre(8, 24 * GRAD_SAT_TRAJE)).toBeCloseTo(8);
    expect(24 * GRAD_SAT_TRAJE).toBe(24 * 60);
    expect(satTekst(8.25)).toBe("08:15");
    expect(satTekst(23.999)).toBe("23:59");
  });

  it("svjetlo: dan danju, noć noću, i postepen prelaz u zoru i sumrak", () => {
    expect(svjetloSata(12)).toEqual({ dan: 1, sumrak: 0, noc: 0 });
    expect(svjetloSata(2)).toEqual({ dan: 0, sumrak: 0, noc: 1 });
    // Zbir je uvijek 1, i nema skoka: susjedni minuti se malo razlikuju.
    for (let h = 0; h < 24; h += 1 / 60) {
      const a = svjetloSata(h);
      const b = svjetloSata(h + 1 / 60);
      expect(a.dan + a.sumrak + a.noc).toBeCloseTo(1);
      expect(Math.abs(a.dan - b.dan) + Math.abs(a.noc - b.noc)).toBeLessThan(0.05);
    }
    // Sumrak je između dana i noći, uveče i ujutru.
    expect(svjetloSata(19.5).sumrak).toBe(1);
    expect(svjetloSata(6).sumrak).toBe(1);
    expect(svjetloSata(20).noc).toBeGreaterThan(0);
    expect(svjetloSata(20).dan).toBe(0);
  });

  it("gužva ujutru i popodne, noću rijetko", () => {
    const noc = saobracajSata(3);
    expect(saobracajSata(8)).toBe(1);
    expect(saobracajSata(15.5)).toBe(1);
    expect(saobracajSata(11)).toBeLessThan(saobracajSata(8));
    expect(noc).toBeLessThan(0.2);
    expect(pjesaciSata(3)).toBeLessThan(0.1);
    expect(pjesaciSata(12.5)).toBe(1);
    // Između sati linearno: pola sata između 6 (0.5) i 7 (0.9).
    expect(saobracajSata(6.5)).toBeCloseTo(0.7);
  });

  it("kraj nastave: oko 13 h i oko 19 h", () => {
    expect(krajNastave(13)).toBe(true);
    expect(krajNastave(19)).toBe(true);
    expect(krajNastave(10)).toBe(false);
    expect(krajNastave(22)).toBe(false);
  });
});

describe("kraj nastave oko škole u Podgorici (stavka 8d)", () => {
  const J = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
  const spisak = JSON.parse(readFileSync(join(J, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
  const b = readFileSync(join(J, spisak.podgorica!.fajl));
  const sv = svijetGrada(procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), null, []);

  it("oko škole na kraju nastave je najviše pješaka; van tog doba i bez sata — kao i prije", () => {
    const pj = noviPjesaci(sv, 1, 1);
    expect(pj.skole.length).toBeGreaterThan(20);
    const skola = pj.skole[0]!;
    const obicno = ciljniBrojPjesaka(pj, skola);
    pj.sat = 13;
    expect(ciljniBrojPjesaka(pj, skola)).toBe(GRAD_PJ_PO_GUSTINI_ZONE.at(-1));
    expect(ciljniBrojPjesaka(pj, skola)).toBeGreaterThan(obicno);
    pj.sat = 10;
    expect(ciljniBrojPjesaka(pj, skola)).toBe(obicno);
    // Daleko od svih škola: kao i prije.
    pj.sat = 13;
    const daleko = { x: skola.x + 50_000, y: skola.y };
    pj.sat = null;
    const bezSata = ciljniBrojPjesaka(pj, daleko);
    pj.sat = 13;
    expect(ciljniBrojPjesaka(pj, daleko)).toBe(bezSata);
  });
});
