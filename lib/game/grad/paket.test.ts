import { describe, expect, it } from "vitest";
import { NIZOVI, prazniNizovi, procitaj, zapisi, type ImeNiza, type ZaglavljeBezNizova } from "./paket";

const ZAGLAVLJE: ZaglavljeBezNizova = {
  grad: "proba",
  ime: "Proba",
  datum: "2026-09-30T00:00:00Z",
  licenca: "© OpenStreetMap contributors (ODbL)",
  ishodiste: { utmX: 1, utmY: 2, lat: 42.44, lon: 19.26 },
  okvir: { minX: -10, minY: -10, maxX: 10, maxY: 10 },
  tile: 500,
  tileovaX: 1,
  tileovaY: 1,
  stringovi: ["", "Bulevar Svetog Petra Cetinjskog"],
  klase: ["primary"],
  vrsteZgrada: ["yes"],
  vrstePovrsina: ["park"],
  vrsteLinija: ["river"],
  vrsteObjekata: ["stop"],
};

describe("paket grada", () => {
  it("ono što se zapiše, pročita se isto — svaki niz, svaki tip", () => {
    const n = prazniNizovi();
    // Svaki niz dobija drugačiju dužinu, da se vidi da se ne pomiješaju.
    (Object.keys(NIZOVI) as ImeNiza[]).forEach((ime, i) => {
      const K = n[ime].constructor as new (a: number[]) => (typeof n)[typeof ime];
      const vrijednosti = Array.from({ length: i + 1 }, (_, k) =>
        NIZOVI[ime] === "f32" ? k * 1.5 - 3.25 : NIZOVI[ime] === "i8" ? -k : k + i,
      );
      (n as Record<string, unknown>)[ime] = new K(vrijednosti);
    });
    const p = procitaj(zapisi(ZAGLAVLJE, n).slice().buffer);
    expect(p.zaglavlje.stringovi[1]).toBe("Bulevar Svetog Petra Cetinjskog");
    for (const ime of Object.keys(NIZOVI) as ImeNiza[]) {
      expect([...p.n[ime]], ime).toEqual([...n[ime]]);
    }
  });

  it("odbija fajl koji nije paket grada", () => {
    const tekst = new TextEncoder().encode("<!doctype html><title>404</title>");
    expect(() => procitaj(tekst.buffer)).toThrow(/nije paket grada/);
  });
});
