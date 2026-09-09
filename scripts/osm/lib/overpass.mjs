/**
 * Preuzimanje sa Overpass API-ja, sa kesiranjem na disk.
 *
 * Tri pravila:
 *  - Svaki odgovor se pamti u `.cache/` po otisku upita. Isti upit se drugi put
 *    ne salje. Overpass je tudji, besplatan i ogranicen servis; skripta koja ga
 *    gadja svaki put kad je neko pokrene je zloupotreba.
 *  - Ogledala se probaju redom i tek kad prvo padne. Ne paralelno.
 *  - Izmedju pokusaja se ceka. Bez toga se od 429 pravi 429 u petlji.
 *
 * Podaci: © OpenStreetMap contributors, ODbL.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OVDJE = dirname(fileURLToPath(import.meta.url));
export const KES = join(OVDJE, "..", ".cache");

/**
 * Ogledala, redom kojim se probaju.
 *
 * `overpass.osm.ch` je namjerno IZOSTAVLJEN iako radi i odgovara za pola
 * sekunde: to je svajcarski izvod baze, pa na svaki upit o Crnoj Gori vrati
 * nula elemenata i status 200. Skripta bi „uspjesno" povukla prazan svijet.
 * Izmjereno, ne pretpostavljeno — zato i stoji zapisano.
 */
const OGLEDALA = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Overpass odbija zahtjeve bez razumnog potpisa sa 406. */
const POTPIS = "mirav-auto-skola/1.0 (igra Prodji raskrsnicu; kontakt preko github.com/vuk2007)";

const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));

/** Koliko puta se prodje kroz sva ogledala prije nego sto se odustane. */
const KRUGOVA = 4;
/** Gornja granica cekanja izmedju krugova [ms]. */
const NAJDUZE_CEKANJE = 120000;

/** Otisak upita — ime fajla u kesu. */
const otisak = (upit) => createHash("sha1").update(upit).digest("hex").slice(0, 16);

/**
 * Posalji upit i vrati razlozen JSON.
 *
 * `ime` sluzi samo citljivosti kesa i porukama; otisak je taj koji odlucuje.
 */
export async function upit(ime, tekst, { svjeze = false } = {}) {
  await mkdir(KES, { recursive: true });
  const put = join(KES, `${ime}-${otisak(tekst)}.json`);
  if (!svjeze && existsSync(put)) {
    const sadrzaj = JSON.parse(await readFile(put, "utf8"));
    console.log(`  ${ime}: iz kesa (${sadrzaj.elements.length} elemenata)`);
    return sadrzaj;
  }

  let posljednja = null;
  for (let pokusaj = 0; pokusaj < OGLEDALA.length * KRUGOVA; pokusaj++) {
    const url = OGLEDALA[pokusaj % OGLEDALA.length];
    const pocetak = Date.now();
    try {
      const odgovor = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": POTPIS,
        },
        body: new URLSearchParams({ data: tekst }),
        signal: AbortSignal.timeout(600000),
      });
      if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
      const tekstOdgovora = await odgovor.text();
      // Overpass javlja gresku kao HTML sa statusom 200 — zato provjera oblika,
      // a ne samo statusa.
      if (!tekstOdgovora.trimStart().startsWith("{")) {
        const greska = /Error<\/strong>: ([^<]+)/.exec(tekstOdgovora);
        throw new Error(greska ? greska[1].trim() : "odgovor nije JSON");
      }
      const sadrzaj = JSON.parse(tekstOdgovora);
      await writeFile(put, JSON.stringify(sadrzaj));
      const sek = ((Date.now() - pocetak) / 1000).toFixed(1);
      console.log(
        `  ${ime}: ${sadrzaj.elements.length} elemenata za ${sek} s (${new URL(url).host})`,
      );
      return sadrzaj;
    } catch (e) {
      posljednja = e;
      // Cekanje raste sa svakim krugom kroz ogledala, do gornje granice: 504
      // znaci da je server zauzet, a navaljivanje na sekundu ga ne oslobadja.
      const krug = Math.floor(pokusaj / OGLEDALA.length);
      const cekanje = Math.min(NAJDUZE_CEKANJE, 5000 * 2 ** krug);
      console.log(`  ${ime}: ${new URL(url).host} — ${e.message}; cekam ${cekanje / 1000} s`);
      await cekaj(cekanje);
    }
  }
  throw new Error(`${ime}: nijedno ogledalo nije odgovorilo (${posljednja?.message})`);
}

/** Datum stanja baze iz odgovora — ide u zapis o izvoru. */
export const datumIzvora = (odgovor) => odgovor.osm3s?.timestamp_osm_base ?? null;
