import { describe, expect, it } from "vitest";
import {
  DT,
  GRAD_BOCNO_UBRZANJE,
  GRAD_RIKVERC_CEKANJE,
  GRAD_RIKVERC_V,
  GRAD_SIRINA_TRAKE,
} from "../sim/config";
import type { Input } from "../sim/types";
import { naPovrsini, napraviPovrsinu, ulicaNa } from "./povrsina";
import { autoNaPovrsini, korakSlobodno, slobodnoNaIvici, type SlobodnoVozilo } from "./slobodno";
import { KRST } from "./testMreza";

/**
 * Slobodna vožnja kroz grad — stavka 3c: volan okreće auto, rikverc, ivičnjak.
 * Krst iz `testMreza.ts`: centar u (0, 0), ivica 0 dolazi sa juga, 1 ide na
 * sjever, 2 na istok, 3 na zapad; ulice sa dvije trake.
 */
const P = napraviPovrsinu(KRST);
const POLA = GRAD_SIRINA_TRAKE; // dvije trake: pola kolovoza je jedna traka

const ulaz = (throttle: number, brake: number, steer = 0): Input => ({ throttle, brake, indicator: null, steer });
const koraci = (sekundi: number) => Math.round(sekundi / DT);
const stepeni = (st: SlobodnoVozilo) => (st.ugao * 180) / Math.PI;

/** Sa juga ka raskrsnici, u desnoj traci, 60 m prije centra. */
const naJugu = () => slobodnoNaIvici(P, 0, 1, 40);

/** Drži brzinu blizu `cilj` [m/s] — gas ili kočnica, bez volana. */
const tempomat = (st: SlobodnoVozilo, cilj: number, steer = 0): Input =>
  st.v < cilj - 0.2 ? ulaz(0.6, 0, steer) : st.v > cilj + 0.2 ? ulaz(0, 0.3, steer) : ulaz(0.1, 0, steer);

describe("grad: površina po kojoj se vozi", () => {
  it("kolovoz je asfalt, trotoar nije", () => {
    expect(naPovrsini(P, 0, 50)).toBe(true);
    expect(naPovrsini(P, POLA - 0.05, 50)).toBe(true);
    expect(naPovrsini(P, POLA + 0.05, 50)).toBe(false);
  });

  it("ugao raskrsnice je zasječen — tik uz tjeme ugla trotoara je asfalt", () => {
    // Tjeme ugla između južnog i istočnog kraka je (POLA, POLA); van obje
    // ulice, ali u zasjeku.
    const d = POLA + 0.3;
    expect(naPovrsini(P, d, d)).toBe(true);
    // Iza kosog ivičnjaka više nije: zasjek je 3 m duž obje ulice.
    expect(naPovrsini(P, POLA + 2, POLA + 2)).toBe(false);
    expect(naPovrsini(P, POLA + 3, 20)).toBe(false);
    // Sva četiri ugla krsta, i nijedan drugi.
    expect(P.uglovi).toHaveLength(4);
  });

  it("ulica na tački je ivica čija je osovina najbliža", () => {
    expect(ulicaNa(P, 2, 60)).toBe(0);
    expect(ulicaNa(P, 60, 2)).toBe(2);
    expect(ulicaNa(P, -60, -2)).toBe(3);
    expect(ulicaNa(P, 60, 60)).toBe(null);
  });
});

