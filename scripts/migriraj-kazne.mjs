#!/usr/bin/env node
/**
 * Korak 2.3 — prebacuje stari katalog kazni u novu shemu.
 *
 *   node scripts/migriraj-kazne.mjs
 *
 * Pravi `data/kazne.json` i `data/pitanje-kazna.json` iz `lib/penalties.ts` i
 * `lib/penaltyMap.ts`. Pokreće se JEDNOM; poslije toga oba fajla uređuje
 * instruktorka kroz `/admin/kazne`, pa skripta odbija da prepiše postojeće
 * fajlove osim uz `--prepisi`.
 *
 * DVIJE ODLUKE KOJE TREBA RAZUMJETI:
 *
 * 1. **Iznosi kreću PRAZNI.** Stari iznos ide u `napomena` kao „ranija
 *    vrijednost (neprovjereno)". Da su prepisani u `iznos_min`/`iznos_max`,
 *    kroz sto unosa bi se samo kliktalo „potvrdi" na brojeve koje niko nije
 *    provjerio — a upravo to je problem koji se rješava.
 *
 * 2. **Višestepene kazne se razdvajaju.** Stari unos „brzina" je imao 6 nivoa
 *    u jednom zapisu; nova shema ima jedan raspon po unosu, pa nastaje 6
 *    zasebnih kazni („brzina-do-10-km-h", …). Time pitanje može pokazati na
 *    tačan nivo umjesto na cijelu ljestvicu.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const IZVOR = path.join("lib", "penalties.ts");
const MAPA = path.join("lib", "penaltyMap.ts");
const PITANJA = path.join("public", "questions.json");
const IZLAZ_KAZNE = path.join("data", "kazne.json");
const IZLAZ_VEZA = path.join("data", "pitanje-kazna.json");
const prepisi = process.argv.includes("--prepisi");

if (!prepisi && (fs.existsSync(IZLAZ_KAZNE) || fs.existsSync(IZLAZ_VEZA))) {
  console.error(
    `${IZLAZ_KAZNE} ili ${IZLAZ_VEZA} već postoji.\n` +
      "Migracija se pokreće jednom — dalje uređuje instruktorka kroz /admin/kazne.\n" +
      "Ako stvarno želiš da prepišeš i izgubiš njen rad: --prepisi",
  );
  process.exit(1);
}

// ── kategorije za stare id-eve ───────────────────────────────────────────────
const KATEGORIJA = {
  brzina: "Brzina",
  alkohol: "Alkohol i psihoaktivne materije",
  prvenstvo: "Prvenstvo prolaza",
  "pjesacki-prelaz": "Pješaci i biciklisti",
  pjesak: "Pješaci i biciklisti",
  biciklista: "Pješaci i biciklisti",
  "kolona-pjesaka": "Pješaci i biciklisti",
  preticanje: "Preticanje i mimoilaženje",
  "preticanje-opasno": "Preticanje i mimoilaženje",
  mimoilazenje: "Preticanje i mimoilaženje",
  signalizacija: "Saobraćajna signalizacija",
  crveno: "Saobraćajna signalizacija",
  policija: "Saobraćajna signalizacija",
  parkiranje: "Parkiranje i zaustavljanje",
  pojas: "Oprema i putnici",
  "dijete-naprijed": "Oprema i putnici",
  "dijete-sjediste": "Oprema i putnici",
  kaciga: "Oprema i putnici",
  prsluk: "Oprema i putnici",
  "prevoz-lica": "Oprema i putnici",
  "ometanje-vozaca": "Oprema i putnici",
  "vozacka-dozvola": "Dokumenta i vozilo",
  "vozilo-neispravno": "Dokumenta i vozilo",
  "zimska-oprema": "Dokumenta i vozilo",
  "radar-ometac": "Dokumenta i vozilo",
  vuca: "Dokumenta i vozilo",
  teret: "Dokumenta i vozilo",
  svjetla: "Svjetla i vidljivost",
  "zvucni-znak": "Svjetla i vidljivost",
  nezgoda: "Saobraćajna nezgoda",
  "prva-pomoc": "Saobraćajna nezgoda",
};

/** Slug iz teksta — mora se poklapati sa `naslovUSlug` u lib/kazne.ts. */
function slug(s) {
  return s
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── čitanje starog kataloga ──────────────────────────────────────────────────
// penalties.ts je TypeScript; čita se regexom jer je oblik fajla ustaljen, a
// prevođenje cijelog modula radi jednokratne migracije ne bi se isplatilo.
const src = fs.readFileSync(IZVOR, "utf8");
const stari = [];
for (const blok of src.split(/\n  \{\n/).slice(1)) {
  const id = blok.match(/^\s*id: "([^"]+)"/m)?.[1];
  if (!id) continue;
  const naslov = blok.match(/label: t\(\s*\n\s*"([^"]+)"/)?.[1] ?? id;
  const izvor = /amended: true/.test(blok)
    ? "izmjene ZoBS-a od 7. 8. 2026 (medijski izvor, NIJE Službeni list)"
    : "ZoBS, prečišćen tekst (čl. 319–326)";

  const nivoi = [];
  // Traži se SAMO unutar `tiers: [ … ]`. Bez toga prvi pogodak bude spoljni
  // `label:` samog prekršaja (jer i on odgovara obrascu), pa najniži nivo
  // brzine dobije naslov cijelog prekršaja umjesto svoje oznake „do 10 km/h".
  const pocetak = blok.indexOf("tiers: [");
  const tiersBlok = pocetak >= 0 ? blok.slice(pocetak, blok.indexOf("\n    ],", pocetak)) : "";

  // `t(` je kod nekih nivoa u istom redu kao natpis, a kod nekih prelomljen u
  // sljedeći — najviši nivo brzine je prelomljen, pa ga regex bez `\s*` gubi.
  for (const m of tiersBlok.matchAll(
    /label: t\(\s*"([^"]+)",[\s\S]*?minEur: (\d+),\s*\n\s*maxEur: (\d+),\s*\n\s*article: "([^"]+)"/g,
  )) {
    nivoi.push({ oznaka: m[1], min: Number(m[2]), max: Number(m[3]), clan: m[4] });
  }
  // Prekršaji sa jednim rasponom koriste skraćenicu `one(min, max, član)`.
  for (const m of blok.matchAll(/one\((\d+), (\d+), "([^"]+)"\)/g)) {
    nivoi.push({ oznaka: null, min: Number(m[1]), max: Number(m[2]), clan: m[3] });
  }
  stari.push({ id, naslov, izvor, nivoi });
}
console.log(`iz ${IZVOR}: ${stari.length} prekršaja, ${stari.reduce((n, x) => n + x.nivoi.length, 0)} raspona`);

// ── nova biblioteka ──────────────────────────────────────────────────────────
const kazne = [];
const staroNovo = {}; // stari id → [novi id…], za prevođenje mape pitanja

for (const s of stari) {
  const viseNivoa = s.nivoi.length > 1;
  staroNovo[s.id] = [];
  for (const n of s.nivoi) {
    const noviId = viseNivoa && n.oznaka ? `${s.id}-${slug(n.oznaka)}` : s.id;
    kazne.push({
      id: noviId,
      kategorija: KATEGORIJA[s.id] ?? "Ostalo",
      naslov: viseNivoa && n.oznaka ? `${s.naslov} — ${n.oznaka}` : s.naslov,
      objasnjenje: "",
      // NAMJERNO prazno — vidi napomenu na vrhu fajla.
      iznos_min: null,
      iznos_max: null,
      kazneni_poeni: null,
      zabrana_upravljanja: null,
      clan: n.clan,
      izvor: s.izvor,
      status: "nepotvrdjeno",
      potvrdio: "",
      potvrdjeno_dana: "",
      napomena: `ranija vrijednost (neprovjereno): ${n.min}–${n.max} EUR`,
    });
    staroNovo[s.id].push(noviId);
  }
}

// ── veza pitanje → kazna ─────────────────────────────────────────────────────
const mapaSrc = fs.readFileSync(MAPA, "utf8");
const staraVeza = {};
for (const m of mapaSrc.matchAll(/^\s*(\d+): (null|"([^"]+)"),/gm)) {
  staraVeza[Number(m[1])] = m[3] ?? null;
}

const pitanja = JSON.parse(fs.readFileSync(PITANJA, "utf8"));
const veza = {};
let saPrijedlogom = 0;
for (const q of pitanja) {
  const staroId = staraVeza[q.id] ?? null;
  const kandidati = staroId ? (staroNovo[staroId] ?? []) : [];
  // Kod višestepenih (brzina, rastojanje) se NE pogađa nivo — instruktorka bira.
  const prijedlog = kandidati.length === 1 ? kandidati[0] : null;
  if (prijedlog) saPrijedlogom += 1;
  veza[String(q.id)] = {
    // Prijedlog iz stare mape je samo polazna tačka; `pregledano` ostaje false
    // dok instruktorka ne potvrdi, pa se prijedlog nikad ne prikazuje kandidatu.
    kazna_id: prijedlog,
    bez_kazne: false,
    pregledano: false,
  };
}

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(
  IZLAZ_KAZNE,
  JSON.stringify({ pregledao: "", azurirano: new Date().toISOString().slice(0, 10), kazne }, null, 2) + "\n",
  "utf8",
);
fs.writeFileSync(IZLAZ_VEZA, JSON.stringify(veza, null, 2) + "\n", "utf8");

const bezPrijedloga = pitanja.length - saPrijedlogom;
console.log(`\nupisano ${IZLAZ_KAZNE}  — ${kazne.length} kazni, sve \`nepotvrdjeno\`, svi iznosi prazni`);
console.log(`upisano ${IZLAZ_VEZA} — ${pitanja.length} pitanja, sva \`pregledano: false\``);
console.log(`   sa prijedlogom kazne iz stare mape: ${saPrijedlogom}`);
console.log(`   bez prijedloga (višestepene i nemapirana): ${bezPrijedloga}`);
console.log(`\nPrijedlog NIJE potvrda — dok je \`pregledano: false\`, kandidatu se ne prikazuje ništa.`);
