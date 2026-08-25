// Faza 3.1 i 3.2 — fuzz izvlačenja ispita i pokrivenost baze.
//
//   npx tsc lib/questions.ts lib/config.ts lib/types.ts --outDir .tmpbuild \
//     --module esnext --target es2022 --moduleResolution bundler --skipLibCheck
//   sed -i 's#from "./config"#from "./config.js"#; s#from "./types"#from "./types.js"#' .tmpbuild/*.js
//   node qa/fuzz_ispit.mjs
//
// Testira se STVARNI `buildExam` iz lib/questions.ts, ne kopija logike.
import fs from "node:fs";
import crypto from "node:crypto";
import { buildExam, totalPoints } from "../.tmpbuild/questions.js";
import { EXAM_STRUCTURE, EXAM_QUESTION_COUNT, EXAM_PASS_PERCENT, examPassPoints } from "../.tmpbuild/config.js";

const N = 500;
const qs = JSON.parse(fs.readFileSync("public/questions.json", "utf8"));
const byId = new Map(qs.map((q) => [q.id, q]));

// Isječci parova su ZASEBNI fajlovi identičnog sadržaja — poredi se sadržaj, ne ime.
const md5 = (f) => crypto.createHash("md5").update(fs.readFileSync("public/web_images/" + f)).digest("hex");
const hash = new Map();
const slika = (f) => (hash.has(f) ? hash.get(f) : (hash.set(f, md5(f)), hash.get(f)));

let pad = 0;
const greske = new Map();
const fail = (m) => {
  pad++;
  greske.set(m, (greske.get(m) ?? 0) + 1);
};

const OCEKIVANI_SEGMENTI = EXAM_STRUCTURE.map((s) => `${s.kind}:${s.count * (s.withSub ? 2 : 1)}`).join(" ");

const bodovi = [];
const vidjeno = new Map();
const t0 = Date.now();

for (let n = 0; n < N; n++) {
  let slots;
  try {
    slots = buildExam(qs);
  } catch (e) {
    fail(`buildExam bacio grešku: ${e.message}`);
    continue;
  }

  // — tačan broj pitanja
  if (slots.length !== EXAM_QUESTION_COUNT) fail(`broj pitanja ${slots.length} umjesto ${EXAM_QUESTION_COUNT}`);

  // — segmenti u zadatom redoslijedu i tačnoj veličini
  const segs = [];
  for (const s of slots) {
    if (!segs.length || segs.at(-1).i !== s.segment) segs.push({ k: s.kind, i: s.segment, n: 0 });
    segs.at(-1).n++;
  }
  const dobijeni = segs.map((x) => `${x.k}:${x.n}`).join(" ");
  if (dobijeni !== OCEKIVANI_SEGMENTI) fail(`segmenti "${dobijeni}"`);

  // — podpitanje je TAČNO iza svog glavnog i dijeli sliku s njim
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].isSub) continue;
    const prethodni = slots[i - 1];
    if (!prethodni || slots[i].question.subOf !== prethodni.question.id) {
      fail("podpitanje nije odmah iza svog glavnog");
      continue;
    }
    if (slika(slots[i].question.image) !== slika(prethodni.question.image)) fail("par ne dijeli sliku");
  }

  // — nijedno pitanje se ne ponavlja unutar istog testa
  if (new Set(slots.map((s) => s.question.id)).size !== slots.length) fail("ponovljeno pitanje u istom testu");

  // — glavno pitanje segmenta sa podpitanjem mora imati podpitanje
  for (const s of slots) {
    if (!s.isSub && EXAM_STRUCTURE[s.segment].withSub) {
      const ima = qs.some((q) => q.subOf === s.question.id);
      if (!ima) fail("glavno pitanje bez podpitanja u segmentu withSub");
    }
  }

  bodovi.push(totalPoints(slots.map((s) => s.question)));
  for (const s of slots) vidjeno.set(s.question.id, (vidjeno.get(s.question.id) ?? 0) + 1);
}

const ms = (Date.now() - t0) / N;
bodovi.sort((a, b) => a - b);
const zbir = bodovi.reduce((a, b) => a + b, 0);

