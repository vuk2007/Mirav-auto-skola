#!/usr/bin/env node
/**
 * Generiše `lib/penaltyMap.ts` — vezu pitanje → prekršaj iz `lib/penalties.ts`.
 *
 * Zašto generator a ne ručna tabela od 421 reda: pravila se mogu pročitati i
 * osporiti („zašto je ovo pitanje svrstano pod parkiranje"), a rezultat je
 * eksplicitan fajl koji MIRAV može pregledati red po red i ručno ispraviti
 * preko `OVERRIDES` ispod. Aplikacija ne radi nikakvo poklapanje po riječima —
 * ona samo čita gotovu tabelu.
 *
 *   node scripts/gen-penalty-map.mjs            # upiši lib/penaltyMap.ts
 *   node scripts/gen-penalty-map.mjs --report   # ispiši raspodjelu, bez upisa
 *
 * ⚠️ Veza pitanja i prekršaja je stručna procjena, ne pravni stav. Vidi
 * napomenu na vrhu lib/penalties.ts.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const QUESTIONS = path.join("public", "questions.json");
const OUT = path.join("lib", "penaltyMap.ts");
const report = process.argv.includes("--report");

/**
 * Ručne ispravke — imaju prednost nad pravilima. Ovdje ide sve što pravila
 * pogrešno svrstaju; `null` znači „ovo pitanje nema odgovarajući prekršaj".
 */
const OVERRIDES = {
  85: "radar-ometac", // uređaj za ometanje mjerenja brzine
  95: "prva-pomoc", // broj hitne pomoći
  405: "prva-pomoc", // broj policije
  411: "prva-pomoc", // broj vatrogasaca
  416: "alkohol",
  83: "ometanje-vozaca", // putnik koji ometa vozača — čl. 322 st. 1 t. 5
  63: null, // definicija „mladi vozač" — nije prekršaj
  75: null, // uslovi za izdavanje vozačke dozvole
};

/**
 * Pravila se primjenjuju redom, prvo poklapanje pobjeđuje. Zato specifičnije
 * (npr. „crveno svjetlo") stoji prije opštijeg („semafor").
 */
const RULES = [
  ["radar-ometac", /ometa(nje)? rad(a)? uređaja za mjerenje brzine|mjerenje brzine kretanja vozila/],
  ["vozilo-neispravno", /radno kočenje|kočnic|kočenj|blokirajući|ABS|amortizer|mjenjač|vratilo|vjetrobran|brisač|blatobran|pneumatik|servo|izduvn|katadiopter|slobodan hod/],
  ["telefon", /telefonsk|mobiln|piše poruke/],
  ["prva-pomoc", /povrijeđen|krvarenj|prv[ae] pomoć|opekotin|imobilizacij|puls|otkucaj|hitne pomoći|smrt|disanj|zavoj|gaz[ae]|rana|ranu|nezgodi.*konzumira/],
  ["alkohol", /alkohol|opojn|psihoaktivn|sedativ/],
  ["dijete-naprijed", /prednjem sjedištu|na prednjem sjedištu do vozača/],
  ["dijete-sjediste", /bezbjednosn\w+ sjedišt|dijete do|prevoz djeteta/],
  ["pojas", /sigurnosn\w+ pojas|naslon za glavu/],
  ["kaciga", /kacig/],
  ["prsluk", /prsluk/],
  ["zimska-oprema", /zimsk\w+ (opremu|upotrebu)|lanac|lanci za snijeg|dubina šare/],
  ["prva-pomoc", /povrijeđen|krvarenj|prv[ae] pomoć|opekotin|imobilizacij|\bpuls\b|otkucaj|hitne pomoći|\bsmrt|disanj|zavoj|\bgaz[ae]\b|\brana\b|\branu\b|nezgodi.*konzumira/],
  ["nezgoda", /saobraćajn\w+ nezgod/],
  ["pruga", /željezničk|Andrejin|branic|polubranic|šinsk\w+ vozil|tramvaj/],
  ["crveno", /crveno svijetlo|žuto svijetlo|crvenom (ili žutom )?svijetlu|crveno ili žuto|prođe semafor/],
  ["kolona-pjesaka", /kolonu pješaka|kolona pješaka|kolonu.*pješak/],
  ["pjesacki-prelaz", /pješačk\w+ prelaz|propust\w* (sve )?pješak|propuštanj\w* pješak|stupio.*pješačk/],
  ["pjesak", /pješak(a|u|om)?\b|pješačko ostrvo|trotoar/],
  ["biciklista", /biciklist|bicikl/],
  ["unazad", /unazad|vožnju unazad/],
  ["preticanje-opasno", /nepregledn\w+ krivin|prevoj|u tunelu.*preti|preti.*u tunelu/],
  ["preticanje", /pretica|pretiče|preticanj|obilažen|obilazi se vozilom/],
  ["mimoilazenje", /mimoilaž|mimoilaz/],
  ["skretanje", /polukružn|skretanj|skreće ulijevo|skreće udesno|obavezan smjer/],
  ["prvenstvo", /prvenstv|propust|propušt|ustupi|redoslijed prolaska|ima pravo prolaska|dolazi sa (njegove |vaše )?desne/],
  ["parkiranje", /parkir|zaustavi ili parkira|zaustavljanj|stajališt|zaustavljeno/],
  ["autoput", /autoput|brz\w+ saobraćajnic|put rezervisan/],
  ["vuca", /vuč|vuk[ao]|tegljač|prikolic|poluprikolic|priključn\w+ vozil/],
  ["teret", /teret\b|teret na|utovar|istovar|nosivost|osovinsko opterećenje|ukupna masa/],
  ["prevoz-lica", /prevoz(i|a)? (lic|putnik|djec)|kamp-prikolic|kamp prikolic/],
  ["policija", /policijsk\w+ službenik|ovlašćen\w+ lice|naredb/],
  ["signalizacija", /saobraćajni znak|saobraćajn\w+ znac|znak izričite naredbe|dopunska tabla|horizontaln\w+ oznak|oznake na kolovozu|linij|strelice na kolovozu|putokaz|semafor|svjetlosn\w+ (saobraćajn\w+ )?znak/],
  ["svjetla", /svijetl|svjetl|far[ao]|katadiopter|maglu/],
  ["zvucni-znak", /zvučn\w+ znak|siren/],
  ["brzina", /brzin|km\/h/],
  ["ukljucivanje", /uključivanj|uključuje u saobraćaj|uključi u saobraćaj|zemljanog puta/],
  ["rastojanje", /odstojanj|rastojanj/],
  ["desna-strana", /desnom (stranom|ivicom)|kolovozn\w+ trak|saobraćajn\w+ trak|prestrojavanj/],
  ["vozacka-dozvola", /vozačk\w+ dozvol/],
  ["vozilo-neispravno", /kočnic|pneumatik|blatobran|brisač|amortizer|mjenjač|servo|ABS|motor|vratilo|vjetrobran|izduvn|oprem\w+ (motornih|vozila)|uređaj(i|a|ima)? za/],
];

