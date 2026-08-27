#!/usr/bin/env node
/**
 * Pravi JAVNI podskup kazni — samo ono što smije da vidi kandidat.
 *
 *   node scripts/gen-kazne-javne.mjs
 *
 * Pokreće se automatski prije svakog builda (`prebuild` u package.json), da se
 * ne može zaboraviti poslije izmjene podataka.
 *
 * ZAŠTO POSTOJI: `data/kazne.json` sadrži i nepotvrđene kazne — sa praznim ili
 * neprovjerenim iznosima. Ako ga komponenta uveze cijelog, sve to završi u
 * bundle-u i putuje korisniku, iako se ne iscrtava. Provjereno testom: naslov
 * nepotvrđene kazne se našao u `634-*.js` koji browser stvarno povuče.
 *
 * Zato prikaz čita iz `data/javno/`, gdje nepotvrđenih nema uopšte.
 */

import fs from "node:fs";
import path from "node:path";

const ULAZ_KAZNE = path.join("data", "kazne.json");
const ULAZ_VEZA = path.join("data", "pitanje-kazna.json");
const IZLAZ = path.join("data", "javno");

if (!fs.existsSync(ULAZ_KAZNE) || !fs.existsSync(ULAZ_VEZA)) {
  console.error(`Nema ${ULAZ_KAZNE} ili ${ULAZ_VEZA} — pokreni prvo scripts/migriraj-kazne.mjs.`);
  process.exit(1);
}

const biblioteka = JSON.parse(fs.readFileSync(ULAZ_KAZNE, "utf8"));
const veza = JSON.parse(fs.readFileSync(ULAZ_VEZA, "utf8"));

const potvrdjene = biblioteka.kazne.filter((k) => k.status === "potvrdjeno");
const idPotvrdjenih = new Set(potvrdjene.map((k) => k.id));

// U javnu vezu ulaze samo pitanja koja pokazuju na POTVRĐENU kaznu. Pitanja
// bez kazne i nepregledana se izostavljaju — kandidatu su ionako ista stvar
// (ništa se ne prikazuje), a fajl ostaje mali.
const javnaVeza = {};
for (const [pid, stanje] of Object.entries(veza)) {
  if (stanje.pregledano && stanje.kazna_id && idPotvrdjenih.has(stanje.kazna_id)) {
    javnaVeza[pid] = stanje.kazna_id;
  }
}

fs.mkdirSync(IZLAZ, { recursive: true });
fs.writeFileSync(
  path.join(IZLAZ, "kazne.json"),
  JSON.stringify(
    { pregledao: biblioteka.pregledao, azurirano: biblioteka.azurirano, kazne: potvrdjene },
    null,
    2,
  ) + "\n",
  "utf8",
);
fs.writeFileSync(path.join(IZLAZ, "pitanje-kazna.json"), JSON.stringify(javnaVeza, null, 2) + "\n", "utf8");

console.log(
  `data/javno/: ${potvrdjene.length} od ${biblioteka.kazne.length} kazni (samo potvrđene), ` +
    `${Object.keys(javnaVeza).length} od ${Object.keys(veza).length} pitanja sa kaznom`,
);
