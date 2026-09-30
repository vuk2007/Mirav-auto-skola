import { describe, expect, it } from "vitest";
import { DT } from "../sim/config";
import type { Input, Point } from "../sim/types";
import { napraviMrezu, najblizaIvica, type Mreza } from "./mreza";
import { IVICA_VOZNA, prazniNizovi, type Paket } from "./paket";
import { izlazi, korak, novoVozilo, poza, type GradVozilo } from "./voznja";

/**
 * Mala mreža za testove: čvorovi i ivice kao prave linije između njih. Sve
 * ivice su dvosmjerne ulice sa dvije trake, osim ako se kaže drugačije.
 */
function mreza(cvorovi: Point[], ivice: [number, number, string?][]): Mreza {
  const n = prazniNizovi();
  n.cvXY = new Float32Array(cvorovi.flatMap((p) => [p.x, p.y]));
  n.ivA = new Uint32Array(ivice.map((e) => e[0]));
  n.ivB = new Uint32Array(ivice.map((e) => e[1]));
  n.ivOd = new Uint32Array(ivice.map((_, i) => 2 * i).concat([2 * ivice.length]));
  n.ivXY = new Float32Array(ivice.flatMap(([a, b]) => [cvorovi[a]!.x, cvorovi[a]!.y, cvorovi[b]!.x, cvorovi[b]!.y]));
  const klase = ["residential", "pedestrian"];
  n.ivKlasa = new Uint8Array(ivice.map((e) => klase.indexOf(e[2] ?? "residential")));
  n.ivSmjer = new Int8Array(ivice.length);
  n.ivTrake = new Uint8Array(ivice.length).fill(2);
  n.ivTrakeNaprijed = new Uint8Array(ivice.length);
  n.ivTrakeNazad = new Uint8Array(ivice.length);
  n.ivBrzina = new Uint8Array(ivice.length);
  n.ivZastavice = new Uint8Array(ivice.map((e) => ((e[2] ?? "residential") === "pedestrian" ? 0 : IVICA_VOZNA)));
  n.ivSloj = new Int8Array(ivice.length);
  n.ivIme = new Uint16Array(ivice.length);
  n.ivTrakeSkretanja = new Uint16Array(ivice.length);
  n.ivTrakeSkretanjaNazad = new Uint16Array(ivice.length);
  n.ivOsm = new Uint32Array(ivice.length);
  const p = { zaglavlje: { klase, stringovi: [""] }, n } as unknown as Paket;
  return napraviMrezu(p);
}

/**
 * Krst: centar 0, krakovi 1 (sjever, y = −100), 2 (istok), 3 (jug), 4 (zapad).
 * `y` raste nadolje, pa je sjever gore.
 */
const KRST = mreza(
  [
    { x: 0, y: 0 },
    { x: 0, y: -100 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: -100, y: 0 },
  ],
  [
    [3, 0], // 0: sa juga ka centru
    [0, 1], // 1: od centra na sjever
    [0, 2], // 2: od centra na istok
    [0, 4], // 3: od centra na zapad
  ],
);

const vozi = (m: Mreza, st: GradVozilo, input: Input, sekundi: number) => {
  const tragovi: Point[] = [];
  for (let i = 0; i < Math.round(sekundi / DT); i++) {
    korak(m, st, input);
    tragovi.push(poza(m, st).pos);
  }
  return tragovi;
};

const gas = (steer = 0): Input => ({ throttle: 0.6, brake: 0, indicator: null, steer });

describe("grad: vožnja bilo kojom ulicom", () => {
  it("izlazi iz raskrsnice imaju ugao: pravo 0, desno +90, lijevo −90", () => {
    const x = izlazi(KRST, 0, 1).map((i) => [i.ivica, Math.round(i.ugao)]);
    expect(x).toEqual([
      [1, 0],
      [2, 90],
      [3, -90],
    ]);
  });

  it("volan pušten prije raskrsnice — opet pravo", () => {
    const st = novoVozilo(KRST, 0, 1, 10);
    vozi(KRST, st, gas(), 6);
    vozi(KRST, st, gas(1), 3);
    vozi(KRST, st, gas(), 6);
    expect(st.ivica).toBe(1);
  });

  it("bez volana se ide pravo", () => {
    const st = novoVozilo(KRST, 0, 1, 10);
    vozi(KRST, st, gas(), 20);
    expect(st.ivica).toBe(1);
  });

  it("volan udesno pred raskrsnicom — skreće se desno, na istok", () => {
    const st = novoVozilo(KRST, 0, 1, 10);
    // Šest sekundi pravo, pa volan udesno sve do raskrsnice. Izbor važi tek u
    // prozoru od pedeset metara pred njom, kad se strana drži `DECISION_HOLD`
    // — i volan pušten prije zaključavanja opet znači „pravo", kao u fazi 5.
    vozi(KRST, st, gas(), 6);
    vozi(KRST, st, gas(1), 8);
    expect(st.ivica).toBe(2);
    expect(poza(KRST, st).pos.x).toBeGreaterThan(10);
  });

  it("volan ulijevo — na zapad", () => {
    const st = novoVozilo(KRST, 0, 1, 10);
    vozi(KRST, st, gas(), 6);
    vozi(KRST, st, gas(-1), 8);
    expect(st.ivica).toBe(3);
  });

  it("slijepa ulica: auto se okrene i vrati istom ulicom", () => {
    const m = mreza(
      [
        { x: 0, y: 0 },
        { x: 0, y: -80 },
      ],
      [[0, 1]],
    );
    const st = novoVozilo(m, 0, 1, 5);
    vozi(m, st, gas(), 30);
    expect(st.ivica).toBe(0);
    expect(st.smjer).toBe(-1);
  });

  it("pješačka zona nije izlaz dok ima drugog", () => {
    const m = mreza(
      [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 0, y: -100 },
        { x: 100, y: 0 },
      ],
      [
        [1, 0],
        [0, 2, "pedestrian"],
        [0, 3],
      ],
    );
    expect(izlazi(m, 0, 1).map((i) => i.ivica)).toEqual([2]);
  });

  it("auto nigdje ne skače — ni na ulasku u luk ni na izlasku iz njega", () => {
    const st = novoVozilo(KRST, 0, 1, 10);
    let prije = poza(KRST, st).pos;
    const koraci = [...Array(300)].map((_, i) => (i > 300 && i < 480 ? gas(1) : gas()));
    for (const inp of [...koraci, ...Array(900).fill(gas(1))]) {
      korak(KRST, st, inp);
      const sada = poza(KRST, st).pos;
      // Najviše put jednog koraka, uz malu rezervu za luk koji je nešto kraći
      // od tetive.
      expect(Math.hypot(sada.x - prije.x, sada.y - prije.y)).toBeLessThan(st.v * DT + 0.05);
      prije = sada;
    }
  });

  it("isti ulaz daje istu vožnju", () => {
    const a = novoVozilo(KRST, 0, 1, 10);
    const b = novoVozilo(KRST, 0, 1, 10);
    const ulazi = [...Array(1500)].map((_, i) => gas(Math.sin(i / 40)));
    for (const u of ulazi) {
      korak(KRST, a, u);
      korak(KRST, b, u);
    }
    expect(a).toEqual(b);
  });

  it("start: najbliža vozna ivica tački", () => {
    const x = najblizaIvica(KRST, { x: 30, y: 2 });
    expect(x?.ivica).toBe(2);
    expect(x?.s).toBeCloseTo(30);
  });
});
