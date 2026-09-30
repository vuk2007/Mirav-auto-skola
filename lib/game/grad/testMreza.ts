import { GRAD_ZEBRA_VRSTE } from "../sim/config";
import type { Point } from "../sim/types";
import { napraviMrezu, type Mreza } from "./mreza";
import { BEZ, IVICA_KRUZNI, IVICA_VOZNA, prazniNizovi, type Paket } from "./paket";

/**
 * Mala mreža za testove: čvorovi i ivice kao prave linije između njih. Sve
 * ivice su dvosmjerne ulice sa dvije trake, osim ako se kaže drugačije.
 */
export function mreza(cvorovi: Point[], ivice: [number, number, string?][]): Mreza {
  const n = prazniNizovi();
  n.cvXY = new Float32Array(cvorovi.flatMap((p) => [p.x, p.y]));
  n.ivA = new Uint32Array(ivice.map((e) => e[0]));
  n.ivB = new Uint32Array(ivice.map((e) => e[1]));
  n.ivOd = new Uint32Array(ivice.map((_, i) => 2 * i).concat([2 * ivice.length]));
  n.ivXY = new Float32Array(ivice.flatMap(([a, b]) => [cvorovi[a]!.x, cvorovi[a]!.y, cvorovi[b]!.x, cvorovi[b]!.y]));
  const klase = ["residential", "pedestrian", "service"];
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
export const KRST = mreza(
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

export interface TestIvica {
  a: number;
  b: number;
  klasa?: string;
  /** 1: jednosmjerna `a → b`; −1: `b → a`. */
  smjer?: -1 | 0 | 1;
  trake?: number;
  kruzni?: boolean;
}

export interface TestObjekat {
  vrsta: "stop" | "give_way" | "traffic_signals" | "crossing";
  podatak?: string;
  /** Na ivici (`s` metara od `a`) ili u čvoru. */
  ivica?: number;
  s?: number;
  cvor?: number;
}

/**
 * Paket i mreža za testove pravila: ulice zadate klase i smjera (prave linije
 * između čvorova), objekti pravila na ivicama ili u čvorovima, zabrane
 * skretanja `[vrsta, sa ivice, preko čvora, na ivicu]`.
 */
export function testPaket(
  cvorovi: Point[],
  ivice: TestIvica[],
  objekti: TestObjekat[] = [],
  zabrane: [string, number, number, number][] = [],
): { paket: Paket; mreza: Mreza } {
  const n = prazniNizovi();
  const klase = [...new Set(["residential", ...ivice.map((e) => e.klasa ?? "residential")])];
  const stringovi = ["", "forward", "backward", ...GRAD_ZEBRA_VRSTE, ...zabrane.map((z) => z[0])];
  const vrsteObjekata = ["stop", "give_way", "traffic_signals", "crossing"];
  n.cvXY = new Float32Array(cvorovi.flatMap((p) => [p.x, p.y]));
  n.ivA = new Uint32Array(ivice.map((e) => e.a));
  n.ivB = new Uint32Array(ivice.map((e) => e.b));
  n.ivOd = new Uint32Array(ivice.map((_, i) => 2 * i).concat([2 * ivice.length]));
  n.ivXY = new Float32Array(ivice.flatMap((e) => [cvorovi[e.a]!.x, cvorovi[e.a]!.y, cvorovi[e.b]!.x, cvorovi[e.b]!.y]));
  n.ivKlasa = new Uint8Array(ivice.map((e) => klase.indexOf(e.klasa ?? "residential")));
  n.ivSmjer = new Int8Array(ivice.map((e) => e.smjer ?? 0));
  n.ivTrake = new Uint8Array(ivice.map((e) => e.trake ?? 2));
  n.ivTrakeNaprijed = new Uint8Array(ivice.length);
  n.ivTrakeNazad = new Uint8Array(ivice.length);
  n.ivBrzina = new Uint8Array(ivice.length);
  n.ivZastavice = new Uint8Array(ivice.map((e) => IVICA_VOZNA | (e.kruzni ? IVICA_KRUZNI : 0)));
  n.ivSloj = new Int8Array(ivice.length);
  n.ivIme = new Uint16Array(ivice.length);
  n.ivTrakeSkretanja = new Uint16Array(ivice.length);
  n.ivTrakeSkretanjaNazad = new Uint16Array(ivice.length);
  n.ivOsm = new Uint32Array(ivice.length);
  n.obVrsta = new Uint8Array(objekti.map((o) => vrsteObjekata.indexOf(o.vrsta)));
  n.obPodatak = new Uint16Array(objekti.map((o) => stringovi.indexOf(o.podatak ?? "")));
  n.obIvica = new Uint32Array(objekti.map((o) => o.ivica ?? BEZ));
  n.obS = new Float32Array(objekti.map((o) => o.s ?? 0));
  n.obCvor = new Uint32Array(objekti.map((o) => o.cvor ?? BEZ));
  n.obXY = new Float32Array(
    objekti.flatMap((o) => {
      if (o.cvor !== undefined) return [cvorovi[o.cvor]!.x, cvorovi[o.cvor]!.y];
      const e = ivice[o.ivica!]!;
      const A = cvorovi[e.a]!;
      const B = cvorovi[e.b]!;
      const l = Math.hypot(B.x - A.x, B.y - A.y);
      return [A.x + ((B.x - A.x) * o.s!) / l, A.y + ((B.y - A.y) * o.s!) / l];
    }),
  );
  n.rsVrsta = new Uint16Array(zabrane.map((z) => stringovi.indexOf(z[0])));
  n.rsOd = new Uint32Array(zabrane.map((z) => z[1]));
  n.rsCvor = new Uint32Array(zabrane.map((z) => z[2]));
  n.rsDo = new Uint32Array(zabrane.map((z) => z[3]));
  const paket = { zaglavlje: { klase, stringovi, vrsteObjekata }, n } as unknown as Paket;
  return { paket, mreza: napraviMrezu(paket) };
}

/**
 * Trouglovi prstena „lepezom" iz prve tačke — za testove. Tačna za konveksne
 * oblike (pravougaonik, osmougao); na udubljenom da ispravne indekse, a
 * pogrešne trouglove, pa testovi na pravim zgradama provjeravaju samo
 * brojeve i indekse. Igra trougliće pravi Pixijevim `earcut`-om; testovi ga
 * ne uvoze, jer učitavanje cijelog Pixija u vitest radniku kvari susjedne
 * testove (izmjereno: „Cannot read properties of undefined (reading 'config')").
 */
export function lepeza(ravno: number[]): number[] {
  const n = ravno.length / 2;
  const i: number[] = [];
  for (let k = 1; k + 1 < n; k++) i.push(0, k, k + 1);
  return i;
}
