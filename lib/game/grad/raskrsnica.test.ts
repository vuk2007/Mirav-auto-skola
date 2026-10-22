import { describe, expect, it } from "vitest";
import {
  GRAD_LINIJE_OD_RASKRSNICE,
  GRAD_SEMAFOR_SVE_CRVENO,
  GRAD_SEMAFOR_ZELENO_GLAVNO,
  GRAD_SEMAFOR_ZUTO,
  GRAD_SIRINA_TRAKE,
  GRAD_STOP_ISPRED_ZEBRE,
  GRAD_ZEBRA_DUBINA,
} from "../sim/config";
import type { Point } from "../sim/types";
import { krajeviLinija } from "./oznake";
import { naKraku, napraviRaskrsnice, prekrsenaZabrana, svjetlo, zabraneSkretanja, type Raskrsnica } from "./raskrsnica";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";

/**
 * Model raskrsnice — stavka 5b (zadatak, odjeljak 8: tabela za generičke
 * čvorove sa 3–6 krakova, ukošene ulice, jednosmjerne, više traka, semafori,
 * kružni tok). `y` raste na jug.
 */
function raskrsnice(cvorovi: Point[], ivice: TestIvica[], objekti: TestObjekat[] = [], zabrane: [string, number, number, number][] = []) {
  const { paket, mreza } = testPaket(cvorovi, ivice, objekti, zabrane);
  return { ...napraviRaskrsnice(paket, mreza, krajeviLinija(mreza)), mreza, paket };
}

/** Zvijezda: centar 0 i krakovi na zadatim uglovima [°] (0 je istok, 90 jug), 100 m dugi, ka centru. */
function zvijezda(uglovi: number[], klase: string[] = [], ivicaIzmjene: Partial<TestIvica>[] = []) {
  const cvorovi: Point[] = [{ x: 0, y: 0 }];
  const ivice: TestIvica[] = [];
  uglovi.forEach((u, i) => {
    const a = (u * Math.PI) / 180;
    cvorovi.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) });
    // Ivica ide od kraja kraka ka centru: `b` je centar.
    ivice.push({ a: i + 1, b: 0, klasa: klase[i] ?? "residential", ...ivicaIzmjene[i] });
  });
  return { cvorovi, ivice };
}

const kontrole = (r: Raskrsnica) => r.kraci.map((k) => `${k.klasa}:${k.kontrola}:${k.izvor}`);

describe("raskrsnica: krakovi", () => {
  it.each([3, 4, 5, 6])("čvor sa %i krakova pod proizvoljnim uglovima — krakovi po uglu", (broj) => {
    const uglovi = Array.from({ length: broj }, (_, i) => (i * 360) / broj + (i % 2 ? 11 : -7));
    const { cvorovi, ivice } = zvijezda(uglovi);
    const { lista } = raskrsnice(cvorovi, ivice);
    expect(lista).toHaveLength(1);
    const r = lista[0]!;
    expect(r.kraci).toHaveLength(broj);
    for (let j = 1; j < r.kraci.length; j++) expect(r.kraci[j]!.ugao).toBeGreaterThan(r.kraci[j - 1]!.ugao);
    // Bez znakova i istih klasa: pravilo desne strane, bez zastavica.
    expect(r.kraci.every((k) => k.kontrola === "desna" && k.izvor === "pravilo")).toBe(true);
    expect(r.inferredPriority).toBe(false);
  });

  it("jednosmjerne: na krak koji vodi ka raskrsnici se ulazi, na onaj od nje se izlazi", () => {
    // Ivice idu ka centru (a = kraj kraka, b = centar): smjer 1 je ka centru.
    const { cvorovi, ivice } = zvijezda([0, 90, 180], [], [{ smjer: 1 }, { smjer: -1 }, {}]);
    const r = raskrsnice(cvorovi, ivice).lista[0]!;
    const po = (u: number) => r.kraci.find((k) => Math.abs(k.ugao - (u * Math.PI) / 180) < 0.01)!;
    expect([po(0).ulaz, po(0).izlaz]).toEqual([true, false]);
    expect([po(90).ulaz, po(90).izlaz]).toEqual([false, true]);
    expect([po(180).ulaz, po(180).izlaz]).toEqual([true, true]);
  });

  it("čvor sa dvije ulice nije raskrsnica", () => {
    const { cvorovi, ivice } = zvijezda([0, 180]);
    expect(raskrsnice(cvorovi, ivice).lista).toHaveLength(0);
  });
});

