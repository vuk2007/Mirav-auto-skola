/**
 * Geometrija nad polilinijama u metrima.
 *
 * Sve radi na nizovima `[x, y]` — isti oblik koji ide u GeoJSON, pa nema
 * pretvaranja izmedju formata.
 */

/** Duzina polilinije [m]. */
export function duzina(tacke) {
  let d = 0;
  for (let i = 1; i < tacke.length; i++) {
    d += Math.hypot(tacke[i][0] - tacke[i - 1][0], tacke[i][1] - tacke[i - 1][1]);
  }
  return d;
}

/** Najmanji pravougaonik oko tacaka: `[minX, minY, maxX, maxY]`. */
export function okvir(tacke) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of tacke) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Rastojanje tacke `p` od duzi `a`—`b` [m]. */
function odDuzi(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const kv = dx * dx + dy * dy;
  if (kv === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / kv;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Najvise tacaka koje idu u jedan prolaz Douglas–Peucker-a.
 *
 * Postupak je u prosjeku O(n log n), ali kad je linija sitno nazubljena svaka
 * podjela ispadne neravnomjerna i vrijeme ode u O(n²). Na obalnoj liniji od
 * sezdeset hiljada tacaka to je bilo mjereno u minutima. Zato se duge linije
 * dijele na komade i svaki se uproscava zasebno; na sastavu se cuva zajednicka
 * tacka, pa linija ostaje neprekidna. Cijena je nekoliko tacaka vise nego sto
 * bi ih dao jedan prolaz.
 */
const NAJVISE_ODJEDNOM = 2000;

/**
 * Douglas–Peucker: izbacuje tacke koje se od prave izmedju susjeda ne
 * odvajaju vise od `tol` metara.
 *
 * Iterativno, ne rekurzivno: obalna linija Crne Gore ima desetine hiljada
 * tacaka u jednom komadu i rekurzija na njoj probija stek.
 */
export function uprosti(tacke, tol) {
  if (tacke.length > NAJVISE_ODJEDNOM) {
    const out = [];
    for (let i = 0; i < tacke.length - 1; i += NAJVISE_ODJEDNOM - 1) {
      const komad = jedanProlaz(tacke.slice(i, i + NAJVISE_ODJEDNOM), tol);
      // Prva tacka komada je posljednja tacka prethodnog — ne upisuje se dvaput.
      out.push(...(i === 0 ? komad : komad.slice(1)));
    }
    return out;
  }
  return jedanProlaz(tacke, tol);
}

function jedanProlaz(tacke, tol) {
  if (tacke.length <= 2) return tacke.slice();
  const drzi = new Uint8Array(tacke.length);
  drzi[0] = 1;
  drzi[tacke.length - 1] = 1;

  const stek = [[0, tacke.length - 1]];
  while (stek.length > 0) {
    const [i, j] = stek.pop();
    if (j <= i + 1) continue;
    let najdalje = -1;
    let gdje = -1;
    for (let k = i + 1; k < j; k++) {
      const d = odDuzi(tacke[k], tacke[i], tacke[j]);
      if (d > najdalje) {
        najdalje = d;
        gdje = k;
      }
    }
    if (najdalje > tol) {
      drzi[gdje] = 1;
      stek.push([i, gdje], [gdje, j]);
    }
  }

  const out = [];
  for (let i = 0; i < tacke.length; i++) if (drzi[i]) out.push(tacke[i]);
  return out;
}

/**
 * Tacka na poliliniji na predjenoj duzini `s` [m].
 *
 * Vraca i smjer, jer je svuda gdje ovo treba potrebno i jedno i drugo.
 */
export function naDuzini(tacke, s) {
  if (tacke.length === 0) return null;
  if (tacke.length === 1) return { p: tacke[0], smjer: [0, 1] };
  let preslo = 0;
  for (let i = 1; i < tacke.length; i++) {
    const dx = tacke[i][0] - tacke[i - 1][0];
    const dy = tacke[i][1] - tacke[i - 1][1];
    const d = Math.hypot(dx, dy);
    if (d === 0) continue;
    if (preslo + d >= s) {
      const t = (s - preslo) / d;
      return {
        p: [tacke[i - 1][0] + dx * t, tacke[i - 1][1] + dy * t],
        smjer: [dx / d, dy / d],
      };
    }
    preslo += d;
  }
  const n = tacke.length - 1;
  const dx = tacke[n][0] - tacke[n - 1][0];
  const dy = tacke[n][1] - tacke[n - 1][1];
  const d = Math.hypot(dx, dy) || 1;
  return { p: tacke[n], smjer: [dx / d, dy / d] };
}

/** Zaokruzivanje koordinata na decimetar — GeoJSON inace nosi 15 cifara bez potrebe. */
export const dm = (v) => Math.round(v * 10) / 10;
