import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GRAD_KROV,
  GRAD_ODMAK_NAJVISE,
  GRAD_SIRINA_TRAKE,
  GRAD_SJENKA_DUZINA,
  GRAD_SJENKA_PRAVAC,
  GRAD_SPRAT,
  GRAD_TROTOAR,
} from "../sim/config";
import type { Point } from "../sim/types";
import { napraviMrezu } from "./mreza";
import { procitaj, prazniNizovi, type Paket } from "./paket";
import { naPovrsini, napraviPovrsinu, odmakniOdUlice } from "./povrsina";
import { KRST, mreza as testMreza, lepeza } from "./testMreza";
import {
  geometrijaSjenki,
  geometrijaZgrada,
  grupaZgrade,
  povrsinaSaZnakom,
  procijenjeniSpratovi,
  sjemeZgrade,
  zgrada,
  type Palete,
  type ZonaPalete,
} from "./zgrade";

/**
 * Zgrade u GTA izgledu — stavka 4a: visina, paleta, geometrija za 2.5D,
 * sjenke, i odmak od proširenih ulica.
 */
const JAVNO = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
const PALETE = JSON.parse(readFileSync(join(JAVNO, "palete.json"), "utf8")) as Palete;
const triangulisi = lepeza;

/** Paket sa zadatim zgradama (osnova, vrsta, spratovi, visina u dm). */
function paketZgrada(zgrade: { osnova: Point[]; vrsta?: string; spratovi?: number; visinaDm?: number }[]): Paket {
  const n = prazniNizovi();
  const vrste = ["yes", "house", "apartments", "industrial", "school"];
  n.zgOd = new Uint32Array(zgrade.reduce((od, z) => [...od, od[od.length - 1]! + z.osnova.length], [0]));
  n.zgXY = new Float32Array(zgrade.flatMap((z) => z.osnova.flatMap((p) => [p.x, p.y])));
  n.zgSpratovi = new Uint8Array(zgrade.map((z) => z.spratovi ?? 0));
  n.zgVisina = new Uint16Array(zgrade.map((z) => z.visinaDm ?? 0));
  n.zgVrsta = new Uint8Array(zgrade.map((z) => vrste.indexOf(z.vrsta ?? "yes")));
  n.zgIme = new Uint16Array(zgrade.length);
  return { zaglavlje: { vrsteZgrada: vrste }, n } as unknown as Paket;
}

/** Kvadrat stranice `a` sa gornjim lijevim uglom u (`x`, `y`). */
const kvadrat = (x: number, y: number, a: number): Point[] => [
  { x, y },
  { x: x + a, y },
  { x: x + a, y: y + a },
  { x, y: y + a },
];

describe("zgrade: visina", () => {
  it("visina iz OSM-a ima prednost, pa spratovi, pa procjena", () => {
    const p = paketZgrada([
      { osnova: kvadrat(0, 0, 20), vrsta: "apartments", spratovi: 4, visinaDm: 305 },
      { osnova: kvadrat(100, 0, 20), vrsta: "apartments", spratovi: 4 },
      { osnova: kvadrat(200, 0, 20), vrsta: "apartments" },
    ]);
    const a = zgrada(p, 0, null, PALETE, [])!;
    const b = zgrada(p, 1, null, PALETE, [])!;
    const c = zgrada(p, 2, null, PALETE, [])!;
    expect(a.visina).toBeCloseTo(30.5, 5);
    expect(a.procijenjena).toBe(false);
    expect(b.visina).toBe(4 * GRAD_SPRAT + GRAD_KROV);
    expect(b.procijenjena).toBe(false);
    // `apartments` je šest spratova, ±1 po sjemenu.
    expect(c.procijenjena).toBe(true);
    expect([5, 6, 7]).toContain(c.spratova);
  });

  it("vrsta `yes` po površini: garaža niska, kuća dva, blok viši, hala opet niska", () => {
    const nula = () => 0.5; // bez odstupanja
    expect(procijenjeniSpratovi("yes", 30, nula)).toBe(1);
    expect(procijenjeniSpratovi("yes", 150, nula)).toBe(2);
    expect(procijenjeniSpratovi("yes", 500, nula)).toBe(4);
    expect(procijenjeniSpratovi("yes", 1500, nula)).toBe(6);
    expect(procijenjeniSpratovi("yes", 8000, nula)).toBe(2);
    // Jednospratnica ne varira — šupa ne raste u dvospratnicu.
    expect(procijenjeniSpratovi("shed", 20, () => 0.99)).toBe(1);
  });

  it("ista zgrada uvijek ista: sjeme zavisi samo od položaja", () => {
    expect(sjemeZgrade(12.34, -56.78)).toBe(sjemeZgrade(12.34, -56.78));
    expect(sjemeZgrade(12.34, -56.78)).not.toBe(sjemeZgrade(12.44, -56.78));
    const p = paketZgrada([{ osnova: kvadrat(0, 0, 15) }]);
    expect(zgrada(p, 0, null, PALETE, [])).toEqual(zgrada(p, 0, null, PALETE, []));
  });
});

