import { describe, expect, it } from "vitest";
import {
  CAR_LENGTH,
  DT,
  GRAD_SEMAFOR_ZUTO,
  GRAD_SIRINA_TRAKE,
  GRAD_TOLERANCIJA_BRZINE,
  type Level,
} from "../sim/config";
import type { Point } from "../sim/types";
import { krajeviLinija } from "./oznake";
import { napraviPovrsinu } from "./povrsina";
import { napraviRaskrsnice, svjetlo, zabraneSkretanja, type Raskrsnica } from "./raskrsnica";
import { korakSlobodno, type SlobodnoVozilo } from "./slobodno";
import { gradZaSudiju, noviSudija, sudi, type GradZaSudiju } from "./sudija";
import { testPaket, type TestIvica, type TestObjekat } from "./testMreza";
import { naPutanji, putanja, vozi } from "./vozacGrad";

/**
 * Sudija u gradu — stavka 5d. Krst sa krakovima od 150 m: čvor 0 je centar,
 * 1 istok, 2 jug, 3 zapad, 4 sjever; ivica i ide od čvora i + 1 ka centru.
 * Desna traka dvosmjerne ulice je pola trake od osovine (`T`).
 */
const T = GRAD_SIRINA_TRAKE / 2;
const CVOROVI: Point[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 0, y: 150 },
  { x: -150, y: 0 },
  { x: 0, y: -150 },
];
const JUG = 1;
const ZAPAD = 2;

function grad(izmjene: Partial<TestIvica>[] = [], objekti: TestObjekat[] = [], zabrane: [string, number, number, number][] = []) {
  const ivice = [1, 2, 3, 4].map((a, i) => ({ a, b: 0, ...izmjene[i] }));
  const { paket, mreza } = testPaket(CVOROVI, ivice, objekti, zabrane);
  const povrsina = napraviPovrsinu(mreza);
  const odsjeci = krajeviLinija(mreza);
  const r = napraviRaskrsnice(paket, mreza, odsjeci);
  return { G: gradZaSudiju(paket, povrsina, r, zabraneSkretanja(paket), odsjeci), r: r.lista[0]! };
}

