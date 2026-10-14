import { describe, expect, it } from "vitest";
import { DT, GRAD_PJ_SEMAFOR_ZAVRSI, GRAD_TROTOAR, GRAD_ZEBRA_DUBINA } from "../sim/config";
import type { Point } from "../sim/types";
import { korakPjesaka, noviPjesaci, ugrozava, type VoziloZaPjesaka } from "./pjesaci";
import { naKolovozu } from "./povrsina";
import { svjetlo } from "./raskrsnica";
import { svijetGrada } from "./svijet";
import { testPaket, type TestObjekat } from "./testMreza";
import { napraviMrezuPjesaka, rutaPjesaka, svjetloPjesaka } from "./trotoari";

/**
 * Krst: centar (0, 0), krakovi 150 m; ivica i ide od kraja kraka ka centru —
 * 0 istok, 1 jug, 2 zapad, 3 sjever (y na jug). Stambene ulice 8,5 m.
 */
function krst(objekti: TestObjekat[] = []) {
  const cvorovi: Point[] = [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 0, y: 150 },
    { x: -150, y: 0 },
    { x: 0, y: -150 },
  ];
  const { paket } = testPaket(
    cvorovi,
    [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0 })),
    objekti,
  );
  return svijetGrada(paket, null, []);
}

/** Zebra na istočnom kraku, 15 m od centra. */
const ZEBRA: TestObjekat = { vrsta: "crossing", podatak: "zebra", ivica: 0, s: 135 };

describe("pješačka mreža (stavka 8)", () => {
  it("trotoar sa obje strane svake ulice, uglovi ih spajaju, nijedna tačka nije na asfaltu", () => {
    const sv = krst();
    const mp = napraviMrezuPjesaka(sv);
    const strane = mp.staze.filter((s) => s.vrsta === "strana");
    const uglovi = mp.staze.filter((s) => s.vrsta === "ugao");
    expect(strane).toHaveLength(8);
    // Četiri ugla oko raskrsnice; slijepi krajevi krakova nemaju ugao.
    expect(uglovi).toHaveLength(4);
    for (const u of uglovi) {
      expect(strane.some((s) => s.c0 === u.c0 || s.c1 === u.c0)).toBe(true);
      expect(strane.some((s) => s.c0 === u.c1 || s.c1 === u.c1)).toBe(true);
    }
    for (const st of mp.staze) {
      for (let u = 0; u <= st.duzina; u += 0.5) {
        const k = st.cum.findIndex((c) => c >= u);
        const i = Math.max(1, k);
        const a = st.tacke[i - 1]!;
        const b = st.tacke[i]!;
        const f = (u - st.cum[i - 1]!) / Math.max(1e-9, st.cum[i]! - st.cum[i - 1]!);
        const x = a.x + (b.x - a.x) * Math.max(0, Math.min(1, f));
        const y = a.y + (b.y - a.y) * Math.max(0, Math.min(1, f));
        expect(naKolovozu(sv.povrsina, x, y), `${st.vrsta} ${x.toFixed(1)},${y.toFixed(1)}`).toBe(false);
      }
    }
    // Sredina trotoara: pola trotoara od ivičnjaka.
    const istok = strane.find((s) => s.ivica === 0 && s.strana === 1)!;
    const p = istok.tacke[Math.floor(istok.tacke.length / 2)]!;
    expect(Math.abs(p.y)).toBeCloseTo(8.5 / 2 + GRAD_TROTOAR / 2, 3);
  });

  it("zebra je prelaz od trotoara do trotoara; bez nje se ulica ne prelazi", () => {
    const sv = krst([ZEBRA]);
    const mp = napraviMrezuPjesaka(sv);
    expect(mp.prelazi).toHaveLength(1);
    const p = mp.prelazi[0]!;
    expect(p.semafor).toBeNull();
    expect(p.duzina).toBeCloseTo(8.5 + GRAD_TROTOAR, 1);
    expect(Math.abs(p.centar.x - 15)).toBeLessThan(0.01);
    // Ruta sa sjeverne na južnu stranu istočnog kraka ide preko zebre.
    const sjever = mp.staze.find((s) => s.vrsta === "strana" && s.ivica === 0 && s.strana === -1)!;
    const jug = mp.staze.find((s) => s.vrsta === "strana" && s.ivica === 0 && s.strana === 1)!;
    const ruta = rutaPjesaka(mp, sjever.c0, jug.c0)!;
    expect(ruta).not.toBeNull();
    expect(ruta.some((k) => mp.veze[k.veza]!.prelaz === 0)).toBe(true);
    // Bez zebre: nema puta preko ulice.
    const bez = napraviMrezuPjesaka(krst());
    const sj = bez.staze.find((s) => s.vrsta === "strana" && s.ivica === 0 && s.strana === -1)!;
    const ju = bez.staze.find((s) => s.vrsta === "strana" && s.ivica === 0 && s.strana === 1)!;
    expect(rutaPjesaka(bez, sj.c0, ju.c0)).toBeNull();
  });

  it("prelaz uz semaforisanu raskrsnicu: zeleno za pješake samo kad vozila sa tog kraka stoje", () => {
    const sv = krst([{ vrsta: "traffic_signals", cvor: 0 }, { ...ZEBRA, podatak: "traffic_signals" }]);
    const mp = napraviMrezuPjesaka(sv);
    const p = mp.prelazi[0]!;
    expect(p.semafor?.vrsta).toBe("raskrsnica");
    const r = sv.raskrsnice.lista[0]!;
    const krak = r.kraci.findIndex((k) => k.ivica === 0);
    let zelenih = 0;
    for (let t = 0; t < 2 * r.plan!.ciklus; t += 0.25) {
      const s = svjetloPjesaka(sv, p, t)!;
      if (s.stanje !== "zeleno") continue;
      zelenih++;
      expect(svjetlo(r, krak, t)).toBe("crveno");
      // Do zelenog za vozila tog kraka ostaje bar „završavanje" pješaka.
      expect(svjetlo(r, krak, t + s.preostalo + GRAD_PJ_SEMAFOR_ZAVRSI - 0.01)).not.toBe("zeleno");
    }
    expect(zelenih).toBeGreaterThan(0);
  });
});

