import { BLINK_HZ } from "../sim/config";

/**
 * Da li žmigavac u gradu u trenutku `t` [s simulacije] svijetli — isti ritam
 * kao `pokazivacSvijetli` u `draw.ts`. Zaseban modul, da ekran grada ne uvozi
 * ni staro platno ni Pixi samo zbog treptanja lampice.
 */
export function zmigavacSvijetli(t: number): boolean {
  return Math.floor(t * BLINK_HZ * 2) % 2 === 0;
}
