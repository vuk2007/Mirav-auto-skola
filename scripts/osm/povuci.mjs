/**
 * Korak 1: preuzimanje podataka sa Overpass API-ja u `.cache/`.
 *
 * Pokretanje: `npm run osm:povuci`. Rucno, nikad u build-u — podaci se mijenjaju
 * sporo, a Overpass je tudji servis.
 *
 * Ovdje se nista ne obradjuje: sirovi odgovori se samo spustaju na disk. Razlog
 * je prakticne prirode — preuzimanje traje desetak minuta, a obrada se mijenja
 * i ponavlja svaki cas. Da su spojeni, svaka izmjena u obradi znacila bi novo
 * preuzimanje.
 *
 * Podaci: © OpenStreetMap contributors, ODbL.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NODES } from "./lib/graf.mjs";
import { KES, upit } from "./lib/overpass.mjs";
import { poMrezi } from "./lib/mreza.mjs";
import * as U from "./upiti.mjs";

/** Poluprecnik oko centra opstine u kojem se povlace gradske ulice [m]. */
const GRAD_POLUPRECNIK = 2500;

/** Opstine — samo one imaju gradsku voznju, pa samo oko njih trebaju ulice. */
const OPSTINE = NODES.filter((n) => n.kind === "opstina");

const spasi = async (ime, sadrzaj) => {
  const put = join(KES, `${ime}.json`);
  await writeFile(put, JSON.stringify(sadrzaj));
  const mb = (JSON.stringify(sadrzaj).length / 1048576).toFixed(1);
  console.log(`  → ${ime}.json (${sadrzaj.elements.length} elemenata, ${mb} MB)`);
};

async function glavno() {
  await mkdir(KES, { recursive: true });
  const datumi = {};

  console.log("Putevi (magistrale, regionalni, kruzni tokovi):");
  const putevi = await poMrezi("putevi", U.OKVIR, 3, 3, U.putevi);
  datumi.putevi = putevi.datum;
  await spasi("putevi", putevi);

  console.log("Gradske ulice:");
  const ulice = await upit("ulice", U.ulice(OPSTINE, GRAD_POLUPRECNIK));
  datumi.ulice = ulice.osm3s?.timestamp_osm_base ?? null;
  await spasi("ulice", ulice);

  console.log("Voda:");
  const voda = await poMrezi("voda", U.OKVIR, 2, 2, U.voda);
  datumi.voda = voda.datum;
  await spasi("voda", voda);

  console.log("Zelenilo i namjena zemljista:");
  const zelenilo = await poMrezi("zelenilo", U.OKVIR, 4, 4, U.zelenilo);
  datumi.zelenilo = zelenilo.datum;
  await spasi("zelenilo", zelenilo);

  console.log("Vrhovi:");
  const vrhovi = await upit("vrhovi", U.vrhovi());
  datumi.vrhovi = vrhovi.osm3s?.timestamp_osm_base ?? null;
  await spasi("vrhovi", vrhovi);

  console.log("Drzavna granica:");
  const granica = await upit("granica", U.granica());
  datumi.granica = granica.osm3s?.timestamp_osm_base ?? null;
  await spasi("granica", granica);

  await writeFile(
    join(KES, "izvor.json"),
    JSON.stringify(
      {
        izvor: "OpenStreetMap",
        licenca: "ODbL 1.0",
        napomena: "Podaci o putevima i okolini: © OpenStreetMap contributors (ODbL)",
        preuzeto: new Date().toISOString(),
        stanjeBaze: datumi,
        okvir: U.OKVIR,
        gradPoluprecnik: GRAD_POLUPRECNIK,
      },
      null,
      2,
    ),
  );
  console.log("\nGotovo. Sljedeci korak: npm run osm:pripremi");
}

await glavno();