/** Putanje kroz krst, po sredini desne trake. Sa juga: pravo, lijevo, desno, polukružno. */
const luk = (cx: number, cy: number, r: number, od: number, do_: number, n = 12): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = od + ((do_ - od) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
const SA_JUGA_PRAVO: Point[] = [
  { x: T, y: 140 },
  { x: T, y: -140 },
];
const SA_JUGA_LIJEVO: Point[] = [{ x: T, y: 140 }, { x: T, y: 8 }, ...luk(-8, 8, 8 + T, 0, -Math.PI / 2), { x: -140, y: -T }];
const SA_JUGA_DESNO: Point[] = [{ x: T, y: 140 }, { x: T, y: 10 }, ...luk(10, 10, 10 - T, Math.PI, 1.5 * Math.PI), { x: 140, y: T }];
// Polukružno traži široku ulicu: sa četiri trake (po dvije u smjeru) auto
// se okreće iz spoljne desne trake u spoljnu suprotnu, lukom od 6,4 m.
const SIROKE: Partial<TestIvica>[] = [{ trake: 4 }, { trake: 4 }, { trake: 4 }, { trake: 4 }];
const S = 1.5 * GRAD_SIRINA_TRAKE;
const SA_JUGA_POLUKRUZNO: Point[] = [{ x: S, y: 140 }, { x: S, y: 2 }, ...luk(0, 2, S, 0, -Math.PI, 16), { x: -S, y: 140 }];

interface Voznja {
  put: Point[];
  brzina: number;
  /** Vrijeme simulacije na početku [s]. */
  t0?: number;
  /** Početna brzina [m/s]. */
  v0?: number;
  nivo?: Level;
  /**
   * Žmigavac: strana — upaljen do 10 m iza centra raskrsnice (putanje sa
   * juga ga prolaze na `s` ≈ 140), pa ugašen, kao što vozač uradi; ili
   * funkcija položaja na putanji.
   */
  zmigavac?: "left" | "right" | ((s: number) => "left" | "right" | null);
  /** Gdje da stane (sredina auta, `s` na putanji) u trenutku `t`; `null` — ne staje. */
  stani?: (t: number, s: number) => number | null;
  trajanje?: number;
}

function vozi_(G: GradZaSudiju, v: Voznja) {
  const p = putanja(v.put);
  const a = p.tacke[0]!;
  const b = p.tacke[1]!;
  const st: SlobodnoVozilo = {
    x: a.x,
    y: a.y,
    ugao: Math.atan2(b.y - a.y, b.x - a.x),
    v: v.v0 ?? 0,
    tocak: 0,
    rikverc: false,
    kocnicaStoji: 0,
    udar: false,
    predjeno: 0,
  };
  const s = noviSudija(v.nivo ?? 3);
  let t = v.t0 ?? 0;
  let sP = 0;
  let udara = 0;
  const kraj = t + (v.trajanje ?? 120);
  while (t < kraj && sP < p.duzina - 6) {
    sP = naPutanji(p, st.x, st.y, sP);
    korakSlobodno(G.povrsina, st, vozi(st, p, sP, { brzina: v.brzina, staniNa: v.stani?.(t, sP) ?? null }));
    if (st.udar) udara += 1;
    t += DT;
    const z = typeof v.zmigavac === "function" ? v.zmigavac(sP) : sP < 150 ? (v.zmigavac ?? null) : null;
    sudi(G, s, st, t, z);
  }
  return { vrste: s.prekrsaji.map((x) => x.vrsta), prekrsaji: s.prekrsaji, udara, t };
}

/** Krak raskrsnice sa ivice `ivica` (ulaz u centar preko `b`). */
const krakSa = (r: Raskrsnica, ivica: number) => r.kraci.findIndex((k) => k.ivica === ivica && k.kraj === 1);

/** Prvo vrijeme u ciklusu kad krak prelazi iz `iz` u `u`. */
function prelaz(r: Raskrsnica, k: number, iz: string, u: string): number {
  for (let t = 0; t < 2 * r.plan!.ciklus; t += DT) {
    if (svjetlo(r, k, t) === iz && svjetlo(r, k, t + DT) === u) return t + DT;
  }
  throw new Error("nema prelaza");
}

describe("sudija: semafor", () => {
  const { G, r } = grad([], [{ vrsta: "traffic_signals", cvor: 0 }]);
  const k = krakSa(r, JUG);
  const stopD = r.kraci[k]!.stopD!;
  /** `s` na putanji sa juga (sredina auta) na kojem nos dodiruje stop-liniju. */
  const naLiniji = 140 - stopD - CAR_LENGTH / 2 - 0.5;

  it("prolazak na crveno je prekršaj", () => {
    // Krak dobija crveno; auto stiže poslije par sekundi i ne staje.
    const t0 = prelaz(r, k, "zuto", "crveno");
    const x = vozi_(G, { put: SA_JUGA_PRAVO, brzina: 11, v0: 11, t0 });
    expect(x.vrste).toEqual(["redLight"]);
    expect(x.prekrsaji[0]!.detalji.svjetlo).toBe("crveno");
  });

  it("čeka zeleno na liniji, pa prođe — bez prekršaja (ni stajanje ni crveno)", () => {
    const t0 = prelaz(r, k, "zuto", "crveno");
    const x = vozi_(G, {
      put: SA_JUGA_PRAVO,
      brzina: 11,
      t0,
      stani: (t) => (svjetlo(r, k, t) === "zeleno" ? null : naLiniji),
    });
    expect(x.vrste).toEqual([]);
    expect(x.udara).toBe(0);
  });

  it("žuto: preblizu da stane — prolazi bez prekršaja; daleko — mogao je stati", () => {
    const tz = prelaz(r, k, "zeleno", "zuto");
    // Nos 8 m od linije kad se upali žuto, na 11 m/s: 0,7 s — prekasno za stati.
    const blizu = 140 - (stopD + CAR_LENGTH / 2 + 8 + 11 * 1);
    const x = vozi_(G, { put: [{ x: T, y: 140 - blizu }, { x: T, y: -140 }], brzina: 11, v0: 11, t0: tz - 1 });
    expect(x.vrste).toEqual([]);
    // Nos 22 m od linije: 2 s — mogao je stati, a ušao je na žuto.
    const daleko = 140 - (stopD + CAR_LENGTH / 2 + 22 + 11 * 1);
    const y = vozi_(G, { put: [{ x: T, y: 140 - daleko }, { x: T, y: -140 }], brzina: 11, v0: 11, t0: tz - 1 });
    expect(y.vrste).toEqual(["redLight"]);
    expect(y.prekrsaji[0]!.detalji.svjetlo).toBe("zuto");
    expect(22 / 11).toBeLessThan(GRAD_SEMAFOR_ZUTO);
  });

  it("polukružno u raskrsnici sa semaforom je prekršaj", () => {
    const s = grad(SIROKE, [{ vrsta: "traffic_signals", cvor: 0 }]);
    const ks = krakSa(s.r, JUG);
    const linija = 140 - s.r.kraci[ks]!.stopD! - CAR_LENGTH / 2 - 0.5;
    // Auto na 4 m/s stiže do linije 2 s poslije početka zelenog.
    const t0 = prelaz(s.r, ks, "crveno", "zeleno") - linija / 4 + 2;
    const x = vozi_(s.G, { put: SA_JUGA_POLUKRUZNO, brzina: 4, v0: 4, t0, zmigavac: "left" });
    expect(x.udara).toBe(0);
    expect(x.vrste).toEqual(["polukruzno"]);
  });
});

describe("sudija: STOP", () => {
  const { G, r } = grad([], [{ vrsta: "stop", podatak: "forward", ivica: JUG, s: 140 }]);
  const stopD = r.kraci[krakSa(r, JUG)]!.stopD!;
  const naLiniji = 140 - stopD - CAR_LENGTH / 2 - 0.5;

  it("proći STOP bez zaustavljanja je prekršaj", () => {
    expect(vozi_(G, { put: SA_JUGA_PRAVO, brzina: 6 }).vrste).toEqual(["stopSign"]);
  });

  it("stati pred linijom (bar STOP_HOLD), pa nastaviti — ispravno", () => {
    let stao: number | null = null;
    const x = vozi_(G, {
      put: SA_JUGA_PRAVO,
      brzina: 6,
      stani: (t, s) => {
        if (stao === null && s >= naLiniji - 0.3) stao = t;
        return stao === null || t - stao < 1.5 ? naLiniji : null;
      },
    });
    expect(x.vrste).toEqual([]);
  });

  it("polukružno bez semafora, van mosta i tunela — nije prekršaj", () => {
    const bez = grad(SIROKE);
    const x = vozi_(bez.G, { put: SA_JUGA_POLUKRUZNO, brzina: 4, zmigavac: "left" });
    expect(x.udara).toBe(0);
    expect(x.vrste).toEqual([]);
  });
});

describe("sudija: polukružno na sredini ulice", () => {
  // Na južnom kraku, 80 m od centra, luk kroz obje strane široke ulice.
  const put: Point[] = [{ x: S, y: 140 }, { x: S, y: 80 }, ...luk(0, 80, S, 0, -Math.PI, 16), { x: -S, y: 140 }];

  it("na mostu je zabranjeno", () => {
    const most = grad(SIROKE.map((x, i) => (i === JUG ? { ...x, most: true } : x)));
    const x = vozi_(most.G, { put, brzina: 4 });
    expect(x.vrste).toEqual(["polukruzno"]);
    expect(x.prekrsaji[0]!.detalji.gdje).toBe("most");
  });

  it("na običnoj dvosmjernoj ulici je dozvoljeno", () => {
    expect(vozi_(grad(SIROKE).G, { put, brzina: 4 }).vrste).toEqual([]);
  });
});

describe("sudija: smjer, zabrane, strana", () => {
  it("jednosmjerna: vožnja suprotno od dozvoljenog je prekršaj, jednom", () => {
    // Istočni krak (ivica 0) jednosmjeran ka centru: na istok se ne smije.
    const { G } = grad([{ smjer: 1 }]);
    const x = vozi_(G, { put: [{ x: -140, y: T }, { x: 140, y: T }], brzina: 10 });
    expect(x.vrste).toEqual(["wrongWay"]);
  });

  it("zabrana skretanja lijevo: lijevo je prekršaj, desno i pravo nisu", () => {
    const { G } = grad([], [], [["no_left_turn", JUG, 0, ZAPAD]]);
    expect(vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 5, zmigavac: "left" }).vrste).toEqual(["zabranaSkretanja"]);
    expect(vozi_(G, { put: SA_JUGA_DESNO, brzina: 4, zmigavac: "right" }).vrste).toEqual([]);
    expect(vozi_(G, { put: SA_JUGA_PRAVO, brzina: 8 }).vrste).toEqual([]);
  });

  it("samo pravo: skretanje desno je prekršaj", () => {
    const { G } = grad([], [], [["only_straight_on", JUG, 0, 3]]); // 3: sjeverni krak
    const x = vozi_(G, { put: SA_JUGA_DESNO, brzina: 4, zmigavac: "right" });
    expect(x.vrste).toEqual(["zabranaSkretanja"]);
    expect(x.prekrsaji[0]!.detalji.znak).toBe("only_straight_on");
  });

  it("lijevom stranom duže od 3 s je prekršaj; kraće nije", () => {
    const { G } = grad();
    const dugo = vozi_(G, { put: [{ x: -T, y: 140 }, { x: -T, y: 20 }], brzina: 8 });
    expect(dugo.vrste).toEqual(["wrongSide"]);
    // Kratko lijevo (oko 1,5 s na 8 m/s), pa nazad desno.
    const kratko = vozi_(G, {
      put: [
        { x: T, y: 140 },
        { x: T, y: 120 },
        { x: -T, y: 112 },
        { x: -T, y: 104 },
        { x: T, y: 96 },
        { x: T, y: 20 },
      ],
      brzina: 8,
    });
    expect(kratko.vrste).toEqual([]);
  });
});

