import { describe, expect, it } from "vitest";
import { CAR_LENGTH, DT, GRAD_BUS_DUZINA, GRAD_SIRINA_TRAKE } from "../sim/config";
import { AUTOBUS } from "./autobusi";
import type { AutobusUPolasku } from "./polazak";
import { autobusiUPolasku, dodajVozilo, korakSaobracaja, noviSaobracaj } from "./saobracaj";
import type { SlobodnoVozilo } from "./slobodno";
import { noviSudija, sudi } from "./sudija";
import { svijetGrada } from "./svijet";
import { testPaket } from "./testMreza";

/**
 * Polazak autobusa sa stajališta (stavka 8c, odluka korisnika 2026-10-13):
 * vozilo iza autobusa koji daje žmigavac, u njegovoj ili susjednoj traci, ga
 * ne smije prestići ako je moglo mirno stati kad se žmigavac upalio.
 *
 * Ulica od istoka ka zapadu (x opada), y = 0 osovina; zapad je lijevo od
 * istoka, sjever je −y — desna traka vožnje na zapad je na `y = −T`.
 */
const T = GRAD_SIRINA_TRAKE / 2;

function ulica(jednosmjerna = false) {
  const { paket } = testPaket(
    [
      { x: 400, y: 0 },
      { x: -400, y: 0 },
    ],
    [{ a: 0, b: 1, klasa: "primary", trake: 2, smjer: jednosmjerna ? 1 : 0 }],
  );
  return svijetGrada(paket, null, []);
}

/** Autobus koji polazi: sredina na `x`, u desnoj traci, glava na zapad. */
const bus = (x: number): AutobusUPolasku => ({ id: 7, x, y: -T, ugao: Math.PI, duzina: GRAD_BUS_DUZINA, sirina: AUTOBUS.sirina, nivo: 0 });

/** Auto od `x0` na zapad u lijevoj traci (pretiče), stalnom brzinom `v`, dok autobus polazi. */
function pretice(x0: number, v: number, koci = false) {
  const sv = ulica();
  const sud = noviSudija(5);
  const st: SlobodnoVozilo = { x: x0, y: T, ugao: Math.PI, v, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 20 };
  for (let t = 0; t < 12; t += DT) {
    if (koci) st.v = Math.max(0, st.v - 2.5 * DT);
    st.x -= st.v * DT;
    sudi(sv.zaSudiju, sud, st, t, null, false, null, [bus(0)]);
  }
  return sud.prekrsaji.filter((p) => p.vrsta === "busDeparture");
}

describe("polazak autobusa sa stajališta — sudija", () => {
  it("auto koje je moglo stati, a prestigne autobus dok polazi: prekršaj (upozorenje), jednom", () => {
    const p = pretice(60, 10);
    expect(p).toHaveLength(1);
    expect(p[0]!.ozbiljnost).toBe("minor");
  });

  it("auto preblizu kad se upalio žmigavac (ne može mirno stati): nije prekršaj", () => {
    // Nos 3 m od zadnjeg kraja autobusa, 10 m/s: udobno zaustavljanje traži 20 m.
    expect(pretice(GRAD_BUS_DUZINA / 2 + CAR_LENGTH / 2 + 3, 10)).toHaveLength(0);
  });

  it("auto koje stane iza autobusa: nije prekršaj", () => {
    expect(pretice(40, 8, true)).toHaveLength(0);
  });

  it("auto koje je već bilo pored autobusa: nije prekršaj", () => {
    expect(pretice(-2, 10)).toHaveLength(0);
  });
});

describe("polazak autobusa sa stajališta — drugi vozači", () => {
  it("vozilo iza, u susjednoj traci, ne prestiže autobus koji polazi; poslije polaska nastavlja", () => {
    const sv = ulica(true);
    const sb = noviSaobracaj(sv, 1);
    sb.gustinaVanZona = 0;
    const b = dodajVozilo(sb, [{ ivica: 0, smjer: 1 }], 0, AUTOBUS)!;
    b.autobus = { ref: "T", stajalista: [40], sljedece: 0, stojiOd: null, staje: 0, polazi: null };
    let auto: ReturnType<typeof dodajVozilo> = null;
    let vidioAutobus = false;
    let prestigao = false;
    for (let k = 0; k < 60 / DT; k++) {
      korakSaobracaja(sb, { x: 0, y: 0 }, null);
      // Kad se upali žmigavac: auto 25 m iza, u drugoj traci (putanja pomjerena bočno).
      if (!auto && b.autobus.polazi) {
        auto = dodajVozilo(sb, [{ ivica: 0, smjer: 1 }], 0)!;
        const pomak = b.y < 0 ? 2 * T : -2 * T;
        auto.plan.put.tacke = auto.plan.put.tacke.map((p) => ({ x: p.x, y: p.y + pomak }));
      }
      if (!auto) continue;
      if (auto.razlog.vrsta === "autobus") vidioAutobus = true;
      const polazi = autobusiUPolasku(sb).length > 0;
      // Nos auta ispred zadnjeg kraja autobusa (vožnja na zapad: x opada).
      if (polazi && auto.x - CAR_LENGTH / 2 < b.x + GRAD_BUS_DUZINA / 2 - 0.1) prestigao = true;
    }
    expect(auto).not.toBeNull();
    expect(vidioAutobus).toBe(true);
    expect(prestigao).toBe(false);
    // Poslije polaska: auto vozi dalje.
    expect(auto!.s).toBeGreaterThan(60);
  });
});
