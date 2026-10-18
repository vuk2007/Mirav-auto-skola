import { describe, expect, it } from "vitest";
import { CAR_LENGTH, DT, GRAD_PJ_POLUPRECNIK, GRAD_SIRINA_TRAKE, GRAD_ZEBRA_DUBINA } from "../sim/config";
import type { Point } from "../sim/types";
import { odveziRutu, planBota } from "./botGrad";
import { korakPjesaka, noviPjesaci, udaraPjesaka, type Pjesak, type Pjesaci } from "./pjesaci";
import { svjetloZaVozila } from "./pjesackiSemafor";
import { dodajVozilo, korakSaobracaja, noviSaobracaj } from "./saobracaj";
import type { SlobodnoVozilo } from "./slobodno";
import { noviSudija, sudi } from "./sudija";
import { svijetGrada } from "./svijet";
import { testPaket, type TestObjekat } from "./testMreza";

/**
 * Pravila za pješake (stavka 8, odluke korisnika 2026-10-08): prednost na
 * zebri (pješak na prelazu koji nije prešao polovinu ulice, i namjera na
 * ivičnjaku), pješački semafor na sredini ulice, udar pješaka.
 *
 * Krst kao u ostalim testovima: centar (0, 0), krakovi 150 m; ivica i ide od
 * kraja kraka ka centru — 0 istok, 1 jug, 2 zapad, 3 sjever (y na jug). Zebra
 * je na istočnom kraku 15 m od centra; auto vozi na zapad desnom (sjevernom)
 * trakom, `y = −T`.
 */
const T = GRAD_SIRINA_TRAKE / 2;
const ZEBRA: TestObjekat = { vrsta: "crossing", podatak: "zebra", ivica: 0, s: 135 };

function krst(objekti: TestObjekat[] = [ZEBRA]) {
  const cvorovi: Point[] = [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 0, y: 150 },
    { x: -150, y: 0 },
    { x: 0, y: -150 },
  ];
  const { paket } = testPaket(cvorovi, [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0 })), objekti);
  return svijetGrada(paket, null, []);
}

/** Pješaci bez novih pojava (gustina 0): samo oni koje test postavi. */
function bezPojave(sv: ReturnType<typeof krst>): Pjesaci {
  const pj = noviPjesaci(sv, 1);
  pj.gustinaVanZona = 0;
  return pj;
}

/** Pješak na prelazu 0: `w` m od kraja `a` (jug), ide ka `b` (sjever, +1) ili nazad; ili čeka na ivičnjaku. */
function pjesak(pj: Pjesaci, w: number, smjer: 1 | -1, stanje: Pjesak["stanje"] = "prelazi"): Pjesak {
  const p = pj.mreza.prelazi[0]!;
  const veza = pj.mreza.veze.findIndex((v) => v.prelaz === 0);
  const ux = (p.b.x - p.a.x) / p.duzina;
  const uy = (p.b.y - p.a.y) / p.duzina;
  const x: Pjesak = {
    id: pj.sljedeciId++,
    x: p.a.x + ux * w,
    y: p.a.y + uy * w,
    ugao: Math.atan2(uy * smjer, ux * smjer),
    v: 0,
    brzina: 1.3,
    boja: 0,
    put: [{ veza, od: smjer === 1 ? p.cvorA : p.cvorB }],
    k: 0,
    d: smjer === 1 ? w : p.duzina - w,
    stanje,
    cekaOd: stanje === "ceka" ? pj.t : null,
    prelaz: 0,
    predjeno: 0,
    bocno: 0,
    rodjen: pj.t,
    vanZebre: null,
  };
  pj.lista.push(x);
  return x;
}

/**
 * Auto prolazi istočni krak na zapad stalnom brzinom, od `x0` do x = −20, pod
 * sudijom; `prije` se zove svakog koraka (npr. da doda pješaka). Vraća prekršaje.
 */
function prodji(sv: ReturnType<typeof krst>, pj: Pjesaci, v: number, x0 = 90, prije?: (st: SlobodnoVozilo) => void) {
  const sud = noviSudija(5);
  const st: SlobodnoVozilo = { x: x0, y: -T, ugao: Math.PI, v, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 20 };
  for (let t = 0; st.x > -20; t += DT) {
    prije?.(st);
    st.x -= v * DT;
    st.predjeno += v * DT;
    sudi(sv.zaSudiju, sud, st, t, null, false, pj);
  }
  return sud.prekrsaji;
}