describe("pješak i vozilo na prelazu (stavka 8)", () => {
  const p = napraviMrezuPjesaka(krst([ZEBRA])).prelazi[0]!;
  // Vozilo na istočnom kraku, vozi na zapad (ka centru), u svojoj traci.
  const auto = (x: number, v: number): VoziloZaPjesaka => ({ id: 1, x, y: -2, ugao: Math.PI, v, duzina: 4.5, sirina: 1.8 });

  it("ugrožava ga vozilo koje ne može udobno stati, ili je već na prelazu", () => {
    expect(ugrozava(auto(40, 14), p, 8)).toBe(true);
    expect(ugrozava(auto(16, 0), p, 8)).toBe(true);
  });

  it("ne ugrožava ga vozilo koje može stati, ono koje stoji pred prelazom, ni ono koje je prošlo", () => {
    expect(ugrozava(auto(90, 14), p, 8)).toBe(false);
    expect(ugrozava(auto(22, 0), p, 8)).toBe(false);
    expect(ugrozava(auto(5, 10), p, 8)).toBe(false);
  });

  it("ugrožava ga vozilo koje skreće ka prelazu, iako mu pravac (još) ne siječe zebru", () => {
    // Uz liniju prelaza (pravcem a → b), 4 m od nje, nos tik pored zebre, u
    // vožnji (krivina ka kraku).
    const ux = (p.b.x - p.a.x) / p.duzina;
    const uy = (p.b.y - p.a.y) / p.duzina;
    const x = p.a.x - uy * 4 - ux * 3;
    const y = p.a.y + ux * 4 - uy * 3;
    const skrece = (v: number): VoziloZaPjesaka => ({ id: 2, x, y, ugao: Math.atan2(uy, ux), v, duzina: 4.5, sirina: 1.8 });
    expect(ugrozava(skrece(5), p, 8)).toBe(true);
    // Stoji: ne ugrožava.
    expect(ugrozava(skrece(0), p, 8)).toBe(false);
  });

  it("ne ugrožava ga vozilo koje stoji tik pred zebrom (čeka njega)", () => {
    // Nos ~1 m (pa i 0,1 m) pred zebrom: vozač je stao zbog pješaka.
    const nos = (d: number) => auto(p.centar.x + GRAD_ZEBRA_DUBINA / 2 + 4.5 / 2 + d, 0);
    expect(ugrozava(nos(0.96), p, 8)).toBe(false);
    expect(ugrozava(nos(0.1), p, 8)).toBe(false);
    // Na samoj zebri: ugrožava.
    expect(ugrozava(nos(-0.5), p, 8)).toBe(true);
  });
});

describe("pješaci (stavka 8)", () => {
  function vozi(sekundi: number, sjeme = 1) {
    const sv = krst([ZEBRA]);
    const pj = noviPjesaci(sv, sjeme);
    let naAsfaltu = 0;
    let najvise = 0;
    for (let t = 0; t < sekundi; t += DT) {
      korakPjesaka(pj, { x: 0, y: 0 }, []);
      najvise = Math.max(najvise, pj.lista.length);
      for (const x of pj.lista) if (x.stanje !== "prelazi" && naKolovozu(sv.povrsina, x.x, x.y)) naAsfaltu++;
    }
    return { pj, naAsfaltu, najvise };
  }

  it("hodaju samo trotoarom i zebrom; prelaze; isto sjeme — isti pješaci", () => {
    const a = vozi(90);
    expect(a.najvise).toBeGreaterThan(5);
    expect(a.naAsfaltu).toBe(0);
    expect(a.pj.metrika.preslo).toBeGreaterThan(0);
    const b = vozi(90);
    expect(b.pj.lista.map((x) => [x.id, x.x, x.y])).toEqual(a.pj.lista.map((x) => [x.id, x.x, x.y]));
  });
});