describe("zgrade: paleta", () => {
  it("van zone paleta ide po grupi zgrade", () => {
    expect(grupaZgrade("house", 2, 120)).toBe("kuca");
    expect(grupaZgrade("yes", 5, 600)).toBe("blok");
    expect(grupaZgrade("yes", 2, 3000)).toBe("industrija");
    const p = paketZgrada([{ osnova: kvadrat(0, 0, 10), vrsta: "house" }]);
    const z = zgrada(p, 0, null, PALETE, [])!;
    expect(PALETE.palete["crveni-krov"]!.krov).toContain(z.krov);
  });

  it("zgrada u nacrtanoj zoni dobija paletu zone", () => {
    const p = paketZgrada([{ osnova: kvadrat(0, 0, 10), vrsta: "house" }]);
    const zona: ZonaPalete = { id: "blok-5", paleta: "soc-blok", poligon: [[-50, -50], [50, -50], [50, 50], [-50, 50]] };
    const z = zgrada(p, 0, null, PALETE, [zona])!;
    expect(PALETE.palete["soc-blok"]!.krov).toContain(z.krov);
    // Zona bez poligona (još nenacrtana) ne mijenja ništa.
    const prazna = zgrada(p, 0, null, PALETE, [{ ...zona, poligon: [] }])!;
    expect(PALETE.palete["crveni-krov"]!.krov).toContain(prazna.krov);
  });

  it("svaka zona iz šablona pokazuje na paletu koja postoji", () => {
    const zone = JSON.parse(readFileSync(join(JAVNO, "cityZones", "podgorica.json"), "utf8")) as { zone: ZonaPalete[] };
    for (const z of zone.zone) if (z.paleta) expect(PALETE.palete[z.paleta], z.id).toBeDefined();
    for (const id of Object.values(PALETE.automatski)) expect(PALETE.palete[id], id).toBeDefined();
  });
});

describe("zgrade: geometrija za 2.5D", () => {
  const p = paketZgrada([
    { osnova: kvadrat(0, 0, 10), vrsta: "house", spratovi: 1 },
    { osnova: [...kvadrat(40, 0, 10)].reverse(), vrsta: "apartments", spratovi: 8 },
  ]);
  const niska = zgrada(p, 0, null, PALETE, [])!;
  const visoka = zgrada(p, 1, null, PALETE, [])!;

  it("osnova je uvijek u smjeru kazaljke, bez obzira kako je došla iz OSM-a", () => {
    expect(povrsinaSaZnakom(niska.osnova)).toBeGreaterThan(0);
    expect(povrsinaSaZnakom(visoka.osnova)).toBeGreaterThan(0);
  });

  it("zidovi od tla do krova, krov na visini zgrade; viša zgrada se crta posljednja", () => {
    const t = geometrijaZgrada([visoka, niska], triangulisi);
    const visine = [...t.visina];
    // Niska prva: 4 zida × 4 temena na 0 i na njenoj visini, pa krov.
    expect(visine.slice(0, 16).filter((h) => h === 0)).toHaveLength(8);
    expect(visine.slice(16, 20)).toEqual([niska.visina, niska.visina, niska.visina, niska.visina].map(Math.fround));
    expect(Math.max(...visine)).toBeGreaterThan(visoka.visina);
    for (const i of t.indeksi) expect(i).toBeLessThan(t.visina.length);
    expect(t.indeksi.length % 3).toBe(0);
    expect(t.polozaj.every(Number.isFinite)).toBe(true);
  });

  it("zid okrenut suncu je svjetliji od zida u sjenci", () => {
    const t = geometrijaZgrada([niska], triangulisi);
    // Zidovi kvadrata: sjever, istok, jug, zapad. Sunce je sa jugozapada.
    const svjetlina = (zid: number) => t.boja[zid * 12]! + t.boja[zid * 12 + 1]! + t.boja[zid * 12 + 2]!;
    expect(svjetlina(2)).toBeGreaterThan(svjetlina(0)); // jug > sjever
    expect(svjetlina(3)).toBeGreaterThan(svjetlina(1)); // zapad > istok
  });

  it("sjenka pada u pravcu sjenke, dugačka srazmjerno visini", () => {
    const t = geometrijaSjenki([niska], triangulisi);
    const d = niska.visina * GRAD_SJENKA_DUZINA;
    let najdalje = -Infinity;
    for (let k = 0; k < t.polozaj.length; k += 2) {
      const x = t.polozaj[k]! - 5;
      const y = t.polozaj[k + 1]! - 5;
      najdalje = Math.max(najdalje, x * GRAD_SJENKA_PRAVAC.x + y * GRAD_SJENKA_PRAVAC.y);
    }
    // Najdalji ugao kvadrata u pravcu sjenke je na 5·(0,8+0,6) od sredine, plus sjenka.
    expect(najdalje).toBeCloseTo(5 * (GRAD_SJENKA_PRAVAC.x - GRAD_SJENKA_PRAVAC.y) + d, 4);
    expect([...t.visina].every((h) => h === 0)).toBe(true);
  });
});

