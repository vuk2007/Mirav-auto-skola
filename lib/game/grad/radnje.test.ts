import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAD_RADNJA_RAZMAK, GRAD_RADNJA_VRIJEME_OSTALO } from "../sim/config";
import { procitaj } from "./paket";
import { naKolovozu } from "./povrsina";
import { otvorena, procitajRadnoVrijeme, radnjeGrada, radnoVrijemeOsm, zapisiRadnoVrijeme } from "./radnje";
import { svijetGrada } from "./svijet";
import { mrezaPjesaka } from "./trotoari";

describe("radno vrijeme radnje (stavka 8d)", () => {
  it("čita se iz OSM opening_hours: radni dan, 24/7, dva raspona, preko ponoći", () => {
    expect(radnoVrijemeOsm("clothes", "Mo-Sa 07:30-21:30")).toEqual([[7.5, 21.5]]);
    expect(radnoVrijemeOsm("bakery", "Mo-Fr 08:00-16:00; Sa 08:00-14:00")).toEqual([[8, 16]]);
    expect(radnoVrijemeOsm("supermarket", "24/7")).toEqual([[0, 24]]);
    expect(radnoVrijemeOsm("shoes", "Mo-Fr 08:00-12:00,17:00-21:00")).toEqual([
      [8, 12],
      [17, 21],
    ]);
    expect(radnoVrijemeOsm("kiosk", "18:00-02:00")).toEqual([[18, 26]]);
    // Prvo pravilo je „off": uzima se sljedeće.
    expect(radnoVrijemeOsm("books", "Su off; Mo-Sa 09:00-20:00")).toEqual([[9, 20]]);
  });

  it("bez čitljivog opening_hours — po vrsti radnje, inače podrazumijevano", () => {
    expect(radnoVrijemeOsm("supermarket", undefined)).toEqual([[7, 22]]);
    expect(radnoVrijemeOsm("bookmaker", "")).toEqual([[8, 24]]);
    expect(radnoVrijemeOsm("florist", "by appointment")).toEqual([GRAD_RADNJA_VRIJEME_OSTALO]);
  });

  it("zapis u paketu i nazad, i otvorena u sat", () => {
    const r = radnoVrijemeOsm("shoes", "08:30-12:00,17:00-21:00");
    expect(procitajRadnoVrijeme(zapisiRadnoVrijeme(r))).toEqual(r);
    expect(otvorena(r, 9)).toBe(true);
    expect(otvorena(r, 14)).toBe(false);
    expect(otvorena(r, 20.9)).toBe(true);
    expect(otvorena(r, 21)).toBe(false);
    const noc = radnoVrijemeOsm("kiosk", "18:00-02:00");
    expect(otvorena(noc, 23)).toBe(true);
    expect(otvorena(noc, 1.5)).toBe(true);
    expect(otvorena(noc, 3)).toBe(false);
    expect(otvorena([[0, 24]], 3.2)).toBe(true);
  });
});

describe("izlozi radnji u Podgorici (stavka 8d)", () => {
  const J = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
  const spisak = JSON.parse(readFileSync(join(J, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
  const b = readFileSync(join(J, spisak.podgorica!.fajl));
  const sv = svijetGrada(procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), null, []);

  it("na trotoaru, ne na kolovozu, razmaknuti; uveče dio zatvoren, noću skoro sve", () => {
    const radnje = radnjeGrada(sv, mrezaPjesaka(sv));
    expect(radnje.length).toBeGreaterThan(300);
    for (const r of radnje) expect(naKolovozu(sv.povrsina, r.x, r.y), `${r.x.toFixed(1)},${r.y.toFixed(1)}`).toBe(false);
    for (let i = 0; i < radnje.length; i++) {
      for (let j = i + 1; j < radnje.length; j++) {
        expect(Math.hypot(radnje[i]!.x - radnje[j]!.x, radnje[i]!.y - radnje[j]!.y)).toBeGreaterThanOrEqual(GRAD_RADNJA_RAZMAK);
      }
    }
    const udio = (sat: number) => radnje.filter((r) => otvorena(r.vrijeme, sat)).length / radnje.length;
    expect(udio(11)).toBeGreaterThan(0.9);
    expect(udio(3)).toBeLessThan(0.1);
    expect(udio(21.5)).toBeLessThan(udio(18));
  });
});
