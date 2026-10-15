/**
 * Hitna vozila (faza 6, stavka 8e): hitna pomoć, policija i vatrogasci sa
 * rotacijom i sirenom — prava vozila u saobraćaju (`saobracaj.ts`). Ovdje su
 * vrste i dimenzije, gdje se pojavljuju (iza igrača, njegovom ulicom) i da li
 * se vozilo može pomjeriti bočno a da ostane na asfaltu.
 */
import type { Point } from "../sim/types";
import type { Korak, Vozilo } from "./botGrad";
import type { Ivica, Mreza } from "./mreza";
import { naKolovozu, type Povrsina } from "./povrsina";
import type { Putanja } from "./vozacGrad";

export type VrstaHitnog = "hitna" | "policija" | "vatrogasci";

export const VRSTE_HITNIH: readonly VrstaHitnog[] = ["hitna", "policija", "vatrogasci"];

/** Dimenzije: kombi hitne pomoći, policijski auto, vatrogasno vozilo. */
export const VOZILO_HITNOG: Readonly<Record<VrstaHitnog, Vozilo>> = {
  hitna: { duzina: 5.4, sirina: 2.1 },
  policija: { duzina: 4.8, sirina: 1.85 },
  vatrogasci: { duzina: 8, sirina: 2.5 },
};

/**
 * Da li tijelo vozila (`duzina` × `sirina`), u tački `p` pravca `h` i
 * pomjereno za `bok` [m, + desno], stoji cijelo na asfaltu (uglovi i sredine
 * dužih strana).
 */
export function bokNaAsfaltu(povrsina: Povrsina, p: Point, h: Point, vozilo: Vozilo, bok: number): boolean {
  const nx = -h.y;
  const ny = h.x;
  const cx = p.x + nx * bok;
  const cy = p.y + ny * bok;
  const l = vozilo.duzina / 2;
  const w = vozilo.sirina / 2;
  for (const [a, b] of [
    [l, w],
    [l, -w],
    [-l, w],
    [-l, -w],
    [0, w],
    [0, -w],
  ] as const) {
    if (!naKolovozu(povrsina, cx + h.x * a + nx * b, cy + h.y * a + ny * b)) return false;
  }
  return true;
}

const smije = (iv: Ivica, smjer: 1 | -1) => iv.smjer === 0 || iv.smjer === smjer;
const pocetak = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.a : iv.b);
const kraj = (iv: Ivica, smjer: 1 | -1) => (smjer === 1 ? iv.b : iv.a);

/** Pravac ivice na njenom kraju (`naKraju`) ili početku, u smjeru vožnje. */
function pravacNa(iv: Ivica, smjer: 1 | -1, naKraju: boolean): Point {
  const t = smjer === 1 ? iv.tacke : [...iv.tacke].reverse();
  const [a, b] = naKraju ? [t[t.length - 2]!, t[t.length - 1]!] : [t[0]!, t[1]!];
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
}

/**
 * Korak `duzina` metara uzvodno od koraka `od` (odakle bi vozilo stiglo na
 * njega): u svakom čvoru ivica koja u njega ulazi najpravije. `null` kad
 * uzvodno nema kuda (kraj mreže).
 */
export function uzvodno(m: Mreza, od: Korak, duzina: number, vozi: (iv: Ivica) => boolean): Korak | null {
  let k = od;
  let predjeno = 0;
  for (let korak = 0; korak < 40 && predjeno < duzina; korak++) {
    const iv = m.ivice[k.ivica]!;
    const c = pocetak(iv, k.smjer);
    const h = pravacNa(iv, k.smjer, false);
    let naj: { k: Korak; d: number } | null = null;
    for (const j of m.izCvora[c] ?? []) {
      if (j === k.ivica) continue;
      const f = m.ivice[j]!;
      if (!vozi(f)) continue;
      const smjer: 1 | -1 = f.b === c ? 1 : -1;
      if (!smije(f, smjer)) continue;
      const hf = pravacNa(f, smjer, true);
      const d = hf.x * h.x + hf.y * h.y;
      if (!naj || d > naj.d) naj = { k: { ivica: j, smjer }, d };
    }
    if (!naj || naj.d < 0.3) return predjeno > 0 ? k : null;
    k = naj.k;
    predjeno += m.ivice[k.ivica]!.duzina;
  }
  return k;
}

