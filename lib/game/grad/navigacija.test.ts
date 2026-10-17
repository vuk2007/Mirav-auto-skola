import { describe, expect, it } from "vitest";
import { DT, GRAD_NAV_SA_RUTE_TRAJE } from "../sim/config";
import { korakNavigacije, mjestoAuta, novaNavigacija, rutaDo, sljedeciManevar } from "./navigacija";
import { kategorijaOdredista, odredistaGrada, procitajOdrediste, zapisiOdrediste, type Odrediste } from "./odredista";
import { korakStatistike, novaStatistika } from "./statistika";
import { svijetGrada } from "./svijet";
import { kruzniTok, testPaket, type TestIvica, type TestObjekat } from "./testMreza";

/**
 * Zadaci (stavka 9): odredišta iz OSM-a, navigacija do njih i statistika
 * slobodne vožnje.
 *
 * Mreža: 0 (0,0) – 1 (200,0) – 2 (400,0) – 3 (400,200) – 4 (400,400), uz
 * krakove 1 – 5 (200,200) i 2 – 6 (600,0), da su 1 i 2 raskrsnice; y je na
 * jug, pa je skretanje sa istoka na jug desno.
 */
function grad(objekti: TestObjekat[] = []) {
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
  const { paket } = testPaket(cvorovi, ivice, objekti);
  return svijetGrada(paket, null, []);
}

/** Odredište „Škola" 25 m istočno od sredine ulice 3 – 4. */
const SKOLA: TestObjekat = { vrsta: "odrediste", podatak: zapisiOdrediste("skola", "Škola"), tacka: { x: 425, y: 300 } };

describe("odredišta", () => {
  it("kategorija iz OSM oznaka; firme i nejasno — nisu odredište", () => {
    expect(kategorijaOdredista({ amenity: "hospital", name: "Klinički centar Crne Gore" })).toBe("zdravlje");
    expect(kategorijaOdredista({ amenity: "clinic", name: "Dom zdravlja Konik" })).toBe("zdravlje");
    expect(kategorijaOdredista({ amenity: "clinic", name: "Klinika Life" })).toBeNull();
    expect(kategorijaOdredista({ amenity: "clinic", name: "Moj Lab" })).toBeNull();
    expect(kategorijaOdredista({ amenity: "school", name: 'JU Srednja elektrotehnička škola "Vaso Aligrudić"' })).toBe("skola");
    expect(kategorijaOdredista({ amenity: "school", name: "ZOPT" })).toBeNull();
    expect(kategorijaOdredista({ shop: "mall", name: "BIG Fashion" })).toBe("trgovina");
    expect(kategorijaOdredista({ leisure: "sports_centre", amenity: "pool_hall", name: "Sahat Kugla" })).toBeNull();
    expect(kategorijaOdredista({ leisure: "stadium", name: "Stadion pod Goricom" })).toBe("sport");
    expect(kategorijaOdredista({ historic: "archaeological_site", name: "Duklja" })).toBe("znamenitost");
    expect(kategorijaOdredista({ amenity: "post_office", name: "Pošta CG" })).toBeNull();
  });

  it("zapis u paketu: kategorija i ime, nazad isto", () => {
    expect(procitajOdrediste(zapisiOdrediste("kultura", " Crnogorsko narodno pozorište "))).toEqual({ kategorija: "kultura", ime: "Crnogorsko narodno pozorište" });
    expect(procitajOdrediste("nepoznata|X")).toBeNull();
  });

  it("vezano za najbližu voznu ulicu; isto ime dvaput — jedno; predaleko od ulice — nema ga", () => {
    const sv = grad([
      SKOLA,
      { vrsta: "odrediste", podatak: zapisiOdrediste("skola", "ŠKOLA"), tacka: { x: 380, y: 310 } },
      { vrsta: "odrediste", podatak: zapisiOdrediste("sport", "Daleko"), tacka: { x: 900, y: 900 } },
    ]);
    const o = odredistaGrada(sv);
    expect(o.map((x) => x.ime)).toEqual(["Škola"]);
    expect(o[0]!.ivica).toBe(3);
    expect(o[0]!.ulaz.x).toBeCloseTo(400, 0);
    expect(o[0]!.ulaz.y).toBeCloseTo(300, 0);
  });
});

