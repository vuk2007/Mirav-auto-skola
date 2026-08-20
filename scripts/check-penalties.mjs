#!/usr/bin/env node
/**
 * Poredi naš katalog kazni (`lib/penalties.ts`) sa referentnim spiskom
 * (`references/kazne-zobs-2026-08.json`) i ispisuje gdje se razilaze.
 *
 *   node scripts/check-penalties.mjs
 *
 * Zašto skripta a ne jednokratno poređenje: obje strane su neprovjerene i obje
 * će se mijenjati kad MIRAV dobije prečišćen tekst. Ovako se poređenje ponovi
 * jednom komandom umjesto da se radi napamet.
 *
 * VAŽNO: ovo poredi dva NEPROVJERENA izvora. Poklapanje ne znači da je iznos
 * tačan — znači samo da se dva izvora slažu. Mjerodavan je Službeni list.
 */

import fs from "node:fs";
import path from "node:path";

const REF = path.join("references", "kazne-zobs-2026-08.json");
const OURS = path.join("lib", "penalties.ts");

/**
 * Veza naš id → id u referentnom spisku. `null` znači da referentni spisak taj
 * prekršaj uopšte nema (njihova lista je nepotpuna i sami to navode u
 * `poznate_rupe`). Za brzinu se porede nivoi posebno.
 */
const MAPPING = {
  telefon: "putnici-02",
  "dijete-naprijed": "putnici-04",
  crveno: "tezi-01",
  pojas: "putnici-01",
  "dijete-sjediste": "putnici-03",
  alkohol: "alkohol-02",
  parkiranje: "parking-01",
  policija: "tezi-02",
  "vozilo-neispravno": "vozilo-02",
  "vozacka-dozvola": "vozilo-03",
  pjesak: "pjesaci-01",
  biciklista: "pjesaci-02",
  "radar-ometac": "vozilo-05",
  // Ostalo referentni spisak nema:
  prvenstvo: null,
  "pjesacki-prelaz": null,
  "preticanje-opasno": null,
  preticanje: null,
  unazad: null,
  signalizacija: null,
  vuca: null,
  teret: null,
  svjetla: null,
  prsluk: null,
  "zimska-oprema": null,
  "prva-pomoc": null,
  kaciga: null,
  pruga: null,
  autoput: null,
  mimoilazenje: null,
  skretanje: null,
  "zvucni-znak": null,
  "prevoz-lica": null,
  "kolona-pjesaka": null,
  nezgoda: null,
  "desna-strana": null,
  ukljucivanje: null,
  rastojanje: null,
  "ometanje-vozaca": null,
};

/** Nivoi našeg prekršaja „brzina" → id u referentnom spisku. */
const SPEED_TIERS = {
  "do 10 km/h": "brzina-01",
  "10–20 km/h": "brzina-02",
  "20–30 km/h": "brzina-03",
  "30–50 km/h": "brzina-04",
  "50–70 km/h": "brzina-06",
  "preko 70 u naselju / 90 van naselja": "brzina-07",
};

