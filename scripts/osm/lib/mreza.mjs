/**
 * Dijeljenje jednog velikog upita na mrezu manjih.
 *
 * Zelenilo je preko 45 000 elemenata; jedan upit koji to trazi ili istekne ili
 * stigne kao stotinjak megabajta koje Overpass odbije da sastavi. Zato se okvir
 * dijeli, svaki dio se kesira zasebno, i ako jedan padne — ostali su vec tu.
 *
 * Elementi se spajaju po `id`-u: put koji lezi preko granice dva dijela stize
 * dva puta, cio, i drugi primjerak se odbacuje.
 */

import { upit } from "./overpass.mjs";

/** Okvir „jug,zapad,sjever,istok" u `n × m` dijelova. */
export function podijeli(okvir, n, m) {
  const [j, z, s, i] = okvir.split(",").map(Number);
  const dijelovi = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < m; c++) {
      dijelovi.push(
        [
          j + ((s - j) * r) / n,
          z + ((i - z) * c) / m,
          j + ((s - j) * (r + 1)) / n,
          z + ((i - z) * (c + 1)) / m,
        ]
          .map((v) => v.toFixed(4))
          .join(","),
      );
    }
  }
  return dijelovi;
}

/** Dokle se dio smije dalje dijeliti kad Overpass ne moze da ga sastavi. */
const NAJDUBLJE = 3;

/**
 * Posalji isti upit nad svakim dijelom mreze i spoji odgovore.
 *
 * `napravi(okvir)` vraca tekst upita za taj dio.
 *
 * Kad dio padne i poslije svih pokusaja, dijeli se na cetiri manja i pokusava
 * ponovo. Status 504 sa Overpassa ne znaci da veze nema nego da je upit preskup
 * da ga server sastavi u svom roku — a cetvrtina okvira je cetvrtina posla.
 * Deseti od sesnaest dijelova zelenila je pao bas tako; podijeljen prolazi.
 */
export async function poMrezi(ime, okvir, n, m, napravi) {
  const svi = new Map();
  let datum = null;

  const uzmi = async (oznaka, dio, dubina) => {
    try {
      const odgovor = await upit(oznaka, napravi(dio));
      datum ??= odgovor.osm3s?.timestamp_osm_base ?? null;
      for (const el of odgovor.elements) svi.set(`${el.type}/${el.id}`, el);
    } catch (e) {
      if (dubina >= NAJDUBLJE) throw e;
      console.log(`  ${oznaka}: ne prolazi (${e.message}); dijelim na cetiri`);
      const manji = podijeli(dio, 2, 2);
      for (const [k, d] of manji.entries()) {
        await uzmi(`${oznaka}-${k + 1}od4`, d, dubina + 1);
      }
    }
  };

  const dijelovi = podijeli(okvir, n, m);
  for (const [k, dio] of dijelovi.entries()) {
    await uzmi(`${ime}-${k + 1}od${dijelovi.length}`, dio, 0);
  }
  console.log(`  ${ime}: ukupno ${svi.size} razlicitih elemenata`);
  return { elements: [...svi.values()], datum };
}
