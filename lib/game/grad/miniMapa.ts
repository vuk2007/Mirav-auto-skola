/**
 * Ulice za mini mapu grada (faza 6, stavka 9): osovine voznih ulica oko tačke,
 * kao SVG putanje u svjetskim koordinatama — glavne (bulevari) posebno, da se
 * crtaju šire. Pravi se jednom za okolinu, ne svaki kadar.
 */
import type { Point } from "../sim/types";
import { ZA_BOTA } from "./botGrad";
import type { Mreza } from "./mreza";

const GLAVNE = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/;

export function uliceOko(m: Mreza, centar: Point, poluprecnik: number): { centar: Point; glavne: string; ostale: string } {
  const glavne: string[] = [];
  const ostale: string[] = [];
  const R2 = poluprecnik * poluprecnik;
  for (const iv of m.ivice) {
    if (!ZA_BOTA(iv)) continue;
    // Brzo odbacivanje: ni jedna tačka ivice nije u krugu (ivice su kratke u gradu).
    if (!iv.tacke.some((p) => (p.x - centar.x) ** 2 + (p.y - centar.y) ** 2 < R2)) continue;
    const d = iv.tacke.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
    (GLAVNE.test(iv.klasa) ? glavne : ostale).push(d);
  }
  return { centar, glavne: glavne.join(""), ostale: ostale.join("") };
}
