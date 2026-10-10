// Faza 3.3 — bodovanje: test nosi tačno 80 bodova, za prolaz treba najmanje 68.
//
//   (prvo izgradi .tmpbuild, vidi qa/fuzz_ispit.mjs)
//   node qa/bodovanje.mjs
//
// Formule prolaza i procenta su prepisane iz components/ResultCard.tsx:
//     const percent = Math.round((scored / maxPoints) * 100);
//     const passed  = scored >= EXAM_PASS_POINTS;
// Ako se tamo promijene, ovaj test to neće primijetiti — zato je i citiran.
import fs from "node:fs";
import { buildExam, examPoints } from "../.tmpbuild/questions.js";
import { EXAM_PASS_POINTS, EXAM_TOTAL_POINTS } from "../.tmpbuild/config.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "PASS  " : "FAIL  ") + m); };

const prosao = (scored) => scored >= EXAM_PASS_POINTS;
const procenat = (scored, max) => (max > 0 ? Math.round((scored / max) * 100) : 0);
const MAX = EXAM_TOTAL_POINTS;

console.log("=".repeat(78));
console.log(`3.3  BODOVANJE  (${EXAM_PASS_POINTS} od ${MAX})`);
console.log("=".repeat(78));

ok(MAX === 80 && EXAM_PASS_POINTS === 68, `ukupno ${MAX}, prag ${EXAM_PASS_POINTS}`);

// — svaki sastavljen test nosi tačno 80
{
  const qs = JSON.parse(fs.readFileSync("public/questions.json", "utf8"));
  const zbirovi = new Set(Array.from({ length: 500 }, () => examPoints(buildExam(qs))));
  ok(zbirovi.size === 1 && zbirovi.has(MAX), `500 testova, zbirovi: ${[...zbirovi].join(", ")}`);
}

ok(prosao(MAX) && procenat(MAX, MAX) === 100, "svi tačni → 100%, položeno");
ok(!prosao(0) && procenat(0, MAX) === 0, "svi netačni → 0%, pad");
ok(prosao(68), "68/80 → POLOŽENO (dokaz da je >= a ne >)");
ok(!prosao(67), "67/80 → PAD");

// — neodgovoreno je 0 bodova i ostaje u imeniocu
ok(procenat(60, MAX) === 75 && !prosao(60), "60/80 (ostalo neodgovoreno) = 75%, pad");

// — prikazani procenat nikad ne protivrječi ishodu
{
  const zamke = [];
  for (let s = 0; s <= MAX; s++) {
    const p = procenat(s, MAX);
    if ((p >= 85) !== prosao(s)) zamke.push(`${s}/${MAX} = ${p}%`);
  }
  ok(zamke.length === 0, `procenat ≥85% ⇔ položeno za svih ${MAX + 1} rezultata` + (zamke.length ? `: ${zamke.join("; ")}` : ""));
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
