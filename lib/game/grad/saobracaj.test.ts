import { describe, expect, it } from "vitest";
import { CAR_LENGTH, CAR_WIDTH, DT, GRAD_NPC_RAZMAK } from "../sim/config";
import type { Point } from "../sim/types";
import { svijetGrada } from "./svijet";
import { dodajVozilo, IGRAC, igracCekaSaobracaj, korakSaobracaja, noviSaobracaj, oduzetoPrvenstvo, type Npc, type Saobracaj, type Tijelo } from "./saobracaj";
import { testPaket, type TestIvica } from "./testMreza";

/**
 * Drugi učesnici (stavka 7) na krstu: centar (0, 0), krakovi 150 m; ivica i
 * ide od kraja kraka ka centru — 0 istok, 1 jug, 2 zapad, 3 sjever (y na jug).
 */
function krst(klase: string[] = ["residential", "residential", "residential", "residential"]) {
  const cvorovi: Point[] = [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 0, y: 150 },
    { x: -150, y: 0 },
    { x: 0, y: -150 },
  ];
  const ivice: TestIvica[] = [0, 1, 2, 3].map((i) => ({ a: i + 1, b: 0, klasa: klase[i] }));
  const { paket } = testPaket(cvorovi, ivice);
  return svijetGrada(paket, null);
}

/** Ruta sa kraka `od` na krak `do_` (ka centru, pa od centra). */
const ruta = (od: number, do_: number) => [
  { ivica: od, smjer: 1 as const },
  { ivica: do_, smjer: -1 as const },
];

/** Fokus u centru (vozila ne nestaju); gustina 0 — nova se ne pojavljuju. */
const DALEKO = { x: 0, y: 0 };

function vozi(sb: Saobracaj, sekundi: number, igrac: () => Tijelo | null = () => null, poKoraku?: () => void) {
  sb.popunjeno = true;
  sb.gustina = 0;
  for (let t = 0; t < sekundi; t += DT) {
    const ig = igrac();
    korakSaobracaja(sb, DALEKO, ig);
    poKoraku?.();
  }
}

const daljina = (a: Npc, b: Npc) => Math.hypot(a.x - b.x, a.y - b.y);

describe("saobraćaj: vozila ustupaju po pravilima", () => {
  it("pravilo desne strane: vozilo sa juga propušta vozilo sa istoka (desno od njega)", () => {
    const sb = noviSaobracaj(krst(), 1, 0);
    // Oba po 148 m od centra, istom brzinom: stižu zajedno.
    const jug = dodajVozilo(sb, ruta(1, 3), 8)!;
    const istok = dodajVozilo(sb, ruta(0, 2), 8)!;
    let najbliza = Infinity;
    let jugUstupio = false;
    let istokUstupio = false;
    let prvi: string | null = null;
    vozi(sb, 40, undefined, () => {
      if (sb.npc.includes(jug) && sb.npc.includes(istok)) najbliza = Math.min(najbliza, daljina(jug, istok));
      if (jug.razlog.vrsta === "ustupa" && jug.razlog.kome.includes(istok.id)) jugUstupio = true;
      if (istok.razlog.vrsta === "ustupa" && istok.razlog.kome.includes(jug.id)) istokUstupio = true;
      // Ko prvi pređe centar (y < 0 za jug, x < 0 za istok).
      prvi ??= istok.x < 0 ? "istok" : jug.y < 0 ? "jug" : null;
    });
    expect(jugUstupio).toBe(true);
    expect(istokUstupio).toBe(false);
    expect(prvi).toBe("istok");
    expect(najbliza).toBeGreaterThan(CAR_WIDTH + 1);
    // Oba su na kraju stigla (nestala na kraju rute), bez zastoja.
    expect(sb.metrika.stiglo).toBe(2);
    expect(sb.metrika.zastoja).toBe(0);
  });

  it("četiri vozila sa sva četiri kraka: krug prvenstva se razrješava (ko najduže čeka kreće)", () => {
    const sb = noviSaobracaj(krst(), 1, 0);
    for (const [od, do_] of [
      [0, 2],
      [1, 3],
      [2, 0],
      [3, 1],
    ] as const) {
      dodajVozilo(sb, ruta(od, do_), 8);
    }
    vozi(sb, 90);
    expect(sb.metrika.krugova).toBeGreaterThanOrEqual(1);
    expect(sb.metrika.zastoja).toBe(0);
    expect(sb.metrika.stiglo).toBe(4);
  });

  it("vozilo iza drži razmak do onoga koje stane", () => {
    const sb = noviSaobracaj(krst(), 1, 0);
    // Prvo stoji na kraju svoje rute (pred centrom), drugo dolazi iza njega.
    const prvo = dodajVozilo(sb, [{ ivica: 1, smjer: 1 }], 0)!;
    prvo.s = 100;
    const drugo = dodajVozilo(sb, [{ ivica: 1, smjer: 1 }], 12)!;
    let najmanje = Infinity;
    vozi(sb, 20, undefined, () => {
      if (sb.npc.includes(prvo) && sb.npc.includes(drugo)) najmanje = Math.min(najmanje, Math.abs(prvo.s - drugo.s) - CAR_LENGTH);
    });
    expect(najmanje).toBeGreaterThan(GRAD_NPC_RAZMAK * 0.6);
  });
});

