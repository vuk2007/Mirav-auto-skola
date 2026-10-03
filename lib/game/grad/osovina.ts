import { GRAD_LOM_OSOVINE } from "../sim/config";
import { cumulative, headingAt, pointAt } from "../sim/geometry";
import type { Point } from "../sim/types";
import type { Ivica } from "./mreza";

/**
 * Zaobljena osovina ulice (faza 6, stavka 7): OSM crta krivinu kao lom, a
 * traka pomaknuta od loma ima na unutrašnjoj strani petlju — auto bi išlo
 * naprijed, pa nazad, preko osovine u suprotnu traku. Bot to volanom izravna;
 * drugi vozači idu tačno putanjom, pa im putanja mora biti glatka.
 *
 * Svaki lom veći od `GRAD_LOM_OSOVINE` zamjenjuje se kružnim lukom
 * poluprečnika `R` (manjim kad susjedni segmenti nisu dovoljno dugi: tangenta
 * je najviše pola segmenta). Traka pomaknuta manje od `R` je tada glatka i
 * na unutrašnjoj strani.
 */
export interface Osovina {
  tacke: Point[];
  cum: number[];
  duzina: number;
}

export function zaobliOsovinu(tacke: readonly Point[], R: number): Osovina {
  const t: Point[] = [];
  for (const p of tacke) {
    const z = t[t.length - 1];
    if (!z || Math.hypot(p.x - z.x, p.y - z.y) > 1e-6) t.push(p);
  }
  if (t.length < 3) {
    const cum = cumulative(t);
    return { tacke: t, cum, duzina: cum[cum.length - 1] ?? 0 };
  }
  const prag = (GRAD_LOM_OSOVINE * Math.PI) / 180;
  const izlaz: Point[] = [t[0]!];
  for (let i = 1; i + 1 < t.length; i++) {
    const a = t[i - 1]!;
    const b = t[i]!;
    const c = t[i + 1]!;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const d1 = { x: (b.x - a.x) / l1, y: (b.y - a.y) / l1 };
    const d2 = { x: (c.x - b.x) / l2, y: (c.y - b.y) / l2 };
    const krst = d1.x * d2.y - d1.y * d2.x;
    const teta = Math.abs(Math.atan2(krst, d1.x * d2.x + d1.y * d2.y));
    if (teta < prag) {
      izlaz.push(b);
      continue;
    }
    const tg = Math.tan(teta / 2);
    const T = Math.min(R * tg, l1 / 2, l2 / 2);
    const r = T / tg;
    const znak = krst > 0 ? 1 : -1;
    // Centar luka: od početka luka okomito ka strani skretanja (y na jug:
    // desno od `d1` je (−d1.y, d1.x)).
    const P1 = { x: b.x - d1.x * T, y: b.y - d1.y * T };
    const O = { x: P1.x - d1.y * r * znak, y: P1.y + d1.x * r * znak };
    const pocetak = Math.atan2(P1.y - O.y, P1.x - O.x);
    const n = Math.max(2, Math.ceil((teta * r) / 0.5));
    for (let j = 0; j <= n; j++) {
      const u = pocetak + (znak * teta * j) / n;
      izlaz.push({ x: O.x + r * Math.cos(u), y: O.y + r * Math.sin(u) });
    }
  }
  izlaz.push(t[t.length - 1]!);
  const cum = cumulative(izlaz);
  return { tacke: izlaz, cum, duzina: cum[cum.length - 1] ?? 0 };
}

const kes = new WeakMap<Ivica, Osovina>();

/**
 * Zaobljena osovina ivice, sa poluprečnikom većim od svakog pomaka trake na
 * njoj (pola kolovoza + metar). Kešira se po ivici.
 */
export function osovinaIvice(iv: Ivica): Osovina {
  let o = kes.get(iv);
  if (!o) {
    o = zaobliOsovinu(iv.tacke, iv.sirina / 2 + 1);
    kes.set(iv, o);
  }
  return o;
}

/**
 * Tačka i pravac zaobljene osovine na `s` metara od početka ivice (mjereno
 * po njenoj OSM osovini): luk je kraći od loma, pa se `s` preslikava srazmjerno
 * — krajevi ivice ostaju na mjestu.
 */
export function naOsovini(iv: Ivica, s: number): { tacka: Point; pravac: Point } {
  const o = osovinaIvice(iv);
  const sz = iv.duzina > 0 ? (s * o.duzina) / iv.duzina : 0;
  return { tacka: pointAt(o.tacke, o.cum, sz), pravac: headingAt(o.tacke, o.cum, sz) };
}