// ── čitanje našeg kataloga ────────────────────────────────────────────────
// penalties.ts je TypeScript; umjesto prevođenja se čitaju iznosi regexom, jer
// je oblik fajla ustaljen i provjerava se samo par polja.
const src = fs.readFileSync(OURS, "utf8");
const ours = [];
for (const block of src.split(/\n  \{\n/).slice(1)) {
  const id = block.match(/^\s*id: "([^"]+)"/m)?.[1];
  if (!id) continue;
  const label = block.match(/label: t\(\s*\n\s*"([^"]+)"/)?.[1] ?? id;
  const tiers = [];
  for (const m of block.matchAll(/minEur: (\d+),\s*\n\s*maxEur: (\d+),/g)) {
    tiers.push({ minEur: Number(m[1]), maxEur: Number(m[2]), label: null });
  }
  for (const m of block.matchAll(/one\((\d+), (\d+),/g)) {
    tiers.push({ minEur: Number(m[1]), maxEur: Number(m[2]), label: null });
  }
  const tierLabels = [...block.matchAll(/label: t\("([^"]+)",[^)]*\),\s*\n\s*minEur/g)].map(
    (m) => m[1],
  );
  tierLabels.forEach((l, i) => {
    if (tiers[i]) tiers[i].label = l;
  });
  ours.push({ id, label, tiers, amended: /amended: true/.test(block) });
}

const ref = JSON.parse(fs.readFileSync(REF, "utf8"));
const refById = new Map(ref.kazne.map((k) => [k.id, k]));

const eur = (lo, hi) => (lo === null || hi === null ? "—" : lo === hi ? `${lo} €` : `${lo}–${hi} €`);

const rows = [];
const push = (naseIme, nase, refId) => {
  const r = refId ? refById.get(refId) : null;
  if (!refId) {
    rows.push({ stanje: "NEMA U IZVORU", naseIme, nase: eur(nase.minEur, nase.maxEur), ref: "—", refId: "—", status: "—" });
    return;
  }
  if (!r) {
    rows.push({ stanje: "GREŠKA MAPE", naseIme, nase: eur(nase.minEur, nase.maxEur), ref: "?", refId, status: "?" });
    return;
  }
  const refima = r.min_eur !== null && r.max_eur !== null;
  const stanje = !refima
    ? "IZVOR BEZ IZNOSA"
    : r.min_eur === nase.minEur && r.max_eur === nase.maxEur
      ? "POKLAPA SE"
      : "RAZILAZI SE";
  rows.push({
    stanje,
    naseIme,
    nase: eur(nase.minEur, nase.maxEur),
    ref: eur(r.min_eur, r.max_eur),
    refId,
    status: r.status,
  });
};

for (const p of ours) {
  if (p.id === "brzina") {
    for (const tier of p.tiers) {
      push(`brzina · ${tier.label ?? "?"}`, tier, SPEED_TIERS[tier.label ?? ""] ?? null);
    }
    continue;
  }
  const refId = Object.prototype.hasOwnProperty.call(MAPPING, p.id) ? MAPPING[p.id] : undefined;
  if (refId === undefined) {
    rows.push({ stanje: "NIJE MAPIRANO", naseIme: p.id, nase: "?", ref: "?", refId: "?", status: "?" });
    continue;
  }
  push(p.id, p.tiers[0] ?? { minEur: null, maxEur: null }, refId);
}

const order = { "RAZILAZI SE": 0, "IZVOR BEZ IZNOSA": 1, "POKLAPA SE": 2, "NEMA U IZVORU": 3, "NIJE MAPIRANO": 4, "GREŠKA MAPE": 5 };
rows.sort((a, b) => order[a.stanje] - order[b.stanje] || a.naseIme.localeCompare(b.naseIme));

const w = (s, n) => String(s).padEnd(n);
console.log(`Naš katalog: ${ours.length} prekršaja  |  referentni spisak: ${ref.kazne.length} stavki`);
console.log(`Referentni spisak važi od ${ref.meta.vazi_od}, generisan ${ref.meta.generisano}.\n`);
console.log(w("STANJE", 18) + w("NAŠ PREKRŠAJ", 34) + w("NAŠ IZNOS", 14) + w("IZVOR", 14) + w("ID", 13) + "STATUS U IZVORU");
console.log("─".repeat(125));
for (const r of rows) {
  console.log(w(r.stanje, 18) + w(r.naseIme, 34) + w(r.nase, 14) + w(r.ref, 14) + w(r.refId, 13) + r.status);
}

const tally = {};
for (const r of rows) tally[r.stanje] = (tally[r.stanje] ?? 0) + 1;
console.log("\nZbir: " + Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(" · "));

// Šta referentni spisak ima, a mi nemamo.
const mapped = new Set(Object.values(MAPPING).filter(Boolean).concat(Object.values(SPEED_TIERS).filter(Boolean)));
const missing = ref.kazne.filter((k) => !mapped.has(k.id));
console.log(`\nU izvoru, a nemamo (${missing.length}):`);
for (const k of missing) {
  console.log(`  ${w(k.id, 13)}${w(eur(k.min_eur, k.max_eur), 14)}${k.prekrsaj}`);
}

const potvrdjeno = ref.kazne.filter((k) => k.status === "potvrdjeno_sluzbeni_list").length;
console.log(
  `\nNapomena: u referentnom spisku je ${potvrdjeno} od ${ref.kazne.length} stavki potvrđeno ` +
    `iz Službenog lista. Poklapanje dva neprovjerena izvora nije potvrda tačnosti.`,
);