describe("raskrsnica: prednost", () => {
  it("sporedna na glavnu bez znaka: sporedna ustupa, izvedeno (inferredPriority)", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180], ["primary", "residential", "primary"]);
    const r = raskrsnice(cvorovi, ivice).lista[0]!;
    expect(kontrole(r)).toEqual([
      "primary:glavni:izvedeno",
      "residential:ustupi:izvedeno",
      "primary:glavni:izvedeno",
    ]);
    expect(r.inferredPriority).toBe(true);
  });

  it("tercijarna na primarnu bez znaka: nijedna ne ustupa (samo sporedne ustupaju)", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180], ["primary", "tertiary", "primary"]);
    const r = raskrsnice(cvorovi, ivice).lista[0]!;
    expect(r.kraci.map((k) => k.kontrola)).toEqual(["desna", "desna", "desna"]);
  });

  it("sporedna na tercijarnu bez znaka: sporedna ustupa, izvedeno (provjera mape, odluka 2026-10-22)", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180], ["tertiary", "residential", "tertiary"]);
    const r = raskrsnice(cvorovi, ivice).lista[0]!;
    expect(kontrole(r)).toEqual([
      "tertiary:glavni:izvedeno",
      "residential:ustupi:izvedeno",
      "tertiary:glavni:izvedeno",
    ]);
    expect(r.inferredPriority).toBe(true);
  });

  it("STOP iz OSM-a na jednoj sporednoj: sporedna naspram nje bez znaka ustupa, izvedeno (nije glavni put)", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180, 270], ["primary", "residential", "primary", "residential"]);
    // Ivica 1 (jug) ide ka centru: STOP u smjeru ulaska. Sjever (ivica 3) nema znak.
    const r = raskrsnice(cvorovi, ivice, [{ vrsta: "stop", podatak: "forward", ivica: 1, s: 92 }]).lista[0]!;
    // Krakovi po uglu: sjever (270°, ugao −90°) je prvi.
    expect(kontrole(r)).toEqual([
      "residential:ustupi:izvedeno",
      "primary:glavni:osm",
      "residential:stop:osm",
      "primary:glavni:osm",
    ]);
    expect(r.inferredPriority).toBe(true);
  });

  it("STOP iz OSM-a na kraku, u smjeru ka raskrsnici: taj krak staje, ostali su glavni", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180]);
    // Ivica 1 (krak na jugu) ide ka centru, pa je smjer ulaska `forward`.
    const r = raskrsnice(cvorovi, ivice, [{ vrsta: "stop", podatak: "forward", ivica: 1, s: 92 }]).lista[0]!;
    expect(kontrole(r)).toEqual(["residential:glavni:osm", "residential:stop:osm", "residential:glavni:osm"]);
    // Linija je gdje je znak (8 m od centra), jer je to dalje od ivice raskrsnice.
    expect(r.kraci[1]!.stopD).toBeCloseTo(8, 4);
    expect(r.inferredPriority).toBe(false);
  });

  it("STOP okrenut na drugu stranu (backward) ne važi za ulaz u ovu raskrsnicu", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180]);
    const r = raskrsnice(cvorovi, ivice, [{ vrsta: "stop", podatak: "backward", ivica: 1, s: 92 }]).lista[0]!;
    expect(r.kraci.every((k) => k.kontrola === "desna")).toBe(true);
  });

  it("znak dalje od GRAD_ZNAK_DO ne važi za raskrsnicu", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180]);
    const r = raskrsnice(cvorovi, ivice, [{ vrsta: "give_way", ivica: 1, s: 20 }]).lista[0]!;
    expect(r.kraci.every((k) => k.kontrola === "desna")).toBe(true);
  });

  it("stop-linija bez znaka na mjestu: na ivici raskrsnice; zebra ispred: linija ide iza zebre", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180], ["primary", "residential", "primary"]);
    const bez = raskrsnice(cvorovi, ivice).lista[0]!;
    const ivicaRaskrsnice = GRAD_SIRINA_TRAKE + GRAD_LINIJE_OD_RASKRSNICE + 0.5;
    expect(bez.kraci[1]!.stopD).toBeCloseTo(ivicaRaskrsnice, 4);
    const saZebrom = raskrsnice(cvorovi, ivice, [{ vrsta: "crossing", podatak: "zebra", ivica: 1, s: 92 }]).lista[0]!;
    expect(saZebrom.kraci[1]!.stopD).toBeCloseTo(8 + GRAD_ZEBRA_DUBINA / 2 + GRAD_STOP_ISPRED_ZEBRE, 4);
  });
});