describe("sudija: brzina", () => {
  const { G } = grad();
  const put = [
    { x: -140, y: T },
    { x: 140, y: T },
  ];
  it.each([1, 3, 5] as Level[])("nivo %i: preko ograničenja + tolerancija je prekršaj, ispod nije", (nivo) => {
    const granica = (50 + GRAD_TOLERANCIJA_BRZINE[nivo]) / 3.6;
    expect(vozi_(G, { put, brzina: granica + 1.2, v0: granica + 1.2, nivo }).vrste).toEqual(["speeding"]);
    expect(vozi_(G, { put, brzina: granica - 0.8, v0: granica - 0.8, nivo }).vrste).toEqual([]);
  });
});

describe("sudija: zaustavljanje", () => {
  // Zebra na južnom kraku, 60 m od centra.
  const { G } = grad([], [{ vrsta: "crossing", podatak: "zebra", ivica: JUG, s: 90 }]);
  const naZebri = 140 - 60;

  it("stajanje 2 s i više na zebri je prekršaj; kraće nije", () => {
    const stoji = (sekundi: number) => {
      let stao: number | null = null;
      return vozi_(G, {
        put: SA_JUGA_PRAVO,
        brzina: 6,
        stani: (t, s) => {
          if (stao === null && s >= naZebri - 0.3) stao = t;
          return stao === null || t - stao < sekundi ? naZebri : null;
        },
      });
    };
    const dugo = stoji(3);
    expect(dugo.vrste).toEqual(["parkingViolation"]);
    expect(dugo.prekrsaji[0]!.detalji.gdje).toBe("zebra");
    expect(stoji(1).vrste).toEqual([]);
  });

  it("stajanje u raskrsnici je prekršaj", () => {
    let stao: number | null = null;
    const x = vozi_(G, {
      put: SA_JUGA_PRAVO,
      brzina: 6,
      stani: (t, s) => {
        if (stao === null && s >= 140 - 0.3) stao = t;
        return stao === null || t - stao < 3 ? 140 : null;
      },
    });
    expect(x.vrste).toEqual(["parkingViolation"]);
    expect(x.prekrsaji[0]!.detalji.gdje).toBe("raskrsnica");
  });
});