function ruleFor(text) {
  for (const [id, re] of RULES) if (re.test(text)) return id;
  return null;
}

const questions = JSON.parse(fs.readFileSync(QUESTIONS, "utf8"));

const rows = questions.map((q) => {
  const id = Object.prototype.hasOwnProperty.call(OVERRIDES, q.id)
    ? OVERRIDES[q.id]
    : ruleFor(`${q.text} ${q.options ? Object.values(q.options).join(" ") : ""}`);
  return [q.id, id];
});

const counts = new Map();
for (const [, id] of rows) counts.set(id, (counts.get(id) ?? 0) + 1);
const sorted = [...counts].sort((a, b) => b[1] - a[1]);

console.log(`Pitanja: ${rows.length}`);
console.log(`Sa kaznom: ${rows.filter(([, id]) => id).length}`);
console.log(`Bez kazne: ${rows.filter(([, id]) => !id).length}`);
console.log("\nRaspodjela:");
for (const [id, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${id ?? "(bez kazne)"}`);

if (report) {
  const none = rows.filter(([, id]) => !id).map(([qid]) => qid);
  if (none.length) console.log(`\nBez kazne (id): ${none.join(", ")}`);
  process.exit(0);
}

const body = rows.map(([qid, id]) => `  ${qid}: ${id === null ? "null" : JSON.stringify(id)},`).join("\n");

const out = `/**
 * GENERISANO — ne mijenjati ručno.
 * Izvor: scripts/gen-penalty-map.mjs (pravila i ručne ispravke su tamo).
 *
 * Veza pitanje → prekršaj iz lib/penalties.ts. \`null\` znači da pitanje nema
 * odgovarajući prekršaj (definicije, uslovi za dozvolu i slično).
 *
 * ⚠️ Veza je stručna procjena, ne pravni stav — MIRAV je pregleda prije objave.
 */

export const PENALTY_BY_QUESTION: Readonly<Record<number, string | null>> = {
${body}
};

/** Prekršaj za pitanje, ili \`null\` ako mu nijedan ne odgovara. */
export function penaltyIdForQuestion(questionId: number): string | null {
  return PENALTY_BY_QUESTION[questionId] ?? null;
}
`;

fs.writeFileSync(OUT, out, "utf8");
console.log(`\nUpisano ${OUT}.`);
