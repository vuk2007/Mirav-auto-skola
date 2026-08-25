#!/usr/bin/env node
/**
 * Upisuje `kind` i `subOf` u public/questions.json — metapodatke od kojih zavisi
 * sastav simulacije ispita.
 *
 *   node scripts/gen-exam-meta.mjs --report   # samo ispiši nalaz, ne diraj bazu
 *   node scripts/gen-exam-meta.mjs            # upiši u questions.json
 *
 * `kind` je vrsta pitanja (znak / teorija / policajac / kosnik / situacija) i
 * NEZAVISAN je od `area` (I/II/III). `area` ostaje kakav jeste i koristi se u
 * vježbi; `kind` određuje segmente ispita (EXAM_STRUCTURE u lib/config.ts).
 *
 * `firstAid` označava pitanja o prvoj pomoći. Ono NE dira `kind` — ta pitanja
 * ostaju `teorija` i i dalje ulaze u teorijski segment ispita, kao i na pravom
 * ispitu. Služi samo kao zaseban filter u vježbi.
 *
 * `subOf` je id glavnog pitanja kod podpitanja. U zvaničnom katalogu jedna
 * slika nosi dva pitanja („kako ćete postupiti…" + „redoslijed prolaska…"), a
 * parser ih je izvukao kao dva zasebna pitanja sa dva identična isječka. Par se
 * prepoznaje po: ista strana + uzastopni `local_no` + **bajt-identičan fajl
 * slike**. Poređenje ide nad sirovim bajtovima, pa skripta ne treba dekoder
 * slika. Provjereno: 91 par, nijedna trojka, nijedno pitanje u dva para.
 *
 * Zašto skripta a ne ručna tabela: pravila se mogu pročitati i osporiti, a
 * ispravke idu u OVERRIDES ispod. Aplikacija ne radi nikakvo poklapanje po
 * riječima — čita gotova polja.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const QUESTIONS = path.join("public", "questions.json");
const IMAGES = path.join("public", "web_images");
const report = process.argv.includes("--report");

/**
 * Pitanja o prvoj pomoći — zaseban filter u vježbi (kategorija „Prva pomoć").
 *
 * Prepoznaju se po sadržaju, jer u katalogu nijesu u jednom bloku: na stranama
 * 44–48 su izmiješana sa pitanjima o uređajima na vozilu (id 380 prva pomoć,
 * 382 vidljivost, 385 prva pomoć, 387 upravljač…).
 */
const FIRST_AID_RE =
  /prv[aeouy]\w* pomoć|povrijeđen|povred|opekotin|imobilizac|krvarenj|krvari|otkucaj\w* srca|mrtvačk|bez svijesti|hitne pomoći|broj policije|vatrogasn/i;

/**
 * Izuzeci od `FIRST_AID_RE` — pravilo ih pokupi, a ne pripadaju.
 * `true` bi značilo obrnuto: dodaj pitanje koje pravilo ne hvata.
 */
const FIRST_AID_OVERRIDES = {
  392: false, // „Od određene opreme u autobusu…" — broj kutija prve pomoći je
  //           pitanje o opremi vozila, ne o pružanju pomoći.
  390: false, // „Kada dođe do umora tokom vožnje…" — higijena vožnje. Granično;
  //           ako MIRAV smatra da spada u medicinski dio, promijeni u `true`.
};

/** Ručne ispravke — imaju prednost nad pravilima. */
const OVERRIDES = {
  // Komande policajca koje ne imenuju policajca — opisuju samo položaj ruke.
  // Pravilo ih ne može uhvatiti bez da pokupi i znake koje daje vozač rukom.
  339: "policajac", // „Horizontalno predručena ruka, kao na slici obavezuje:"
  363: "policajac", // „Kombinovani znak podizanje ruke i upotreba pištaljke…"
  371: "policajac", // „Vetikalno podignuta ruka, kao na slici znači:"
};

/**
 * Pravila se primjenjuju redom, prvo poklapanje pobjeđuje.
 *
 * Odstupanja od prvobitnog predloga, i zašto:
 *
 * 1. `policajac` traži „policijski službenik" ili „ovlašćeno lice", NE samo
 *    „policijsk". Golo „policijsk" pokupi i „policijsko vozilo" (id 129, 133,
 *    252), a to su situacijska pitanja o vozilu sa pravom prvenstva, ne o
 *    komandama policajca. Traži se i slika — id 16 je čista teorija.
 *
 * 2. `kosnik` traži granicu riječi (`\bgraničnik`). Bez nje `granič` pokupi
 *    „ograničenje brzine" i pola teorije o brzinama (18 lažnih pogodaka).
 *    „prelaz preko pruge" NIJE uključen: to su znakovi ili situacije, a kosnik
 *    i graničnik su oznake uz prugu koje se u katalogu izričito imenuju.
 *
 * 3. `znak` prihvata i množinu (`znaci`, `znakovi`) — to je bila greška zbog
 *    koje su pitanja o znakovima nosila badge druge oblasti.
 */
const RULES = [
  ["policajac", (q) => q.image && /policijsk\w*\s+službenik|ovlašćen\w+\s+(policijsk\w+\s+)?lic/i.test(q.text)],
  ["kosnik", (q) => /\bkosnik|\bgraničnik/i.test(`${q.text} ${optText(q)}`)],
  ["znak", (q) => q.image && /saobraćajn\w*\s+znak\w*|znak\w*\s+obavještenja|znak\w*\s+izričite naredbe|dopunsk\w+\s+tabl/i.test(q.text)],
  ["teorija", (q) => !q.image],
  ["situacija", (q) => Boolean(q.image)],
];

function optText(q) {
  return q.options ? Object.values(q.options).join(" ") : "";
}

