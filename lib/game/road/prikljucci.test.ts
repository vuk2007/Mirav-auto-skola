import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NO_OVERTAKE_BEFORE_JUNCTION,
  PRIKLJUCAK_OD_KRAJA,
  PRIKLJUCAK_PUNA_LINIJA,
  PRIKLJUCAK_RAZMAK,
} from "../sim/config";
import type { Prikljucak, RoadTemplate } from "../sim/types";
import { nadjiRutu, napraviRutu, type Ruta } from "../world/ruta";
import { rutaTemplate } from "../world/svijet";
import { parseGeometry, type EdgeGeometry } from "./edgeGeometry";
import { parseKicma, type Kicma } from "./kicma";
import { prikljucciIvice, prorijedi, punaPred } from "./prikljucci";
import { EDGES, NODES } from "./roadGraph";
import { sabijenaIvica } from "./sabijanje";
import { osovina } from "./edgeGeometry";
import { zabranjeno } from "./zabrane";

/**
 * Raskrsnice sa sporednim putem: od OSM podatka do mjesta na putu koji se vozi.
 *
 * Mjeri se na stvarnim podacima, jer je upravo to ono što je bilo sporno: da
 * raskrsnica u podacima nije uvijek raskrsnica, i da se na sabijenom putu
 * zbijaju.
 */

const GEOM: ReadonlyMap<string, EdgeGeometry> = new Map(
  EDGES.map((e) => [
    e.id,
    parseGeometry(JSON.parse(readFileSync(`public/data/osm/edgeGeometry/${e.id}.json`, "utf8")))!,
  ]),
);
const KICME: ReadonlyMap<string, Kicma> = new Map(
  NODES.filter((n) => n.kind === "opstina").map((n) => [
    n.id,
    parseKicma(JSON.parse(readFileSync(`public/data/osm/kicme/${n.id}.json`, "utf8")))!,
  ]),
);

const ruta = (od: string, doK: string): Ruta => napraviRutu(nadjiRutu(od, doK)!, GEOM, KICME);
const RUTE = [ruta("budva", "kolasin"), ruta("herceg-novi", "rozaje"), ruta("ulcinj", "pljevlja")];

describe("raskrsnice u podacima", () => {
  it("svaka ivica ih nosi, i ukupno ih je po jedna na kilometar ili gušće", () => {
    // Bez seoskih puteva ih je bilo 253 na 1385 km — jedna na pet i po
    // kilometara, dakle samo raskrsnice sa regionalnim putem.
    let ukupno = 0;
    let km = 0;
    for (const g of GEOM.values()) {
      expect(Array.isArray(g.prikljucci), g.id).toBe(true);
      ukupno += g.prikljucci!.length;
      km += g.duzinaM / 1000;
    }
    expect(km / ukupno).toBeLessThan(1);
  });

  it("stoje unutar ivice, poređane, i sa poznatom stranom", () => {
    for (const g of GEOM.values()) {
      let prethodna = -1;
      for (const p of g.prikljucci ?? []) {
        expect(p.s, g.id).toBeGreaterThanOrEqual(prethodna);
        expect(p.s, g.id).toBeLessThanOrEqual(g.duzinaM);
        expect(["lijevo", "desno"]).toContain(p.strana);
        prethodna = p.s;
      }
    }
  });

  it("provjera oblika odbija pogrešne raskrsnice", () => {
    const g = GEOM.get("podgorica--danilovgrad")!;
    expect(parseGeometry({ ...g, prikljucci: [{ s: 10, strana: "gore", rang: "tertiary" }] })).toBeNull();
    expect(parseGeometry({ ...g, prikljucci: [{ s: "10", strana: "desno", rang: "tertiary" }] })).toBeNull();
    expect(parseGeometry({ ...g, prikljucci: "nema" })).toBeNull();
    // Fajl napravljen prije ovog polja i dalje prolazi.
    const { prikljucci: _bez, ...stari } = g;
    void _bez;
    expect(parseGeometry(stari)).not.toBeNull();
  });
});