describe("prednost pješaka na zebri (stavka 8)", () => {
  const sv = krst();

  it("pješak na prelazu koji još nije prešao polovinu ulice auta: prekršaj", () => {
    // Prelaz ide od juga (a) ka sjeveru (b); auto je u sjevernoj polovini.
    for (const [w, smjer] of [
      [2, 1], // u južnoj polovini, ide ka sjevernoj
      [8, -1], // u sjevernoj polovini
      [9.5, 1], // u sjevernoj polovini, pred ivičnjakom
    ] as const) {
      const pj = bezPojave(sv);
      pjesak(pj, w, smjer);
      const p = prodji(sv, pj, 8);
      expect(p.map((x) => x.vrsta), `w ${w} smjer ${smjer}`).toEqual(["pedestrianRightOfWay"]);
      expect(p[0]!.detalji.gdje).toBe("naPrelazu");
    }
  });

  it("pješak koji je prešao polovinu ulice auta i udaljava se: nije prekršaj", () => {
    const pj = bezPojave(sv);
    pjesak(pj, 3, -1);
    expect(prodji(sv, pj, 8)).toEqual([]);
  });

  it("namjera na ivičnjaku: prekršaj ako je auto tada moglo mirno stati; ako nije — ne", () => {
    const daleko = bezPojave(sv);
    pjesak(daleko, 0, 1, "ceka");
    const p = prodji(sv, daleko, 10);
    expect(p.map((x) => x.vrsta)).toEqual(["pedestrianRightOfWay"]);
    expect(p[0]!.detalji.gdje).toBe("naIvicnjaku");
    // Pješak stane na ivičnjak kad je auto već 12 m od zebre, na 14 m/s
    // (zaustavni put 39 m): auto ne može mirno stati — prolazi.
    const blizu = bezPojave(sv);
    let dodat = false;
    expect(
      prodji(sv, blizu, 14, 90, (st) => {
        if (!dodat && st.x - CAR_LENGTH / 2 < 15 + GRAD_ZEBRA_DUBINA / 2 + 12) {
          pjesak(blizu, 0, 1, "ceka");
          dodat = true;
        }
      }),
    ).toEqual([]);
  });
});

