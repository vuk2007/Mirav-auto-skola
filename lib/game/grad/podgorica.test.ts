import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { segmentIntersection } from "../sim/geometry";
import type { Point } from "../sim/types";
import { napraviMrezu } from "./mreza";
import { IVICA_MOST, IVICA_TUNEL, procitaj, type Paket } from "./paket";

/**
 * Konzistentnost svijeta — zadatak, odjeljak 8: sve ulice povezane u jedan
 * graf (izuzev označenih), nema NaN, mostovi prelaze rijeke. Na PRAVOM paketu
 * Podgorice, onom koji igra i učitava.
 */
const JAVNO = join(import.meta.dirname, "..", "..", "..", "public", "data", "grad");
const spisak = JSON.parse(readFileSync(join(JAVNO, "gradovi.json"), "utf8")) as Record<string, { fajl: string }>;
const bajtovi = readFileSync(join(JAVNO, spisak.podgorica!.fajl));
const paket: Paket = procitaj(bajtovi.buffer.slice(bajtovi.byteOffset, bajtovi.byteOffset + bajtovi.byteLength));
const mreza = napraviMrezu(paket);

describe("Podgorica: paket grada", () => {
  it("nijedna koordinata nije NaN, ni daleko van grada", () => {
    const o = paket.zaglavlje.okvir;
    // Overpass vraća CIJELI put koji zalazi u okvir, pa ulica koja iz grada
    // vodi dalje ima čvorove i petnaestak kilometara van njega — to je stvaran
    // put. Ovo hvata smeće iz projekcije, ne duge puteve.
    const rub = 30000;
    for (const ime of ["cvXY", "ivXY", "zgXY", "pvXY", "lnXY", "obXY"] as const) {
      const niz = paket.n[ime];
      for (let k = 0; k < niz.length; k += 2) {
        const x = niz[k]!;
        const y = niz[k + 1]!;
        expect(Number.isFinite(x) && Number.isFinite(y), `${ime}[${k}]`).toBe(true);
        if (x < o.minX - rub || x > o.maxX + rub || y < o.minY - rub || y > o.maxY + rub) {
          throw new Error(`${ime}[${k}] van okvira: ${x}, ${y}`);
        }
      }
    }
  });

  it("indeksi tile-ova rastu i pokrivaju sve stavke", () => {
    const tileova = paket.zaglavlje.tileovaX * paket.zaglavlje.tileovaY;
    for (const [od, broj] of [
      [paket.n.zgTileOd, paket.n.zgVrsta.length],
      [paket.n.pvTileOd, paket.n.pvVrsta.length],
      [paket.n.lnTileOd, paket.n.lnVrsta.length],
      [paket.n.obTileOd, paket.n.obVrsta.length],
    ] as const) {
      expect(od.length).toBe(tileova + 1);
      expect(od[0]).toBe(0);
      expect(od[tileova]).toBe(broj);
      for (let t = 0; t < tileova; t++) expect(od[t + 1]!).toBeGreaterThanOrEqual(od[t]!);
    }
  });

  it("vozne ulice su jedan graf — ostrva su izuzetak, ne pravilo", () => {
    const roditelj = mreza.cvorovi.map((_, i) => i);
    const nadji = (x: number): number => {
      while (roditelj[x] !== x) x = roditelj[x] = roditelj[roditelj[x]!]!;
      return x;
    };
    const vozne = mreza.ivice.filter((iv) => iv.vozna);
    for (const iv of vozne) roditelj[nadji(iv.a)] = nadji(iv.b);
    const velicine = new Map<number, number>();
    for (const iv of vozne) velicine.set(nadji(iv.a), (velicine.get(nadji(iv.a)) ?? 0) + 1);
    const najveca = Math.max(...velicine.values());
    // Izmjereno 99,5 %: ostrva su parkinzi i prilazi presječeni okvirom upita.
    expect(najveca / vozne.length).toBeGreaterThan(0.99);
  });

  it("ulica koja prelazi rijeku je most ili tunel", () => {
    const rijeke: Point[][] = [];
    const vrste = paket.zaglavlje.vrsteLinija;
    for (let i = 0; i < paket.n.lnVrsta.length; i++) {
      if (vrste[paket.n.lnVrsta[i]!] !== "rijeka") continue;
      const t: Point[] = [];
      for (let k = paket.n.lnOd[i]!; k < paket.n.lnOd[i + 1]!; k++) t.push({ x: paket.n.lnXY[2 * k]!, y: paket.n.lnXY[2 * k + 1]! });
      rijeke.push(t);
    }
    const bezMosta: string[] = [];
    let prelaza = 0;
    for (const iv of mreza.ivice) {
      // Poljski put (`track`) preko potoka ide gazom, bez mosta — izmjereno
      // jedan takav u Podgorici. Pravilo je za ulice.
      if (!iv.vozna || iv.klasa === "track") continue;
      const most = (paket.n.ivZastavice[iv.i]! & (IVICA_MOST | IVICA_TUNEL)) !== 0;
      let sijece = false;
      for (const r of rijeke) {
        for (let a = 0; a + 1 < iv.tacke.length && !sijece; a++) {
          for (let b = 0; b + 1 < r.length && !sijece; b++) {
            if (segmentIntersection(iv.tacke[a]!, iv.tacke[a + 1]!, r[b]!, r[b + 1]!)) sijece = true;
          }
        }
      }
      if (!sijece) continue;
      prelaza += 1;
      if (!most) bezMosta.push(`${iv.ime || "bez imena"} (OSM ${paket.n.ivOsm[iv.i]})`);
    }
    expect(prelaza).toBeGreaterThan(0);
    expect(bezMosta).toEqual([]);
  });
});
