import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rng } from "../sim/geometry";
import type { Point } from "../sim/types";
import { nasumicnaRuta, odveziRutu, planBota, ruta, type Korak } from "./botGrad";
import { napraviMrezu } from "./mreza";
import { krajeviLinija } from "./oznake";
import { procitaj } from "./paket";
import { napraviPovrsinu } from "./povrsina";
import { napraviRaskrsnice, prekrsenaZabrana, zabraneSkretanja } from "./raskrsnica";
import { gradZaSudiju } from "./sudija";
import { kruzniTok, testPaket, type TestObjekat } from "./testMreza";

/**
 * Savršeni bot u gradu — stavka 5f: vozi rutu od-do po pravilima, i sudija mu
 * ne nađe ništa. Mreža 3 × 3 čvora na 120 m: čvor `3·red + kolona`, centar 4
 * ima semafor, sjeverni krak centra STOP. Ivice: vodoravne 0–5 (red po red),
 * uspravne 6–11.
 */
const CVOROVI: Point[] = Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 120, y: Math.floor(i / 3) * 120 }));
const IVICE = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [6, 7],
  [7, 8],
  [0, 3],
  [1, 4],
  [2, 5],
  [3, 6],
  [4, 7],
  [5, 8],
].map(([a, b]) => ({ a: a!, b: b! }));
const ZAPAD = 2; // 3 → 4
const ISTOK = 3; // 4 → 5
const SJEVER = 7; // 1 → 4
const JUG = 10; // 4 → 7

function grad(objekti: TestObjekat[], zabrane: [string, number, number, number][] = []) {
  const { paket, mreza } = testPaket(CVOROVI, IVICE, objekti, zabrane);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  const z = zabraneSkretanja(paket);
  return { G: gradZaSudiju(paket, povrsina, r, z, odsjeci), z };
}

const SEMAFOR: TestObjekat[] = [{ vrsta: "traffic_signals", cvor: 4 }];

function vozi(G: ReturnType<typeof grad>["G"], z: ReturnType<typeof grad>["z"], od: Korak, do_: Korak, t0 = 0) {
  const koraci = ruta(G.mreza, G.raskrsnice, z, od, do_);
  expect(koraci).not.toBeNull();
  const plan = planBota(G, koraci!);
  return { koraci: koraci!, x: odveziRutu(G, G.povrsina, plan, t0, 5, 600) };
}

describe("grad: savršeni bot", () => {
  it("kroz semafor pravo, lijevo i desno — u svakoj fazi, bez prekršaja", () => {
    const { G, z } = grad(SEMAFOR);
    const rute: [Korak, Korak][] = [
      [{ ivica: ZAPAD, smjer: 1 }, { ivica: ISTOK, smjer: 1 }],
      // Sa juga ka sjeveru, pa lijevo na zapad.
      [{ ivica: JUG, smjer: -1 }, { ivica: ZAPAD, smjer: -1 }],
      // Sa zapada desno na jug.
      [{ ivica: ZAPAD, smjer: 1 }, { ivica: JUG, smjer: 1 }],
    ];
    for (const [od, do_] of rute) {
      for (const t0 of [0, 17, 34, 51]) {
        const { x } = vozi(G, z, od, do_, t0);
        expect(x.stigao, `${od.ivica}→${do_.ivica} t0 ${t0}`).toBe(true);
        expect(x.prekrsaji, `${od.ivica}→${do_.ivica} t0 ${t0}`).toEqual([]);
      }
    }
  });

  it("na STOP staje, pa nastavlja", () => {
    const { G, z } = grad([{ vrsta: "stop", ivica: SJEVER, s: 110 }]);
    const { x } = vozi(G, z, { ivica: SJEVER, smjer: 1 }, { ivica: JUG, smjer: 1 });
    expect(x.stigao).toBe(true);
    expect(x.prekrsaji).toEqual([]);
  });

  it("zabranjeno lijevo zaobilazi drugim ulicama", () => {
    const { G, z } = grad(SEMAFOR, [["no_left_turn", JUG, 4, ZAPAD]]);
    const { koraci, x } = vozi(G, z, { ivica: JUG, smjer: -1 }, { ivica: ZAPAD, smjer: -1 });
    for (let i = 0; i + 1 < koraci.length; i++) {
      const iv = G.mreza.ivice[koraci[i]!.ivica]!;
      const cvor = koraci[i]!.smjer === 1 ? iv.b : iv.a;
      expect(prekrsenaZabrana(z, koraci[i]!.ivica, cvor, koraci[i + 1]!.ivica)).toBeNull();
    }
    expect(koraci.length).toBeGreaterThan(2);
    expect(x.stigao).toBe(true);
    expect(x.prekrsaji).toEqual([]);
  });
});

describe("grad: savršeni bot u dvotračnom kružnom toku", () => {
  const { cvorovi, ivice } = kruzniTok();
  const { paket, mreza } = testPaket(cvorovi, ivice);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  const z = zabraneSkretanja(paket);
  const G = gradZaSudiju(paket, povrsina, r, z, odsjeci);

  it("sa juga desno, pravo i lijevo — prava traka u prstenu, bez prekršaja", () => {
    // Istok (ivica 8), sjever (11), zapad (10), svaki put od prstena napolje.
    for (const izlaz of [8, 11, 10]) {
      const koraci = ruta(mreza, r, z, { ivica: 9, smjer: 1 }, { ivica: izlaz, smjer: -1 });
      expect(koraci).not.toBeNull();
      const x = odveziRutu(G, povrsina, planBota(G, koraci!), 0, 5, 600);
      expect(x.stigao, `izlaz ${izlaz}`).toBe(true);
      expect(x.prekrsaji, `izlaz ${izlaz}`).toEqual([]);
    }
  });
});

describe("Podgorica: savršeni bot", () => {
  // Pravi paket; pet nasumičnih ruta (cijelih 50 vozi `npm run test:fuzz:grad`).
  const J = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
  const spisak = JSON.parse(readFileSync(join(J, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
  const b = readFileSync(join(J, spisak.podgorica!.fajl));
  const paket = procitaj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const mreza = napraviMrezu(paket);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  const z = zabraneSkretanja(paket);
  const G = gradZaSudiju(paket, povrsina, r, z, odsjeci);

  it("pet ruta na nivou 5: do kraja, bez prekršaja", { timeout: 60000 }, () => {
    const slucajno = rng(1);
    for (let n = 0; n < 5; n++) {
      const koraci = nasumicnaRuta(mreza, r, z, slucajno);
      const plan = planBota(G, koraci);
      const x = odveziRutu(G, povrsina, plan, slucajno() * 300, 5, 1800);
      expect(x.stigao, `ruta ${n}`).toBe(true);
      expect(
        x.prekrsaji.map((p) => `${p.vrsta} @${Math.round(p.x)},${Math.round(p.y)}`),
        `ruta ${n}`,
      ).toEqual([]);
    }
  });
});