describe("saobraćaj i igrač", () => {
  /** Igrač vozi pravo sa istoka na zapad, desnom trakom, stalnom brzinom. */
  function igracSaIstoka(sb: Saobracaj, x0: number, v: number) {
    let x = x0;
    return () => {
      x -= v * DT;
      return { id: IGRAC, x, y: -2.125, ugao: Math.PI, v, duzina: CAR_LENGTH, sirina: CAR_WIDTH, nivo: 0 } satisfies Tijelo;
    };
  }

  it("sa sporedne (ustupi) se čeka igrača na glavnoj; kad je igrač daleko, ide se", () => {
    // Istok i zapad su glavna ulica (primary), jug je sporedna: jug ustupa.
    const blizu = noviSaobracaj(krst(["primary", "residential", "primary", "residential"]), 1, 0);
    const npc = dodajVozilo(blizu, ruta(1, 3), 8)!;
    const igrac = igracSaIstoka(blizu, 120, 12);
    let ustupio = false;
    blizu.popunjeno = true;
    for (let t = 0; t < 20; t += DT) {
      const ig = igrac();
      korakSaobracaja(blizu, DALEKO, ig, { tijelo: ig, ivica: 0, smjer: 1, zmigavac: null });
      if (npc.razlog.vrsta === "ustupa" && npc.razlog.kome.includes(IGRAC)) ustupio = true;
    }
    expect(ustupio).toBe(true);

    const daleko = noviSaobracaj(krst(["primary", "residential", "primary", "residential"]), 1, 0);
    const npc2 = dodajVozilo(daleko, ruta(1, 3), 8)!;
    const igrac2 = igracSaIstoka(daleko, 1000, 12);
    let ustupio2 = false;
    daleko.popunjeno = true;
    for (let t = 0; t < 20; t += DT) {
      const ig = igrac2();
      korakSaobracaja(daleko, DALEKO, ig, { tijelo: ig, ivica: 0, smjer: 1, zmigavac: null });
      if (npc2.razlog.vrsta === "ustupa" && npc2.razlog.kome.includes(IGRAC)) ustupio2 = true;
    }
    expect(ustupio2).toBe(false);
  });

  it("oduzeto prvenstvo: igrač sa sporedne natjera vozilo na glavnoj da naglo koči", () => {
    // Igrač dolazi sa juga (sporedna), vozilo sa istoka (glavna) pravo.
    const sb = noviSaobracaj(krst(["primary", "residential", "primary", "residential"]), 1, 0);
    const npc = dodajVozilo(sb, ruta(0, 2), 12)!;
    npc.s = 110; // ~38 m od centra
    let y = 12;
    sb.popunjeno = true;
    for (let t = 0; t < 4; t += DT) {
      y -= 8 * DT;
      const ig: Tijelo = { id: IGRAC, x: 2.125, y, ugao: -Math.PI / 2, v: 8, duzina: CAR_LENGTH, sirina: CAR_WIDTH, nivo: 0 };
      korakSaobracaja(sb, DALEKO, ig);
    }
    expect(sb.kocenja.length).toBeGreaterThan(0);
    const r = sb.kocenja[0]!.r;
    // Igrač je išao pravo, sa juga (ivica 1) na sjever (ivica 3).
    const k = oduzetoPrvenstvo(sb, { r, ulaz: 1, izlaz: 3, manevar: "pravo", od: 0, do_: sb.t });
    expect(k?.id).toBe(npc.id);
    // Da je igrač bio na glavnoj (sa zapada), ustupalo bi vozilo — nije prekršaj.
    expect(oduzetoPrvenstvo(sb, { r, ulaz: 2, izlaz: 0, manevar: "pravo", od: 0, do_: sb.t })?.usao ?? false).toBe(sb.kocenja[0]!.usao);
  });

  it("igrač stoji u raskrsnici zbog pješaka koji je stigao poslije njegovog ulaska: nije oduzeto prvenstvo", () => {
    // Odluka korisnika 2026-10-17: ušao je ispravno, pa stao zbog pješaka koji
    // je naišao tek poslije — drugi je stao zbog pješaka. Pješak koji je već
    // bio uz prelaz kad je igrač ulazio — prekršaj ostaje.
    const sb = noviSaobracaj(krst(["primary", "residential", "primary", "residential"]), 1, 0);
    dodajVozilo(sb, ruta(0, 2), 12)!.s = 110;
    let y = 12;
    sb.popunjeno = true;
    for (let t = 0; t < 4; t += DT) {
      y -= 8 * DT;
      korakSaobracaja(sb, DALEKO, { id: IGRAC, x: 2.125, y, ugao: -Math.PI / 2, v: 8, duzina: CAR_LENGTH, sirina: CAR_WIDTH, nivo: 0 });
    }
    const k = sb.kocenja[0]!;
    const prolaz = { r: k.r, ulaz: 1, izlaz: 3, manevar: "pravo" as const, od: 0, do_: sb.t, ulazak: 1 };
    expect(k.pjesakOd).toBeNull();
    expect(oduzetoPrvenstvo(sb, prolaz)).not.toBeNull();
    for (const x of sb.kocenja) x.pjesakOd = 2;
    expect(oduzetoPrvenstvo(sb, prolaz)).toBeNull();
    for (const x of sb.kocenja) x.pjesakOd = 0.5;
    expect(oduzetoPrvenstvo(sb, prolaz)).not.toBeNull();
    for (const x of sb.kocenja) x.pjesakOd = -Infinity;
    expect(oduzetoPrvenstvo(sb, prolaz)).not.toBeNull();
  });
});