describe("drugi vozač i pješak (stavka 8)", () => {
  const ISTOK_ZAPAD = [
    { ivica: 0, smjer: 1 as const },
    { ivica: 2, smjer: -1 as const },
  ];

  it("staje pred zebrom dok pješak prelazi, ne dodirne ga, pa nastavlja", () => {
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    const pj = bezPojave(sv);
    sb.pjesaci = pj;
    sb.popunjeno = true;
    const n = dodajVozilo(sb, ISTOK_ZAPAD, 12)!;
    // Pješak stupa na zebru kad je auto 40 m od nje (može mirno stati).
    let x: Pjesak | null = null;
    let stao = false;
    let dodir = false;
    for (let t = 0; t < 50; t += DT) {
      if (!x && n.x < 15 + 40) x = pjesak(pj, 1, 1);
      korakSaobracaja(sb, { x: 0, y: 0 }, null);
      korakPjesaka(pj, { x: 0, y: 0 }, sb.npc.map((v) => ({ id: v.id, x: v.x, y: v.y, ugao: v.ugao, v: v.v, duzina: CAR_LENGTH, sirina: 1.8 })));
      if (sb.npc.includes(n)) {
        if (n.v < 0.1 && n.x > 15) stao = true;
        if (x && pj.lista.includes(x) && udaraPjesaka({ x: n.x, y: n.y, ugao: n.ugao, duzina: CAR_LENGTH, sirina: 1.8 }, x)) dodir = true;
      }
    }
    expect(stao).toBe(true);
    expect(dodir).toBe(false);
    // Pješak je prešao, auto je stiglo do kraja rute.
    expect(pj.metrika.preslo).toBe(1);
    expect(sb.npc.includes(n)).toBe(false);
  });

  it("pješak na zebri na izlazu raskrsnice bez semafora: vozilo čeka na liniji, ne u raskrsnici", () => {
    // Vozilo dolazi sa zapada i ide na istok; zebra je na istočnom kraku,
    // 15 m od centra (izlaz). Odluka korisnika 2026-10-17 (stavka 9c).
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    const pj = bezPojave(sv);
    sb.pjesaci = pj;
    sb.popunjeno = true;
    const n = dodajVozilo(sb, [{ ivica: 2, smjer: 1 }, { ivica: 0, smjer: -1 }], 10)!;
    const x = pjesak(pj, 0, 1, "ceka");
    let najdalje = -Infinity;
    for (let t = 0; t < 30 && x.stanje === "ceka"; t += DT) {
      korakSaobracaja(sb, { x: 0, y: 0 }, null);
      // Pješak čeka (kao da ga drži nešto drugo): vozilo ga ne smije čekati u raskrsnici.
      x.cekaOd = pj.t;
      najdalje = Math.max(najdalje, n.x);
    }
    expect(n.v).toBeLessThan(0.1);
    expect(n.razlog.vrsta).toBe("pjesak");
    // Stoji pred raskrsnicom (zapadni krak), ne u njoj.
    expect(najdalje + CAR_LENGTH / 2).toBeLessThan(-GRAD_SIRINA_TRAKE);
  });

  it("kolona: iza vozila koje stoji tik iza zebre ne staje na zebru, nego pred njom", () => {
    // Igrač stoji 6 m iza zebre (x = 9, zebra je na x = 15): vozilo iza
    // njega bi stalo tijelom na zebri — ZOBS: na prelazu se ne staje (9c).
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    sb.pjesaci = bezPojave(sv);
    sb.popunjeno = true;
    const n = dodajVozilo(sb, ISTOK_ZAPAD, 12)!;
    const igrac = { id: 0, x: 9, y: -T, ugao: Math.PI, v: 0, duzina: CAR_LENGTH, sirina: 1.8, nivo: 0 };
    for (let t = 0; t < 20; t += DT) korakSaobracaja(sb, { x: 0, y: 0 }, igrac);
    expect(n.v).toBeLessThan(0.1);
    expect(n.x - CAR_LENGTH / 2).toBeGreaterThan(15 + GRAD_ZEBRA_DUBINA / 2);
  });

  it("pješaku na ivičnjaku ustupa kad može stati; pješak tada prelazi", () => {
    const sv = krst();
    const sb = noviSaobracaj(sv, 1, 0);
    const pj = bezPojave(sv);
    sb.pjesaci = pj;
    sb.popunjeno = true;
    const n = dodajVozilo(sb, ISTOK_ZAPAD, 10)!;
    pjesak(pj, 0, 1, "ceka");
    let zbogPjesaka = false;
    for (let t = 0; t < 40; t += DT) {
      korakSaobracaja(sb, { x: 0, y: 0 }, null);
      korakPjesaka(pj, { x: 0, y: 0 }, sb.npc.map((v) => ({ id: v.id, x: v.x, y: v.y, ugao: v.ugao, v: v.v, duzina: CAR_LENGTH, sirina: 1.8 })));
      if (sb.npc.includes(n) && n.razlog.vrsta === "pjesak") zbogPjesaka = true;
    }
    expect(zbogPjesaka).toBe(true);
    expect(pj.metrika.preslo).toBe(1);
    expect(sb.npc.includes(n)).toBe(false);
  });
});

