/**
 * Sporedni putevi koji se prikljucuju na ivicu.
 *
 * Prikljucak je cvor rute iz kojeg vodi bar jos jedan put koji nije sama ruta:
 * tu vozilo sa magistrale skrece, ili se na nju ukljucuje. OSM ga ne oznacava
 * posebno — raskrsnica je u podacima samo zajednicki cvor dva puta — pa se
 * cita iz mreze: svaki susjed cvora rute koji i sam nije na ruti je jedan
 * sporedni put.
 *
 * Strana se racuna u smjeru ivice (od `a` prema `b`): vektorski proizvod
 * pravca rute i pravca sporednog puta. Koordinate su UTM, x na istok i y na
 * sjever, pa je pozitivan proizvod lijevo.
 *
 * STA NIJE PRIKLJUCAK, iako u podacima tako izgleda. Izmjereno na svih 54
 * ivica: od 943 grane, 388 nosi istu oznaku puta kao sama ruta, a uglovi imaju
 * tri vrha — oko 90 stepeni, i blizu 0 i 180. Ove druge su druga kolovozna
 * traka istog puta koja se odvaja ili spaja, i ulivne trake uz nju; one su
 * gotovo sve jednosmjerne. Zato se odbacuje:
 *  - grana sa istom oznakom puta (`ref`) kao ruta u tom cvoru, i
 *  - jednosmjerna grana koja ide skoro paralelno sa rutom (`PARALELNO`).
 * Dvosmjeran put pod ostrim uglom ostaje — to je obicno pravi put koji se
 * racva u obliku slova Y.
 *
 * Podaci: (c) OpenStreetMap contributors, ODbL.
 */

/** Ugao do kojeg se jednosmjerna grana smatra paralelnom sa rutom [rad]. */
const PARALELNO = (35 * Math.PI) / 180;

/**
 * Prikljucci duz rute ivice.
 *
 * `cvorovi` su OSM cvorovi rute, redom od `a` prema `b`; `s` je predjena duzina
 * po tim cvorovima, dakle ista mjera po kojoj se racuna i `duzinaM` ivice.
 *
 * Bliski prikljucci na istoj strani se spajaju (`spoji` metara): jedna
 * raskrsnica u podacima umije biti dva-tri cvora, a kruzni tok i vise.
 * Zadrzava se krupniji put, jer se po njemu raskrsnica i prepoznaje.
 *
 * `putevi` su OSM putevi rute (`putevi[i]` vodi od cvora `i` do `i + 1`), a
 * `opis(wayId)` vraca `{ ref, jednosmjeran }` za bilo koji put u mrezi.
 *
 * `sporedna` je druga mreza, samo za susjede: seoski i stambeni putevi ne ulaze
 * u trazenje rute, ali se po njima vidi gdje na nju izlaze.
 */
export function prikljucci(
  mreza,
  cvorovi,
  {
    spoji = 30,
    odKraja = 0,
    putevi = [],
    opis = () => ({ ref: "", jednosmjeran: false }),
    sporedna = null,
  } = {},
) {
  const tacka = (id) => mreza.tacke.get(id) ?? sporedna?.tacke.get(id);
  const susjedi = (id) => [...(mreza.susjedi.get(id) ?? []), ...(sporedna?.susjedi.get(id) ?? [])];
  const naRuti = new Set(cvorovi);
  const sirovi = [];
  let s = 0;
  const ukupno = (() => {
    let d = 0;
    for (let i = 1; i < cvorovi.length; i++) {
      const a = mreza.tacke.get(cvorovi[i - 1]);
      const b = mreza.tacke.get(cvorovi[i]);
      d += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return d;
  })();

  for (let i = 1; i < cvorovi.length - 1; i++) {
    const a = mreza.tacke.get(cvorovi[i - 1]);
    const p = mreza.tacke.get(cvorovi[i]);
    const b = mreza.tacke.get(cvorovi[i + 1]);
    s += Math.hypot(p.x - a.x, p.y - a.y);
    if (s < odKraja || s > ukupno - odKraja) continue;
    // Pravac rute u cvoru: od prethodnog ka sljedecem, da jedan kratak
    // segment digitalizacije ne okrene stranu.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Oznake puta kojim ruta ulazi u cvor i izlazi iz njega.
    const refRute = new Set(
      [putevi[i - 1], putevi[i]].filter((w) => w !== undefined).map((w) => opis(w).ref).filter(Boolean),
    );
    for (const [drugi, , , wayId, rang] of susjedi(cvorovi[i])) {
      if (naRuti.has(drugi)) continue;
      const q = tacka(drugi);
      if (!q) continue;
      const proizvod = dx * (q.y - p.y) - dy * (q.x - p.x);
      if (proizvod === 0) continue;
      const grana = opis(wayId);
      if (grana.ref && refRute.has(grana.ref)) continue;
      if (grana.jednosmjeran) {
        const skalar = dx * (q.x - p.x) + dy * (q.y - p.y);
        const ugao = Math.abs(Math.atan2(proizvod, skalar));
        if (ugao < PARALELNO || ugao > Math.PI - PARALELNO) continue;
      }
      sirovi.push({ s, strana: proizvod > 0 ? "lijevo" : "desno", rang });
    }
  }

  const RED = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential"];
  const krupniji = (x, y) => RED.indexOf(x) < RED.indexOf(y);
  const out = [];
  for (const k of sirovi) {
    const blizu = out.find((o) => o.strana === k.strana && Math.abs(o.s - k.s) < spoji);
    if (blizu) {
      if (krupniji(k.rang, blizu.rang)) blizu.rang = k.rang;
      continue;
    }
    out.push({ ...k });
  }
  return out.map((o) => ({ s: Math.round(o.s), strana: o.strana, rang: o.rang }));
}
