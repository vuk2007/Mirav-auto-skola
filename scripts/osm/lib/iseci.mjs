/**
 * Sjecenje geometrije na granicama tile-a.
 *
 * Zasto se sijece a ne samo razvrstava: sumski poligon iznad Kolasina prelazi
 * preko tridesetak tile-ova. Da se cio upisuje u svaki od njih, isti podatak bi
 * na disku stajao trideset puta. Zato se svakom tile-u daje samo njegov komad.
 *
 * Poligoni se sijeku Sutherland–Hodgman postupkom. Na udubljenim oblicima on
 * ostavlja spojnice duz ivice pravougaonika — obris nije tacan, ali je POVRSINA
 * tacna, a poligoni se ovdje samo boje, ne obilaze. Za linije se koristi obicno
 * sjecenje po segmentima, koje je tacno.
 */

/** Da li je tacka unutar poluravni date ivice pravougaonika. */
const unutra = (p, ivica, r) => {
  if (ivica === 0) return p[0] >= r[0];
  if (ivica === 1) return p[0] <= r[2];
  if (ivica === 2) return p[1] >= r[1];
  return p[1] <= r[3];
};

/** Presjek duzi `a`—`b` sa ivicom pravougaonika. */
function presjek(a, b, ivica, r) {
  const vodoravna = ivica >= 2;
  const granica = ivica === 0 ? r[0] : ivica === 1 ? r[2] : ivica === 2 ? r[1] : r[3];
  const os = vodoravna ? 1 : 0;
  const t = (granica - a[os]) / (b[os] - a[os]);
  return vodoravna
    ? [a[0] + (b[0] - a[0]) * t, granica]
    : [granica, a[1] + (b[1] - a[1]) * t];
}

/** Poligon isjecen na pravougaonik `[minX, minY, maxX, maxY]`; `[]` ako ga nema. */
export function iseciPoligon(prsten, r) {
  let ulaz = prsten;
  for (let ivica = 0; ivica < 4 && ulaz.length > 0; ivica++) {
    const izlaz = [];
    for (let i = 0; i < ulaz.length; i++) {
      const a = ulaz[(i + ulaz.length - 1) % ulaz.length];
      const b = ulaz[i];
      const aU = unutra(a, ivica, r);
      const bU = unutra(b, ivica, r);
      if (bU) {
        if (!aU) izlaz.push(presjek(a, b, ivica, r));
        izlaz.push(b);
      } else if (aU) {
        izlaz.push(presjek(a, b, ivica, r));
      }
    }
    ulaz = izlaz;
  }
  return ulaz;
}

/** Linija isjecena na pravougaonik; vraca nula ili vise komada. */
export function iseciLiniju(tacke, r) {
  const komadi = [];
  let tekuci = [];
  const uOkviru = (p) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];

  for (let i = 1; i < tacke.length; i++) {
    const a = tacke[i - 1];
    const b = tacke[i];
    const aU = uOkviru(a);
    const bU = uOkviru(b);
    if (aU && bU) {
      if (tekuci.length === 0) tekuci.push(a);
      tekuci.push(b);
      continue;
    }
    const dio = uOkvir(a, b, r);
    if (!dio) {
      if (tekuci.length > 1) komadi.push(tekuci);
      tekuci = [];
      continue;
    }
    if (aU) {
      if (tekuci.length === 0) tekuci.push(a);
      tekuci.push(dio[1]);
      komadi.push(tekuci);
      tekuci = [];
    } else if (bU) {
      if (tekuci.length > 1) komadi.push(tekuci);
      tekuci = [dio[0], b];
    } else {
      if (tekuci.length > 1) komadi.push(tekuci);
      tekuci = [];
      komadi.push([dio[0], dio[1]]);
    }
  }
  if (tekuci.length > 1) komadi.push(tekuci);
  return komadi;
}

/** Dio duzi `a`—`b` koji lezi u pravougaoniku (Liang–Barsky); `null` ako ga nema. */
function uOkvir(a, b, r) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - r[0], r[2] - a[0], a[1] - r[1], r[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1],
  ];
}

/** Povrsina prstena [m²], bez predznaka. */
export function povrsina(prsten) {
  let s = 0;
  for (let i = 0; i < prsten.length; i++) {
    const a = prsten[i];
    const b = prsten[(i + 1) % prsten.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}
