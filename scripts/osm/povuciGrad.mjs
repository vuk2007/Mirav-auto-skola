/**
 * Preuzimanje podataka za jedan grad (faza 6) u `.cache/`.
 *
 * Pokretanje: `npm run osm:grad:povuci -- podgorica`. Ručno, nikad u build-u.
 * Kao i `povuci.mjs`, ovdje se ništa ne obrađuje — sirovi odgovori se samo
 * spuštaju na disk, a obrada (`pripremiGrad.mjs`) se ponavlja koliko treba.
 *
 * Podaci: © OpenStreetMap contributors, ODbL.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KES } from "./lib/overpass.mjs";
import { poMrezi } from "./lib/mreza.mjs";
import { GRADOVI } from "./gradovi.mjs";
import * as U from "./upitiGrad.mjs";

const kljuc = process.argv[2];
const grad = GRADOVI[kljuc];
if (!grad) {
  console.error(`Nepoznat grad „${kljuc}". Poznati: ${Object.keys(GRADOVI).join(", ")}`);
  process.exit(1);
}

/** Na koliko dijelova se okvir dijeli po upitu — zgrade su najveće. */
const MREZA = { ulice: [2, 2], pravila: [1, 1], zgrade: [3, 3], povrsine: [2, 2], objekti: [1, 1] };

await mkdir(KES, { recursive: true });
const izvor = { grad: kljuc, okvir: grad.okvir, datumi: {}, broj: {} };
for (const ime of Object.keys(MREZA)) {
  console.log(`${grad.ime} — ${ime}:`);
  const [n, m] = MREZA[ime];
  const r = await poMrezi(`grad-${kljuc}-${ime}`, grad.okvir, n, m, U[ime]);
  izvor.datumi[ime] = r.datum;
  izvor.broj[ime] = r.elements.length;
  const put = join(KES, `grad-${kljuc}-${ime}.json`);
  const tekst = JSON.stringify({ elements: r.elements });
  await writeFile(put, tekst);
  console.log(`  → ${put.split(/[\\/]/).pop()} (${r.elements.length} elemenata, ${(tekst.length / 1048576).toFixed(1)} MB)`);
}
await writeFile(join(KES, `grad-${kljuc}-izvor.json`), JSON.stringify(izvor, null, 2));
console.log(JSON.stringify(izvor, null, 2));