describe("raskrsnica: semafori", () => {
  const { cvorovi, ivice } = zvijezda([0, 90, 180, 270], ["primary", "residential", "primary", "residential"]);
  const r = raskrsnice(cvorovi, ivice, [{ vrsta: "traffic_signals", cvor: 0 }]).lista[0]!;

  it("semafor u čvoru: svi ulazi pod semaforom, dvije faze po osama, izvedene (inferredPhases)", () => {
    expect(r.kraci.every((k) => k.kontrola === "semafor")).toBe(true);
    expect(r.inferredPhases).toBe(true);
    expect(r.plan!.faze).toHaveLength(2);
    // Glavna osa (istok–zapad) prva; suprotni krakovi u istoj fazi.
    expect(r.plan!.faze[0]!.kraci.map((j) => r.kraci[j]!.klasa)).toEqual(["primary", "primary"]);
    expect(r.plan!.faze[0]!.zeleno).toBe(GRAD_SEMAFOR_ZELENO_GLAVNO);
  });

  it("ciklus: zeleno → žuto → sve crveno, nikad dva zelena u isto vrijeme", () => {
    const glavni = r.plan!.faze[0]!.kraci[0]!;
    const sporedni = r.plan!.faze[1]!.kraci[0]!;
    const t0 = r.plan!.ciklus - r.plan!.pomak; // početak ciklusa
    expect(svjetlo(r, glavni, t0 + 1)).toBe("zeleno");
    expect(svjetlo(r, sporedni, t0 + 1)).toBe("crveno");
    expect(svjetlo(r, glavni, t0 + GRAD_SEMAFOR_ZELENO_GLAVNO + 1)).toBe("zuto");
    expect(svjetlo(r, glavni, t0 + GRAD_SEMAFOR_ZELENO_GLAVNO + GRAD_SEMAFOR_ZUTO + 0.5)).toBe("crveno");
    expect(svjetlo(r, sporedni, t0 + GRAD_SEMAFOR_ZELENO_GLAVNO + GRAD_SEMAFOR_ZUTO + 0.5)).toBe("crveno");
    expect(svjetlo(r, sporedni, t0 + GRAD_SEMAFOR_ZELENO_GLAVNO + GRAD_SEMAFOR_ZUTO + GRAD_SEMAFOR_SVE_CRVENO + 1)).toBe(
      "zeleno",
    );
    for (let t = 0; t < 2 * r.plan!.ciklus; t += 0.25) {
      const faze = new Set(r.kraci.map((k, j) => (svjetlo(r, j, t) === "zeleno" ? k.faza : null)).filter((f) => f !== null));
      expect(faze.size, `t = ${t}`).toBeLessThanOrEqual(1);
    }
  });

  it("šest krakova pod raznim uglovima: tri ose, tri faze", () => {
    const s = zvijezda([0, 60, 120, 180, 240, 300]);
    const x = raskrsnice(s.cvorovi, s.ivice, [{ vrsta: "traffic_signals", cvor: 0 }]).lista[0]!;
    expect(x.plan!.faze).toHaveLength(3);
    for (const f of x.plan!.faze) expect(f.kraci).toHaveLength(2);
  });

  it("semafor samo na nekim krakovima: prilaz iz dvorišta i priključna traka bez semafora ustupaju, izvedeno", () => {
    for (const klasa of ["service", "secondary_link"]) {
      const s = zvijezda([0, 90, 180], ["secondary", klasa, "secondary"]);
      const x = raskrsnice(s.cvorovi, s.ivice, [
        { vrsta: "traffic_signals", ivica: 0, s: 90 },
        { vrsta: "traffic_signals", ivica: 2, s: 90 },
      ]).lista[0]!;
      expect(x.kraci.map((k) => k.kontrola)).toEqual(["semafor", "ustupi", "semafor"]);
      expect(x.inferredPriority).toBe(true);
    }
  });

  it("semafor samo na nekim krakovima: ulica bez svog semafora je i ona pod semaforom, izvedeno (provjera mape)", () => {
    const s = zvijezda([0, 90, 180]);
    const x = raskrsnice(s.cvorovi, s.ivice, [
      { vrsta: "traffic_signals", ivica: 0, s: 90 },
      { vrsta: "traffic_signals", ivica: 2, s: 90 },
    ]).lista[0]!;
    expect(x.kraci.map((k) => `${k.kontrola}:${k.izvor}`)).toEqual(["semafor:osm", "semafor:izvedeno", "semafor:osm"]);
    expect(x.plan!.faze).toHaveLength(2);
  });
});

