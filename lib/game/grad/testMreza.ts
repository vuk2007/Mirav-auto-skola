import type { Point } from "../sim/types";
import { napraviMrezu, type Mreza } from "./mreza";
import { IVICA_VOZNA, prazniNizovi, type Paket } from "./paket";

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