function firstAidFor(q) {
  if (Object.prototype.hasOwnProperty.call(FIRST_AID_OVERRIDES, q.id)) {
    return FIRST_AID_OVERRIDES[q.id];
  }
  return FIRST_AID_RE.test(`${q.text} ${optText(q)}`);
}

function kindFor(q) {
  if (Object.prototype.hasOwnProperty.call(OVERRIDES, q.id)) return OVERRIDES[q.id];
  for (const [kind, test] of RULES) if (test(q)) return kind;
  return "ostalo";
}

const raw = fs.readFileSync(QUESTIONS, "utf8");
const crlf = raw.includes("\r\n");
const questions = JSON.parse(raw);
for (const q of questions) {
  q.kind = kindFor(q);
  if (firstAidFor(q)) q.firstAid = true;
  else delete q.firstAid;
}

// ── uparivanje glavno pitanje + podpitanje ────────────────────────────────
const digest = new Map();
for (const q of questions) {
  if (!q.image) continue;
  digest.set(q.id, crypto.createHash("md5").update(fs.readFileSync(path.join(IMAGES, q.image))).digest("hex"));
}
const ordered = [...questions].sort((a, b) => a.page - b.page || a.local_no - b.local_no);
for (const q of questions) delete q.subOf;

const pairs = [];
for (let i = 0; i < ordered.length - 1; ) {
  const a = ordered[i];
  const b = ordered[i + 1];
  const paired =
    a.page === b.page &&
    b.local_no - a.local_no === 1 &&
    a.image &&
    b.image &&
    digest.get(a.id) === digest.get(b.id);
  if (!paired) {
    i += 1;
    continue;
  }
  b.subOf = a.id; // podpitanje pamti glavno; glavno ne pamti ništa
  pairs.push([a, b]);
  i += 2; // pitanje ne može biti i glavno i podpitanje
}

const counts = new Map();
for (const q of questions) counts.set(q.kind, (counts.get(q.kind) ?? 0) + 1);

console.log(`Pitanja: ${questions.length}\n`);
console.log("Raspodjela po `kind`:");
for (const [k, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
}

// Kapacitet naspram sastava ispita — ovo je razlog zašto skripta postoji.
const NEED = { znak: 10, teorija: 20, policajac: 1, kosnik: 1, situacija: 4 };
console.log("\nKapacitet naspram EXAM_STRUCTURE:");
let blocked = false;
for (const [k, need] of Object.entries(NEED)) {
  const have = counts.get(k) ?? 0;
  const ok = have >= need;
  if (!ok) blocked = true;
  console.log(
    `  ${k.padEnd(11)} treba ${String(need).padStart(3)}  ima ${String(have).padStart(4)}  ` +
      `${ok ? `u redu (${(have / need).toFixed(1)}× rezerve)` : "!!! NEDOVOLJNO — SIMULACIJA NE MOŽE DA SE SASTAVI"}`,
  );
}
if (blocked) console.log("\n  ⚠️  BLOKADA: bar jedna kategorija nema dovoljno pitanja.");

const prvaPomoc = questions.filter((q) => q.firstAid);
console.log(`\nPrva pomoc: ${prvaPomoc.length} pitanja (zaseban filter u vjezbi, \`kind\` ostaje netaknut)`);
for (const q of prvaPomoc) {
  console.log(`  id=${String(q.id).padStart(3)} str.${q.page}/${q.local_no} ${q.kind.padEnd(10)} ${q.text.slice(0, 66)}`);
}

console.log(`\nParova glavno+podpitanje: ${pairs.length} (${pairs.length * 2} pitanja od ${questions.length})`);
const pairMains = new Map();
for (const [a] of pairs) pairMains.set(a.kind, (pairMains.get(a.kind) ?? 0) + 1);
console.log("Glavnih pitanja sa podpitanjem, po kategoriji:");
for (const [k, n] of [...pairMains].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);
const SUB_NEED = { policajac: 1, situacija: 4 };
for (const [k, need] of Object.entries(SUB_NEED)) {
  const have = pairMains.get(k) ?? 0;
  if (have < need) {
    blocked = true;
    console.log(`  ⚠️  ${k}: ispit traži ${need} sa podpitanjem, a ima ih ${have}.`);
  }
}

console.log("\n10 primjera parova:");
for (const [a, b] of pairs.slice(0, 10)) {
  console.log(`  str.${String(a.page).padStart(3)} q${a.local_no}/${b.local_no}  [${a.kind}]  ${a.id} + ${b.id}  (${a.image} = ${b.image})`);
  console.log(`      glavno: ${a.text.slice(0, 74)}`);
  console.log(`      pod   : ${b.text.slice(0, 74)}`);
}

// Nasumični primjeri po kategoriji, za ručnu provjeru klasifikacije.
let seed = 20260823;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
console.log("\nPo 5 nasumičnih primjera iz svake kategorije:");
for (const [k] of [...counts].sort((a, b) => b[1] - a[1])) {
  const pool = questions.filter((q) => q.kind === k);
  const pick = [...pool].sort(() => rnd() - 0.5).slice(0, 5);
  console.log(`\n  ── ${k} (${pool.length}) ──`);
  for (const q of pick) {
    console.log(`    id=${String(q.id).padStart(3)} area=${String(q.area).padEnd(3)} ${q.image ? "slika" : "tekst"}  ${q.text.slice(0, 70)}`);
  }
}

if (report) {
  console.log("\n(--report: questions.json nije mijenjan)");
  process.exit(blocked ? 1 : 0);
}

const out = JSON.stringify(questions, null, 2) + "\n";
fs.writeFileSync(QUESTIONS, crlf ? out.replace(/\n/g, "\r\n") : out, "utf8");
console.log(`\nUpisano \`kind\` i \`subOf\` u ${QUESTIONS}.`);