describe("sudija: determinizam", () => {
  it("ista vožnja — isti prekršaji, u isto vrijeme", () => {
    const { G, r } = grad([], [{ vrsta: "traffic_signals", cvor: 0 }]);
    const t0 = prelaz(r, krakSa(r, JUG), "zuto", "crveno");
    const a = vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 7, v0: 7, t0, zmigavac: "left" });
    const b = vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 7, v0: 7, t0, zmigavac: "left" });
    expect(a.prekrsaji).toEqual(b.prekrsaji);
    expect(a.prekrsaji.length).toBeGreaterThan(0);
  });
});

describe("sudija: žmigavac (kao u fazi 5)", () => {
  const { G } = grad();
  /** `s` na putanji sa juga u centru raskrsnice — tu je auto već ušao. */
  const centar = 140;

  it("skretanje sa upaljenim žmigavcem na pravu stranu — ispravno", () => {
    expect(vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 5, zmigavac: "left" }).vrste).toEqual([]);
    expect(vozi_(G, { put: SA_JUGA_DESNO, brzina: 4, zmigavac: "right" }).vrste).toEqual([]);
  });

  it("bez žmigavca — indicatorMissing; pogrešna strana — indicatorWrong", () => {
    expect(vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 5 }).vrste).toEqual(["indicatorMissing"]);
    expect(vozi_(G, { put: SA_JUGA_DESNO, brzina: 4, zmigavac: "left" }).vrste).toEqual(["indicatorWrong"]);
  });

  it("upaljen tek u raskrsnici — indicatorLate", () => {
    const x = vozi_(G, { put: SA_JUGA_LIJEVO, brzina: 5, zmigavac: (s) => (s > centar && s < 150 ? "left" : null) });
    expect(x.vrste).toEqual(["indicatorLate"]);
  });

  it("pravo sa upaljenim žmigavcem — blag prekršaj", () => {
    const x = vozi_(G, { put: SA_JUGA_PRAVO, brzina: 8, zmigavac: "right" });
    expect(x.vrste).toEqual(["indicatorWrong"]);
    expect(x.prekrsaji[0]!.ozbiljnost).toBe("minor");
  });

  it("ostavljen upaljen poslije skretanja — indicatorLeftOn (blag)", () => {
    const x = vozi_(G, { put: SA_JUGA_DESNO, brzina: 4, zmigavac: "right" });
    expect(x.vrste).toEqual([]);
    // Isti manevar, ali žmigavac ostaje upaljen i poslije raskrsnice.
    const dalje = vozi_(G, { put: SA_JUGA_DESNO, brzina: 5, zmigavac: () => "right" });
    expect(dalje.vrste).toEqual(["indicatorLeftOn"]);
    expect(dalje.prekrsaji[0]!.ozbiljnost).toBe("minor");
  });
});

