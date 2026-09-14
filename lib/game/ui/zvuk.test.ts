import { describe, expect, it } from "vitest";
import { BLINK_HZ } from "../sim/config";
import { engineTone, tickTone } from "./sound";

/**
 * Zvučni graf se u testu nema gdje pustiti, ali model obrtaja ima logiku i ona
 * se provjerava: sve ostalo u `sound.ts` je vezivanje čvorova.
 */
describe("motor", () => {
  it("u mjestu i bez gasa je prazan hod — čuje se, ali jedva", () => {
    const { freq, gain } = engineTone(0, 0);
    expect(freq).toBeCloseTo(52, 6);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(0.05);
  });

  it("gas iz mjesta diže obrtaje, i prije nego što vozilo krene", () => {
    expect(engineTone(0, 1).freq).toBeGreaterThan(engineTone(0, 0).freq);
    expect(engineTone(0, 1).gain).toBeGreaterThan(engineTone(0, 0).gain);
  });

  it("unutar stepena prenosa ton raste sa brzinom", () => {
    let prije = engineTone(0.1, 0).freq;
    for (let v = 0.5; v < 6.9; v += 0.5) {
      const sada = engineTone(v, 0).freq;
      expect(sada, `v=${v}`).toBeGreaterThan(prije);
      prije = sada;
    }
  });

  it("na promjeni stepena prenosa ton padne — po tome se i prepoznaje auto", () => {
    // Pred krajem prvog stepena je visoko, odmah poslije njega nisko.
    expect(engineTone(6.9, 0).freq).toBeGreaterThan(engineTone(7.1, 0).freq);
    expect(engineTone(13.9, 0).freq).toBeGreaterThan(engineTone(14.1, 0).freq);
  });

  it("nikad nije glasniji od trube i nikad nije nečujan", () => {
    // Truba je 0,18 — motor koji je nadjača progutao bi upozorenje.
    for (let v = 0; v <= 40; v += 0.25) {
      for (const gas of [0, 0.5, 1]) {
        const { freq, gain } = engineTone(v, gas);
        expect(gain, `v=${v} gas=${gas}`).toBeGreaterThan(0);
        expect(gain, `v=${v} gas=${gas}`).toBeLessThan(0.18);
        expect(freq, `v=${v} gas=${gas}`).toBeGreaterThanOrEqual(52);
        expect(freq, `v=${v} gas=${gas}`).toBeLessThanOrEqual(52 + 78);
      }
    }
  });

  it("besmislen ulaz ne razbija model", () => {
    expect(engineTone(-5, -1).freq).toBeCloseTo(52, 6);
    expect(engineTone(0, 5).gain).toBeLessThan(0.18);
  });
});

describe("klik pokazivača", () => {
  it("paljenje i gašenje zvuče različito, kao relej", () => {
    expect(tickTone(true).freq).not.toBe(tickTone(false).freq);
  });

  it("klik je kratak i visok — ne stapa se sa sljedećim ni sa motorom", () => {
    for (const upaljen of [true, false]) {
      const { trajanje, gain, freq } = tickTone(upaljen);
      // Između dva klika prođe pola treptaja; klik traje manje od četvrtine toga.
      expect(trajanje).toBeGreaterThan(0);
      expect(trajanje).toBeLessThan(1 / (BLINK_HZ * 2) / 4);
      expect(gain).toBeGreaterThan(0);
      // Motor ne ide iznad 130 Hz, a njegov filtar iznad 800 Hz.
      expect(freq).toBeGreaterThan(1000);
    }
  });
});
