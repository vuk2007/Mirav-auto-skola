import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rng } from "../sim/geometry";
import { linijeAutobusa, voznjaLinijom, type SiroveLinije } from "./autobusi";
import type { Korak } from "./botGrad";
import { procitaj, type Paket } from "./paket";
import { oseBlizu } from "./povrsina";
import { svijetGrada } from "./svijet";

/**
 * Autobuske linije (faza 6, stavka 8c) na PRAVOM paketu Podgorice i pravim
 * linijama iz OSM-a (`public/data/grad/linije/podgorica.json`).
 */
const JAVNO = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
const bajtovi = readFileSync(join(JAVNO, spisak.podgorica!.fajl));
const paket: Paket = procitaj(bajtovi.buffer.slice(bajtovi.byteOffset, bajtovi.byteOffset + bajtovi.byteLength));
const sv = svijetGrada(paket, null);
const sirove = JSON.parse(readFileSync(join(JAVNO, "linije", "podgorica.json"), "utf8")) as SiroveLinije;
const linije = linijeAutobusa(sv, sirove);

/** Vožnje iz nasumičnih ivica koridora (ko nema cilj ispred — preskače se). */
function voznje(ref: string, n: number, sjeme: number): Korak[][] {
  const l = linije.find((x) => x.ref === ref)!;
  const sl = rng(sjeme);
  const out: Korak[][] = [];
  for (let k = 0; k < n; k++) {
    const i = l.ivice[Math.floor(sl() * l.ivice.length)]!;
    const iv = sv.mreza.ivice[i]!;
    const put = voznjaLinijom(sv, l, { ivica: i, smjer: iv.smjer !== 0 ? iv.smjer : 1 }, sl);
    if (put) out.push(put);
  }
  return out;
}

describe("autobuske linije Podgorice", () => {
  it("sve gradske linije iz OSM-a su na mreži, oba smjera zajedno", () => {
    expect(linije.map((l) => l.ref)).toEqual(["3", "4", "10", "15", "18", "19", "20"]);
    for (const l of linije) expect(l.ivice.length, `linija ${l.ref}`).toBeGreaterThan(100);
  });

  it("bar 90 % stajališta svake linije je uz njen koridor", () => {
    for (const l of linije) {
      const uz = l.stajalista.filter((p) => oseBlizu(sv.povrsina, p.x, p.y, 30).some((ob) => l.koridor.has(ob.ivica)));
      expect(uz.length / l.stajalista.length, `linija ${l.ref}`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("vožnja linijom: povezana ruta niz mrežu, većinom ulicama linije", () => {
    // Van koridora: rupe u OSM relaciji (ulica-član koja nije uz ivicu mreže)
    // i skretanja koja pravila igre ne dozvoljavaju (strelice, preoštar ugao).
    let sve = 0;
    let sveUKoridoru = 0;
    for (const l of linije) {
      const v = voznje(l.ref, 20, 11);
      expect(v.length, `linija ${l.ref}: vožnji`).toBeGreaterThanOrEqual(12);
      let ukupno = 0;
      let uKoridoru = 0;
      for (const put of v) {
        for (let k = 0; k < put.length; k++) {
          const iv = sv.mreza.ivice[put[k]!.ivica]!;
          if (k > 0) {
            const prije = sv.mreza.ivice[put[k - 1]!.ivica]!;
            const kraj = put[k - 1]!.smjer === 1 ? prije.b : prije.a;
            expect(put[k]!.smjer === 1 ? iv.a : iv.b).toBe(kraj);
          }
          expect(iv.smjer === 0 || iv.smjer === put[k]!.smjer).toBe(true);
          ukupno += iv.duzina;
          if (l.koridor.has(iv.i)) uKoridoru += iv.duzina;
        }
      }
      expect(uKoridoru / ukupno, `linija ${l.ref}: u koridoru`).toBeGreaterThanOrEqual(0.6);
      sve += ukupno;
      sveUKoridoru += uKoridoru;
    }
    expect(sveUKoridoru / sve).toBeGreaterThanOrEqual(0.75);
  });

  it("isto sjeme — ista vožnja", () => {
    expect(voznje("10", 5, 3)).toEqual(voznje("10", 5, 3));
  });

  it("grad bez linija u OSM-u: autobusi po bulevarima, staju na `bus_stop`", () => {
    const bul = linijeAutobusa(sv, null);
    expect(bul).toHaveLength(1);
    expect(bul[0]!.ref).toBe("");
    for (const i of bul[0]!.ivice) expect(["trunk", "primary", "secondary"]).toContain(sv.mreza.ivice[i]!.klasa);
    expect(bul[0]!.stajalista.length).toBeGreaterThan(100);
  });
});