/** Korak `duzina` metara nizvodno od koraka `od`: u svakom čvoru najpravija ivica dalje. */
export function nizvodno(m: Mreza, od: Korak, duzina: number, vozi: (iv: Ivica) => boolean): Korak {
  let k = od;
  let predjeno = 0;
  for (let korak = 0; korak < 40 && predjeno < duzina; korak++) {
    const iv = m.ivice[k.ivica]!;
    const c = kraj(iv, k.smjer);
    const h = pravacNa(iv, k.smjer, true);
    let naj: { k: Korak; d: number } | null = null;
    for (const j of m.izCvora[c] ?? []) {
      if (j === k.ivica) continue;
      const f = m.ivice[j]!;
      if (!vozi(f)) continue;
      const smjer: 1 | -1 = f.a === c ? 1 : -1;
      if (!smije(f, smjer)) continue;
      const hf = pravacNa(f, smjer, false);
      const d = hf.x * h.x + hf.y * h.y;
      if (!naj || d > naj.d) naj = { k: { ivica: j, smjer }, d };
    }
    if (!naj) return k;
    k = naj.k;
    predjeno += m.ivice[k.ivica]!.duzina;
  }
  return k;
}

/** Hitno vozilo kako ga vidi sudija (stavka 8e): gdje je, i putanja kojom ide. */
export interface HitnoZaSudiju {
  id: number;
  x: number;
  y: number;
  ugao: number;
  duzina: number;
  sirina: number;
  /** Putanja hitnog i sredina hitnog na njoj [m]. */
  put: Putanja;
  s: number;
  /** Stoji i čeka baš ovoga koga sudija sudi (vozilo ispred, zatvoren izlaz, ustupa mu). */
  cekaMe?: boolean;
}

/**
 * Gdje je tačka (x, y) — auto pravca `ugao` — ispred hitnog vozila: na
 * njegovoj putanji do `do_` m ispred njegovog nosa, u istom smjeru i bočno do
 * `bocnoDo` m. Vraća koliko je ispred nosa [m], bočni pomak od putanje
 * [m, + desno] i najbližu tačku putanje sa njenim pravcem; `null` kad nije
 * ispred njega.
 */
export function ispredHitnog(h: HitnoZaSudiju, x: number, y: number, ugao: number, do_: number, bocnoDo: number): { ispred: number; bok: number; tacka: Point; pravac: Point } | null {
  if (Math.cos(ugao) * Math.cos(h.ugao) + Math.sin(ugao) * Math.sin(h.ugao) < 0.7) return null;
  const { tacke, cum } = h.put;
  const nos = h.s + h.duzina / 2;
  let naj: { ispred: number; bok: number; tacka: Point; pravac: Point; d: number } | null = null;
  for (let i = 1; i < tacke.length; i++) {
    if (cum[i]! < nos) continue;
    if (cum[i - 1]! > nos + do_) break;
    const a = tacke[i - 1]!;
    const b = tacke[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    if (l === 0) continue;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (l * l)));
    const px = a.x + dx * u;
    const py = a.y + dy * u;
    const d = Math.hypot(x - px, y - py);
    if (!naj || d < naj.d) {
      naj = { ispred: cum[i - 1]! + u * l - nos, bok: ((x - px) * -dy + (y - py) * dx) / l, tacka: { x: px, y: py }, pravac: { x: dx / l, y: dy / l }, d };
    }
  }
  if (!naj || naj.ispred <= 0 || naj.ispred > do_ || naj.d > bocnoDo) return null;
  return { ispred: naj.ispred, bok: naj.bok, tacka: naj.tacka, pravac: naj.pravac };
}