describe("preslikavanje na put koji se vozi", () => {
  it("u povratku je raskrsnica na drugoj strani i na drugom kraju", () => {
    const g = GEOM.get("podgorica--danilovgrad")!;
    const tamo = prikljucciIvice(g, sabijenaIvica(g.id, osovina(g), false), false);
    const nazad = prikljucciIvice(g, sabijenaIvica(g.id, osovina(g), true), true);
    expect(tamo.length).toBeGreaterThan(5);
    expect(nazad.length).toBe(tamo.length);
    const duzina = sabijenaIvica(g.id, osovina(g), false).duzina;
    // Sparuje se po mjestu i strani, ne po redoslijedu: krst ima dvije
    // raskrsnice na istom mjestu, pa im se redoslijed u povratku ne okreće.
    const preostale = [...nazad];
    for (const p of tamo) {
      const i = preostale.findIndex(
        (q) => q.strana !== p.strana && Math.abs(q.s - (duzina - p.s)) < 5,
      );
      expect(i, `${p.strana} @ ${p.s.toFixed(0)}`).toBeGreaterThanOrEqual(0);
      preostale.splice(i, 1);
    }
    expect(preostale).toEqual([]);
  });

  it("proređivanje spaja bliske na istoj strani, a krst ostavlja", () => {
    const niz: Prikljucak[] = [
      { s: 100, strana: "desno", rang: "residential" },
      { s: 150, strana: "desno", rang: "tertiary" },
      { s: 152, strana: "lijevo", rang: "unclassified" },
      { s: 100 + PRIKLJUCAK_RAZMAK + 1, strana: "desno", rang: "residential" },
    ];
    const out = prorijedi(niz);
    // Prva dva desna su jedno, i ostaje krupniji put; lijevi na istom mjestu je
    // druga strana krsta i ostaje; četvrti je dovoljno daleko od prvog.
    expect(out.map((p) => [p.s, p.strana, p.rang])).toEqual([
      [100, "desno", "tertiary"],
      [152, "lijevo", "unclassified"],
      [100 + PRIKLJUCAK_RAZMAK + 1, "desno", "residential"],
    ]);
  });
});

describe("raskrsnice na ruti", () => {
  it("ima ih na svakoj ruti, na obje strane", () => {
    for (const r of RUTE) {
      expect(r.prikljucci.length, r.id).toBeGreaterThan(40);
      expect(r.prikljucci.some((p) => p.strana === "lijevo"), r.id).toBe(true);
      expect(r.prikljucci.some((p) => p.strana === "desno"), r.id).toBe(true);
    }
  });

  it("stoje između mjesta: ni jedna uz ulaz u mjesto, ni jedna u gradu", () => {
    for (const r of RUTE) {
      for (const p of r.prikljucci) {
        const d = r.dionicaNa(p.s);
        expect(d.vrsta, `${r.id} @ ${p.s}`).toBe("ivica");
        expect(p.s - d.odS, `${r.id} @ ${p.s}`).toBeGreaterThanOrEqual(PRIKLJUCAK_OD_KRAJA - 1e-6);
        expect(d.doS - p.s, `${r.id} @ ${p.s}`).toBeGreaterThanOrEqual(PRIKLJUCAK_OD_KRAJA - 1e-6);
      }
    }
  });

  it("na istoj strani nisu bliže od propisanog razmaka", () => {
    for (const r of RUTE) {
      for (const strana of ["lijevo", "desno"] as const) {
        const niz = r.prikljucci.filter((p) => p.strana === strana);
        for (let i = 1; i < niz.length; i++) {
          expect(niz[i]!.s - niz[i - 1]!.s, `${r.id} ${strana}`).toBeGreaterThanOrEqual(PRIKLJUCAK_RAZMAK - 1e-6);
        }
      }
    }
  });

  it("pred većim putem je linija puna, pred seoskim nije", () => {
    // Odluka od 29. septembra: puna linija samo pred regionalnim i većim putem.
    let seoskihBezLinije = 0;
    for (const r of RUTE) {
      const tpl = rutaTemplate(r) as RoadTemplate;
      for (const p of r.prikljucci) {
        const pred = p.s - NO_OVERTAKE_BEFORE_JUNCTION / 2;
        if (PRIKLJUCAK_PUNA_LINIJA.includes(p.rang)) {
          expect(punaPred(p)).toBe(true);
          expect(zabranjeno(tpl.zabrane, pred), `${r.id} @ ${p.s} ${p.rang}`).toBe(true);
        } else if (!zabranjeno(tpl.zabrane, pred)) {
          seoskihBezLinije += 1;
        }
      }
    }
    expect(seoskihBezLinije).toBeGreaterThan(50);
  });
});