describe("raskrsnica: semafor iza kratkog kraka (ispravka, stavka 8)", () => {
  // Četiri kraka; svaki je u OSM-u prelomljen 10 m od centra (kratka ivica
  // kraka), a zebra (14 m) i semafor (18 m) su na nastavku ulice — kao na
  // raskrsnici Moskovske i Bulevara revolucije.
  const uglovi = [0, 90, 180, 270];
  const cvorovi: Point[] = [{ x: 0, y: 0 }];
  const ivice: TestIvica[] = [];
  const objekti: TestObjekat[] = [];
  uglovi.forEach((u, i) => {
    const a = (u * Math.PI) / 180;
    cvorovi.push({ x: 100 * Math.cos(a), y: 100 * Math.sin(a) }, { x: 10 * Math.cos(a), y: 10 * Math.sin(a) });
    // Ivica 2i: od kraja kraka do preloma (90 m); 2i + 1: od preloma do centra.
    ivice.push({ a: 2 * i + 1, b: 2 * i + 2, klasa: "secondary" }, { a: 2 * i + 2, b: 0, klasa: "secondary" });
    objekti.push(
      { vrsta: "crossing", podatak: "traffic_signals", ivica: 2 * i, s: 86 },
      { vrsta: "traffic_signals", podatak: "forward", ivica: 2 * i, s: 82 },
    );
  });

  it("svi krakovi su pod semaforom; stop-linija je na nastavku ulice, ispred zebre", () => {
    const x = raskrsnice(cvorovi, ivice, objekti);
    expect(x.lista).toHaveLength(1);
    const r = x.lista[0]!;
    expect(r.kraci.map((k) => `${k.kontrola}:${k.izvor}`)).toEqual(Array(4).fill("semafor:osm"));
    expect(r.plan!.faze).toHaveLength(2);
    for (const k of r.kraci) {
      // Linija na semaforu, 18 m od centra — dalje od kratke ivice kraka.
      expect(k.stopD).toBeCloseTo(18, 3);
      expect(k.lanac.map((l) => l.ivica)).toEqual([k.ivica, k.ivica - 1]);
      const l = naKraku(x.mreza, k, k.stopD!);
      expect(Math.hypot(l.tacka.x, l.tacka.y)).toBeCloseTo(18, 3);
      expect(l.ivica).toBe(k.ivica - 1);
    }
    expect(x.semaforiRaskrsnica.size).toBe(4);
  });

  it("jedan semafor uz zebru dalje od raskrsnice, a drugi krakovi bez semafora: pješački semafor", () => {
    const x = raskrsnice(cvorovi, ivice, [
      { vrsta: "crossing", podatak: "traffic_signals", ivica: 0, s: 66 },
      { vrsta: "traffic_signals", ivica: 0, s: 62 },
    ]);
    const r = x.lista[0]!;
    expect(r.kraci.every((k) => k.kontrola === "desna")).toBe(true);
    expect(x.semaforiRaskrsnica.size).toBe(0);
  });
});