describe("pješački semafor na sredini ulice (stavka 8)", () => {
  // Duga ulica bez raskrsnica: semafor i zebra na sredini.
  function ulica() {
    const { paket } = testPaket(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      [{ a: 0, b: 1 }],
      [
        { vrsta: "crossing", podatak: "zebra", ivica: 0, s: 152 },
        { vrsta: "traffic_signals", ivica: 0, s: 150 },
      ],
    );
    return svijetGrada(paket, null, []);
  }

  it("semafor bez raskrsnice uz zebru je pješački; prelaz ide po njemu", () => {
    const sv = ulica();
    expect(sv.zaSudiju.pjesackiSemafori).toHaveLength(1);
    const pj = noviPjesaci(sv, 1);
    expect(pj.mreza.prelazi[0]!.semafor?.vrsta).toBe("sredina");
  });

  it("bot staje na crveno i ne krši; auto kroz crveno — redLightPedestrian", () => {
    const sv = ulica();
    const sem = sv.zaSudiju.pjesackiSemafori[0]!;
    const plan = planBota(sv.zaSudiju, [{ ivica: 0, smjer: 1 }]);
    expect(plan.pjesacki).toHaveLength(1);
    // Početak tako da je na semaforu crveno kad bot stigne (oko 15 s vožnje).
    let t0 = 0;
    while (svjetloZaVozila(sem, t0 + 15) !== "crveno" || svjetloZaVozila(sem, t0 + 10) !== "crveno") t0 += 1;
    const x = odveziRutu(sv.zaSudiju, sv.povrsina, plan, t0, 5, 300);
    expect(x.prekrsaji).toEqual([]);
    expect(x.stigao).toBe(true);
    // Auto stalnom brzinom kroz crveno.
    const sud = noviSudija(5);
    const st: SlobodnoVozilo = { x: 60, y: T, ugao: 0, v: 12, tocak: 0, rikverc: false, kocnicaStoji: 0, udar: false, predjeno: 20 };
    for (let t = t0 + 4; st.x < 250; t += DT) {
      st.x += st.v * DT;
      sudi(sv.zaSudiju, sud, st, t);
    }
    expect(sud.prekrsaji.map((p) => p.vrsta)).toEqual(["redLightPedestrian"]);
  });
});

describe("udar pješaka", () => {
  it("dodir tijela auta i pješaka (pravougaonik i krug)", () => {
    const auto = { x: 0, y: 0, ugao: 0, duzina: CAR_LENGTH, sirina: 1.8 };
    const r = GRAD_PJ_POLUPRECNIK;
    expect(udaraPjesaka(auto, { x: CAR_LENGTH / 2 + r - 0.05, y: 0 })).toBe(true);
    expect(udaraPjesaka(auto, { x: CAR_LENGTH / 2 + r + 0.05, y: 0 })).toBe(false);
    expect(udaraPjesaka(auto, { x: 0, y: 0.9 + r - 0.05 })).toBe(true);
    // Ugao: dijagonala od tjemena.
    expect(udaraPjesaka(auto, { x: CAR_LENGTH / 2 + r * 0.8, y: 0.9 + r * 0.8 })).toBe(false);
  });
});

describe("pješak van zebre i vozilo na putu (stavka 9)", () => {
  it("vozilo mu stane na put nasred kolovoza: poslije `GRAD_PJ_BLOKIRAN` vraća se na ivičnjak", () => {
    const sv = krst();
    const pj = bezPojave(sv);
    // Prelazi istočni krak van zebre (x = 60), od juga ka sjeveru; auto stoji
    // u sjevernoj traci tik ispred njega (npr. sklonio se pred hitnim).
    const x = pjesak(pj, 0, 1);
    x.vanZebre = { k: x.k, d: x.d, a: { x: 60, y: 8 }, b: { x: 60, y: -8 }, u: 5 };
    x.x = 60;
    x.y = 3;
    x.ugao = -Math.PI / 2;
    const auto = { id: 1, x: 60, y: -T, ugao: Math.PI, v: 0, duzina: CAR_LENGTH, sirina: 1.8, cekaPjesaka: true };
    // Priđe autu i stane: ne ulazi u vozilo.
    for (let t = 0; t < 3; t += DT) korakPjesaka(pj, { x: 60, y: 0 }, [auto]);
    const stao = x.y;
    for (let t = 0; t < 1; t += DT) korakPjesaka(pj, { x: 60, y: 0 }, [auto]);
    expect(x.y).toBeCloseTo(stao, 5);
    expect(udaraPjesaka(auto, x)).toBe(false);
    // Poslije `GRAD_PJ_BLOKIRAN` okrenuo se: ide nazad, ka jugu.
    for (let t = 0; t < 4; t += DT) korakPjesaka(pj, { x: 60, y: 0 }, [auto]);
    expect(x.vanZebre?.b).toEqual({ x: 60, y: 8 });
    expect(x.y).toBeGreaterThan(stao + 1);
    expect(udaraPjesaka(auto, x)).toBe(false);
  });
});