/** Jedna ulica sjever–jug zadate klase. */
const mrezaSaKlasom = (klasa: string) =>
  testMreza(
    [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ],
    [[0, 1, klasa]],
  );

describe("zgrade: odmak od proširenih ulica", () => {
  const P = napraviPovrsinu(KRST);
  const granica = GRAD_SIRINA_TRAKE + GRAD_TROTOAR; // dvije trake: pola kolovoza je jedna traka

  it("ugao zgrade na trotoaru ili kolovozu ide do ivice trotoara", () => {
    const t = odmakniOdUlice(P, { x: GRAD_SIRINA_TRAKE, y: 50 });
    expect(t.x).toBeCloseTo(granica, 6);
    expect(t.y).toBeCloseTo(50, 6);
    // Tačka dalje od trotoara se ne dira.
    const dalje = { x: granica + 1, y: 50 };
    expect(odmakniOdUlice(P, dalje)).toBe(dalje);
  });

  it("duboko u stambenoj ulici: netačna OSM linija — kuća se odmiče do kraja", () => {
    const duboko = { x: granica - GRAD_ODMAK_NAJVISE - 0.5, y: 50 };
    expect(odmakniOdUlice(P, duboko).x).toBeCloseTo(granica, 6);
  });

  it("duboko u servisnom putu: prolaz kroz zgradu — ostaje", () => {
    const servis = napraviPovrsinu(mrezaSaKlasom("service"));
    const pola = GRAD_SIRINA_TRAKE; // dvije trake, kao i ostale ulice test-mreže
    const duboko = { x: pola + GRAD_TROTOAR - GRAD_ODMAK_NAJVISE - 0.5, y: 50 };
    expect(odmakniOdUlice(servis, duboko)).toBe(duboko);
    // A plitko i u servisnom se odmiče.
    expect(odmakniOdUlice(servis, { x: pola, y: 50 }).x).toBeCloseTo(pola + GRAD_TROTOAR, 6);
  });
});

describe("zgrade: Podgorica", () => {
  const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
  const b = readFileSync(join(JAVNO, spisak.podgorica!.fajl));
  const paket = procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const povrsina = napraviPovrsinu(napraviMrezu(paket));
  const zone = JSON.parse(readFileSync(join(JAVNO, "cityZones", "podgorica.json"), "utf8")) as { zone: ZonaPalete[] };

  it("svaka zgrada ima konačnu geometriju, a skoro nijedna više ne stoji na asfaltu", () => {
    let zgrada_ = 0;
    let naAsfaltu = 0;
    let temena = 0;
    const lista = [];
    for (let i = 0; i < paket.n.zgVrsta.length; i++) {
      const z = zgrada(paket, i, povrsina, PALETE, zone.zone);
      if (!z) continue;
      zgrada_ += 1;
      if (z.osnova.some((p) => naPovrsini(povrsina, p.x, p.y))) naAsfaltu += 1;
      expect(Number.isFinite(z.visina) && z.visina > 0).toBe(true);
      if (i % 50 === 0) lista.push(z);
    }
    const t = geometrijaZgrada(lista, triangulisi);
    temena = t.visina.length;
    expect(t.polozaj.every(Number.isFinite)).toBe(true);
    expect(temena).toBeGreaterThan(0);
    // Prije odmaka 13,4 % zgrada (4 548) je uglom stajalo na asfaltu; poslije
    // izmjereno 0,2 % — prolazi kroz zgrade na servisnim putevima.
    expect(naAsfaltu / zgrada_).toBeLessThan(0.005);
    expect(zgrada_ / paket.n.zgVrsta.length).toBeGreaterThan(0.99);
  });
});
