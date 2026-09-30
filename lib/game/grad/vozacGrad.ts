import { B_MAX, GRAD_MEDJUOSOVINSKO, GRAD_RIKVERC_PEDALA, GRAD_VOZAC_USPORENJE } from "../sim/config";
import { cumulative, pointAt } from "../sim/geometry";
import type { Input, Point } from "../sim/types";
import { najveciTocak, type SlobodnoVozilo } from "./slobodno";

/**
 * Vozač koji prati putanju u gradu (faza 6, stavka 5): volan po „pure
 * pursuit" pravilu nad istim modelom bicikla kojim se vozi igrač, gas i
 * kočnica ka zadatoj brzini, i zaustavljanje na zadatom mjestu.
 *
 * Koristi ga sudija u testovima (vožnja tačno tamo gdje test hoće) i savršeni
 * bot. Ne zna pravila — kad i gdje da stane, i koliko brzo, kaže mu pozivalac.
 */

export interface Putanja {
  tacke: Point[];
  cum: number[];
  duzina: number;
}

export function putanja(tacke: Point[]): Putanja {
  const cum = cumulative(tacke);
  return { tacke, cum, duzina: cum[cum.length - 1] ?? 0 };
}

/** Najbliža tačka putanje autu — `s` duž putanje, tražena od prošlog `s` naprijed. */
export function naPutanji(p: Putanja, x: number, y: number, od = 0): number {
  let naj = Infinity;
  let s = od;
  for (let k = 0; k + 1 < p.tacke.length; k++) {
    if (p.cum[k + 1]! < od - 5) continue;
    const a = p.tacke[k]!;
    const b = p.tacke[k + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
    const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
    if (d < naj) {
      naj = d;
      s = p.cum[k]! + Math.sqrt(l2) * t;
    }
    if (p.cum[k]! > od + 40) break;
  }
  return s;
}

export interface Cilj {
  /** Brzina kojom da vozi [m/s]. */
  brzina: number;
  /** Mjesto na putanji na kojem da stane (nos auta), ili `null`. */
  staniNa: number | null;
}

/**
 * Ulaz za jedan korak: volan ka tački ispred na putanji, pedale ka brzini koja
 * je najmanja od zadate i one sa koje se stigne stati na `staniNa`.
 */
export function vozi(st: SlobodnoVozilo, p: Putanja, sNaPutanji: number, cilj: Cilj): Input {
  const v = Math.max(0, st.v);
  // Pogled naprijed: kratak pri maloj brzini (uska skretanja — duži bi sjekao
  // ugao i zakačio ivičnjak), duži pri većoj (mirno držanje trake).
  const naprijed = Math.max(2.2, Math.min(12, 1.2 + 0.55 * v));
  const meta = pointAt(p.tacke, p.cum, Math.min(p.duzina, sNaPutanji + naprijed));
  // Pure pursuit: ugao ka meti od zadnje osovine, pa ugao točkova.
  const pola = GRAD_MEDJUOSOVINSKO / 2;
  const zx = st.x - Math.cos(st.ugao) * pola;
  const zy = st.y - Math.sin(st.ugao) * pola;
  const alfa = Math.atan2(meta.y - zy, meta.x - zx) - st.ugao;
  const ld = Math.max(1, Math.hypot(meta.x - zx, meta.y - zy));
  const tocak = Math.atan((2 * GRAD_MEDJUOSOVINSKO * Math.sin(alfa)) / ld);
  const steer = Math.max(-1, Math.min(1, tocak / najveciTocak(v)));

  let zeljena = cilj.brzina;
  if (cilj.staniNa !== null) {
    const doStajanja = cilj.staniNa - sNaPutanji;
    zeljena = doStajanja <= 0.3 ? 0 : Math.min(zeljena, Math.sqrt(2 * GRAD_VOZAC_USPORENJE * Math.max(0, doStajanja - 0.3)));
    // Zaustavljanje bliže nego što udobno usporenje stigne (žuto upaljeno
    // blizu): kočnica onoliko koliko treba, do `B_MAX`.
    const treba = (v * v) / (2 * Math.max(0.1, doStajanja - 0.3));
    if (v > 0.3 && treba > GRAD_VOZAC_USPORENJE) {
      return { throttle: 0, brake: Math.min(1, (treba * 1.15) / B_MAX), indicator: null, steer };
    }
  }
  const razlika = zeljena - v;
  // Stojeći drži kočnicu slabije od praga rikverca — inače bi poslije
  // `GRAD_RIKVERC_CEKANJE` krenuo unazad.
  if (zeljena === 0 && v < 0.3) return { throttle: 0, brake: GRAD_RIKVERC_PEDALA * 0.5, indicator: null, steer };
  if (razlika > 0.2) return { throttle: Math.min(1, razlika / 2), brake: 0, indicator: null, steer };
  if (razlika < -0.2) return { throttle: 0, brake: Math.min(1, -razlika / 2 + 0.1), indicator: null, steer };
  // Održavanje: tek toliko gasa da otpor ne uspori.
  return { throttle: Math.min(1, 0.05 + v * 0.01), brake: 0, indicator: null, steer };
}

/** Brzina sa koje se stigne stati na `d` metara [m/s] — za planiranje. */
export const brzinaZaStati = (d: number) => Math.sqrt(2 * GRAD_VOZAC_USPORENJE * Math.max(0, d));
