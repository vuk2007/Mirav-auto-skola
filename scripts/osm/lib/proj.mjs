/**
 * Projekcija: geografske koordinate u metre i nazad.
 *
 * UTM zona 34N (centralni meridijan 21°E) pokriva cijelu Crnu Goru — najzapad-
 * nija tacka grafa je Debeli Brijeg na 18,44°, dakle jos uvijek istocno od 18°,
 * gdje zona pocinje. Zato nema potrebe ni za `proj4` ni za bilo kojom drugom
 * zavisnoscu: jedna zona je jedna formula.
 *
 * Zasto uopste projekcija: stepeni nisu metri i nisu ni jednaki medju sobom —
 * jedan stepen duzine je na 43° sjeverne sirine oko 81 km, a jedan stepen
 * sirine 111 km. Sve u igri je u metrima (poluprecnik krivine, sirina puta,
 * odstojanje), pa se podaci prevode jednom, ovdje, a dalje se racuna pravo.
 *
 * Formule su Snyder, „Map Projections — A Working Manual", poglavlje o
 * transverzalnoj Merkatorovoj projekciji. Greska serije je ispod milimetra na
 * ovoj udaljenosti od centralnog meridijana.
 */

const a = 6378137; // velika poluosa WGS84 [m]
const f = 1 / 298.257223563;
const e2 = f * (2 - f);
const ep2 = e2 / (1 - e2);
const k0 = 0.9996;
const FE = 500000;
const FN = 0;

/** Centralni meridijan zone 34 [rad]. */
const LAMBDA0 = (21 * Math.PI) / 180;

export const ZONA = "UTM 34N (WGS84)";

const rad = (x) => (x * Math.PI) / 180;
const deg = (x) => (x * 180) / Math.PI;

/** Duzina meridijanskog luka od ekvatora do `phi`. */
function luk(phi) {
  return (
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

/** Geografske koordinate [°] u metre zone 34N. */
export function uMetre(lat, lon) {
  const phi = rad(lat);
  const A = (rad(lon) - LAMBDA0) * Math.cos(phi);
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const T = Math.tan(phi) ** 2;
  const C = ep2 * Math.cos(phi) ** 2;
  const M = luk(phi);

  const x =
    FE +
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120);
  const y =
    FN +
    k0 *
      (M +
        N *
          Math.tan(phi) *
          (A * A / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { x, y };
}

/** Metri zone 34N nazad u geografske koordinate [°]. */
export function uStepene(x, y) {
  const M = (y - FN) / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const C1 = ep2 * Math.cos(phi1) ** 2;
  const T1 = Math.tan(phi1) ** 2;
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = (x - FE) / (N1 * k0);

  const phi =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lam =
    LAMBDA0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) /
      Math.cos(phi1);

  return { lat: deg(phi), lon: deg(lam) };
}

/**
 * Rastojanje po velikom krugu [m].
 *
 * Postoji da bi se projekcija imala cime provjeriti: rastojanje izmedju dvije
 * tacke mora ispasti isto i preko metara i preko haversinusa. Ako se te dvije
 * mjere raziđu, greska je u formuli, ne u podacima.
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371008.8;
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