describe("grad: slobodna vožnja", () => {
  it("bez volana auto ide pravo i ostaje u svojoj traci", () => {
    const st = naJugu();
    const x0 = st.x;
    for (let i = 0; i < koraci(4); i++) korakSlobodno(P, st, ulaz(0.5, 0));
    expect(st.v).toBeGreaterThan(3);
    expect(st.x).toBeCloseTo(x0, 6);
    expect(stepeni(st)).toBeCloseTo(-90, 6);
    expect(st.udar).toBe(false);
  });

  it("skreće se tamo gdje igrač skrene: desno u raskrsnici, na istok", () => {
    const st = naJugu();
    let udara = 0;
    // Do raskrsnice na petnaestak na sat, pa pun volan desno dok auto ne
    // gleda na istok, pa pravo. Izmjereno: skretanje uspijeva ako volan krene
    // bilo gdje od 5 m do 1 m ispred centra — prostor za ljudsku grešku.
    for (let i = 0; i < koraci(30); i++) {
      const skrece = st.y < 3 && stepeni(st) < -3;
      korakSlobodno(P, st, tempomat(st, 4, skrece ? 1 : 0));
      if (st.udar) udara += 1;
    }
    expect(udara).toBe(0);
    expect(ulicaNa(P, st.x, st.y)).toBe(2);
    expect(st.x).toBeGreaterThan(40);
    expect(Math.abs(stepeni(st))).toBeLessThan(10);
  });

  it("i lijevo, preko cijele raskrsnice, na zapad", () => {
    const st = naJugu();
    let udara = 0;
    for (let i = 0; i < koraci(30); i++) {
      const skrece = st.y < 3 && stepeni(st) > -177 && stepeni(st) < 0;
      korakSlobodno(P, st, tempomat(st, 4, skrece ? -1 : 0));
      if (st.udar) udara += 1;
    }
    expect(udara).toBe(0);
    expect(ulicaNa(P, st.x, st.y)).toBe(3);
    expect(st.x).toBeLessThan(-40);
  });

  it("na brzini volan ne može više nego što guma drži: v²/R ≤ bočno ubrzanje", () => {
    const st = naJugu();
    while (st.v < 60 / 3.6) korakSlobodno(P, st, ulaz(1, 0));
    const prije = st.ugao;
    korakSlobodno(P, st, ulaz(0.3, 0, 1));
    for (let i = 0; i < 5; i++) korakSlobodno(P, st, ulaz(0.3, 0, 1));
    const zaokret = Math.abs(st.ugao - prije) / (6 * DT);
    // ω = v / R, a v²/R = v·ω. Brzina se u šest koraka malo promijeni, pa
    // prosjek ugla i krajnja brzina nisu iz istog trenutka — otud 1 %.
    expect(st.v * zaokret).toBeLessThanOrEqual(GRAD_BOCNO_UBRZANJE * 1.01);
    expect(st.v * zaokret).toBeGreaterThan(GRAD_BOCNO_UBRZANJE * 0.9);
  });

  it("ivičnjak okrznut koso: auto klizi uz njega, sporije, i poravna se", () => {
    const st = naJugu();
    while (st.v < 8) korakSlobodno(P, st, ulaz(0.6, 0));
    let dodira = 0;
    let najsporije = st.v;
    for (let i = 0; i < koraci(3); i++) {
      // Kratko volan desno, pa pušten: auto ide koso ka desnom ivičnjaku.
      korakSlobodno(P, st, ulaz(0.2, 0, i < koraci(0.3) ? 1 : 0));
      if (st.udar) dodira += 1;
      najsporije = Math.min(najsporije, st.v);
      expect(autoNaPovrsini(P, st.x, st.y, st.ugao)).toBe(true);
    }
    expect(dodira).toBeGreaterThan(0);
    expect(najsporije).toBeLessThan(8);
    expect(st.v).toBeGreaterThan(0);
    // Poravnat sa ulicom: opet gleda na sjever.
    expect(stepeni(st)).toBeCloseTo(-90, 0);
  });

  it("čeoni udar zaustavlja auto; gasom se dalje ne ide — izlazi se rikvercom", () => {
    // Na sjevernom kraku, do kraja slijepe ulice.
    const st = slobodnoNaIvici(P, 1, 1, 80);
    while (!st.udar) korakSlobodno(P, st, tempomat(st, 5));
    expect(st.v).toBe(0);
    expect(autoNaPovrsini(P, st.x, st.y, st.ugao)).toBe(true);
    const zaglavljen = { x: st.x, y: st.y };
    // Gas: auto se primakne ivičnjaku najviše za ono što je prešao u zadnjem
    // koraku prije udara (v·DT), i tu ostane.
    for (let i = 0; i < koraci(1); i++) korakSlobodno(P, st, ulaz(1, 0));
    expect(Math.hypot(st.x - zaglavljen.x, st.y - zaglavljen.y)).toBeLessThan(5 * DT + 0.01);
    for (let i = 0; i < koraci(2); i++) korakSlobodno(P, st, ulaz(0, 1));
    expect(st.rikverc).toBe(true);
    expect(st.y - zaglavljen.y).toBeGreaterThan(1);
  });
});

