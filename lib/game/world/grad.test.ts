import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DIO_TIJELA,
  GRAD_OD_KRAJA,
  PARKING_MIN_POLUPRECNIK,
  PARKING_ODMAK,
  PARKING_RAZMAK,
  STANICA_BEZ_PARKINGA_POSLIJE,
  STANICA_BEZ_PARKINGA_PRIJE,
  STANICA_RAZMAK,
  VOZILA,
} from "@/lib/game/sim/config";
import { compile } from "@/lib/game/sim/intersection";
import { lanePathId } from "@/lib/game/sim/highway";
import { parkiranoTijelo } from "@/lib/game/sim/world";
import type { RoadTemplate } from "@/lib/game/sim/types";
import { parseGeometry, type EdgeGeometry } from "@/lib/game/road/edgeGeometry";
import { parseKicma, type Kicma } from "@/lib/game/road/kicma";
import { EDGES, NODES } from "@/lib/game/road/roadGraph";
import { headingAt, pointAt, polygonsOverlap, rectCorners, right } from "@/lib/game/sim/geometry";
import { parkiranaNaRuti, staniceNaRuti } from "./grad";
import { nadjiRutu, napraviRutu, type Ruta } from "./ruta";
import { rutaTemplate } from "./svijet";

/**
 * Grad na ruti: gdje stoje autobuske stanice i parkirani auti.
 *
 * Mjeri se na stvarnim rutama sa gradskim dionicama, jer su tu i krivine i
 * krajevi dionica onakvi kakvi će se voziti.
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

/** Gradski dijelovi rute bez krajeva uz raskrsnice. */
const gradski = (r: Ruta) =>
  r.dionice.filter((d) => d.vrsta === "grad").map((d) => ({ od: d.odS + GRAD_OD_KRAJA, do: d.doS - GRAD_OD_KRAJA }));

const uGradu = (r: Ruta, od: number, doK: number) => gradski(r).some((g) => od >= g.od - 1e-6 && doK <= g.do + 1e-6);

describe("autobuske stanice", () => {
  it("stoje samo u gradu, dalje od ulaza i izlaza, i ima ih na svakoj ruti", () => {
    for (const r of RUTE) {
      const stanice = staniceNaRuti(r);
      expect(stanice.length, r.id).toBeGreaterThan(0);
      for (const st of stanice) expect(uGradu(r, st.s, st.s), `${r.id} @ ${st.s}`).toBe(true);
    }
  });

  it("u istom smjeru su razmaknute bar koliko je propisano, i nisu u oštroj krivini", () => {
    for (const r of RUTE) {
      const stanice = staniceNaRuti(r);
      for (const traka of [0, 1]) {
        const iste = stanice.filter((st) => st.traka === traka);
        for (let i = 1; i < iste.length; i++) {
          expect(iste[i]!.s - iste[i - 1]!.s, r.id).toBeGreaterThanOrEqual(STANICA_RAZMAK - 1e-6);
        }
      }
      for (const st of stanice) {
        const ostra = r.krivine.some((k) => k.radius < PARKING_MIN_POLUPRECNIK && Math.abs(st.s - k.atS) < k.arc / 2);
        expect(ostra, `${r.id} @ ${st.s}`).toBe(false);
      }
    }
  });
});

