import { describe, expect, it } from "vitest";
import { GRAD_ISPIT_LAKSIH } from "../sim/config";
import { predjeneTacke, rutaIspita, rutaIspitaOd, zapisnikIspita } from "./ispit";
import { novaNavigacija } from "./navigacija";
import { sidroUlice, type Zadatak } from "./overlay";
import type { GradskiPrekrsaj, VrstaGradskogPrekrsaja } from "./sudija";
import { svijetGrada } from "./svijet";
import { testPaket, type TestIvica } from "./testMreza";

/**
 * Ispitna ruta (stavka 9c): ruta kroz obavezne tačke iz editora i zapisnik.
 *
 * Mreža kao u `navigacija.test.ts`: 0 (0,0) – 1 (200,0) – 2 (400,0) –
 * 3 (400,200) – 4 (400,400), uz krakove 1 – 5 (200,200) i 2 – 6 (600,0); y je
 * na jug. Ispitna ruta je samo za test (odluka korisnika: prave rute su samo
 * iz editora).
 */
function grad() {
  const cvorovi = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 200 },
    { x: 400, y: 400 },
    { x: 200, y: 200 },
    { x: 600, y: 0 },
  ];
  const ivice: TestIvica[] = [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
    { a: 3, b: 4 },
    { a: 1, b: 5 },
    { a: 2, b: 6 },
  ];
  return svijetGrada(testPaket(cvorovi, ivice, []).paket, null, []);
}

const ISTOK = { x: 1, y: 0 };
const JUG = { x: 0, y: 1 };
/** Start (50,0) na istok, obavezna tačka (300,0), cilj (400,300) na jug. */
const RUTA: Zadatak = {
  id: "test-ispit",
  ime: "Test ruta",
  vrsta: "ispitna",
  start: sidroUlice(0, { x: 50, y: 0 }, ISTOK),
  tacke: [sidroUlice(0, { x: 300, y: 0 }, ISTOK)],
  cilj: sidroUlice(0, { x: 400, y: 300 }, JUG),
  manevri: [],
};

const prekrsaj = (vrsta: VrstaGradskogPrekrsaja, ozbiljnost: "fail" | "minor"): GradskiPrekrsaj => ({ vrsta, ozbiljnost, t: 0, x: 0, y: 0, detalji: {} });

describe("ispit: zapisnik", () => {
  it(`do ${GRAD_ISPIT_LAKSIH} lakših — položio; jedan više — nije`, () => {
    const laksi = Array.from({ length: GRAD_ISPIT_LAKSIH }, () => prekrsaj("indicatorLate", "minor"));
    expect(zapisnikIspita(laksi).polozio).toBe(true);
    expect(zapisnikIspita([...laksi, prekrsaj("speeding", "minor")]).polozio).toBe(false);
    expect(zapisnikIspita([]).polozio).toBe(true);
  });

  it("bilo koji teži — nije položio", () => {
    const z = zapisnikIspita([prekrsaj("redLight", "fail")]);
    expect(z.polozio).toBe(false);
    expect(z.teskih).toBe(1);
  });

  it("greške po stavkama", () => {
    const z = zapisnikIspita([prekrsaj("rightOfWay", "fail"), prekrsaj("speeding", "minor"), prekrsaj("indicatorMissing", "minor"), prekrsaj("indicatorLate", "minor"), prekrsaj("pedestrianRightOfWay", "fail")]);
    const po = Object.fromEntries(z.stavke.map((s) => [s.stavka, [s.laksih, s.teskih]]));
    expect(po).toEqual({ raskrsnice: [0, 1], brzina: [1, 0], znakovi: [0, 0], pjesaci: [0, 1], polozaj: [0, 0], manevri: [2, 0] });
    expect([z.laksih, z.teskih]).toEqual([3, 2]);
  });
});

describe("ispit: ruta kroz obavezne tačke", () => {
  const sv = grad();

  it("od starta kroz tačku do cilja: dužina, gdje su tačke, desno u raskrsnici 2", () => {
    const r = rutaIspita(sv, RUTA)!;
    expect(r.duzina).toBeCloseTo(150 + 200 + 300, 0);
    expect(r.mete[0]).toBeCloseTo(250, 0);
    expect(r.mete[1]).toBeCloseTo(650, 0);
    expect(r.manevri.map((m) => m.manevar)).toEqual(["desno"]);
  });

  it("tačka je pređena kad auto po ruti stigne do nje", () => {
    const nav = novaNavigacija(rutaIspita(sv, RUTA)!);
    nav.s = 200;
    expect(predjeneTacke(nav, 0, 1)).toBe(0);
    nav.s = 245;
    expect(predjeneTacke(nav, 0, 1)).toBe(1);
  });

  it("nova ruta poslije pređene tačke: samo do cilja", () => {
    const r = rutaIspitaOd(sv, RUTA, 350, 1, 0, 1)!;
    expect(r.mete).toHaveLength(1);
    expect(r.duzina).toBeCloseTo(50 + 300, 0);
  });

  it("nova ruta prije tačke: i dalje kroz nju", () => {
    const r = rutaIspitaOd(sv, RUTA, 100, 1, 0, 0)!;
    expect(r.mete).toHaveLength(2);
    expect(r.mete[0]).toBeCloseTo(200, 0);
  });

  it("tačka van vozne ulice: nema rute", () => {
    expect(rutaIspita(sv, { ...RUTA, tacke: [sidroUlice(0, { x: 300, y: 120 }, ISTOK)] })).toBeNull();
  });
});