describe("grad: rikverc", () => {
  it("kočnica držana u mjestu ubacuje rikverc tek poslije čekanja", () => {
    const st = naJugu();
    const y0 = st.y;
    const prije = koraci(GRAD_RIKVERC_CEKANJE) - 2;
    for (let i = 0; i < prije; i++) korakSlobodno(P, st, ulaz(0, 1));
    expect(st.rikverc).toBe(false);
    expect(st.v).toBe(0);
    for (let i = 0; i < koraci(4); i++) korakSlobodno(P, st, ulaz(0, 1));
    expect(st.rikverc).toBe(true);
    expect(st.v).toBeCloseTo(-GRAD_RIKVERC_V, 1);
    expect(st.v).toBeGreaterThanOrEqual(-GRAD_RIKVERC_V);
    // Unazad: auto gleda na sjever, a ide na jug (`y` raste).
    expect(st.y).toBeGreaterThan(y0 + 5);
    expect(stepeni(st)).toBeCloseTo(-90, 6);
  });

  it("kočenje do zaustavljanja ne pokreće auto unazad", () => {
    const st = naJugu();
    for (let i = 0; i < koraci(3); i++) korakSlobodno(P, st, ulaz(0.6, 0));
    let stao = 0;
    for (let i = 0; i < koraci(4); i++) {
      korakSlobodno(P, st, ulaz(0, 1));
      if (st.v === 0) stao += 1;
      if (stao * DT >= GRAD_RIKVERC_CEKANJE - 2 * DT) break;
    }
    for (let i = 0; i < koraci(1); i++) korakSlobodno(P, st, ulaz(0, 0));
    expect(st.rikverc).toBe(false);
    expect(st.v).toBe(0);
  });

  it("u rikvercu gas prvo zaustavi auto, pa ga u mjestu vrati naprijed", () => {
    const st = naJugu();
    for (let i = 0; i < koraci(3); i++) korakSlobodno(P, st, ulaz(0, 1));
    expect(st.v).toBeLessThan(0);
    let vidjenaNula = false;
    for (let i = 0; i < koraci(3); i++) {
      korakSlobodno(P, st, ulaz(1, 0));
      if (st.v === 0) vidjenaNula = true;
      expect(st.v >= 0 || st.rikverc).toBe(true);
    }
    expect(vidjenaNula).toBe(true);
    expect(st.rikverc).toBe(false);
    expect(st.v).toBeGreaterThan(0);
  });

  it("unazad volan okreće auto na drugu stranu — kao u autu", () => {
    const st = naJugu();
    for (let i = 0; i < koraci(2); i++) korakSlobodno(P, st, ulaz(0, 1));
    const prije = st.ugao;
    for (let i = 0; i < koraci(0.5); i++) korakSlobodno(P, st, ulaz(0, 1, 1));
    // Naprijed desni volan povećava ugao; unazad ga smanjuje.
    expect(st.ugao).toBeLessThan(prije);
  });
});

describe("grad: determinizam", () => {
  it("isti ulazi, isti kraj — bit po bit", () => {
    const voznja = () => {
      const st = naJugu();
      for (let i = 0; i < koraci(25); i++) {
        const t = i * DT;
        const steer = Math.sin(t * 0.9) * (t > 3 ? 1 : 0);
        korakSlobodno(P, st, t < 12 ? ulaz(0.5, 0, steer) : ulaz(0, 1, -steer));
      }
      return st;
    };
    expect(voznja()).toEqual(voznja());
  });
});