describe("navigacija", () => {
  const sv = grad([SKOLA]);
  const cilj = odredistaGrada(sv)[0]!;

  it("auto na ulici: ivica i smjer po pravcu auta", () => {
    expect(mjestoAuta(sv, 50, 2, 0)).toEqual({ korak: { ivica: 0, smjer: 1 }, s: 50 });
    expect(mjestoAuta(sv, 50, 2, Math.PI)?.korak).toEqual({ ivica: 0, smjer: -1 });
    expect(mjestoAuta(sv, 50, 500, 0)).toBeNull();
  });

  it("ruta do ulaza odredišta: dužina, desno u raskrsnici 2, pravo kroz 1 se ne javlja", () => {
    const r = rutaDo(sv, 50, 2, 0, cilj)!;
    expect(r.duzina).toBeCloseTo(350 + 200 + 100, 0);
    expect(r.manevri).toHaveLength(1);
    expect(r.manevri[0]!.manevar).toBe("desno");
    expect(r.manevri[0]!.s).toBeCloseTo(350, 0);
    expect(r.tacke.at(-1)!.x).toBeCloseTo(400, 0);
    expect(r.tacke.at(-1)!.y).toBeCloseTo(300, 0);
  });

  it("vožnja po ruti: napredak, sljedeći manevar, pa dolazak", () => {
    const nav = novaNavigacija(rutaDo(sv, 50, 2, 0, cilj)!);
    let t = 0;
    const idi = (x: number, y: number) => korakNavigacije(nav, x, y, (t += DT));
    idi(150, 1);
    expect(nav.s).toBeCloseTo(100, 0);
    expect(sljedeciManevar(nav)?.za).toBeCloseTo(250, 0);
    for (let y = 0; y <= 290; y += 5) idi(401, y);
    expect(nav.stigao).toBe(true);
  });

  it("auto ode sa rute: posle `GRAD_NAV_SA_RUTE_TRAJE` traži se nova", () => {
    const nav = novaNavigacija(rutaDo(sv, 50, 2, 0, cilj)!);
    let t = 0;
    let nova = false;
    for (; t < GRAD_NAV_SA_RUTE_TRAJE + 0.5 && !nova; t += DT) nova = korakNavigacije(nav, 200, 120, t).novaRuta;
    expect(nova).toBe(true);
    expect(t).toBeGreaterThanOrEqual(GRAD_NAV_SA_RUTE_TRAJE);
  });

  it("kružni tok: jedan manevar sa rednim brojem izlaza", () => {
    const { cvorovi, ivice } = kruzniTok(60);
    // Cilj na zapadnom kraku (ivica 10): sa istoka, prsten ide 0 → 7 → 6 (sjever, 1.) → 5 → 4 (zapad, 2.).
    const { paket } = testPaket(cvorovi, ivice, [{ vrsta: "odrediste", podatak: zapisiOdrediste("sport", "Stadion"), tacka: { x: -130, y: -20 } }]);
    const svK = svijetGrada(paket, null, []);
    const c: Odrediste = odredistaGrada(svK)[0]!;
    expect(c.ivica).toBe(10);
    const r = rutaDo(svK, 140, 0, Math.PI, c)!;
    expect(r.manevri).toHaveLength(1);
    expect(r.manevri[0]!.izlaz).toBe(2);
  });
});

describe("statistika slobodne vožnje", () => {
  it("čist minut vožnje se broji; prekršaj kvari minut i niz; stajanje se ne broji", () => {
    const s = novaStatistika();
    for (let t = 0; t < 60; t += 0.5) korakStatistike(s, 10, 0.5, 0);
    expect(s.cisteMinute).toBe(1);
    expect(s.niz).toBe(1);
    expect(s.metara).toBeCloseTo(600, 0);
    for (let t = 0; t < 120; t += 0.5) korakStatistike(s, 0, 0.5, 0);
    expect(s.cisteMinute).toBe(1);
    korakStatistike(s, 10, 0.5, 1);
    for (let t = 0.5; t < 60; t += 0.5) korakStatistike(s, 10, 0.5, 0);
    expect(s.cisteMinute).toBe(1);
    expect(s.niz).toBe(0);
    expect(s.prekrsaja).toBe(1);
  });
});