console.log("=".repeat(78));
console.log(`3.1  FUZZ — ${N} IZVLAČENJA`);
console.log("=".repeat(78));
console.log(`grešaka: ${pad}`);
for (const [m, n] of greske) console.log(`   ${n}×  ${m}`);
console.log(`očekivani segmenti: ${OCEKIVANI_SEGMENTI}`);
console.log(`vrijeme po ispitu: ${ms.toFixed(3)} ms`);
console.log();
console.log(`bodovi po testu NIJESU fiksni (dolaze iz baze):`);
console.log(`   min ${bodovi[0]}  p25 ${bodovi[N >> 2]}  medijana ${bodovi[N >> 1]}  ` +
  `p75 ${bodovi[Math.floor(N * 0.75)]}  max ${bodovi[N - 1]}  prosjek ${(zbir / N).toFixed(1)}`);
console.log(`   prag ${EXAM_PASS_PERCENT}% tog testa: ${examPassPoints(bodovi[0])}–${examPassPoints(bodovi[N - 1])} bodova`);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log(`3.2  POKRIVENOST BAZE KROZ ${N} IZVLAČENJA`);
console.log("=".repeat(78));

const nikad = qs.filter((q) => !vidjeno.has(q.id));
console.log(`različitih pitanja ikad izvučeno: ${vidjeno.size} od ${qs.length}`);
console.log(`nikad izvučeno: ${nikad.length}`);
const nikadPoKindu = {};
for (const q of nikad) nikadPoKindu[q.kind] = (nikadPoKindu[q.kind] ?? 0) + 1;
if (nikad.length) {
  console.log(`   po kategoriji: ${JSON.stringify(nikadPoKindu)}`);
  const bezPod = nikad.filter((q) => !qs.some((x) => x.subOf === q.id) && q.subOf === undefined);
  console.log(`   od toga bez podpitanja (zato i ne mogu ući): ${bezPod.length}`);
}

console.log(`\n${"kind".padEnd(11)}${"u bazi".padStart(8)}${"dostupno".padStart(10)}${"izvlači se".padStart(12)}` +
  `${"šansa/ispit".padStart(13)}${"viđeno".padStart(9)}`);
console.log("-".repeat(64));
const podpitanja = new Set(qs.filter((q) => q.subOf !== undefined).map((q) => q.id));
for (const seg of EXAM_STRUCTURE) {
  const svi = qs.filter((q) => q.kind === seg.kind);
  const dostupni = svi.filter(
    (q) => !podpitanja.has(q.id) && (!seg.withSub || qs.some((x) => x.subOf === q.id)),
  );
  const izvlaci = seg.count;
  const sansa = dostupni.length ? (izvlaci / dostupni.length) * 100 : 0;
  const vid = svi.filter((q) => vidjeno.has(q.id)).length;
  console.log(
    seg.kind.padEnd(11) + String(svi.length).padStart(8) + String(dostupni.length).padStart(10) +
    String(izvlaci).padStart(12) + `${sansa.toFixed(1)}%`.padStart(13) + `${vid}/${svi.length}`.padStart(9),
  );
}

console.log("\nponavljanje — koliko kandidat mora odraditi ispita da vidi isto pitanje:");
for (const seg of EXAM_STRUCTURE) {
  const dostupni = qs.filter(
    (q) => q.kind === seg.kind && q.subOf === undefined && (!seg.withSub || qs.some((x) => x.subOf === q.id)),
  ).length;
  const ocekivano = dostupni ? dostupni / seg.count : Infinity;
  const upozorenje = dostupni < 6 ? "  ⚠️ ISPOD 6 — kandidat ih nauči napamet" : "";
  console.log(`   ${seg.kind.padEnd(11)} ${dostupni} dostupnih / ${seg.count} po ispitu ` +
    `→ isto pitanje otprilike svaki ${ocekivano.toFixed(1)}. ispit${upozorenje}`);
}

console.log(`\n${pad === 0 ? "3.1 BEZ GREŠAKA" : `3.1 PALO: ${pad}`}`);
process.exit(pad ? 1 : 0);