describe("raskrsnica: bulevar sa dvije kolovozne trake", () => {
  // Dvije jednosmjerne trake bulevara (istok–zapad), 16 m razmaka, i ulica
  // koja ih presijeca (sjever–jug). Čvorovi: 0 (sjeverna traka × ulica), 1
  // (južna traka × ulica); ivica 0–1 je 16 m unutar raskrsnice.
  const cvorovi: Point[] = [
    { x: 0, y: -8 },
    { x: 0, y: 8 },
    { x: -100, y: -8 },
    { x: 100, y: -8 },
    { x: 100, y: 8 },
    { x: -100, y: 8 },
    { x: 0, y: -100 },
    { x: 0, y: 100 },
  ];
  const ivice: TestIvica[] = [
    { a: 0, b: 1, klasa: "residential" },
    { a: 3, b: 0, klasa: "primary", smjer: 1 }, // sjeverna traka ide na zapad
    { a: 0, b: 2, klasa: "primary", smjer: 1 },
    { a: 5, b: 1, klasa: "primary", smjer: 1 }, // južna traka ide na istok
    { a: 1, b: 4, klasa: "primary", smjer: 1 },
    { a: 6, b: 0, klasa: "residential" },
    { a: 1, b: 7, klasa: "residential" },
  ];

  it("dva čvora su jedna raskrsnica; ivica između njih je unutra, ne krak", () => {
    const { lista, uCvoru } = raskrsnice(cvorovi, ivice, [{ vrsta: "traffic_signals", cvor: 0 }]);
    expect(lista).toHaveLength(1);
    expect(uCvoru[0]).toBe(0);
    expect(uCvoru[1]).toBe(0);
    expect(lista[0]!.unutrasnje).toEqual([0]);
    expect(lista[0]!.kraci).toHaveLength(6);
    // Semafor u jednom čvoru važi za cijelu raskrsnicu: jedan plan.
    expect(lista[0]!.kraci.filter((k) => k.ulaz).every((k) => k.kontrola === "semafor")).toBe(true);
  });

  it("dvije raskrsnice 60 m jedna od druge ostaju dvije", () => {
    const daleko = cvorovi.map((p, i) => (i === 1 || i === 4 || i === 5 || i === 7 ? { x: p.x, y: p.y + 44 } : p));
    const { lista } = raskrsnice(daleko, ivice);
    expect(lista).toHaveLength(2);
  });
});