describe("igrač stoji zbog saobraćaja (nije parkiranje)", () => {
  const igrac = (x: number, y: number, ugao: number): Tijelo => ({ id: IGRAC, x, y, ugao, v: 0, duzina: CAR_LENGTH, sirina: CAR_WIDTH, nivo: 0 });

  it("vozilo tik ispred u traci: čeka; iza, ili daleko ispred: ne", () => {
    const sb = noviSaobracaj(krst(), 1, 0);
    // Vozilo sa juga ka sjeveru, stoji na 100 m od centra (y = 100).
    const n = dodajVozilo(sb, ruta(1, 3), 0)!;
    vozi(sb, 0.1);
    // Igrač iza njega, ka sjeveru (ugao −90°), 8 m iza: čeka.
    expect(igracCekaSaobracaj(sb, igrac(n.x, n.y + 8, -Math.PI / 2), null)).toBe(true);
    // Ispred njega: ne čeka zbog njega.
    expect(igracCekaSaobracaj(sb, igrac(n.x, n.y - 8, -Math.PI / 2), null)).toBe(false);
    // 40 m iza: ne.
    expect(igracCekaSaobracaj(sb, igrac(n.x, n.y + 40, -Math.PI / 2), null)).toBe(false);
  });

  it("u raskrsnici, a kroz nju prolazi drugo vozilo: čeka", () => {
    const sb = noviSaobracaj(krst(), 1, 0);
    const r = sb.svijet.raskrsnice.uCvoru[0]!;
    // Vozilo sa istoka ka zapadu, 20 m pred centrom, u pokretu.
    dodajVozilo(sb, ruta(0, 2), 10)!.s = 125;
    vozi(sb, 0.1);
    // Igrač stoji u centru (raskrsnica `r`), okrenut ka sjeveru, bez ikog ispred.
    expect(igracCekaSaobracaj(sb, igrac(-2, 3, -Math.PI / 2), r)).toBe(true);
    // Van raskrsnice (`null`) samo zbog kolone — ovdje nema.
    expect(igracCekaSaobracaj(sb, igrac(-2, 3, -Math.PI / 2), null)).toBe(false);
  });
});