describe("sudija: traka za skretanje (strelice)", () => {
  // Južni krak jednosmjeran ka centru, dvije trake: lijeva „samo lijevo", desna „pravo i desno".
  const { G } = grad([{}, { smjer: 1, trake: 2 }], []);
  const iv = G.mreza.ivice[JUG]!;
  iv.skretanjaNaprijed = "left|through;right";
  iv.trakeNaprijed = 2;
  iv.trakeNazad = 0;
  const L = -GRAD_SIRINA_TRAKE / 2;
  const D = GRAD_SIRINA_TRAKE / 2;

  it("pravo iz lijeve trake (samo lijevo) — prekršaj; iz desne — ispravno", () => {
    expect(vozi_(G, { put: [{ x: L, y: 140 }, { x: L, y: 20 }, { x: T, y: -20 }, { x: T, y: -140 }], brzina: 7 }).vrste).toEqual([
      "wrongLaneForTurn",
    ]);
    expect(vozi_(G, { put: [{ x: D, y: 140 }, { x: T, y: -140 }], brzina: 7 }).vrste).toEqual([]);
  });

  it("lijevo iz lijeve trake — ispravno", () => {
    // Luk od 6 m iz lijeve trake u desnu traku zapadnog kraka (y = −T).
    const put = [{ x: L, y: 140 }, { x: L, y: 10 }, ...luk(L - 6, -T + 6, 6, 0, -Math.PI / 2), { x: -140, y: -T }];
    expect(vozi_(G, { put, brzina: 5, zmigavac: "left" }).vrste).toEqual([]);
  });
});