describe("raskrsnica: šta NIJE jedna raskrsnica", () => {
  it("dvije T-raskrsnice u stambenoj ulici, 20 m jedna od druge, ostaju dvije", () => {
    const cvorovi: Point[] = [
      { x: -100, y: 0 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 120, y: 0 },
      { x: 0, y: 100 },
      { x: 20, y: -100 },
    ];
    const ivice: TestIvica[] = [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
      { a: 4, b: 1 },
      { a: 5, b: 2 },
    ];
    expect(raskrsnice(cvorovi, ivice).lista).toHaveLength(2);
  });

  it("pješački semafor na sredini ulice ne upravlja raskrsnicom", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180]);
    // Semafor i prelaz 40 m od centra: to je semafor za pješake, ne za raskrsnicu.
    const r = raskrsnice(cvorovi, ivice, [
      { vrsta: "traffic_signals", ivica: 0, s: 60 },
      { vrsta: "crossing", podatak: "traffic_signals", ivica: 0, s: 61 },
    ]).lista[0]!;
    expect(r.plan).toBeNull();
    expect(r.kraci.every((k) => k.kontrola === "desna")).toBe(true);
  });
});

describe("raskrsnica: kružni tok", () => {
  // Prsten: 4 čvora na krugu od 15 m, ivice prstena u smjeru kruženja, i
  // četiri prilaza spolja.
  const R = 15;
  const cvorovi: Point[] = [
    { x: R, y: 0 },
    { x: 0, y: -R },
    { x: -R, y: 0 },
    { x: 0, y: R },
    { x: 100, y: 0 },
    { x: 0, y: -100 },
    { x: -100, y: 0 },
    { x: 0, y: 100 },
  ];
  const ivice: TestIvica[] = [
    { a: 0, b: 1, smjer: 1, kruzni: true, klasa: "primary" },
    { a: 1, b: 2, smjer: 1, kruzni: true, klasa: "primary" },
    { a: 2, b: 3, smjer: 1, kruzni: true, klasa: "primary" },
    { a: 3, b: 0, smjer: 1, kruzni: true, klasa: "primary" },
    { a: 4, b: 0 },
    { a: 5, b: 1 },
    { a: 6, b: 2 },
    { a: 7, b: 3 },
  ];

  it("svaki ulaz je svoja raskrsnica; ulaz ustupa prstenu, izvedeno", () => {
    const { lista } = raskrsnice(cvorovi, ivice);
    expect(lista).toHaveLength(4);
    for (const r of lista) {
      expect(r.kruzni).toBe(true);
      expect(r.inferredPriority).toBe(true);
      const ulaz = r.kraci.find((k) => k.klasa === "residential")!;
      const prsten = r.kraci.find((k) => k.klasa === "primary" && k.ulaz)!;
      expect(ulaz.kontrola).toBe("ustupi");
      expect(prsten.kontrola).toBe("glavni");
      expect(ulaz.stopD).not.toBeNull();
    }
  });
});

describe("zabrane skretanja", () => {
  it("no_left_turn zabranjuje tačno taj izlaz; only_straight_on sve ostale", () => {
    const { cvorovi, ivice } = zvijezda([0, 90, 180, 270]);
    // Sa juga (ivica 1): lijevo je zapad (ivica 2), pravo sjever (3), desno istok (0).
    const { paket } = raskrsnice(cvorovi, ivice, [], [["no_left_turn", 1, 0, 2]]);
    const z = zabraneSkretanja(paket);
    expect(prekrsenaZabrana(z, 1, 0, 2)?.vrsta).toBe("no_left_turn");
    expect(prekrsenaZabrana(z, 1, 0, 3)).toBeNull();
    const samo = zabraneSkretanja(raskrsnice(cvorovi, ivice, [], [["only_straight_on", 1, 0, 3]]).paket);
    expect(prekrsenaZabrana(samo, 1, 0, 3)).toBeNull();
    expect(prekrsenaZabrana(samo, 1, 0, 0)?.vrsta).toBe("only_straight_on");
    expect(prekrsenaZabrana(samo, 1, 0, 2)?.vrsta).toBe("only_straight_on");
    // Sa drugog kraka zabrana ne važi.
    expect(prekrsenaZabrana(samo, 0, 0, 2)).toBeNull();
  });
});