describe("parkirani auti", () => {
  it("stoje samo u gradu i ima ih", () => {
    for (const r of RUTE) {
      const parkirana = parkiranaNaRuti(r, staniceNaRuti(r));
      expect(parkirana.length, r.id).toBeGreaterThan(20);
      for (const p of parkirana) {
        const pola = VOZILA[p.vrsta].duzina / 2;
        expect(uGradu(r, p.s - pola, p.s + pola), `${r.id} @ ${p.s}`).toBe(true);
      }
    }
  });

  it("uz isti ivičnjak ne stoje jedan u drugom", () => {
    for (const r of RUTE) {
      const parkirana = parkiranaNaRuti(r, staniceNaRuti(r));
      for (const strana of ["lijevo", "desno"] as const) {
        const niz = parkirana.filter((p) => p.strana === strana);
        for (let i = 1; i < niz.length; i++) {
          const a = niz[i - 1]!;
          const b = niz[i]!;
          const praznina = b.s - VOZILA[b.vrsta].duzina / 2 - (a.s + VOZILA[a.vrsta].duzina / 2);
          expect(praznina, `${r.id} ${strana} @ ${a.s}`).toBeGreaterThanOrEqual(PARKING_RAZMAK[0] - 1e-6);
        }
      }
    }
  });

  it("ne stoje u prilazu stanici, sa one strane na kojoj autobus staje", () => {
    for (const r of RUTE) {
      const stanice = staniceNaRuti(r);
      for (const p of parkiranaNaRuti(r, stanice)) {
        const pola = VOZILA[p.vrsta].duzina / 2;
        for (const st of stanice) {
          if ((st.traka === 0) !== (p.strana === "desno")) continue;
          const [prije, poslije] =
            st.traka === 0
              ? [st.s - STANICA_BEZ_PARKINGA_PRIJE, st.s + STANICA_BEZ_PARKINGA_POSLIJE]
              : [st.s - STANICA_BEZ_PARKINGA_POSLIJE, st.s + STANICA_BEZ_PARKINGA_PRIJE];
          const preklapa = p.s + pola > prije && p.s - pola < poslije;
          expect(preklapa, `${r.id} ${p.strana} @ ${p.s} uz stanicu ${st.s}`).toBe(false);
        }
      }
    }
  });

  it("stoje van kolovoza: unutrašnja ivica je iza ivične linije, i u krivini", () => {
    for (const r of RUTE) {
      const tpl = rutaTemplate(r) as RoadTemplate;
      const nasa = compile(tpl).paths.get(lanePathId(tpl.id, 0))!;
      for (const p of tpl.parkirana ?? []) {
        const tijelo = parkiranoTijelo(nasa, p);
        const d = right(tijelo.heading);
        // Koliko je unutrašnja ivica tijela odmaknuta od ose naše trake, u stranu
        // na kojoj auto stoji — i koliko je ivica kolovoza sa te strane.
        const osa = nasa.points.reduce((naj, t) =>
          Math.hypot(t.x - tijelo.pos.x, t.y - tijelo.pos.y) < Math.hypot(naj.x - tijelo.pos.x, naj.y - tijelo.pos.y) ? t : naj,
        );
        const bocno = ((tijelo.pos.x - osa.x) * d.x + (tijelo.pos.y - osa.y) * d.y) * (p.strana === "desno" ? 1 : -1);
        const unutra = bocno - tijelo.width / 2;
        expect(unutra, `${r.id} ${p.strana} @ ${p.s}`).toBeGreaterThan(PARKING_ODMAK - 0.3);
      }
    }
  });

  it("ne diraju vozilo širine autobusa koje vozi osom svoje trake", () => {
    // Najšire vozilo u saobraćaju je autobus. Ako parkirani auto dira njega dok
    // ovaj vozi tačno osom trake, sudar bi bio bez ičije greške — a savršeni vozač
    // je upravo tako udario u parkirani auto u Mojkovcu.
    for (const r of RUTE) {
      const tpl = rutaTemplate(r) as RoadTemplate;
      const paths = compile(tpl).paths;
      const nasa = paths.get(lanePathId(tpl.id, 0))!;
      const susretna = paths.get(lanePathId(tpl.id, 1))!;
      for (const p of tpl.parkirana ?? []) {
        const tijelo = parkiranoTijelo(nasa, p);
        const parkirano = rectCorners(tijelo.pos, tijelo.heading, tijelo.length, tijelo.width);
        const put = p.strana === "desno" ? nasa : susretna;
        const sPut = p.strana === "desno" ? p.s : susretna.length - p.s;
        for (let d = -6; d <= 6; d += 1) {
          const x = sPut + d;
          const komad = rectCorners(
            pointAt(put.points, put.cum, x),
            headingAt(put.points, put.cum, x),
            DIO_TIJELA,
            VOZILA.autobus.sirina,
          );
          expect(polygonsOverlap(parkirano, komad), `${r.id} ${p.strana} @ ${p.s.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  it("isti su pri svakoj izgradnji iste rute", () => {
    const a = ruta("budva", "kolasin");
    const b = ruta("budva", "kolasin");
    expect(parkiranaNaRuti(a, staniceNaRuti(a))).toEqual(parkiranaNaRuti(b, staniceNaRuti(b)));
    expect(staniceNaRuti(a)).toEqual(staniceNaRuti(b));
  });
});
