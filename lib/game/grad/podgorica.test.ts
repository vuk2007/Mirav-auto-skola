import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { segmentIntersection } from "../sim/geometry";
import type { Point } from "../sim/types";
import { napraviMrezu, najblizaIvica } from "./mreza";
import { BEZ, IVICA_MOST, IVICA_TUNEL, procitaj, type Paket } from "./paket";
import { krajeviLinija } from "./oznake";
import { naPovrsini, napraviPovrsinu } from "./povrsina";
import { napraviRaskrsnice, zabraneSkretanja } from "./raskrsnica";
import { crtezPravila } from "./znakovi";
import { autoNaPovrsini, slobodnoNaIvici } from "./slobodno";

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

describe("Podgorica: pravila u mreži (stavka 5a)", () => {
  it("znak, semafor i prelaz stoje na ivici (unutar njene dužine) ili u čvoru mreže", () => {
    const n = paket.n;
    let naMrezi = 0;
    for (let o = 0; o < n.obVrsta.length; o++) {
      const iv = n.obIvica[o]!;
      const c = n.obCvor[o]!;
      expect(iv === BEZ || c === BEZ, `objekat ${o}: i ivica i čvor`).toBe(true);
      if (iv !== BEZ) {
        expect(iv).toBeLessThan(mreza.ivice.length);
        const s = n.obS[o]!;
        expect(s >= -0.01 && s <= mreza.ivice[iv]!.duzina + 0.01, `objekat ${o}: s ${s}`).toBe(true);
        naMrezi += 1;
      }
      if (c !== BEZ) {
        expect(c).toBeLessThan(mreza.cvorovi.length);
        const p = mreza.cvorovi[c]!;
        // Položaj čvora pravila se uzima iz ulica, pa je tačno u čvoru mreže.
        expect(Math.hypot(p.x - n.obXY[2 * o]!, p.y - n.obXY[2 * o + 1]!)).toBeLessThan(0.01);
        naMrezi += 1;
      }
    }
    // Izmjereno: 2 349 od 2 450 objekata pravila je na voznoj ili pješačkoj mreži.
    expect(naMrezi).toBeGreaterThan(2000);
  });

  it("zabrana skretanja: obje ivice dodiruju čvor preko kojeg se skreće", () => {
    const n = paket.n;
    expect(n.rsOd.length).toBeGreaterThan(30);
    for (let r = 0; r < n.rsOd.length; r++) {
      const c = n.rsCvor[r]!;
      for (const i of [n.rsOd[r]!, n.rsDo[r]!]) {
        const iv = mreza.ivice[i]!;
        expect(iv.a === c || iv.b === c, `zabrana ${r}`).toBe(true);
      }
      expect(paket.zaglavlje.stringovi[n.rsVrsta[r]!]).toMatch(/^(no|only)_/);
    }
  });
});

describe("Podgorica: površina za slobodnu vožnju", () => {
  const povrsina = napraviPovrsinu(mreza);

  it("start (ulica najbliža Trgu nezavisnosti) je cijelim autom na asfaltu", () => {
    const start = najblizaIvica(mreza, { x: 0, y: 0 })!;
    const st = slobodnoNaIvici(povrsina, start.ivica, 1, start.s);
    expect(autoNaPovrsini(povrsina, st.x, st.y, st.ugao)).toBe(true);
  });

  it("auto staje u desnu traku skoro svake vozne ulice (na polovini, oba smjera)", () => {
    let ulica = 0;
    const ne: string[] = [];
    for (const iv of mreza.ivice) {
      if (!iv.vozna || iv.duzina < 20) continue;
      ulica += 1;
      for (const smjer of [1, -1] as const) {
        const st = slobodnoNaIvici(povrsina, iv.i, smjer, iv.duzina / 2);
        if (!autoNaPovrsini(povrsina, st.x, st.y, st.ugao)) ne.push(`${iv.ime || iv.klasa} (OSM ${paket.n.ivOsm[iv.i]})`);
      }
    }
    // Izmjereno 140 od 20 462 (0,7 %): skoro sve servisni prolazi od jedne
    // trake, gdje je polovina ulice baš u oštroj krivini.
    expect(ne.length / (2 * ulica)).toBeLessThan(0.01);
  });
});

describe("Podgorica: znakovi i semafori (stavka 5c)", () => {
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  const c = crtezPravila(povrsina, r, zabraneSkretanja(paket), odsjeci);

  it("stub znaka i semafora je na trotoaru, ne na kolovozu", () => {
    const stubovi = [...c.znakovi, ...c.semafori];
    const naAsfaltu = stubovi.filter((z) => naPovrsini(povrsina, z.x, z.y));
    // Izmjereno 19 od 1 850 (1 %): gdje se proširene ulice preklapaju sa obje
    // strane kraka, stuba bez asfalta nema.
    expect(naAsfaltu.length / stubovi.length).toBeLessThan(0.02);
  });
});
