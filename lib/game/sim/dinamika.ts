import {
  DRAG_COEFF,
  DT,
  LAT_SPEED_FAST,
  LAT_SPEED_SLOW,
  LAT_SPEED_V_FAST,
  LAT_SPEED_V_SLOW,
  ROLL_RESISTANCE,
  V_TOP,
} from "./config";

/**
 * Dinamika vozila: čiste funkcije, zajedničke starom motoru (šabloni, `world.ts`)
 * i novom (grad u razmjeri 1:1, `lib/game/grad/`).
 *
 * Izvučene iz `world.ts` bez ijedne izmjene u ponašanju — vozilo u gradu mora
 * ubrzavati, kočiti i skretati tačno kao na ispitu, inače bi ista vožnja na dva
 * mjesta bila dvije različite igre.
 */

/** Ono što `integrate` mijenja: brzina [m/s] i pređeni put [m]. */
export interface Kretanje {
  v: number;
  s: number;
}

/**
 * Jedan korak brzine i puta.
 *
 * Brzina se steže na ono što vozilo MOŽE (`V_TOP`), ne na ono što SMIJE.
 * Zbog toga prekoračenje uopšte može da se desi i da se prijavi.
 */
export function integrate(v: Kretanje, a: number, top = V_TOP, coeff = DRAG_COEFF): void {
  const drag = coeff * v.v + (v.v > 0.01 ? ROLL_RESISTANCE : 0);
  const acc = a - (a > 0 ? drag : 0);
  v.v = Math.max(0, Math.min(top, v.v + acc * DT));
  v.s += v.v * DT;
}

/**
 * Bočna brzina pri punom volanu [m/s].
 *
 * Raste sa brzinom: na deset na sat se volan okreće mnogo a auto se pomjeri
 * malo, na osamdeset je obrnuto.
 */
export function bocnaBrzina(v: number): number {
  const t = (v - LAT_SPEED_V_SLOW) / (LAT_SPEED_V_FAST - LAT_SPEED_V_SLOW);
  const k = Math.min(1, Math.max(0, t));
  return LAT_SPEED_SLOW + (LAT_SPEED_FAST - LAT_SPEED_SLOW) * k;
}
